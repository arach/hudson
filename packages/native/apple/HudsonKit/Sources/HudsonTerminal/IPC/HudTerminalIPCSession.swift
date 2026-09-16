#if os(macOS)
import AppKit
import Observation
import Security
import QuartzCore

// CAMetalLayer supports off-main drawable submission; NSXPC proxies are
// thread-safe. This immutable handoff transfers only those two references.
private struct TerminalPresentationContext: @unchecked Sendable {
    let layer: CAMetalLayer
    let proxy: HudTerminalWorkerService
}

@MainActor @Observable public final class HudTerminalIPCSession {
    public var processSpec: HudTerminalProcessSpecification
    public private(set) var statusMessage = "Ready"
    public private(set) var isRunning = false
    public private(set) var lastErrorMessage: String?
    public var presentationEnabled = true { didSet { geometryChanged() } }
    public var acceptsInput: Bool { identifier != nil }
    public var controller: HudTerminalIPCSession { self }
    @ObservationIgnored public lazy var view = HudTerminalIPCView(session: self)
    @ObservationIgnored private var identifier: String?
    @ObservationIgnored private var teardownProxy: HudTerminalWorkerService?
    @ObservationIgnored private var configurationRetries = 0
    @ObservationIgnored private var presenter: HudTerminalIPCPresenter?
    @ObservationIgnored private var inputSequence: UInt64 = 0
    @ObservationIgnored private var revision: UInt64 = 0
    @ObservationIgnored private var inputQueue: [Data] = []
    @ObservationIgnored private var inputBytes = 0
    @ObservationIgnored private var inputPending = false
    @ObservationIgnored private var configurationPending = false
    @ObservationIgnored private var desiredConfiguration: Configuration?
    @ObservationIgnored private var sentConfiguration: Configuration?
    private struct Configuration: Equatable { var width: Int; var height: Int; var scale: Double; var visible: Bool; var focused: Bool }
    public init(processSpec: HudTerminalProcessSpecification = .init()) { self.processSpec = processSpec }
    #if HUDSON_TERMINAL_IPC_TESTING
    static func installTestService(_ service: HudTerminalWorkerService) { HudTerminalIPCHub.shared.proxy = service }
    var queuedInputCount: Int { inputQueue.count }
    #endif
    public func start() {
        stop()
        let id = UUID().uuidString; identifier = id
        statusMessage = "Starting terminal"; lastErrorMessage = nil
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let hub = try await HudTerminalIPCHub.shared.connect()
                guard self.identifier == id else { return }
                self.teardownProxy = hub.proxy
                hub.sessions[id] = WeakTerminalSession(self)
                let data = try JSONEncoder().encode(processSpec)
                hub.proxy?.open(id, specification: data) { [weak self] error in
                    Task { @MainActor in
                        guard let self, self.identifier == id else { return }
                        if let error { self.fail(error); return }
                        guard let proxy = hub.proxy else { self.fail("Terminal helper disconnected"); return }
                        let context = TerminalPresentationContext(layer: self.view.metalLayer, proxy: proxy)
                        // Shader/pipeline preparation can invoke the Metal compiler.
                        // It must not hold up Scout's main thread on a new pane.
                        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                            do {
                                let presenter = try HudTerminalIPCPresenter(layer: context.layer, proxy: context.proxy, identifier: id) { [weak self] message in
                                    Task { @MainActor in guard self?.identifier == id else { return }; self?.fail(message) }
                                }
                                Task { @MainActor in
                                    guard let self, self.identifier == id else { presenter.stop {}; return }
                                    self.presenter = presenter
                                    self.isRunning = true; self.statusMessage = "Running"
                                    self.drainInput()
                                    self.geometryChanged()
                                }
                            } catch {
                                Task { @MainActor in guard self?.identifier == id else { return }; self?.fail(error.localizedDescription) }
                            }
                        }
                    }
                }
            } catch { if self.identifier == id { self.fail(error.localizedDescription) } }
        }
    }
    deinit {
        guard let id = identifier else { return }
        let proxy = teardownProxy
        if let presenter { presenter.stop { proxy?.close(id) {} } }
        else { proxy?.close(id) {} }
        Task { @MainActor in HudTerminalIPCHub.shared.sessions.removeValue(forKey: id) }
    }
    public func stop() {
        guard let id = identifier else { return }
        identifier = nil; isRunning = false; statusMessage = "Stopped"
        inputQueue.removeAll(); inputBytes = 0; inputPending = false; inputSequence = 0
        configurationPending = false; configurationRetries = 0; desiredConfiguration = nil; sentConfiguration = nil; revision = 0
        let old = presenter; presenter = nil
        // Close only after consumer GPU completion; helper teardown never races a lease.
        let proxy = teardownProxy; teardownProxy = nil
        HudTerminalIPCHub.shared.sessions.removeValue(forKey: id)
        if let old { old.stop { proxy?.close(id) {} } } else { proxy?.close(id) {} }
    }
    public func focus() { view.window?.makeFirstResponder(view) }
    public func send(_ data: Data) {
        // Text is UTF-8. Split by Unicode scalar boundaries, not arbitrary bytes.
        let text = String(decoding: data, as: UTF8.self)
        var piece = ""
        for scalar in text.unicodeScalars {
            piece.unicodeScalars.append(scalar)
            if piece.utf8.count >= 8192 { sendText(piece); piece = "" }
        }
        if !piece.isEmpty { sendText(piece) }
    }
    private func sendText(_ text: String) { var event = HudTerminalInputEvent(kind: "text"); event.text = text; sendEvent(event) }
    func sendEvent(_ event: HudTerminalInputEvent) {
        guard acceptsInput, let data = try? JSONEncoder().encode(event) else { return }
        guard data.count <= 65536, inputBytes + data.count <= 1_048_576 else {
            statusMessage = "Input was not sent: terminal input queue limit exceeded"
            lastErrorMessage = statusMessage
            return
        }
        inputQueue.append(data); inputBytes += data.count; drainInput()
    }
    private func drainInput() {
        guard isRunning, !inputPending, let id = identifier, let data = inputQueue.first, let proxy = HudTerminalIPCHub.shared.proxy else { return }
        inputPending = true; inputSequence += 1
        proxy.input(id, sequence: inputSequence, event: data) { [weak self] accepted in
            Task { @MainActor in
                guard let self, self.identifier == id else { return }
                self.inputPending = false
                guard accepted else { self.fail("Terminal helper rejected input"); return }
                self.inputQueue.removeFirst(); self.inputBytes -= data.count; self.drainInput()
            }
        }
    }
    func copySelection() {
        guard let id = identifier else { return }
        HudTerminalIPCHub.shared.proxy?.selection(id) { [weak self] text in
            Task { @MainActor in
                guard self?.identifier == id, !text.isEmpty else { return }
                NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
            }
        }
    }
    func geometryChanged() {
        guard isRunning else { return }
        let scale = view.window?.backingScaleFactor ?? 1
        let visible = presentationEnabled && view.window != nil && !view.isHiddenOrHasHiddenAncestor && (view.window?.occlusionState.contains(.visible) ?? false) && view.bounds.width > 0 && view.bounds.height > 0
        let next = Configuration(width: max(1, Int(view.bounds.width * scale)), height: max(1, Int(view.bounds.height * scale)),
            scale: scale, visible: visible, focused: view.window?.isKeyWindow == true && view.window?.firstResponder === view)
        if next != desiredConfiguration { configurationRetries = 0 }
        desiredConfiguration = next
        sendConfiguration()
    }
    private func sendConfiguration() {
        guard !configurationPending, let next = desiredConfiguration, next != sentConfiguration, let id = identifier,
              let proxy = HudTerminalIPCHub.shared.proxy else { return }
        configurationPending = true; revision += 1
        if !next.visible { presenter?.setVisible(false) }
        proxy.configure(id, revision: revision, width: next.width, height: next.height, scale: next.scale,
                        visible: next.visible, focused: next.focused) { [weak self] error in
            Task { @MainActor in
                guard let self, self.identifier == id else { return }
                self.configurationPending = false
                if let error {
                    self.statusMessage = error
                    if self.desiredConfiguration != next { self.sendConfiguration(); return }
                    guard self.configurationRetries < 2 else { return }
                    self.configurationRetries += 1
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                        guard let self, self.identifier == id else { return }
                        self.sendConfiguration()
                    }
                    return
                }
                self.configurationRetries = 0
                self.statusMessage = "Running"
                self.sentConfiguration = next
                self.presenter?.setVisible(next.visible)
                self.sendConfiguration()
            }
        }
    }
    fileprivate func fail(_ message: String) { stop(); statusMessage = message; lastErrorMessage = message == "Terminal process exited" ? nil : message }
}

private final class WeakTerminalSession {
    weak var session: HudTerminalIPCSession?
    init(_ session: HudTerminalIPCSession) { self.session = session }
}

@MainActor private final class HudTerminalIPCHub: NSObject, HudTerminalHostEvents {
    static let shared = HudTerminalIPCHub()
    var sessions: [String: WeakTerminalSession] = [:]
    var proxy: HudTerminalWorkerService?
    private var connection: NSXPCConnection?
    private var requirementTask: Task<String, Error>?
    nonisolated private static func requirement(for helper: URL) throws -> String {
        var code: SecStaticCode?; var requirement: SecRequirement?; var requirementText: CFString?
        guard SecStaticCodeCreateWithPath(helper as CFURL, [], &code) == errSecSuccess, let code,
              SecCodeCopyDesignatedRequirement(code, [], &requirement) == errSecSuccess, let requirement,
              SecRequirementCopyString(requirement, [], &requirementText) == errSecSuccess, let requirementText else {
            throw NSError(domain: "HudsonTerminal", code: 1, userInfo: [NSLocalizedDescriptionKey: "Signed terminal helper is missing"])
        }
        return requirementText as String
    }
    func connect() async throws -> HudTerminalIPCHub {
        if proxy != nil { return self }
        if requirementTask == nil {
            let helper = Bundle.main.bundleURL.appendingPathComponent("Contents/XPCServices/HudsonTerminalWorker.xpc")
            requirementTask = Task.detached(priority: .userInitiated) { try Self.requirement(for: helper) }
        }
        let requirement: String
        do { requirement = try await requirementTask!.value }
        catch { requirementTask = nil; throw error }
        if proxy != nil { return self }
        let connection = NSXPCConnection(serviceName: HudTerminalIPCWire.serviceName)
        connection.setCodeSigningRequirement(requirement)
        connection.remoteObjectInterface = HudTerminalIPCWire.interface()
        connection.exportedInterface = NSXPCInterface(with: HudTerminalHostEvents.self)
        connection.exportedObject = self
        connection.invalidationHandler = { [weak self, weak connection] in Task { @MainActor in
            guard let self, let connection, self.connection === connection else { return }; self.disconnected()
        } }
        connection.interruptionHandler = { [weak self, weak connection] in Task { @MainActor in
            guard let self, let connection, self.connection === connection else { return }; self.disconnected()
        } }
        connection.resume()
        self.connection = connection
        proxy = connection.remoteObjectProxyWithErrorHandler { [weak self, weak connection] _ in
            Task { @MainActor in
                guard let self, let connection, self.connection === connection else { return }; self.disconnected()
            }
        } as? HudTerminalWorkerService
        return self
    }
    private func disconnected() {
        let active = sessions.values.compactMap { $0.session }
        let old = connection; connection = nil; proxy = nil; sessions.removeAll(); old?.invalidate()
        for session in active { session.fail("Terminal helper disconnected — restart the terminal explicitly") }
    }
    nonisolated func ended(_ identifier: String, message: String) {
        Task { @MainActor in sessions[identifier]?.session?.fail(message) }
    }
}
#endif
