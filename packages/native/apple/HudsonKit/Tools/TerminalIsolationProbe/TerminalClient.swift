import AppKit
import IOSurface

@main struct TerminalClientMain {
    static func main() throws {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let connection = NSXPCConnection(serviceName: "dev.hudson.TerminalIsolationProbe.Worker")
        connection.remoteObjectInterface = terminalServiceInterface()
        connection.resume()
        defer { connection.invalidate() }
        let proxy = connection.remoteObjectProxyWithErrorHandler { error in
            fputs("Terminal XPC: \(error)\n", stderr)
        } as! TerminalProbeService
        let identity: (Int32, Int) = reply { done in proxy.hello { done(($0, $1)) } }
        require(identity.0 != getpid() && identity.1 == 2, "Separate live Ghostty worker")
        let frame: (IOSurface?, UInt64) = reply { done in proxy.acquireFrame { done(($0, $1)) } }
        require(frame.0 != nil && frame.1 > 0, "Actual Ghostty frame exported")
        // A text-bearing frame must have many non-background pixels. Retry a
        // bounded number of startup frames; the first can precede PTY output.
        func contrastingPixels(_ surface: IOSurface) -> Int {
            require(surface.lock(options: .readOnly, seed: nil) == 0, "Terminal frame CPU read lock")
            defer { _ = surface.unlock(options: .readOnly, seed: nil) }
            let words = surface.baseAddress.assumingMemoryBound(to: UInt32.self)
            let background = words[0]
            return (0..<(surface.allocationSize / 4)).reduce(0) { $0 + (words[$1] != background ? 1 : 0) }
        }
        var held = frame, glyphPixels = contrastingPixels(frame.0!)
        for _ in 0..<20 where glyphPixels < 100 {
            let accepted: Bool = reply { proxy.releaseFrame(held.1, reply: $0) }
            require(accepted, "Startup frame released")
            held = reply { done in proxy.acquireFrame { done(($0, $1)) } }
            require(held.0 != nil, "Next terminal frame")
            glyphPixels = contrastingPixels(held.0!)
        }
        require(glyphPixels > 100, "Terminal glyph pixels rendered")
        let accepted: Bool = reply { proxy.releaseFrame(held.1, reply: $0) }
        require(accepted, "Inspected terminal frame released")
        let terminalPID: Int32 = reply { proxy.processID(reply: $0) }
        require(terminalPID > 0 && terminalPID != getpid() && terminalPID != identity.0, "Separate worker-owned PTY process")
        let view = ProbeTerminalView(frame: NSRect(x: 0, y: 0, width: 768, height: 384))
        let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Hudson — real Ghostty over XPC"
        window.contentView = view
        window.center(); window.orderFrontRegardless(); view.layoutSubtreeIfNeeded()
        let presenter = try ProbePresenter(layer: view.metalLayer, proxy: proxy, verifySyntheticPixel: false)
        presenter.start()
        DispatchQueue.global(qos: .userInitiated).async {
            let warmupDeadline = Date().addingTimeInterval(5)
            while presenter.snapshot().completed < 3 && Date() < warmupDeadline { Thread.sleep(forTimeInterval: 0.02) }
            require(presenter.snapshot().completed >= 3, "Real terminal presentation starts")
            let started = DispatchSemaphore(value: 0), ended = DispatchSemaphore(value: 0)
            DispatchQueue.main.async { started.signal(); Thread.sleep(forTimeInterval: 0.5); ended.signal() }
            require(started.wait(timeout: .now() + 2) == .success, "Host main stall starts")
            let before = presenter.snapshot().completed
            Thread.sleep(forTimeInterval: 0.3)
            let during = presenter.snapshot().completed
            require(ended.wait(timeout: .now()) == .timedOut && during > before, "Ghostty frames progress entirely within host main stall")
            require(ended.wait(timeout: .now() + 2) == .success, "Host stall ends")
            let readyDeadline = Date().addingTimeInterval(8)
            var text = ""
            repeat {
                text = reply { proxy.readScreen(reply: $0) }
                if text.contains("INPUT_READY") { break }
                Thread.sleep(forTimeInterval: 0.1)
            } while Date() < readyDeadline
            require(text.contains("INPUT_READY"), "Worker PTY output parsed")
            let inputAccepted: Bool = reply { proxy.writeInput(Data("ipc-input-verified\r".utf8), reply: $0) }
            require(inputAccepted, "Input delivered to worker terminal")
            let echoDeadline = Date().addingTimeInterval(5)
            repeat {
                text = reply { proxy.readScreen(reply: $0) }
                if text.contains("HUDSON_ECHO:ipc-input-verified") { break }
                Thread.sleep(forTimeInterval: 0.05)
            } while Date() < echoDeadline
            require(text.contains("HUDSON_ECHO:ipc-input-verified"), "Round-trip PTY input/output")
            let stopped = DispatchSemaphore(value: 0)
            presenter.stop { stopped.signal() }
            require(stopped.wait(timeout: .now() + 5) == .success, "Presenter cancels pending frame and drains GPU")
            let snapshot = presenter.snapshot()
            require(snapshot.failures.isEmpty, "Terminal presenter errors: \(snapshot.failures)")
            // Hold all three export credits while continuing PTY input/output.
            // The terminal must keep parsing and recover its latest frame when
            // one credit returns, even with a hidden/non-blinking cursor.
            var heldFrames: [(IOSurface, UInt64)] = []
            func hash(_ surface: IOSurface) -> UInt64 {
                require(surface.lock(options: .readOnly, seed: nil) == 0, "Held frame lock")
                defer { _ = surface.unlock(options: .readOnly, seed: nil) }
                let words = surface.baseAddress.assumingMemoryBound(to: UInt32.self)
                return (0..<(surface.allocationSize / 4)).reduce(UInt64(14695981039346656037)) { ($0 ^ UInt64(words[$1])) &* 1099511628211 }
            }
            for index in 0..<3 {
                let sent: Bool = reply { proxy.writeInput(Data("credit-\(index)\r".utf8), reply: $0) }
                require(sent, "Credit test input")
                let frame: (IOSurface?, UInt64) = reply { done in proxy.acquireFrame { done(($0, $1)) } }
                require(frame.0 != nil, "Credit test frame")
                heldFrames.append((frame.0!, frame.1))
            }
            let heldHashes = heldFrames.map { hash($0.0) }
            let initialCounts: (UInt64, UInt64) = reply { done in proxy.frameStatistics { done(($0, $1)) } }
            let finalInput: Bool = reply { proxy.writeInput(Data("after-backpressure\r".utf8), reply: $0) }
            require(finalInput, "Input remains accepted without frame credits")
            let parseDeadline = Date().addingTimeInterval(3)
            repeat {
                text = reply { proxy.readScreen(reply: $0) }
                if text.contains("HUDSON_ECHO:after-backpressure") { break }
                Thread.sleep(forTimeInterval: 0.02)
            } while Date() < parseDeadline
            require(text.contains("HUDSON_ECHO:after-backpressure"), "PTY parsing progresses under frame backpressure")
            Thread.sleep(forTimeInterval: 0.1)
            let fullCounts: (UInt64, UInt64) = reply { done in proxy.frameStatistics { done(($0, $1)) } }
            require(fullCounts.1 > initialCounts.1, "Renderer skips exports at bounded credit limit")
            require(heldFrames.map { hash($0.0) } == heldHashes, "Held Ghostty export buffers remain immutable")
            let released: Bool = reply { proxy.releaseFrame(heldFrames[0].1, reply: $0) }
            require(released, "Return one export credit")
            let recovered: (IOSurface?, UInt64) = reply { done in proxy.acquireFrame { done(($0, $1)) } }
            require(recovered.0 != nil && recovered.1 > heldFrames.map { $0.1 }.max()!, "Current frame resumes after credit return")
            require(hash(recovered.0!) != heldHashes[0], "Recovered frame contains changed pixels")
            if let output = ProcessInfo.processInfo.environment["HUDSON_TERMINAL_PROBE_OUTPUT"] {
                let surface = recovered.0!
                require(surface.lock(options: .readOnly, seed: nil) == 0, "Evidence frame lock")
                let bytes = Data(bytes: surface.baseAddress, count: surface.allocationSize)
                _ = surface.unlock(options: .readOnly, seed: nil)
                let provider = CGDataProvider(data: bytes as CFData)!
                let colorSpace = CGColorSpace(name: CGColorSpace.displayP3)!
                let info = CGBitmapInfo.byteOrder32Little.union(CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue))
                let image = CGImage(width: surface.width, height: surface.height, bitsPerComponent: 8, bitsPerPixel: 32,
                    bytesPerRow: surface.bytesPerRow, space: colorSpace, bitmapInfo: info, provider: provider,
                    decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
                let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
                do { try png.write(to: URL(fileURLWithPath: output).appendingPathComponent("terminal-frame.png")) }
                catch { require(false, "Save terminal frame evidence: \(error)") }
            }
            let staleAccepted: Bool = reply { proxy.releaseFrame(heldFrames[0].1, reply: $0) }
            require(!staleAccepted, "Stale ACK cannot release recovered terminal frame")
            for token in [heldFrames[1].1, heldFrames[2].1, recovered.1] {
                let accepted: Bool = reply { proxy.releaseFrame(token, reply: $0) }
                require(accepted, "Final terminal frame cleanup")
            }
            let shutdown = DispatchSemaphore(value: 0)
            proxy.shutdown { shutdown.signal() }
            require(shutdown.wait(timeout: .now() + 5) == .success, "Worker terminal shutdown")
            let exitDeadline = Date().addingTimeInterval(2)
            while kill(terminalPID, 0) == 0 && Date() < exitDeadline { Thread.sleep(forTimeInterval: 0.02) }
            require(kill(terminalPID, 0) == -1 && errno == ESRCH, "PTY process reaped after shutdown")
            let result: [String: Any] = ["status": "PASS", "clientPID": getpid(), "workerPID": identity.0,
                "terminalPID": terminalPID, "engine": "Patched Ghostty 07d31666e", "protocolVersion": 2,
                "glyphPixels": glyphPixels, "skippedExportsWhileBackpressured": fullCounts.1 - initialCounts.1, "completedFrames": snapshot.completed,
                "gpuCompletionsDuringMainStall": during - before, "sampleWithinStallMS": 300,
                "checks": ["real worker PTY", "Ghostty glyph rendering", "IOSurface GPU export", "AppKit Metal presentation", "presentation during host main stall", "PTY input/output round trip", "bounded frame backpressure without lost PTY output", "idle credit recovery", "held-buffer immutability", "explicit terminal shutdown and PTY reap"],
                "limits": ["Fixed-size diagnostic fixture; no full keyboard/IME/selection/AX or resize recovery", "GPU completion does not measure scanout"]]
            print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
            DispatchQueue.main.async {
                window.orderOut(nil); app.stop(nil)
                let event = NSEvent.otherEvent(with: .applicationDefined, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, subtype: 0, data1: 0, data2: 0)!
                app.postEvent(event, atStart: false)
            }
        }
        app.run()
        withExtendedLifetime((presenter, window)) {}
    }
}
