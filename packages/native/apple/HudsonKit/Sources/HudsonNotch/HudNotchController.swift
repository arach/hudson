#if os(macOS)
import AppKit
import Combine
import HudsonNotchCore
import HudsonShell
import SwiftUI

/// Owns the notch panel and its presentation: hover, pin, peek timers, and
/// the stage of activities. Hosts post activities directly or call
/// `serve(socketURL:)` to take them over the wire, and hear the person's
/// answers through `onResponse`.
///
/// The controller adds no status item, settings window, or brand; the host
/// app decides those.
@MainActor
public final class HudNotchController: ObservableObject {
    public struct Copy: Sendable {
        /// Accessibility label for the notch as a whole.
        public var name: String
        /// Shown when the notch is opened with nothing on the stage.
        public var idleTitle: String
        public var idleDetail: String

        public init(
            name: String = "Notch",
            idleTitle: String = "Nothing running",
            idleDetail: String = "Updates from your tools appear here"
        ) {
            self.name = name
            self.idleTitle = idleTitle
            self.idleDetail = idleDetail
        }
    }

    @Published public private(set) var notchInfo = HudNotchInfo.effective()
    @Published public private(set) var isVisible = false
    /// The silhouette is out of the housing. False while the panel is
    /// ordered in but the shape has not grown yet, and while it tucks away.
    @Published public private(set) var isPresented = false
    @Published public private(set) var isHovered = false
    @Published public private(set) var isHoverActivated = false
    @Published public private(set) var isExpanded = false
    @Published public private(set) var isPinned = false
    /// The reply field has focus; the notch stays open until it loses it.
    @Published public private(set) var isComposing = false
    /// Bumps each time something asks for attention; the surface flashes on it.
    @Published public private(set) var attentionSerial = 0
    /// Bumps when something asks for attention while the card is already
    /// open; the surface gives the card a small stretch.
    @Published public private(set) var nudgeSerial = 0
    @Published public private(set) var stage: HudNotchStage
    @Published public private(set) var configuration: HudNotchConfiguration

    /// Called on the main actor with each answer or dismissal, after it has
    /// been sent to the socket (when serving).
    public var onResponse: ((HudNotchResponse) -> Void)?

    public let copy: Copy
    public let theme: HudNotchTheme
    private let persistenceKey: String?
    private var panel: HudOverlayPanel?
    private var server: HudNotchSocketServer?
    private var screenObserver: NSObjectProtocol?
    private var hoverActivationTask: Task<Void, Never>?
    private var collapseTask: Task<Void, Never>?
    private var retractTask: Task<Void, Never>?

    /// - Parameter persistenceKey: a `UserDefaults` key for tuned
    ///   configuration. Nil keeps tuning in memory only.
    public init(
        configuration: HudNotchConfiguration = .default,
        persistenceKey: String? = nil,
        capacity: Int = 8,
        copy: Copy = Copy(),
        theme: HudNotchTheme = .hudson
    ) {
        self.persistenceKey = persistenceKey
        self.copy = copy
        self.theme = theme
        self.stage = HudNotchStage(capacity: capacity)
        let persisted = persistenceKey.flatMap(Self.persistedConfiguration(key:))
        self.configuration = (persisted ?? configuration).normalized()
    }

    deinit {
        if let screenObserver {
            NotificationCenter.default.removeObserver(screenObserver)
        }
    }

    // MARK: Derived geometry

    public var panelSize: CGSize {
        HudNotchMetrics.panelSize(
            notchWidth: notchInfo.notchWidth,
            notchHeight: notchInfo.notchHeight,
            configuration: configuration
        )
    }

    public var displayMode: HudNotchDisplayMode {
        configuration.displayMode
    }

    public var renderStyle: HudNotchRenderStyle {
        configuration.displayMode.resolvedStyle(isVirtual: notchInfo.isVirtual)
    }

    public var needsSyntheticNotchFill: Bool {
        renderStyle == .notch && notchInfo.isVirtual
    }

    /// Something ongoing is on the stage, so the collapsed notch widens a
    /// little to show it on the wings.
    public var showsLiveActivity: Bool {
        stage.headline != nil
    }

    public var currentPokeOut: CGFloat {
        if isExpanded || isPinned { return configuration.activePokeOut }
        if isHoverActivated { return configuration.hoverPokeOut }
        if showsLiveActivity { return max(configuration.restPokeOut, min(configuration.hoverPokeOut, 34)) }
        return configuration.restPokeOut
    }

    public var shellHeight: CGFloat {
        max(notchInfo.notchHeight, configuration.shellHeight)
    }

    public var notchGap: CGFloat {
        HudNotchMetrics.notchGap(notchWidth: notchInfo.notchWidth)
    }

    public var shellWidth: CGFloat {
        notchGap + (currentPokeOut * 2) + 24
    }

    public var contentHeight: CGFloat {
        configuration.contentHeight(asksForInput: stage.focused?.asksForInput ?? false)
    }

    // MARK: Lifecycle

    public func start() {
        observeScreenChanges()
        show()
    }

    /// Takes commands from a Unix socket and writes answers back to it.
    public func serve(socketURL: URL = HudNotchSocket.defaultURL) throws {
        guard server == nil else { return }
        let server = HudNotchSocketServer(socketURL: socketURL) { [weak self] command in
            Task { @MainActor in self?.handle(command) }
        }
        try server.start()
        self.server = server
    }

    public func stopServing() {
        server?.stop()
        server = nil
    }

    public var socketURL: URL? { server?.socketURL }

    public func show() {
        refreshNotchInfo()

        if panel == nil {
            let panel = HudOverlayPanelShell.makePanel(
                configuration: HudOverlayPanelShell.Configuration(
                    size: NSSize(width: panelSize.width, height: panelSize.height),
                    title: copy.name,
                    level: NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.screenSaverWindow))),
                    hasShadow: false,
                    hidesOnDeactivate: false,
                    isReleasedWhenClosed: false,
                    collectionBehavior: [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle],
                    activatesOnMouseDown: false,
                    appearance: NSAppearance(named: .darkAqua)
                ),
                rootView: HudNotchSurface(controller: self)
            )
            self.panel = panel
            updatePanelFrame(animated: false)
        }

        guard let panel else { return }
        retractTask?.cancel()
        retractTask = nil
        isVisible = true
        guard !isPresented else { return }

        // Never activate the app or take key: the notch must not steal focus.
        panel.alphaValue = 1
        HudOverlayPanelShell.present(panel, activate: false, makeKey: false, orderFrontRegardless: true)
        // Let the tucked-in shape render once so the next frame grows it
        // out of the housing instead of popping in.
        DispatchQueue.main.async { [weak self] in
            guard let self, self.isVisible else { return }
            self.isPresented = true
        }
    }

    /// Folds the card, tucks the shape back into the housing, then orders
    /// the panel out.
    public func hide() {
        guard let panel, panel.isVisible, isVisible else { return }
        isVisible = false
        collapseTask?.cancel()
        setExpanded(false)
        isPresented = false
        retractTask?.cancel()
        retractTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(HudNotchMotion.retractSeconds))
            guard !Task.isCancelled, let self, !self.isVisible else { return }
            self.panel?.orderOut(nil)
        }
    }

    public func toggleVisibility() {
        isVisible ? hide() : show()
    }

    // MARK: Commands

    public func handle(_ command: HudNotchCommand) {
        switch command {
        case .post(let activity): post(activity)
        // Always notify: whoever is still waiting on this id must be released.
        case .dismiss(let id): dismiss(id: id)
        case .pulse: pulse()
        case .subscribe: break
        }
    }

    /// Adds or updates an activity. Progress-only updates stay quiet.
    public func post(_ activity: HudNotchActivity) {
        let change = stage.post(activity)
        guard change.wantsAttention else { return }
        if isExpanded { nudgeSerial += 1 }
        attentionSerial += 1
        show()
        setExpanded(true)
        scheduleCollapse(after: activity.peekDuration)
    }

    /// Removes an activity. With `notify`, a waiting asker and subscribers
    /// hear `dismissed` for it.
    public func dismiss(id: String, notify: Bool = true) {
        guard let removed = stage.dismiss(id: id) else { return }
        if notify, removed.state == .waiting {
            send(.dismissed(id: id))
        }
        if stage.activities.isEmpty, !isHovered, !isPinned {
            scheduleCollapse(after: configuration.collapseDelaySeconds)
        }
    }

    public func choose(_ choice: HudNotchChoice, for activityID: String) {
        if choice.role == .cancel {
            dismiss(id: activityID)
            return
        }
        answer(HudNotchReply(id: activityID, choice: choice.id))
    }

    public func reply(_ text: String, to activityID: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        answer(HudNotchReply(id: activityID, text: trimmed))
    }

    public func focusNext() {
        stage.focusNext()
    }

    public func clearSettled() {
        stage.clearSettled()
    }

    public func open(_ link: HudNotchLink) {
        guard let url = URL(string: link.url) else { return }
        NSWorkspace.shared.open(url)
    }

    /// Opens the card, for a click on the collapsed pill. It folds back on
    /// the focused activity's peek timer unless the pointer stays over it.
    public func expand() {
        show()
        setExpanded(true)
        scheduleCollapse(after: stage.focused?.peekDuration ?? HudNotchActivity.defaultTTL)
    }

    /// Opens briefly without new content.
    public func pulse() {
        if isExpanded { nudgeSerial += 1 }
        attentionSerial += 1
        show()
        setExpanded(true)
        scheduleCollapse(after: 1.35)
    }

    private func answer(_ reply: HudNotchReply) {
        guard stage.answer(reply) != nil else { return }
        isComposing = false
        send(.reply(reply))
        if !isHovered, !isPinned {
            scheduleCollapse(after: 1.6)
        }
    }

    private func send(_ response: HudNotchResponse) {
        server?.respond(response)
        onResponse?(response)
    }

    // MARK: Presentation

    public func setConfiguration(_ configuration: HudNotchConfiguration) {
        let normalized = configuration.normalized()
        guard self.configuration != normalized else { return }
        withAnimation(.easeOut(duration: 0.18)) {
            self.configuration = normalized
        }
        persist(normalized)
        updatePanelFrame(animated: true)
    }

    public func setDisplayMode(_ displayMode: HudNotchDisplayMode) {
        var updated = configuration
        updated.displayMode = displayMode
        setConfiguration(updated)
    }

    public func setHovered(_ hovered: Bool) {
        isHovered = hovered
        hoverActivationTask?.cancel()
        collapseTask?.cancel()

        if hovered {
            let delay = configuration.hoverActivationDelaySeconds
            hoverActivationTask = Task { [weak self] in
                if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
                guard !Task.isCancelled, let self, self.isHovered else { return }
                self.isHoverActivated = true
                self.setExpanded(true)
            }
            return
        }

        isHoverActivated = false
        scheduleCollapse(after: configuration.collapseDelaySeconds)
    }

    public func setComposing(_ composing: Bool) {
        isComposing = composing
        if composing {
            collapseTask?.cancel()
        } else if !isHovered {
            scheduleCollapse(after: configuration.collapseDelaySeconds)
        }
    }

    public func togglePinned() {
        isPinned.toggle()
        setExpanded(isPinned || isHovered)
    }

    private func scheduleCollapse(after seconds: TimeInterval) {
        guard !isPinned else { return }
        collapseTask?.cancel()
        collapseTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled, let self,
                  !self.isHovered, !self.isPinned, !self.isComposing else { return }
            self.setExpanded(false)
        }
    }

    private func setExpanded(_ expanded: Bool) {
        guard isExpanded != expanded else { return }
        isExpanded = expanded
    }

    // MARK: Screen

    private func refreshNotchInfo() {
        notchInfo = HudNotchInfo.effective(for: preferredScreen())
    }

    private func preferredScreen() -> NSScreen? {
        NSScreen.screens.first { HudNotchInfo.detect(for: $0).hasNotch }
            ?? NSScreen.main
            ?? NSScreen.screens.first
    }

    private func observeScreenChanges() {
        guard screenObserver == nil else { return }
        screenObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.refreshNotchInfo()
                self?.updatePanelFrame(animated: true)
            }
        }
    }

    private func updatePanelFrame(animated: Bool) {
        guard let panel else { return }
        let size = NSSize(width: panelSize.width, height: panelSize.height)
        let frame = NSRect(
            origin: NSPoint(x: notchInfo.screenCenter - size.width / 2, y: notchInfo.screenFrame.maxY - size.height),
            size: size
        )
        if animated {
            HudOverlayPanelShell.animateFrame(panel, to: frame, duration: 0.18)
        } else {
            panel.setFrame(frame, display: true)
        }
    }

    // MARK: Persistence

    private static func persistedConfiguration(key: String) -> HudNotchConfiguration? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(HudNotchConfiguration.self, from: data)
    }

    private func persist(_ configuration: HudNotchConfiguration) {
        guard let persistenceKey, let data = try? JSONEncoder().encode(configuration) else { return }
        UserDefaults.standard.set(data, forKey: persistenceKey)
    }
}
#endif
