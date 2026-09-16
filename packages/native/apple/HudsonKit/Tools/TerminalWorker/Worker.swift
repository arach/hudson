import AppKit
import GhosttyKit
import IOSurface
import Metal

private final class PixelBudget {
    static let shared = PixelBudget()
    private let lock = NSLock()
    private var used = 0
    func reserve(_ bytes: Int) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard bytes > 0, bytes <= 288 * 1024 * 1024 - used else { return false }
        used += bytes; return true
    }
    func release(_ bytes: Int) { lock.lock(); used -= bytes; lock.unlock() }
}
private final class ExportPool {
    let width: Int, height: Int, bytes: Int
    let surfaces: [IOSurface]
    let textures: [MTLTexture]
    init?(width: Int, height: Int, device: MTLDevice) {
        guard width > 0, height > 0, width <= 8192, height <= 8192 else { return nil }
        let stride = ((width * 4 + 255) / 256) * 256
        let allocation = stride * height
        guard allocation <= 96 * 1024 * 1024, PixelBudget.shared.reserve(allocation * 3) else { return nil }
        let surfaces = (0..<3).compactMap { _ in IOSurface(properties: [.width: width, .height: height, .bytesPerElement: 4,
            .bytesPerRow: stride, .allocSize: allocation, .pixelFormat: 0x42475241]) }
        let description = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: width, height: height, mipmapped: false)
        description.storageMode = .shared; description.usage = [.shaderRead, .renderTarget]
        let textures = surfaces.compactMap { device.makeTexture(descriptor: description, iosurface: $0, plane: 0) }
        guard surfaces.count == 3, textures.count == 3 else { PixelBudget.shared.release(allocation * 3); return nil }
        self.width = width; self.height = height; self.bytes = allocation * 3; self.surfaces = surfaces; self.textures = textures
    }
    deinit { PixelBudget.shared.release(bytes) }
}
private final class Terminal {
    struct Geometry: Equatable { let width: Int; let height: Int; let scale: Double; let visible: Bool; let focused: Bool }
    struct Lease { let pool: ExportPool; let slot: Int; let generation: UInt64 }
    let identifier: String
    private let events: HudTerminalHostEvents
    private let device: MTLDevice
    private let lock = NSLock()
    private var pool: ExportPool
    private var retired: ExportPool?
    private var leases: [UInt64: Lease] = [:]
    private var nextSequence: UInt64 = 1
    private var latestCompleted: UInt64 = 0
    private var generation: UInt64 = 1
    private var ready: (IOSurface, UInt64)?
    private var waiting: ((IOSurface?, UInt64) -> Void)?
    private var visible = false
    private var dirty = true
    private var stopped = false
    private var geometry = Geometry(width: 640, height: 400, scale: 1, visible: false, focused: false)
    private var desired: Geometry?
    private var revision: UInt64 = 0
    private var inputSequence: UInt64 = 0
    private var config: ghostty_config_t?
    private var app: ghostty_app_t?
    private var surface: ghostty_surface_t?
    private var tickPending = false
    private var pendingPaste: String?
    private let anchor = NSView(frame: NSRect(x: 0, y: 0, width: 640, height: 400))
    init(identifier: String, specification: HudTerminalProcessSpecification, events: HudTerminalHostEvents) throws {
        guard specification.version == HudTerminalIPCWire.version, specification.executable.hasPrefix("/"),
              specification.fontSize.isFinite, specification.fontSize >= 5, specification.fontSize <= 96,
              !specification.executable.contains("\0"), !specification.workingDirectory.contains("\0"),
              specification.arguments.allSatisfy({ !$0.contains("\0") }),
              specification.environment.allSatisfy({ !$0.key.contains("=") && !$0.key.contains("\0") && !$0.value.contains("\0") }),
              let device = MTLCreateSystemDefaultDevice(), let pool = ExportPool(width: 640, height: 400, device: device) else {
            throw NSError(domain: "Terminal specification or pixel budget", code: 1)
        }
        self.identifier = identifier; self.events = events; self.device = device; self.pool = pool
        config = ghostty_config_new()
        guard let config else { throw NSError(domain: "Terminal configuration", code: 1) }
        ghostty_config_set_font_size(config, Float(specification.fontSize))
        _ = specification.fontFamily.withCString { ghostty_config_set_font_family(config, $0, UInt(specification.fontFamily.utf8.count)) }
        ghostty_config_finalize(config)
        var runtime = ghostty_runtime_config_s(userdata: Unmanaged.passUnretained(self).toOpaque(), supports_selection_clipboard: false,
            wakeup_cb: { pointer in
                guard let pointer else { return }
                let terminal = Unmanaged<Terminal>.fromOpaque(pointer).takeUnretainedValue()
                DispatchQueue.main.async { terminal.tick() }
            }, action_cb: { _, _, _ in false },
            read_clipboard_cb: { pointer, _, request in
                guard let pointer else { return false }
                let terminal = Unmanaged<Terminal>.fromOpaque(pointer).takeUnretainedValue()
                guard let text = terminal.pendingPaste, let surface = terminal.surface else { return false }
                text.withCString { ghostty_surface_complete_clipboard_request(surface, $0, request, true) }
                return true
            }, confirm_read_clipboard_cb: { _, _, _, _ in }, write_clipboard_cb: { _, _, _, _, _ in },
            write_to_host_cb: nil, close_surface_cb: { pointer, _ in
                guard let pointer else { return }
                let terminal = Unmanaged<Terminal>.fromOpaque(pointer).takeUnretainedValue()
                DispatchQueue.main.async { terminal.events.ended(terminal.identifier, message: "Terminal process exited") }
            })
        app = ghostty_app_new(&runtime, config)
        guard let app else { stop(); throw NSError(domain: "Terminal engine", code: 1) }
        var options = ghostty_surface_config_new()
        options.platform_tag = GHOSTTY_PLATFORM_MACOS; options.platform.macos.nsview = Unmanaged.passUnretained(anchor).toOpaque()
        options.scale_factor = 1; options.font_size = Float(specification.fontSize); options.userdata = Unmanaged.passUnretained(self).toOpaque()
        var exporter = ghostty_frame_export_s(userdata: options.userdata, encode_cb: { pointer, texture, command in
            guard let pointer, let texture, let command else { return }
            let terminal = Unmanaged<Terminal>.fromOpaque(pointer).takeUnretainedValue()
            terminal.encode(Unmanaged<AnyObject>.fromOpaque(texture).takeUnretainedValue() as! MTLTexture,
                command: Unmanaged<AnyObject>.fromOpaque(command).takeUnretainedValue() as! MTLCommandBuffer)
        }, has_credit_cb: { pointer in
            guard let pointer else { return false }; return Unmanaged<Terminal>.fromOpaque(pointer).takeUnretainedValue().hasCredit()
        })
        func quote(_ value: String) -> String { "'" + value.replacingOccurrences(of: "'", with: "'\"'\"'") + "'" }
        let command = ([specification.executable] + specification.arguments).map(quote).joined(separator: " ")
        let strings = specification.environment.sorted(by: { $0.key < $1.key }).map { (strdup($0.key)!, strdup($0.value)!) }
        defer { for (key, value) in strings { free(key); free(value) } }
        var environment = strings.map { ghostty_env_var_s(key: UnsafePointer($0.0), value: UnsafePointer($0.1)) }
        surface = command.withCString { command in specification.workingDirectory.withCString { directory in
            environment.withUnsafeMutableBufferPointer { environment in
                options.command = command; options.working_directory = directory; options.env_vars = environment.baseAddress; options.env_var_count = environment.count
                return ghostty_surface_new_with_frame_export(app, &options, &exporter)
            }
        } }
        guard let surface else { stop(); throw NSError(domain: "Terminal process startup", code: 1) }
        ghostty_surface_set_size(surface, 640, 400); ghostty_surface_set_occlusion(surface, false); ghostty_app_tick(app)
    }
    private func tick() {
        guard !tickPending, app != nil else { return }; tickPending = true
        DispatchQueue.main.async { self.tickPending = false; if let app = self.app { ghostty_app_tick(app) } }
    }
    private func hasCredit() -> Bool {
        lock.lock(); defer { lock.unlock() }
        let available = !stopped && visible && leases.values.filter { $0.pool === pool }.count < 3
        if !available { dirty = true }; return available
    }
    private func encode(_ source: MTLTexture, command: MTLCommandBuffer) {
        lock.lock()
        guard !stopped, visible, source.width == pool.width, source.height == pool.height, source.pixelFormat == .bgra8Unorm,
              nextSequence < UInt64.max, let slot = (0..<3).first(where: { slot in !leases.values.contains { $0.pool === pool && $0.slot == slot } }) else {
            dirty = true; lock.unlock(); return
        }
        let sequence = nextSequence; nextSequence += 1
        let lease = Lease(pool: pool, slot: slot, generation: generation); leases[sequence] = lease
        lock.unlock()
        guard let blit = command.makeBlitCommandEncoder() else { _ = release(sequence); return }
        blit.copy(from: source, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(), sourceSize: MTLSize(width: source.width, height: source.height, depth: 1),
            to: lease.pool.textures[slot], destinationSlice: 0, destinationLevel: 0, destinationOrigin: MTLOrigin()); blit.endEncoding()
        command.addCompletedHandler { command in
            self.lock.lock()
            guard !self.stopped, self.visible, command.status == .completed, self.generation == lease.generation, sequence > self.latestCompleted else {
                self.lock.unlock(); _ = self.release(sequence); return
            }
            self.latestCompleted = sequence
            let frame = (lease.pool.surfaces[slot], sequence)
            let reply = self.waiting; self.waiting = nil
            if reply == nil {
                if let previous = self.ready { self.leases.removeValue(forKey: previous.1) }
                self.ready = frame
            }
            self.lock.unlock(); reply?(frame.0, frame.1)
        }
    }
    func configure(revision: UInt64, geometry: Geometry) -> String? {
        guard revision > self.revision, geometry.width > 0, geometry.height > 0, geometry.width <= 8192, geometry.height <= 8192,
              geometry.scale.isFinite, geometry.scale >= 1, geometry.scale <= 4 else { return "Invalid terminal geometry revision" }
        self.revision = revision; desired = geometry
        return applyGeometry()
    }
    private func applyGeometry() -> String? {
        guard let next = desired, let surface else { return nil }
        lock.lock()
        if let ready { leases.removeValue(forKey: ready.1); self.ready = nil }
        let resize = pool.width != next.width || pool.height != next.height
        if resize, retired != nil { lock.unlock(); return nil } // coalesce to the latest geometry
        if resize {
            guard let replacement = ExportPool(width: next.width, height: next.height, device: device) else { lock.unlock(); return "Terminal pixel-memory budget exceeded" }
            if leases.values.contains(where: { $0.pool === pool }) { retired = pool }
            pool = replacement
        }
        if next != geometry { generation += 1 }
        visible = next.visible; dirty = true; geometry = next; desired = nil
        lock.unlock()
        anchor.frame.size = CGSize(width: Double(next.width) / next.scale, height: Double(next.height) / next.scale)
        ghostty_surface_set_content_scale(surface, next.scale, next.scale)
        ghostty_surface_set_size(surface, UInt32(next.width), UInt32(next.height))
        ghostty_surface_set_occlusion(surface, next.visible); ghostty_surface_set_focus(surface, next.focused)
        if next.visible { ghostty_surface_request_frame_export(surface) }
        return nil
    }
    func acquire(_ reply: @escaping (IOSurface?, UInt64) -> Void) {
        lock.lock()
        guard !stopped, waiting == nil else { lock.unlock(); reply(nil, 0); return }
        if let ready { self.ready = nil; lock.unlock(); reply(ready.0, ready.1); return }
        waiting = reply; lock.unlock()
    }
    func cancel() { lock.lock(); let reply = waiting; waiting = nil; lock.unlock(); reply?(nil, 0) }
    func release(_ sequence: UInt64) -> Bool {
        lock.lock()
        guard leases.removeValue(forKey: sequence) != nil else { lock.unlock(); return false }
        var retiredFreed = false
        if let retired, !leases.values.contains(where: { $0.pool === retired }) { self.retired = nil; retiredFreed = true }
        let refresh = dirty && visible && !stopped
        if refresh { dirty = false }
        lock.unlock()
        if retiredFreed || refresh {
            DispatchQueue.main.async {
                if retiredFreed, let error = self.applyGeometry() { self.events.ended(self.identifier, message: error) }
                if refresh, let surface = self.surface { ghostty_surface_request_frame_export(surface) }
            }
        }
        return true
    }
    func input(sequence: UInt64, event: HudTerminalInputEvent) -> Bool {
        guard sequence == inputSequence + 1, let surface else { return false }; inputSequence = sequence
        switch event.kind {
        case "text": event.text.withCString { ghostty_surface_text(surface, $0, UInt(event.text.utf8.count)) }
        case "preedit": event.text.withCString { ghostty_surface_preedit(surface, $0, UInt(event.text.utf8.count)) }
        case "paste":
            pendingPaste = event.text; defer { pendingPaste = nil }
            _ = "paste_from_clipboard".withCString { ghostty_surface_binding_action(surface, $0, 20) }
        case "binding":
            guard event.text == "select_all" else { return false }
            _ = event.text.withCString { ghostty_surface_binding_action(surface, $0, UInt(event.text.utf8.count)) }
        case "key":
            let mods = ghostty_input_mods_e(rawValue: event.modifiers)
            var consumed = ghostty_surface_key_translation_mods(surface, mods).rawValue
            consumed &= ~GHOSTTY_MODS_CTRL.rawValue; consumed &= ~GHOSTTY_MODS_SUPER.rawValue
            var key = ghostty_input_key_s(action: event.action == 1 ? GHOSTTY_ACTION_RELEASE : (event.action == 2 ? GHOSTTY_ACTION_REPEAT : GHOSTTY_ACTION_PRESS),
                mods: mods, consumed_mods: ghostty_input_mods_e(rawValue: consumed), keycode: event.keycode, text: nil, unshifted_codepoint: event.codepoint, composing: false)
            if event.text.isEmpty { _ = ghostty_surface_key(surface, key) }
            else { event.text.withCString { key.text = $0; _ = ghostty_surface_key(surface, key) } }
        case "mouse":
            guard event.x.isFinite, event.y.isFinite else { return false }
            let mods = ghostty_input_mods_e(rawValue: event.modifiers)
            ghostty_surface_mouse_pos(surface, event.x, event.y, mods)
            if event.action != 2 {
                let button = event.button == 1 ? GHOSTTY_MOUSE_RIGHT : (event.button == 2 ? GHOSTTY_MOUSE_MIDDLE : GHOSTTY_MOUSE_LEFT)
                _ = ghostty_surface_mouse_button(surface, event.action == 1 ? GHOSTTY_MOUSE_RELEASE : GHOSTTY_MOUSE_PRESS, button, mods)
            }
        case "scroll":
            guard event.x.isFinite, event.y.isFinite else { return false }
            ghostty_surface_mouse_scroll(surface, event.x, event.y, Int32(event.modifiers))
        default: return false
        }
        return true
    }
    func selection() -> String {
        guard let surface else { return "" }; var text = ghostty_text_s()
        guard ghostty_surface_read_selection(surface, &text) else { return "" }
        defer { ghostty_surface_free_text(surface, &text) }
        guard let pointer = text.text else { return "" }
        return String(decoding: UnsafeBufferPointer(start: UnsafeRawPointer(pointer).assumingMemoryBound(to: UInt8.self), count: min(Int(text.text_len), 1_048_576)), as: UTF8.self)
    }
    func stop() {
        lock.lock(); stopped = true; let reply = waiting; waiting = nil; lock.unlock(); reply?(nil, 0)
        if let surface { ghostty_surface_free(surface); self.surface = nil }
        if let app { ghostty_app_free(app); self.app = nil }
        if let config { ghostty_config_free(config); self.config = nil }
        lock.lock(); leases.removeAll(); ready = nil; retired = nil; lock.unlock()
    }
}
private final class Worker: NSObject, HudTerminalWorkerService {
    var terminals: [String: Terminal] = [:]
    let events: HudTerminalHostEvents
    init(events: HudTerminalHostEvents) { self.events = events }
    func open(_ identifier: String, specification: Data, reply: @escaping (String?) -> Void) {
        DispatchQueue.main.async {
            guard self.terminals.count < 16, self.terminals[identifier] == nil, identifier.count <= 64, specification.count <= 262144,
                  let spec = try? JSONDecoder().decode(HudTerminalProcessSpecification.self, from: specification) else { reply("Invalid terminal session request"); return }
            do { self.terminals[identifier] = try Terminal(identifier: identifier, specification: spec, events: self.events); reply(nil) }
            catch { reply(error.localizedDescription) }
        }
    }
    func close(_ identifier: String, reply: @escaping () -> Void) { DispatchQueue.main.async { self.terminals.removeValue(forKey: identifier)?.stop(); reply() } }
    func input(_ identifier: String, sequence: UInt64, event: Data, reply: @escaping (Bool) -> Void) {
        guard event.count <= 65536, let input = try? JSONDecoder().decode(HudTerminalInputEvent.self, from: event) else { reply(false); return }
        DispatchQueue.main.async { reply(self.terminals[identifier]?.input(sequence: sequence, event: input) ?? false) }
    }
    func configure(_ identifier: String, revision: UInt64, width: Int, height: Int, scale: Double, visible: Bool, focused: Bool, reply: @escaping (String?) -> Void) {
        DispatchQueue.main.async {
            guard let terminal = self.terminals[identifier] else { reply("Unknown terminal session"); return }
            reply(terminal.configure(revision: revision, geometry: .init(width: width, height: height, scale: scale, visible: visible, focused: focused)))
        }
    }
    func acquire(_ identifier: String, reply: @escaping (IOSurface?, UInt64) -> Void) { DispatchQueue.main.async {
        guard let terminal = self.terminals[identifier] else { reply(nil, 0); return }; terminal.acquire(reply)
    } }
    func release(_ identifier: String, sequence: UInt64, reply: @escaping (Bool) -> Void) { DispatchQueue.main.async { reply(self.terminals[identifier]?.release(sequence) ?? false) } }
    func cancelAcquire(_ identifier: String, reply: @escaping () -> Void) { DispatchQueue.main.async { self.terminals[identifier]?.cancel(); reply() } }
    func selection(_ identifier: String, reply: @escaping (String) -> Void) { DispatchQueue.main.async { reply(self.terminals[identifier]?.selection() ?? "") } }
    func stop() { for terminal in terminals.values { terminal.stop() }; terminals.removeAll() }
}
private final class Listener: NSObject, NSXPCListenerDelegate {
    private var connected = false
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard !connected, connection.effectiveUserIdentifier == getuid(),
              let requirement = Bundle.main.object(forInfoDictionaryKey: "HudsonHostRequirement") as? String, !requirement.isEmpty else { return false }
        connected = true
        connection.setCodeSigningRequirement(requirement)
        connection.exportedInterface = HudTerminalIPCWire.interface()
        connection.remoteObjectInterface = NSXPCInterface(with: HudTerminalHostEvents.self)
        let events = connection.remoteObjectProxyWithErrorHandler { _ in } as! HudTerminalHostEvents
        let worker = Worker(events: events); connection.exportedObject = worker
        connection.invalidationHandler = { DispatchQueue.main.async { worker.stop(); exit(0) } }
        connection.resume(); return true
    }
}
@main struct TerminalWorkerMain {
    static func main() {
        _ = NSApplication.shared
        guard ghostty_init(0, nil) == GHOSTTY_SUCCESS else { exit(1) }
        let listener = NSXPCListener.service(), delegate = Listener()
        listener.delegate = delegate
        withExtendedLifetime(delegate) { listener.resume(); RunLoop.main.run() }
    }
}
