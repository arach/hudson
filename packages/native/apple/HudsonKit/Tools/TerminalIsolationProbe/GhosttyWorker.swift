import AppKit
import GhosttyKit
import IOSurface
import Metal

// Isolated real-engine fixture, not a stable Hudson session API. The worker
// owns the actual PTY, parser, renderer and every exported frame allocation.
final class GhosttyWorker: NSObject, TerminalProbeService {
    private let storage = GPUProducer()!
    private let lock = NSLock()
    private var leases = FrameLeases()
    private var ready: (IOSurface, UInt64)?
    private var waiting: ((IOSurface?, UInt64) -> Void)?
    private var needsRefresh = false
    private var latestCompleted: UInt64 = 0
    private var exported: UInt64 = 0
    private var skipped: UInt64 = 0
    private var stopped = false
    private var config: ghostty_config_t?
    private var app: ghostty_app_t?
    private var surface: ghostty_surface_t?
    private var pendingTick = false
    private let anchor = NSView(frame: NSRect(x: 0, y: 0, width: ProbeFrame.width, height: ProbeFrame.height))

    func start() {
        precondition(Thread.isMainThread)
        precondition(ghostty_init(0, nil) == GHOSTTY_SUCCESS)
        config = ghostty_config_new()
        guard let config else { fatalError("Ghostty config") }
        ghostty_config_set_font_size(config, 14)
        _ = "Menlo".withCString { ghostty_config_set_font_family(config, $0, 5) }
        ghostty_config_finalize(config)
        var runtime = ghostty_runtime_config_s(
            userdata: Unmanaged.passUnretained(self).toOpaque(), supports_selection_clipboard: false,
            wakeup_cb: { userdata in
                guard let userdata else { return }
                let worker = Unmanaged<GhosttyWorker>.fromOpaque(userdata).takeUnretainedValue()
                DispatchQueue.main.async { worker.scheduleTick() }
            },
            action_cb: { _, _, _ in false },
            read_clipboard_cb: { _, _, _ in false },
            confirm_read_clipboard_cb: { _, _, _, _ in },
            write_clipboard_cb: { _, _, _, _, _ in },
            write_to_host_cb: nil, close_surface_cb: { _, _ in })
        app = ghostty_app_new(&runtime, config)
        guard let app else { fatalError("Ghostty app") }
        var options = ghostty_surface_config_new()
        options.platform_tag = GHOSTTY_PLATFORM_MACOS
        options.platform.macos.nsview = Unmanaged.passUnretained(anchor).toOpaque()
        options.scale_factor = 1
        options.font_size = 14
        options.userdata = Unmanaged.passUnretained(self).toOpaque()
        var exporter = ghostty_frame_export_s(userdata: options.userdata, encode_cb: { userdata, texture, command in
            guard let userdata, let texture, let command else { return }
            let worker = Unmanaged<GhosttyWorker>.fromOpaque(userdata).takeUnretainedValue()
            let source = Unmanaged<AnyObject>.fromOpaque(texture).takeUnretainedValue() as! MTLTexture
            let buffer = Unmanaged<AnyObject>.fromOpaque(command).takeUnretainedValue() as! MTLCommandBuffer
            worker.encode(source: source, command: buffer)
        }, has_credit_cb: { userdata in
            guard let userdata else { return false }
            return Unmanaged<GhosttyWorker>.fromOpaque(userdata).takeUnretainedValue().hasCredit()
        })
        // Fixed trusted fixture command. No user startup files or shell snippets
        // are needed for the proof; the shell/PTY lives entirely in this helper.
        let script = "printf '\\033[2J\\033[H\\033[?25lHUDSON_GHOSTTY_READY\\n'; i=0; while [ $i -lt 120 ]; do printf '\\033[2;1Hframe %04d  ABCDEFGHIJKLMNOPQRSTUVWXYZ' $i; i=$((i+1)); sleep 0.025; done; printf '\\nINPUT_READY\\n'; while IFS= read -r line; do printf 'HUDSON_ECHO:%s\\n' \"$line\"; done"
        let command = "/bin/sh -c '" + script.replacingOccurrences(of: "'", with: "'\"'\"'") + "'"
        surface = command.withCString { command in
            options.command = command
            return ghostty_surface_new_with_frame_export(app, &options, &exporter)
        }
        guard let surface else { fatalError("Ghostty offscreen surface") }
        ghostty_surface_set_size(surface, UInt32(ProbeFrame.width), UInt32(ProbeFrame.height))
        ghostty_surface_set_focus(surface, true)
        ghostty_app_tick(app)
    }
    private func scheduleTick() {
        guard !pendingTick, app != nil else { return }
        pendingTick = true
        DispatchQueue.main.async {
            self.pendingTick = false
            if let app = self.app { ghostty_app_tick(app) }
        }
    }
    private func hasCredit() -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard !stopped else { return false }
        if !leases.hasFreeSlot { needsRefresh = true; skipped += 1; return false }
        return true
    }
    private func encode(source: MTLTexture, command: MTLCommandBuffer) {
        guard source.width == ProbeFrame.width, source.height == ProbeFrame.height,
              source.pixelFormat == .bgra8Unorm else { return }
        lock.lock()
        guard !stopped else { lock.unlock(); return }
        guard let lease = leases.acquire() else { needsRefresh = true; skipped += 1; lock.unlock(); return }
        lock.unlock()
        guard let blit = command.makeBlitCommandEncoder() else {
            lock.lock(); _ = leases.release(lease.sequence); lock.unlock(); return
        }
        blit.copy(from: source, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(),
            sourceSize: MTLSize(width: ProbeFrame.width, height: ProbeFrame.height, depth: 1),
            to: storage.textures[lease.slot], destinationSlice: 0, destinationLevel: 0, destinationOrigin: MTLOrigin())
        blit.endEncoding()
        command.addCompletedHandler { command in
            self.lock.lock()
            guard !self.stopped, command.status == .completed, lease.sequence > self.latestCompleted else {
                _ = self.leases.release(lease.sequence); self.lock.unlock(); return
            }
            self.latestCompleted = lease.sequence
            self.exported += 1
            let frame = (self.storage.surfaces[lease.slot], lease.sequence)
            let reply = self.waiting; self.waiting = nil
            if reply == nil {
                if let previous = self.ready { _ = self.leases.release(previous.1) }
                self.ready = frame
            }
            self.lock.unlock()
            reply?(frame.0, frame.1)
        }
    }
    func hello(reply: @escaping (Int32, Int) -> Void) {
        DispatchQueue.main.async { reply(getpid(), self.surface == nil ? -1 : 2) }
    }
    func acquireFrame(reply: @escaping (IOSurface?, UInt64) -> Void) {
        lock.lock()
        if stopped { lock.unlock(); reply(nil, 0); return }
        if let ready { self.ready = nil; lock.unlock(); reply(ready.0, ready.1); return }
        guard waiting == nil else { lock.unlock(); reply(nil, 0); return }
        waiting = reply
        lock.unlock()
    }
    func releaseFrame(_ sequence: UInt64, reply: @escaping (Bool) -> Void) {
        lock.lock()
        let accepted = leases.release(sequence)
        let refresh = accepted && needsRefresh && !stopped
        if refresh { needsRefresh = false }
        lock.unlock()
        reply(accepted)
        if refresh { DispatchQueue.main.async { if let surface = self.surface { ghostty_surface_request_frame_export(surface) } } }
    }
    func cancelFrameRequest(reply: @escaping () -> Void) {
        lock.lock(); let pending = waiting; waiting = nil; lock.unlock()
        pending?(nil, 0); reply()
    }
    func heartbeat(reply: @escaping (UInt64) -> Void) {
        lock.lock(); let count = exported; lock.unlock(); reply(count)
    }
    func frameStatistics(reply: @escaping (UInt64, UInt64) -> Void) {
        lock.lock(); let counts = (exported, skipped); lock.unlock(); reply(counts.0, counts.1)
    }
    func processID(reply: @escaping (Int32) -> Void) {
        DispatchQueue.main.async {
            reply(self.surface.map { Int32(clamping: ghostty_surface_foreground_pid($0)) } ?? 0)
        }
    }
    func writeInput(_ data: Data, reply: @escaping (Bool) -> Void) {
        guard data.count <= 4096 else { reply(false); return }
        DispatchQueue.main.async {
            guard let surface = self.surface else { reply(false); return }
            data.withUnsafeBytes { bytes in
                if let base = bytes.baseAddress { ghostty_surface_text(surface, base.assumingMemoryBound(to: CChar.self), UInt(data.count)) }
            }
            reply(true)
        }
    }
    func readScreen(reply: @escaping (String) -> Void) {
        DispatchQueue.main.async {
            guard let surface = self.surface else { reply(""); return }
            var text = ghostty_text_s()
            let selection = ghostty_selection_s(
                top_left: ghostty_point_s(tag: GHOSTTY_POINT_VIEWPORT, coord: GHOSTTY_POINT_COORD_TOP_LEFT, x: 0, y: 0),
                bottom_right: ghostty_point_s(tag: GHOSTTY_POINT_VIEWPORT, coord: GHOSTTY_POINT_COORD_BOTTOM_RIGHT, x: 0, y: 0), rectangle: false)
            guard ghostty_surface_read_text(surface, selection, &text) else { reply(""); return }
            defer { ghostty_surface_free_text(surface, &text) }
            guard let pointer = text.text else { reply(""); return }
            reply(String(decoding: UnsafeBufferPointer(start: UnsafeRawPointer(pointer).assumingMemoryBound(to: UInt8.self), count: min(Int(text.text_len), 16384)), as: UTF8.self))
        }
    }
    func shutdown(reply: @escaping () -> Void) { DispatchQueue.main.async { self.stop(); reply() } }
    func stop() {
        precondition(Thread.isMainThread)
        lock.lock(); stopped = true; let waiting = self.waiting; self.waiting = nil; lock.unlock()
        waiting?(nil, 0)
        // Surface teardown drains renderer GPU work and terminates its PTY.
        if let surface { ghostty_surface_free(surface); self.surface = nil }
        if let app { ghostty_app_free(app); self.app = nil }
        if let config { ghostty_config_free(config); self.config = nil }
    }
}
final class TerminalListener: NSObject, NSXPCListenerDelegate {
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard connection.effectiveUserIdentifier == getuid() else { return false }
        DispatchQueue.main.async {
            let worker = GhosttyWorker()
            connection.exportedInterface = terminalServiceInterface()
            connection.exportedObject = worker
            connection.invalidationHandler = { DispatchQueue.main.async { worker.stop(); exit(0) } }
            worker.start()
            connection.resume()
        }
        return true
    }
}
@main struct GhosttyWorkerMain {
    static func main() {
        _ = NSApplication.shared
        let listener = NSXPCListener.service(), delegate = TerminalListener()
        listener.delegate = delegate
        withExtendedLifetime(delegate) { listener.resume(); RunLoop.main.run() }
    }
}
