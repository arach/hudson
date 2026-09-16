import AppKit
import IOSurface

@main struct ClientMain {
    static func main() throws {
        // Deterministic local contract checks precede the real process test.
        var leases = FrameLeases()
        let first = leases.acquire()!, second = leases.acquire()!, third = leases.acquire()!
        require(leases.acquire() == nil, "Pool must stay bounded at three")
        require(!leases.release(99), "Unknown acknowledgement rejected")
        require(leases.release(second.sequence), "Held frame can be released")
        require(!leases.release(second.sequence), "Duplicate acknowledgement rejected")
        let replacement = leases.acquire()!
        require(replacement.slot == second.slot && replacement.sequence != second.sequence, "Recycled slot gets a new sequence")
        require(!leases.release(second.sequence), "Stale acknowledgement cannot free recycled slot")
        require(leases.release(first.sequence) && leases.release(third.sequence), "Other leases remain valid")

        let connection = NSXPCConnection(serviceName: "dev.hudson.TerminalIsolationProbe.Worker")
        connection.remoteObjectInterface = serviceInterface()
        connection.resume()
        defer { connection.invalidate() }
        let proxy = connection.remoteObjectProxyWithErrorHandler { error in
            fputs("XPC error: \(error)\n", stderr)
        } as! ProbeService
        let identity: (Int32, Int) = reply { done in proxy.hello { done(($0, $1)) } }
        require(identity.0 != getpid() && identity.1 == 1, "Separate helper process and protocol version")
        func acquire() -> (IOSurface?, UInt64) { reply { done in proxy.acquireFrame { done(($0, $1)) } } }
        let frames = [acquire(), acquire(), acquire()]
        require(frames.allSatisfy { $0.0 != nil && $0.1 > 0 }, "IOSurfaces transferred over XPC")
        require(Set(frames.map { IOSurfaceGetID($0.0!) }).count == 3, "Distinct buffers")
        require(acquire().0 == nil, "Remote pool has bounded outstanding frames")
        for (surface, sequence) in frames {
            require(pixel(surface!) == ProbeFrame.pixel(sequence), "Shared surface pixels match producer")
        }
        let before: UInt64 = reply { proxy.heartbeat(reply: $0) }
        // Deliberately block the client main thread. The separate worker must
        // continue progressing, and held buffers must remain immutable.
        Thread.sleep(forTimeInterval: 0.25)
        let after: UInt64 = reply { proxy.heartbeat(reply: $0) }

        for (surface, sequence) in frames {
            require(pixel(surface!) == ProbeFrame.pixel(sequence), "Held frame not overwritten while client stalled")
        }
        let released: Bool = reply { proxy.releaseFrame(frames[0].1, reply: $0) }
        require(released, "Release accepted")
        let fresh = acquire()
        require(fresh.0 != nil && fresh.1 > frames[2].1, "Fresh frame after release")
        let staleAccepted: Bool = reply { proxy.releaseFrame(frames[0].1, reply: $0) }
        require(!staleAccepted && acquire().0 == nil, "Stale ACK did not free fresh frame")
        let result: [String: Any] = ["status": "PASS", "clientPID": getpid(), "workerPID": identity.0,
            "protocolVersion": identity.1, "outstandingFrameLimit": 3, "workerTicksDuringClientStall": after - before,
            "surfaceIDs": frames.map { IOSurfaceGetID($0.0!) }, "checks": ["bounded frame leases", "duplicate/stale ACK rejection", "separate process", "IOSurface IPC", "producer GPU completion and pixel integrity", "held-buffer immutability"],
            "limits": ["Synthetic Metal producer; no PTY or Ghostty renderer", "No input or production authentication tested", "Explicit release is fixture completion; production release requires GPU completion"]]
        // Return every diagnostic lease before starting the one-in-flight presenter.
        for sequence in [frames[1].1, frames[2].1, fresh.1] {
            let accepted: Bool = reply { proxy.releaseFrame(sequence, reply: $0) }
            require(accepted, "Diagnostic lease cleanup")
        }
        if CommandLine.arguments.contains("--window") {
            let app = NSApplication.shared
            app.setActivationPolicy(.accessory)
            let view = ProbeTerminalView(frame: NSRect(x: 0, y: 0, width: 512, height: 256))
            let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "Hudson terminal isolation — synthetic GPU fixture"
            window.contentView = view
            window.center(); window.orderFrontRegardless(); view.layoutSubtreeIfNeeded()
            let presenter = try ProbePresenter(layer: view.metalLayer, proxy: proxy)
            presenter.start()
            DispatchQueue.global(qos: .userInitiated).async {
                let deadline = Date().addingTimeInterval(5)
                while presenter.snapshot().completed < 3 && Date() < deadline { Thread.sleep(forTimeInterval: 0.02) }
                require(presenter.snapshot().completed >= 3, "AppKit Metal presentation starts")
                let started = DispatchSemaphore(value: 0), stalled = DispatchSemaphore(value: 0)
                DispatchQueue.main.async {
                    started.signal()
                    Thread.sleep(forTimeInterval: 0.5)
                    stalled.signal()
                }
                require(started.wait(timeout: .now() + 2) == .success, "Main-thread stall starts")
                let before = presenter.snapshot().completed
                Thread.sleep(forTimeInterval: 0.3)
                let after = presenter.snapshot().completed
                require(stalled.wait(timeout: .now()) == .timedOut, "Main thread remains stalled throughout GPU sample")
                require(after > before, "GPU presenter progresses during main-thread stall")
                require(stalled.wait(timeout: .now() + 2) == .success, "Main-thread stall ends")
                let stopped = DispatchSemaphore(value: 0)
                presenter.stop { stopped.signal() }
                require(stopped.wait(timeout: .now() + 5) == .success, "Presenter drains GPU lease before stop")
                let snapshot = presenter.snapshot()
                require(snapshot.failures.isEmpty, "Presenter errors: \(snapshot.failures)")
                var visualResult = result
                visualResult["presentation"] = ["completedFrames": snapshot.completed,
                    "gpuCompletionsDuringMainStall": after - before, "mainThreadStallMS": 500, "sampleWithinStallMS": 300,
                    "errors": snapshot.failures, "view": "AppKit NSView + CAMetalLayer",
                    "verification": "GPU drawable pixel readback before lease ACK; scanout not measured"]
                visualResult["limits"] = ["Synthetic Metal producer; no PTY/Ghostty or input/IME",
                    "GPU completion is not a visible scanout measurement", "Fixed-size pool; no production authentication or recovery"]
                emit(visualResult)
                DispatchQueue.main.async { window.orderOut(nil); app.stop(nil)
                    // Wake NSApplication's event wait so its run loop can return.
                    let event = NSEvent.otherEvent(with: .applicationDefined, location: .zero, modifierFlags: [],
                        timestamp: 0, windowNumber: 0, context: nil, subtype: 0, data1: 0, data2: 0)!
                    app.postEvent(event, atStart: false)
                }
            }
            app.run()
            withExtendedLifetime((presenter, window)) {}
        } else { emit(result) }
    }
    static func emit(_ result: [String: Any]) {
        print(String(data: try! JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
    }
}
