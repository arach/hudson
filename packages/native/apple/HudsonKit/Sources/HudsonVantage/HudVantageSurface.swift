import Darwin
import Foundation
import SwiftUI
import AppKit
import HudsonObservability
import HudsonUI
import HudsonShell
import HudsonTerminal
import Termini

private let hudVantagePerfTrace = HudTrace(category: "vantage.perf")

/// Configuration for an embeddable Hudson Vantage.
///
/// A Vantage is a spatial operating surface for live runtimes. Hosts provide
/// product naming, control-plane paths, and an optional working directory while
/// Hudson owns the canvas interaction model.
public struct HudVantageConfiguration: Sendable {
    public var workspaceID: String
    public var surfaceTitle: String
    public var surfaceSubtitle: String
    public var commandURL: URL
    public var responseURL: URL
    public var stateURL: URL
    public var workingDirectoryURL: URL?
    public var followsSystemColorScheme: Bool
    public var restoresStateOnLaunch: Bool

    public init(
        workspaceID: String = "vantage",
        surfaceTitle: String = "Vantage",
        surfaceSubtitle: String = "native Hudson runtime surface",
        commandURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-control.jsonl"),
        responseURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-control.responses.jsonl"),
        stateURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-state.json"),
        workingDirectoryURL: URL? = nil,
        followsSystemColorScheme: Bool = true,
        restoresStateOnLaunch: Bool = false
    ) {
        self.workspaceID = GraphitePath.slugify(workspaceID, fallback: "vantage")
        self.surfaceTitle = surfaceTitle
        self.surfaceSubtitle = surfaceSubtitle
        self.commandURL = commandURL
        self.responseURL = responseURL
        self.stateURL = stateURL
        self.workingDirectoryURL = workingDirectoryURL
        self.followsSystemColorScheme = followsSystemColorScheme
        self.restoresStateOnLaunch = restoresStateOnLaunch
    }

    public static let terminiCanvasCaseStudy = HudVantageConfiguration(
        workspaceID: "termini-canvas",
        surfaceTitle: "Termini Canvas",
        surfaceSubtitle: "native macOS Hudson Vantage case study",
        commandURL: URL(fileURLWithPath: "/tmp/termini-canvas-control.jsonl"),
        responseURL: URL(fileURLWithPath: "/tmp/termini-canvas-control.responses.jsonl"),
        stateURL: URL(fileURLWithPath: "/tmp/termini-canvas-state.json"),
        restoresStateOnLaunch: true
    )
}

private enum HudVantageMetrics {
    static let terminalTitleBarHeight = HudLayout.fieldHeight
    static let terminalTrafficLightSize = HudDotSize.large
    static let nodeMinimumScreenSize = HudStrokeWidth.bold
    static let nodeMarkerMinimumWidth = HudIconSize.micro
    static let nodeMarkerMaximumWidth = HudIconSize.huge + HudSpacing.sm
    static let nodeMarkerMinimumHeight = HudSpacing.xl
    static let nodeMarkerMaximumHeight = HudIconSize.large + HudSpacing.xxs
    static let nodeMarkerStripeWidth = HudSpacing.xs
    static let nodeMarkerStripeFraction: CGFloat = 0.12
    static let resizeGripInset = HudSpacing.xxs + HudStrokeWidth.standard
    static let resizeGripSize = HudLayout.rowHeightCompact
    static let minimapHeight: CGFloat = 132
    static let panelResizeHandleWidth = HudSpacing.xs
    static let panelResizeIndicatorHeight = HudIconSize.xLarge
    static let filterButtonHeight = HudLayout.rowHeightCompact - HudSpacing.xs
    static let commandButtonWidth = HudLayout.rowHeightRegular
    static let viewportChipHeight = HudLayout.rowHeightCompact - HudSpacing.xxs
    static let zoomLabelWidth = HudIconSize.huge + HudSpacing.lg
    static let zoomControlShadowRadius = HudSpacing.xxl
    static let terminalCardShadowRadius = HudSpacing.xxl
    static let terminalCardSelectedShadowRadius = HudSpacing.xxxl + HudSpacing.xxs
    static let popOutMinimumWidth = HudLayout.cliffWidth
    static let popOutMinimumHeight = HudLayout.dialogWidth - HudLayout.rowHeightRegular + HudSpacing.xs
    static let popOutTabStripMaxWidth = HudLayout.popoverWidth
        + HudSpacing.huge
        + HudSpacing.xxxl
        + HudSpacing.xxxl
        + HudSpacing.xl
    static let popOutTerminalPreviewHeight = HudLayout.qrViewfinderSize + HudSpacing.lg
}

private extension HudTheme {
    var vantageControlFill: Color {
        palette.ink.opacity(HudOpacity.ghost)
    }

    var vantageControlHoverFill: Color {
        palette.ink.opacity(HudOpacity.subtle)
    }

    var vantageShadow: Color {
        self == .lightDraft ? palette.ink.opacity(HudOpacity.soft) : HudSurface.scrim
    }
}

@MainActor
private final class TerminalNode: ObservableObject, Identifiable {
    enum RuntimeIdentity {
        case localPTY
        case tmux(target: String, path: GraphitePath?, remoteHost: String?)

        var badge: String {
            switch self {
            case .localPTY: "LOCAL PTY"
            case .tmux(_, _, let remoteHost): remoteHost == nil ? "TMUX" : "SSH TMUX"
            }
        }

        var detail: String {
            switch self {
            case .localPTY:
                "zsh · local PTY"
            case .tmux(let target, _, let remoteHost):
                remoteHost.map { "\($0) · \(target)" } ?? target
            }
        }

        var graphitePath: String? {
            guard case .tmux(_, let path, _) = self else { return nil }
            return path?.description
        }
    }

    let id: UUID
    let workspace: TerminiLocalPTYWorkspace
    let title: String
    let subtitle: String
    let tint: HudTint
    let runtimeIdentity: RuntimeIdentity

    @Published var origin: CGPoint
    @Published var size: CGSize
    @Published var zIndex: Double
    @Published var tag: CanvasTag?

    init(
        id: UUID = UUID(),
        index: Int,
        origin: CGPoint,
        size: CGSize,
        tint: HudTint,
        zIndex: Double,
        processSpec: TerminiProcessSpec? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        runtimeIdentity: RuntimeIdentity = .localPTY,
        tag: CanvasTag? = nil,
        workingDirectoryURL: URL? = nil
    ) {
        let controller = TerminiTerminalController()
        self.id = id
        self.workspace = TerminiLocalPTYWorkspace(
            processSpec: processSpec ?? Self.localShellSpec(workingDirectoryURL: workingDirectoryURL),
            controller: controller
        )
        self.title = title ?? "Termini \(index)"
        self.subtitle = subtitle ?? runtimeIdentity.detail
        self.origin = origin
        self.size = size
        self.tint = tint
        self.zIndex = zIndex
        self.runtimeIdentity = runtimeIdentity
        self.tag = tag
        workspace.start()
    }

    var controller: TerminiTerminalController {
        workspace.controller
    }

    func move(by delta: CGSize) {
        origin.x += delta.width
        origin.y += delta.height
    }

    func resize(by delta: CGSize) {
        size.width = max(340, size.width + delta.width)
        size.height = max(220, size.height + delta.height)
    }

    func stop() {
        workspace.stop()
    }

    private static func localShellSpec() -> TerminiProcessSpec {
        localShellSpec(workingDirectoryURL: nil)
    }

    private static func localShellSpec(workingDirectoryURL: URL?) -> TerminiProcessSpec {
        shellSpec(
            executableURL: shellURL,
            arguments: ["-l"],
            workingDirectoryURL: workingDirectoryURL
        )
    }

    static func tmuxAttachSpec(
        target: String,
        createIfMissing: Bool,
        remoteHost: String?,
        workingDirectoryURL: URL?
    ) -> TerminiProcessSpec {
        let canCreate = createIfMissing && Self.isSessionName(target)
        let tmuxArguments = canCreate
            ? ["new-session", "-A", "-s", target]
            : ["attach-session", "-t", target]
        if let remoteHost {
            return shellSpec(
                executableURL: URL(fileURLWithPath: "/usr/bin/ssh"),
                arguments: ["-tt", remoteHost, "tmux"] + tmuxArguments,
                workingDirectoryURL: workingDirectoryURL
            )
        }

        return shellSpec(
            executableURL: localTmuxURL ?? URL(fileURLWithPath: "/usr/bin/env"),
            arguments: localTmuxURL == nil ? ["tmux"] + tmuxArguments : tmuxArguments,
            workingDirectoryURL: workingDirectoryURL
        )
    }

    static var localTmuxURL: URL? { TmuxToolchain.localTmuxURL }

    static func canCreateTmuxTarget(_ target: String, createIfMissing: Bool) -> Bool {
        createIfMissing && isSessionName(target)
    }

    static func localTmuxTargetExists(_ target: String) -> Bool {
        guard let localTmuxURL else { return false }

        let process = Process()
        process.executableURL = localTmuxURL
        process.arguments = ["has-session", "-t", target]
        process.standardOutput = Pipe()
        process.standardError = Pipe()

        do {
            try process.run()
        } catch {
            return false
        }
        process.waitUntilExit()
        return process.terminationStatus == 0
    }

    private static func shellSpec(
        executableURL: URL,
        arguments: [String],
        workingDirectoryURL: URL?
    ) -> TerminiProcessSpec {
        TerminiProcessSpec(
            executableURL: executableURL,
            arguments: arguments,
            environment: [
                "TERM": "xterm-256color",
                "HUDSON_VANTAGE": "1",
                "HUDSON_TERMINI_CANVAS": "1",
            ],
            workingDirectoryURL: workingDirectoryURL ?? defaultWorkingDirectoryURL
        )
    }

    private static var shellURL: URL {
        let environment = ProcessInfo.processInfo.environment
        let shellPath = environment["SHELL"].flatMap { $0.isEmpty ? nil : $0 } ?? "/bin/zsh"
        return URL(fileURLWithPath: shellPath)
    }

    private static func isSessionName(_ target: String) -> Bool {
        !target.contains(":") && !target.contains(".") && !target.hasPrefix("%")
    }

    private static var defaultWorkingDirectoryURL: URL {
        if let configuredPath = ProcessInfo.processInfo.environment["HUDSON_VANTAGE_WORKDIR"],
           !configuredPath.isEmpty {
            return URL(fileURLWithPath: configuredPath)
        }

        return URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}

private enum CanvasTool: String {
    case select
    case hand

    var statusLabel: String {
        rawValue
    }
}

private enum CanvasNavigationFilter: String, CaseIterable, Identifiable {
    case all
    case selected
    case live

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .selected: "Selected"
        case .live: "Live"
        }
    }
}

private enum CanvasTag: String, CaseIterable, Identifiable {
    case focus
    case watch
    case parked

    var id: String { rawValue }

    var label: String {
        switch self {
        case .focus: "Focus"
        case .watch: "Watch"
        case .parked: "Parked"
        }
    }

    var symbolName: String {
        switch self {
        case .focus: "scope"
        case .watch: "eye"
        case .parked: "tray"
        }
    }

    func tint(in theme: HudTheme) -> Color {
        switch self {
        case .focus: theme.palette.statusOk
        case .watch: theme.palette.statusInfo
        case .parked: theme.palette.statusWarn
        }
    }
}

private struct SelectionDrag {
    var start: CGPoint
    var current: CGPoint
    var baseSelection: Set<UUID>
    var mode: HudVantageSelectionMode

    var viewportRect: CGRect {
        CGRect(
            x: min(start.x, current.x),
            y: min(start.y, current.y),
            width: abs(current.x - start.x),
            height: abs(current.y - start.y)
        )
    }
}

private struct TmuxReattachSpec {
    var target: String
    var path: GraphitePath?
    var title: String
    var remoteHost: String?
}

private enum HudVantageStateError: Error, LocalizedError {
    case stateFileMissing(String)
    case missingRuntimeTarget(UUID)
    case missingTmuxTarget(String)
    case tmuxMissing

    var errorDescription: String? {
        switch self {
        case .stateFileMissing(let path):
            "state file not found: \(path)"
        case .missingRuntimeTarget(let id):
            "state node \(id) is missing a tmux target"
        case .missingTmuxTarget(let target):
            "tmux target \(target) not found; create it first or restore with createIfMissing"
        case .tmuxMissing:
            "tmux executable not found; install tmux locally or restore remote nodes"
        }
    }
}

private enum HudVantageControlNodeError: Error, LocalizedError {
    case missingSelector
    case emptySelection
    case notFound(String)
    case ambiguous(String)

    var errorCode: String {
        switch self {
        case .missingSelector: "missing_node_selector"
        case .emptySelection: "empty_selection"
        case .notFound: "node_not_found"
        case .ambiguous: "ambiguous_node_selector"
        }
    }

    var errorDescription: String? {
        switch self {
        case .missingSelector:
            "node selector required; pass nodeID, nodeIDs, or ids"
        case .emptySelection:
            "no nodes are selected"
        case .notFound(let selector):
            "node \(selector) not found"
        case .ambiguous(let selector):
            "node selector \(selector) matched multiple nodes"
        }
    }
}

private func formattedZoom(_ scale: CGFloat) -> String {
    let percent = scale * 100

    if percent < 1 {
        return String(format: "%.2f%%", Double(percent))
    }
    if percent < 10 {
        return String(format: "%.1f%%", Double(percent))
    }
    if percent >= 10_000 {
        return String(format: "%.1fk%%", Double(percent / 1_000))
    }
    return "\(Int(percent.rounded()))%"
}

/// Native Hudson surface for terminal-backed durable runtimes.
///
/// The current implementation focuses on local PTYs, local tmux, remote tmux
/// over SSH, and JSONL-driven external control. It is intentionally embeddable:
/// Scout, Talkie, Fabric, or a standalone app can each host their own Vantage
/// by supplying a `HudVantageConfiguration`.
public struct HudVantageSurface: View {
    private static let tileLimit = 128
    private static let largeTileLimit = 512
    private static let defaultPerfHarnessCount = 64
    private static let defaultPerfHarnessRateMS = 250.0
    private static let minimumCanvasScale: CGFloat = 0.002
    private static let maximumCanvasScale: CGFloat = 64

    private let configuration: HudVantageConfiguration

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.hudTheme) private var inheritedTheme

    @State private var nodes: [TerminalNode] = []
    @State private var selectedIDs: Set<UUID> = []
    @State private var navigationFilter: CanvasNavigationFilter = .all
    @State private var navigationTagFilter: CanvasTag?
    @State private var navigationCollapsed = false
    @State private var navigationWidth: CGFloat = 254
    @State private var inspectorCollapsed = false
    @State private var inspectorWidth: CGFloat = 300
    @State private var focusedNodeID: UUID?
    @State private var popOutWindows: [UUID: NSWindow] = [:]
    @State private var popOutDelegates: [UUID: VantagePopOutWindowDelegate] = [:]
    @State private var nextIndex = 3
    @State private var nextZIndex: Double = 3
    @StateObject private var controlAPI: HudVantageControlAPI
    @State private var controlStatus = "API ready"
    @State private var controlCommandCount = 0
    @State private var lastControlAction: String?
    @State private var lastControlDurationMS: Double?
    @State private var perfTracker = HudVantagePerfTracker()
    @State private var tmuxInstallInProgress = false
    @State private var tmuxInstallMessage = ""
    @State private var tmuxInstallConfirmationPresented = false
    @State private var perfHarnessPrefix: String?
    @State private var didBootstrap = false
    @State private var canvasTool: CanvasTool = .select
    @State private var canvasState = HudVantageCanvasState(
        minimumScale: HudVantageSurface.minimumCanvasScale,
        maximumScale: HudVantageSurface.maximumCanvasScale
    )
    @State private var transientHandActive = false
    @State private var panStart: CGSize?
    @State private var zoomStart: CGFloat?
    @State private var selectionDrag: SelectionDrag?
    @State private var pendingPersistTask: Task<Void, Never>?

    public init(configuration: HudVantageConfiguration = .init()) {
        self.configuration = configuration
        _controlAPI = StateObject(
            wrappedValue: HudVantageControlAPI(
                commandURL: configuration.commandURL,
                responseURL: configuration.responseURL
            )
        )
    }

    public var body: some View {
        HudAppShell {
            if !isTerminalFocusActive {
                navigationPanel
            }
        } trailing: {
            if !isTerminalFocusActive {
                inspectorPanel
            }
        } content: {
            terminalCanvasShell
        } statusBar: {
            statusBar
        }
        .onAppear {
            bootstrapIfNeeded()
            startControlAPI()
        }
        .onDisappear {
            pendingPersistTask?.cancel()
            pendingPersistTask = nil
            persistStateIfConfigured()
            controlAPI.stop()
            closePopOutWindows()
            stopAllNodes()
            didBootstrap = false
        }
        .onChange(of: canvasTool) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: navigationFilter) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: navigationTagFilter) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: navigationCollapsed) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: navigationWidth) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: inspectorCollapsed) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: inspectorWidth) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .confirmationDialog(
            "Install tmux with Homebrew?",
            isPresented: $tmuxInstallConfirmationPresented
        ) {
            Button("Install tmux") {
                startTmuxInstall()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(tmuxInstallPermissionMessage)
        }
        .hudTheme(activeTheme)
        .environment(\.colorScheme, activeColorScheme)
        .toolbar {
            ToolbarItemGroup(placement: .navigation) {
                if navigationCollapsed {
                    Button {
                        navigationCollapsed = false
                    } label: {
                        Label("Show navigator", systemImage: "sidebar.left")
                    }
                    .labelStyle(.iconOnly)
                    .help("Show navigator")
                    .accessibilityLabel("Show navigator")
                }
            }

            ToolbarItemGroup(placement: .primaryAction) {
                if inspectorCollapsed {
                    Button {
                        inspectorCollapsed = false
                    } label: {
                        Label("Show inspector", systemImage: "sidebar.right")
                    }
                    .labelStyle(.iconOnly)
                    .help("Show inspector")
                    .accessibilityLabel("Show inspector")
                }
            }
        }
        .onExitCommand {
            if isTerminalFocusActive {
                exitFocusMode()
            }
        }
        .background(HudWindowChrome(colorScheme: activeColorScheme))
    }

    private var activeColorScheme: ColorScheme {
        if configuration.followsSystemColorScheme {
            return colorScheme
        }
        return inheritedTheme == .lightDraft ? .light : .dark
    }

    private var activeTheme: HudTheme {
        guard configuration.followsSystemColorScheme else {
            return inheritedTheme
        }
        return colorScheme == .dark ? .default : .lightDraft
    }

    private var effectiveCanvasTool: CanvasTool {
        transientHandActive ? .hand : canvasTool
    }

    private var focusedNode: TerminalNode? {
        guard let focusedNodeID else { return nil }
        return nodes.first { $0.id == focusedNodeID }
    }

    private var isTerminalFocusActive: Bool {
        focusedNode != nil
    }

    @ViewBuilder
    private var navigationPanel: some View {
        if !navigationCollapsed {
            CanvasNavigationPanel(
                width: $navigationWidth,
                nodes: navigationNodes,
                minimapNodes: nodes,
                totalCount: nodes.count,
                selectedCount: selectedIDs.count,
                filter: $navigationFilter,
                tagFilter: $navigationTagFilter,
                selectedIDs: selectedIDs,
                viewportWorldRect: canvasState.visibleWorldRect,
                canvasWorldBounds: canvasWorldBounds,
                canvasScale: canvasState.scale,
                onSelectNode: selectNode,
                onCenterNode: centerNode,
                onTagSelection: tagSelection(as:),
                onCenterWorldPoint: centerCanvas(on:),
                onFit: fitCanvasToViewport,
                onCollapse: { navigationCollapsed = true }
            )
        }
    }

    @ViewBuilder
    private var inspectorPanel: some View {
        if !inspectorCollapsed {
            CanvasInspectorPanel(
                width: $inspectorWidth,
                selectedNodes: selectedNodes,
                totalCount: nodes.count,
                tmuxAvailable: TerminalNode.localTmuxURL != nil,
                tmuxInstallInProgress: tmuxInstallInProgress,
                tmuxInstallMessage: tmuxInstallMessage,
                onCenterNode: { node in
                    centerCanvas(on: CGPoint(x: node.origin.x + node.size.width / 2, y: node.origin.y + node.size.height / 2))
                },
                onCloseNode: close,
                onInstallTmux: { tmuxInstallConfirmationPresented = true },
                onCollapse: { inspectorCollapsed = true }
            )
        }
    }

    private var selectedNodes: [TerminalNode] {
        nodes.filter { selectedIDs.contains($0.id) }
    }

    private func showCommandPlaceholder() {
        controlStatus = "Command palette placeholder"
    }

    private var tmuxInstallPermissionMessage: String {
        let command = TmuxToolchain.homebrewInstallCommandDescription
            ?? "Homebrew was not found in PATH or common install locations."
        return "Vantage will run \(command). This is only needed for local tmux-backed sessions."
    }

    private var canvasHeader: some View {
        HStack(spacing: HudSpacing.lg) {
            if let focusedNode {
                HudStatusDot(color: focusedNode.tint.color, size: HudDotSize.small)
                Text(configuration.surfaceTitle.uppercased())
                    .font(HudFont.mono(10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(activeTheme.palette.ink)
                HudBadge("FOCUS", tint: focusedNode.tint.color, dot: true)
                Text(focusedNode.title)
                    .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                    .foregroundStyle(activeTheme.palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                Text(focusedNode.subtitle)
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Spacer()

                HudButton("Pop out", icon: "rectangle.on.rectangle", style: .ghost) {
                    popOut(nodes: [focusedNode])
                }
                HudButton("Close", icon: "xmark", style: .ghost) {
                    exitFocusMode()
                    close(focusedNode.id)
                }
                HudButton("Exit", icon: "arrow.down.right.and.arrow.up.left", style: .secondary) {
                    exitFocusMode()
                }
            } else {
                HudStatusDot(color: activeTheme.palette.statusOk, size: HudDotSize.small)
                Text(configuration.surfaceTitle.uppercased())
                    .font(HudFont.mono(10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(activeTheme.palette.ink)
                Text(configuration.surfaceSubtitle)
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Spacer()
                CanvasToolSwitch(
                    tool: effectiveCanvasTool,
                    onSelect: { canvasTool = .select },
                    onHand: { canvasTool = .hand }
                )
                CommandKeyButton(action: showCommandPlaceholder)

                HudButton("Focus", icon: "rectangle.inset.filled", style: .secondary) {
                    focusSelection()
                }
                .disabled(selectedIDs.count != 1)

                HudButton("Pop out", icon: "rectangle.on.rectangle", style: .secondary) {
                    popOutSelection()
                }
                .disabled(selectedIDs.isEmpty)

                HudButton("New", icon: "plus", style: .primary(.cyan)) {
                    spawnTerminal()
                }
            }
        }
    }

    private var terminalCanvasShell: some View {
        VStack(spacing: 0) {
            canvasHeader
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, HudSpacing.xxl)
                .frame(height: HudLayout.navHeight)
                .background(activeTheme.palette.chrome)
            HudDivider(color: activeTheme.hairline.standard)
            canvasViewport
        }
    }

    private var canvasViewport: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                activeTheme.palette.bg
                InfiniteCanvasBackground(
                    pan: canvasBackgroundPan,
                    scale: canvasBackgroundScale
                )
                .allowsHitTesting(false)

                terminalCanvas
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .allowsHitTesting(isTerminalFocusActive || effectiveCanvasTool == .select)

                if !isTerminalFocusActive, let rect = selectionDrag?.viewportRect {
                    SelectionMarquee(rect: rect)
                }

            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
            .contentShape(Rectangle())
            .background(
                CanvasInputBridge(
                    onScroll: { delta, location in
                        handleCanvasScroll(delta: delta, at: location)
                    },
                    onMagnify: { magnification, location in
                        handleCanvasMagnify(magnification, at: location)
                    },
                    canBeginSpacePan: { location in
                        canBeginSpacePan(at: location)
                    },
                    onSpacePanChanged: { isActive in
                        transientHandActive = isActive
                    }
                )
            )
            .gesture(canvasInteractionGesture)
            .simultaneousGesture(canvasZoomGesture)
            .onAppear {
                canvasState = canvasState.withViewportSize(proxy.size)
            }
            .onChange(of: proxy.size) { _, size in
                canvasState = canvasState.withViewportSize(size)
            }
            .onChange(of: transientHandActive) { _, isActive in
                if isActive {
                    selectionDrag = nil
                } else {
                    panStart = nil
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if !isTerminalFocusActive {
                    CanvasZoomTool(
                        scale: canvasState.scale,
                        onZoomOut: { zoom(by: 0.5) },
                        onZoomIn: { zoom(by: 2) },
                        onReset: {
                            resetCanvasViewport()
                            schedulePersistStateIfConfigured()
                        },
                        onFit: { fitCanvasToViewport() }
                    )
                    .padding(HudSpacing.xl)
                }
            }
        }
    }

    private var canvasInteractionGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                guard !isTerminalFocusActive else { return }
                switch effectiveCanvasTool {
                case .hand:
                    perfTracker.increment("input.canvasPan.delta")
                    let start = panStart ?? canvasState.pan
                    panStart = start
                    canvasState = canvasState.replaying(
                        panX: start.width + value.translation.width,
                        panY: start.height + value.translation.height,
                        scale: nil
                    )
                case .select:
                    if var drag = selectionDrag {
                        drag.current = value.location
                        selectionDrag = drag
                    } else {
                        selectionDrag = SelectionDrag(
                            start: value.startLocation,
                            current: value.location,
                            baseSelection: selectedIDs,
                            mode: pointerSelectionMode()
                        )
                    }
                    perfTracker.increment("input.marquee.delta")
                    updateMarqueeSelection()
                }
            }
            .onEnded { _ in
                guard !isTerminalFocusActive else { return }
                perfTracker.increment("input.canvasDrag.end")
                panStart = nil
                schedulePersistStateIfConfigured()
                selectionDrag = nil
            }
    }

    private func canBeginSpacePan(at viewportPoint: CGPoint) -> Bool {
        guard !isTerminalFocusActive else { return false }
        let worldPoint = canvasState.worldPoint(fromViewportPoint: viewportPoint)
        return !nodes.contains { node in
            rendersLiveSurface(for: node) && nodeFrame(node).contains(worldPoint)
        }
    }

    private var canvasZoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                guard !isTerminalFocusActive else { return }
                let start = zoomStart ?? canvasState.scale
                zoomStart = start
                setCanvasScale(start * value, around: canvasState.viewportCenter)
            }
            .onEnded { _ in
                zoomStart = nil
            }
    }

    private func zoom(by factor: CGFloat) {
        setCanvasScale(canvasState.scale * factor, around: canvasState.viewportCenter)
    }

    private func handleCanvasScroll(delta: CGSize, at viewportPoint: CGPoint) {
        guard !isTerminalFocusActive else { return }
        perfTracker.increment("input.scroll")
        if abs(delta.height) >= abs(delta.width) {
            perfTracker.increment("input.scroll.zoom")
            let factor = min(max(exp(delta.height * 0.004), 0.82), 1.22)
            setCanvasScale(canvasState.scale * factor, around: viewportPoint)
        } else {
            perfTracker.increment("input.scroll.pan")
            canvasState = canvasState.panned(by: CGSize(width: delta.width, height: 0))
        }
    }

    private func handleCanvasMagnify(_ magnification: CGFloat, at viewportPoint: CGPoint) {
        guard !isTerminalFocusActive else { return }
        perfTracker.increment("input.magnify")
        let factor = min(max(1 + magnification, 0.75), 1.35)
        setCanvasScale(canvasState.scale * factor, around: viewportPoint)
    }

    private func setCanvasScale(_ proposedScale: CGFloat, around screenPoint: CGPoint) {
        canvasState = canvasState.zoomed(to: proposedScale, around: screenPoint)
        schedulePersistStateIfConfigured()
    }

    private func fitCanvasToViewport() {
        canvasState = canvasState.fitting(canvasWorldBounds)
        schedulePersistStateIfConfigured()
    }

    private func updateMarqueeSelection() {
        guard let selectionDrag else { return }
        perfTracker.increment("selection.marquee.update")
        let rect = canvasState.worldRect(fromViewportRect: selectionDrag.viewportRect)
        let candidates = Set(
            nodes
                .filter { node in
                    rect.intersects(nodeFrame(node))
                }
                .map(\.id)
        )
        perfTracker.set("selection.marquee.candidates", to: candidates.count)
        selectedIDs = HudVantageSelectionState(ids: selectionDrag.baseSelection)
            .applying(candidates, mode: selectionDrag.mode)
            .ids
    }

    private func centerCanvas(on worldPoint: CGPoint) {
        canvasState = canvasState.centered(on: worldPoint)
        schedulePersistStateIfConfigured()
    }

    private func resetCanvasViewport() {
        canvasState = canvasState.reset()
    }

    private func nodeFrame(_ node: TerminalNode) -> CGRect {
        CGRect(origin: node.origin, size: node.size)
    }

    private var navigationNodes: [TerminalNode] {
        let filteredNodes: [TerminalNode]
        switch navigationFilter {
        case .all:
            filteredNodes = nodes
        case .selected:
            filteredNodes = nodes.filter { selectedIDs.contains($0.id) }
        case .live:
            filteredNodes = nodes.filter { rendersLiveSurface(for: $0) }
        }

        guard let navigationTagFilter else { return filteredNodes }
        return filteredNodes.filter { $0.tag == navigationTagFilter }
    }

    private func rendersLiveSurface(for node: TerminalNode) -> Bool {
        if let focusedNodeID = focusedNode?.id {
            return node.id == focusedNodeID
        }

        guard canvasState.scale >= 0.25 else { return false }

        if nodes.count <= 24 {
            return true
        }

        return canvasState.scale >= 0.58
            && selectedIDs.count == 1
            && selectedIDs.contains(node.id)
    }

    private var canvasBackgroundPan: CGSize {
        guard let focusedNode else { return canvasState.pan }
        let scale = displayScale(for: focusedNode)
        return displayPan(for: focusedNode, scale: scale)
    }

    private var canvasBackgroundScale: CGFloat {
        guard let focusedNode else { return canvasState.scale }
        return displayScale(for: focusedNode)
    }

    private func shouldRenderNode(_ node: TerminalNode) -> Bool {
        guard let focusedNodeID = focusedNode?.id else { return true }
        return node.id == focusedNodeID
    }

    private func displayScale(for node: TerminalNode) -> CGFloat {
        guard focusedNode?.id == node.id else { return canvasState.scale }

        let inset = HudSpacing.huge + HudSpacing.xxxl
        let availableWidth = max(HudLayout.rowHeightRegular, canvasState.viewportSize.width - inset * 2)
        let availableHeight = max(HudLayout.rowHeightRegular, canvasState.viewportSize.height - inset * 2)
        guard node.size.width > 0, node.size.height > 0 else { return 1 }

        let fitScale = min(availableWidth / node.size.width, availableHeight / node.size.height)
        return clamped(fitScale, to: Self.minimumCanvasScale...Self.maximumCanvasScale)
    }

    private func displayPan(for node: TerminalNode, scale: CGFloat) -> CGSize {
        guard focusedNode?.id == node.id else { return canvasState.pan }

        let width = node.size.width * scale
        let height = node.size.height * scale
        return CGSize(
            width: (canvasState.viewportSize.width - width) / 2 - node.origin.x * scale,
            height: (canvasState.viewportSize.height - height) / 2 - node.origin.y * scale
        )
    }

    private var terminalCanvas: some View {
        ZStack(alignment: .topLeading) {
            ForEach(nodes) { node in
                if shouldRenderNode(node) {
                    let isFocused = focusedNodeID == node.id
                    let displayScale = displayScale(for: node)
                    TerminalNodeView(
                        node: node,
                        isSelected: selectedIDs.contains(node.id),
                        isFocused: isFocused,
                        rendersLiveSurface: rendersLiveSurface(for: node),
                        canvasPan: displayPan(for: node, scale: displayScale),
                        canvasScale: displayScale,
                        onSelect: { selectNode(node.id) },
                        onFocus: { enterFocusMode(node.id) },
                        onDragBegin: {
                            if !isFocused {
                                beginDraggingNode(node.id)
                            }
                        },
                        onClose: { close(node.id) },
                        onMove: { delta in
                            if !isFocused {
                                move(node.id, delta: worldDelta(delta, scale: displayScale))
                            }
                        },
                        onResize: { delta in
                            if !isFocused {
                                resize(node.id, delta: worldDelta(delta, scale: displayScale))
                            }
                        },
                        onTransformEnd: {
                            if !isFocused {
                                finishNodeTransform()
                            }
                        }
                    )
                }
            }
        }
        .coordinateSpace(name: "termini-canvas")
        .contentShape(Rectangle())
        .onTapGesture {
            guard !isTerminalFocusActive else { return }
            selectedIDs.removeAll()
            schedulePersistStateIfConfigured()
        }
    }

    private var inspector: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudButton("Create terminal", icon: "plus", style: .primary(.cyan)) {
                spawnTerminal()
            }

            ForEach(nodes) { node in
                TerminalInspectorRow(
                    node: node,
                    isSelected: selectedIDs.contains(node.id),
                    onSelect: { selectNode(node.id) }
                )
            }

            Spacer()
        }
        .padding(HudSpacing.xxl)
    }

    private var statusBar: some View {
        ZStack {
            HStack(spacing: HudSpacing.xl) {
                HudStatusDot(color: activeTheme.palette.statusOk)
                Text("HUDSONKIT MACOS")
                    .font(HudFont.mono(10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(activeTheme.palette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.dim)
                Text("\(nodes.count) nodes")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.dim)
                Text("\(selectedIDs.count) selected")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.dim)
                Text(controlPerfLabel)
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.dim)
                Text(controlStatus.uppercased())
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Spacer()
            }
            .padding(.horizontal, HudSpacing.xxl)

            ViewportStatusChip(
                rect: canvasState.visibleWorldRect,
                scale: canvasState.scale,
                tool: effectiveCanvasTool
            )
        }
        .frame(height: HudLayout.statusBarHeight)
    }

    private var controlPerfLabel: String {
        guard let action = lastControlAction, let duration = lastControlDurationMS else {
            return "api idle"
        }

        return "\(action) \(String(format: "%.1f", duration))ms"
    }

    private func spawnTerminal() {
        let offset = CGFloat((nextIndex - 1) % 5) * 36
        let node = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 130 + offset, y: 120 + offset),
            size: CGSize(width: 500, height: 316),
            tint: tint(for: nextIndex),
            zIndex: nextZIndex,
            workingDirectoryURL: configuration.workingDirectoryURL
        )
        nodes.append(node)
        selectedIDs = [node.id]
        nextIndex += 1
        nextZIndex += 1
    }

    private func startControlAPI() {
        controlAPI.start { command in
            let span = hudVantagePerfTrace.beginSpan(
                "control.command",
                metadata: ["action": command.normalizedAction]
            )
            let startedAt = CFAbsoluteTimeGetCurrent()
            var response = handleControlCommand(command)
            let duration = (CFAbsoluteTimeGetCurrent() - startedAt) * 1_000
            controlCommandCount += 1
            lastControlAction = command.normalizedAction
            lastControlDurationMS = duration
            perfTracker.increment("control.command")
            perfTracker.increment("control.action.\(command.normalizedAction)")
            perfTracker.recordTiming("control.\(command.normalizedAction)", durationMS: duration)
            response.durationMS = duration
            if response.metrics == nil, command.includeMetrics != false {
                response.metrics = controlMetrics()
            }
            if response.viewport == nil, command.includeViewport != false {
                response.viewport = controlViewport()
            }
            controlStatus = response.message
            span.end(response.ok ? "ok" : "error")
            return response
        }
    }

    private func bootstrapIfNeeded() {
        guard !didBootstrap else { return }
        didBootstrap = true
        if let command = bootstrapReattachCommand() {
            let response = reattachTmuxTargets(command)
            controlStatus = response.message
            if response.ok {
                return
            }
        }
        if let command = bootstrapRestoreCommand() {
            let response = restoreWorkspaceState(command)
            controlStatus = response.message
            if response.ok {
                return
            }
        }
        resetTerminals()
    }

    private func bootstrapReattachCommand() -> HudVantageControlCommand? {
        let environment = ProcessInfo.processInfo.environment
        let ids = parseEnvironmentList(
            environment["HUDSON_VANTAGE_REATTACH_IDS"]
                ?? environment["TERMINI_CANVAS_REATTACH_IDS"]
        )
        let sessions = parseEnvironmentList(
            environment["HUDSON_VANTAGE_REATTACH_SESSIONS"]
                ?? environment["TERMINI_CANVAS_REATTACH_SESSIONS"]
        )
        let targets = parseEnvironmentList(
            environment["HUDSON_VANTAGE_REATTACH_TARGETS"]
                ?? environment["TERMINI_CANVAS_REATTACH_TARGETS"]
        )
        let remoteHost = environment["HUDSON_VANTAGE_REATTACH_REMOTE_HOST"]
            ?? environment["TERMINI_CANVAS_REATTACH_REMOTE_HOST"]

        guard !ids.isEmpty || !sessions.isEmpty || !targets.isEmpty else {
            return nil
        }

        return HudVantageControlCommand(
            id: "bootstrap-reattach",
            action: "reattach",
            reset: true,
            ids: ids.isEmpty ? nil : ids,
            sessions: sessions.isEmpty ? nil : sessions,
            targets: targets.isEmpty ? nil : targets,
            createIfMissing: (environment["HUDSON_VANTAGE_REATTACH_CREATE"]
                ?? environment["TERMINI_CANVAS_REATTACH_CREATE"]) == "1",
            remoteHost: remoteHost
        )
    }

    private func bootstrapRestoreCommand() -> HudVantageControlCommand? {
        let environment = ProcessInfo.processInfo.environment
        let shouldRestore = configuration.restoresStateOnLaunch
            || environment["HUDSON_VANTAGE_RESTORE_ON_LAUNCH"] == "1"
            || environment["TERMINI_CANVAS_RESTORE_ON_LAUNCH"] == "1"
        guard shouldRestore else { return nil }

        let statePath = environment["HUDSON_VANTAGE_STATE_FILE"]
            ?? environment["TERMINI_CANVAS_STATE_FILE"]

        return HudVantageControlCommand(
            id: "bootstrap-restore",
            action: "restore",
            workspaceID: configuration.workspaceID,
            statePath: statePath,
            reset: true,
            createIfMissing: (environment["HUDSON_VANTAGE_RESTORE_CREATE"]
                ?? environment["TERMINI_CANVAS_RESTORE_CREATE"]) == "1"
        )
    }

    private func parseEnvironmentList(_ value: String?) -> [String] {
        guard let value else { return [] }
        return value
            .components(separatedBy: CharacterSet(charactersIn: ",;\n"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func handleControlCommand(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        switch command.normalizedAction {
        case "tile", "grid":
            return tileTerminals(command)
        case "spawn", "new", "create":
            return spawnTerminals(command)
        case "reattach", "attach", "tmux":
            return reattachTmuxTargets(command)
        case "select":
            return selectNodes(command)
        case "inspect", "node":
            return inspectNodes(command)
        case "focus", "center", "reveal":
            return focusNodes(command)
        case "focus-mode", "focusmode", "enter-focus", "enterfocus", "solo":
            return enterFocusMode(command)
        case "exit-focus", "exitfocus", "leave-focus", "leavefocus", "unfocus":
            return exitFocusMode(command)
        case "popout", "pop-out", "pop-window", "popwindow":
            return popOutNodes(command)
        case "close", "remove":
            return closeNodes(command)
        case "metrics", "perf":
            return controlResponse(
                command,
                ok: true,
                message: "\(nodes.count) nodes · \(selectedIDs.count) selected"
            )
        case "viewport", "view":
            return applyViewportCommand(command)
        case "perf-reset", "reset-metrics":
            controlCommandCount = 0
            lastControlAction = nil
            lastControlDurationMS = nil
            perfTracker.reset()
            return controlResponse(
                command,
                ok: true,
                message: "perf counters reset"
            )
        case "ensure-tmux", "ensuretmux", "tmux-ensure", "install-tmux", "installtmux", "tmux-install":
            return requestTmuxInstall(command)
        case "perf-harness", "perfharness", "harness", "stress":
            return runPerfHarness(command)
        case "perf-cleanup", "perfcleanup", "harness-cleanup", "stress-cleanup":
            return cleanupPerfHarness(command)
        case "save", "snapshot", "save-workspace", "workspace-save", "export-workspace":
            return saveWorkspaceState(command)
        case "restore", "load", "restore-workspace", "workspace-restore", "open-workspace", "import-workspace":
            return restoreWorkspaceState(command)
        case "clear":
            stopAllNodes()
            schedulePersistStateIfConfigured()
            return controlResponse(
                command,
                ok: true,
                message: "cleared terminals"
            )
        case "reset":
            resetTerminals()
            return controlResponse(
                command,
                ok: true,
                message: "reset terminals"
            )
        case "status":
            return controlResponse(
                command,
                ok: true,
                message: "\(nodes.count) terminals"
            )
        default:
            return controlResponse(
                command,
                ok: false,
                message: "unknown action \(command.action)"
            )
        }
    }

    private func tileTerminals(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let columns = clamp(command.columns ?? 4, lower: 1, upper: 32)
        let rows = clamp(command.rows ?? 4, lower: 1, upper: 32)
        let total = columns * rows
        let limit = command.allowLarge == true ? Self.largeTileLimit : Self.tileLimit

        guard total <= limit else {
            return controlResponse(
                command,
                ok: false,
                message: "requested \(total); limit is \(limit)"
            )
        }

        let shouldReset = command.reset ?? true
        let reusableNodes = shouldReset ? nodes : []
        var reusableIndex = 0

        if shouldReset {
            nextIndex = 1
            nextZIndex = 1
            resetCanvasViewport()
        }

        let size = CGSize(
            width: CGFloat(max(240.0, command.width ?? 300.0)),
            height: CGFloat(max(160.0, command.height ?? 200.0))
        )
        let gap = CGFloat(max(0.0, command.gap ?? 18.0))
        let originX = CGFloat(command.originX ?? 64.0)
        let originY = CGFloat(command.originY ?? 70.0)

        var tiledNodes: [TerminalNode] = []
        tiledNodes.reserveCapacity(total)

        for row in 0..<rows {
            for column in 0..<columns {
                let origin = CGPoint(
                    x: originX + CGFloat(column) * (size.width + gap),
                    y: originY + CGFloat(row) * (size.height + gap)
                )

                let node: TerminalNode
                if shouldReset && reusableIndex < reusableNodes.count {
                    node = reusableNodes[reusableIndex]
                    node.origin = origin
                    node.size = size
                    node.zIndex = nextZIndex
                    reusableIndex += 1
                } else {
                    node = TerminalNode(
                        index: nextIndex,
                        origin: origin,
                        size: size,
                        tint: tint(for: nextIndex),
                        zIndex: nextZIndex,
                        workingDirectoryURL: configuration.workingDirectoryURL
                    )
                }
                tiledNodes.append(node)
                nextIndex += 1
                nextZIndex += 1
            }
        }

        if shouldReset {
            reusableNodes.dropFirst(reusableIndex).forEach { $0.stop() }
            nodes = tiledNodes
        } else {
            nodes.append(contentsOf: tiledNodes)
        }
        selectedIDs.removeAll()
        fitCanvasToViewport()
        schedulePersistStateIfConfigured()

        return controlResponse(
            command,
            ok: true,
            message: "tiled \(columns)x\(rows)"
        )
    }

    private func spawnTerminals(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let count = clamp(command.count ?? 1, lower: 1, upper: 32)
        let size = CGSize(
            width: CGFloat(max(240.0, command.width ?? 500.0)),
            height: CGFloat(max(160.0, command.height ?? 316.0))
        )
        let gap = CGFloat(max(8.0, command.gap ?? 36.0))
        let originX = CGFloat(command.originX ?? 130.0)
        let originY = CGFloat(command.originY ?? 120.0)

        for index in 0..<count {
            let offset = CGFloat(index) * gap
            let node = TerminalNode(
                index: nextIndex,
                origin: CGPoint(x: originX + offset, y: originY + offset),
                size: size,
                tint: tint(for: nextIndex),
                zIndex: nextZIndex,
                workingDirectoryURL: configuration.workingDirectoryURL
            )
            nodes.append(node)
            selectedIDs = [node.id]
            nextIndex += 1
            nextZIndex += 1
        }

        return controlResponse(
            command,
            ok: true,
            message: "spawned \(count)"
        )
    }

    private func reattachTmuxTargets(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let span = hudVantagePerfTrace.beginSpan("tmux.reattach")
        let specs: [TmuxReattachSpec]
        do {
            specs = try tmuxReattachSpecs(from: command)
        } catch {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription
            )
        }

        guard !specs.isEmpty else {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "reattach requires ids, sessions, or targets"
            )
        }

        if specs.allSatisfy({ $0.remoteHost == nil }), TerminalNode.localTmuxURL == nil {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "tmux executable not found; install tmux locally or pass remoteHost"
            )
        }

        if let missingLocalTarget = specs.first(where: { spec in
            guard spec.remoteHost == nil else { return false }
            if TerminalNode.canCreateTmuxTarget(
                spec.target,
                createIfMissing: command.createIfMissing == true
            ) {
                return false
            }
            return !TerminalNode.localTmuxTargetExists(spec.target)
        }) {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "tmux target \(missingLocalTarget.target) not found; create it first or use --session NAME --create"
            )
        }

        let count = specs.count
        let columns = clamp(
            command.columns ?? Int(ceil(sqrt(Double(count)))),
            lower: 1,
            upper: 32
        )
        let size = CGSize(
            width: CGFloat(max(300.0, command.width ?? 500.0)),
            height: CGFloat(max(200.0, command.height ?? 316.0))
        )
        let gap = CGFloat(max(0.0, command.gap ?? 22.0))
        let originX = CGFloat(command.originX ?? 72.0)
        let originY = CGFloat(command.originY ?? 76.0)
        let shouldReset = command.reset ?? true

        if shouldReset {
            stopAllNodes()
            nextIndex = 1
            nextZIndex = 1
        }

        var created: [TerminalNode] = []
        created.reserveCapacity(count)

        for (offset, spec) in specs.enumerated() {
            let row = offset / columns
            let column = offset % columns
            let origin = CGPoint(
                x: originX + CGFloat(column) * (size.width + gap),
                y: originY + CGFloat(row) * (size.height + gap)
            )
            let node = TerminalNode(
                index: nextIndex,
                origin: origin,
                size: size,
                tint: tint(for: nextIndex),
                zIndex: nextZIndex,
                processSpec: TerminalNode.tmuxAttachSpec(
                    target: spec.target,
                    createIfMissing: command.createIfMissing == true,
                    remoteHost: spec.remoteHost,
                    workingDirectoryURL: configuration.workingDirectoryURL
                ),
                title: spec.title,
                subtitle: spec.remoteHost.map { "ssh · \($0)" } ?? "tmux · \(spec.target)",
                runtimeIdentity: .tmux(
                    target: spec.target,
                    path: spec.path,
                    remoteHost: spec.remoteHost
                )
            )
            created.append(node)
            nextIndex += 1
            nextZIndex += 1
        }

        nodes.append(contentsOf: created)
        selectedIDs = Set(created.map(\.id))
        fitCanvasToViewport()
        persistStateIfConfigured()

        span.end()
        return controlResponse(
            command,
            ok: true,
            message: "reattached \(count) tmux target\(count == 1 ? "" : "s")"
        )
    }

    private func runPerfHarness(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let span = hudVantagePerfTrace.beginSpan("perf.harness")
        guard TerminalNode.localTmuxURL != nil else {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "tmux executable not found; run ensure-tmux first"
            )
        }

        let total = clamp(
            command.count ?? Self.defaultPerfHarnessCount,
            lower: 1,
            upper: Self.largeTileLimit
        )
        let activeCount = clamp(command.activeCount ?? total / 2, lower: 0, upper: total)
        let mode = command.harnessMode?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() ?? "tail"
        let rateMS = max(50.0, command.rateMS ?? Self.defaultPerfHarnessRateMS)
        let prefix = perfHarnessName(from: command.prefix)
        let rootURL = URL(fileURLWithPath: "/tmp/hudson-vantage-perf-\(prefix)", isDirectory: true)
        let shouldReset = command.reset ?? true

        guard mode == "tail" || mode == "idle" else {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "unsupported perf harness mode \(mode)"
            )
        }

        let startedAt = CFAbsoluteTimeGetCurrent()
        do {
            try FileManager.default.createDirectory(
                at: rootURL,
                withIntermediateDirectories: true
            )
            let sessions = try preparePerfHarnessSessions(
                prefix: prefix,
                count: total,
                activeCount: activeCount,
                mode: mode,
                rateMS: rateMS,
                rootURL: rootURL,
                reset: shouldReset
            )
            perfHarnessPrefix = prefix
            perfTracker.increment("perfHarness.run")
            perfTracker.set("perfHarness.sessions", to: total)
            perfTracker.set("perfHarness.activeSessions", to: activeCount)
            perfTracker.recordTiming(
                "perfHarness.prepare",
                durationMS: (CFAbsoluteTimeGetCurrent() - startedAt) * 1_000
            )

            let attachCommand = HudVantageControlCommand(
                apiVersion: command.resolvedAPIVersion,
                kind: command.kind,
                id: command.id,
                action: "reattach",
                columns: command.columns ?? Int(ceil(sqrt(Double(total)))),
                originX: command.originX,
                originY: command.originY,
                width: command.width ?? 300,
                height: command.height ?? 200,
                gap: command.gap ?? 18,
                reset: shouldReset,
                includeChildren: command.includeChildren,
                sessions: sessions,
                createIfMissing: false,
                includeNodes: command.includeNodes,
                includeMetrics: command.includeMetrics,
                includeViewport: command.includeViewport
            )
            let attachResponse = reattachTmuxTargets(attachCommand)
            guard attachResponse.ok else {
                span.end("error")
                return controlResponse(
                    command,
                    ok: false,
                    message: attachResponse.message
                )
            }

            span.end()
            return controlResponse(
                command,
                ok: true,
                message: "perf harness \(prefix): \(total) sessions, \(activeCount) active \(mode)"
            )
        } catch {
            span.end("error")
            perfTracker.increment("perfHarness.error")
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription
            )
        }
    }

    private func cleanupPerfHarness(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let span = hudVantagePerfTrace.beginSpan("perf.cleanup")
        guard TerminalNode.localTmuxURL != nil else {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "tmux executable not found"
            )
        }

        guard let prefix = command.prefix.map({ perfHarnessName(from: $0) }) ?? perfHarnessPrefix else {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: "perf cleanup requires a prefix"
            )
        }

        do {
            let tmuxSessions = try tmuxHarnessSessions(matching: prefix)
            for session in tmuxSessions {
                _ = try runTmuxHarnessCommand(["kill-session", "-t", session], ignoreFailure: true)
            }

            let targetPrefix = "\(prefix)-"
            let idsToRemove = Set(
                nodes.compactMap { node -> UUID? in
                    guard case .tmux(let target, _, nil) = node.runtimeIdentity,
                          target.hasPrefix(targetPrefix)
                    else { return nil }
                    return node.id
                }
            )
            for node in nodes where idsToRemove.contains(node.id) {
                node.stop()
            }
            nodes.removeAll { idsToRemove.contains($0.id) }
            selectedIDs.subtract(idsToRemove)
            if perfHarnessPrefix == prefix {
                perfHarnessPrefix = nil
            }
            schedulePersistStateIfConfigured()
            perfTracker.increment("perfHarness.cleanup")
            perfTracker.set("perfHarness.cleanedSessions", to: tmuxSessions.count)
            span.end()
            return controlResponse(
                command,
                ok: true,
                message: "cleaned \(tmuxSessions.count) perf harness sessions for \(prefix)"
            )
        } catch {
            span.end("error")
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription
            )
        }
    }

    private func preparePerfHarnessSessions(
        prefix: String,
        count: Int,
        activeCount: Int,
        mode: String,
        rateMS: Double,
        rootURL: URL,
        reset: Bool
    ) throws -> [String] {
        var sessions: [String] = []
        sessions.reserveCapacity(count)
        let rateSeconds = String(format: "%.3f", rateMS / 1_000)

        for index in 1...count {
            let session = try TmuxTarget.validatedName(
                "\(prefix)-\(String(format: "%02d", index))",
                field: "session"
            )
            sessions.append(session)

            if reset {
                _ = try runTmuxHarnessCommand(["kill-session", "-t", session], ignoreFailure: true)
            }

            if mode == "tail", isPerfHarnessSessionActive(index: index, total: count, activeCount: activeCount) {
                let logURL = rootURL.appendingPathComponent("\(session).log")
                FileManager.default.createFile(atPath: logURL.path, contents: Data())
                let quotedLogPath = shellQuoted(logURL.path)
                let script = "i=0; while :; do printf '%s hudson-vantage \(session) line %05d\\n' \"$(date +%H:%M:%S)\" \"$i\" >> \(quotedLogPath); i=$((i+1)); sleep \(rateSeconds); done & tail -n 50 -f \(quotedLogPath)"
                _ = try runTmuxHarnessCommand([
                    "new-session",
                    "-d",
                    "-s",
                    session,
                    "sh -lc \(shellQuoted(script))",
                ])
            } else {
                _ = try runTmuxHarnessCommand(["new-session", "-d", "-s", session])
            }
        }

        return sessions
    }

    private func isPerfHarnessSessionActive(index: Int, total: Int, activeCount: Int) -> Bool {
        guard activeCount > 0, total > 0 else { return false }
        return (index * activeCount / total) != ((index - 1) * activeCount / total)
    }

    private func perfHarnessName(from proposedPrefix: String?) -> String {
        let fallback = "hudson-perf-\(Int(Date().timeIntervalSince1970))"
        guard let proposedPrefix,
              !proposedPrefix.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return fallback
        }
        return GraphitePath.slugify(proposedPrefix, fallback: fallback)
    }

    private func tmuxHarnessSessions(matching prefix: String) throws -> [String] {
        let output = try runTmuxHarnessCommand(
            ["list-sessions", "-F", "#S"],
            allowNoServer: true
        )
        let sessionPrefix = "\(prefix)-"
        return output
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map(String.init)
            .filter { $0.hasPrefix(sessionPrefix) }
    }

    private func runTmuxHarnessCommand(
        _ arguments: [String],
        ignoreFailure: Bool = false,
        allowNoServer: Bool = false
    ) throws -> String {
        guard let tmuxURL = TerminalNode.localTmuxURL else {
            throw TmuxRuntimeError.tmuxMissing
        }

        let process = Process()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.executableURL = tmuxURL
        process.arguments = arguments
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        try process.run()
        process.waitUntilExit()

        let stdout = String(
            data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""
        let stderr = String(
            data: stderrPipe.fileHandleForReading.readDataToEndOfFile(),
            encoding: .utf8
        ) ?? ""

        if process.terminationStatus != 0 {
            if ignoreFailure || (allowNoServer && stderr.localizedCaseInsensitiveContains("no server running")) {
                return stdout
            }
            throw TmuxRuntimeError.commandFailed(status: process.terminationStatus, stderr: stderr)
        }

        return stdout
    }

    private func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\"'\"'"))'"
    }

    private func tmuxReattachSpecs(
        from command: HudVantageControlCommand
    ) throws -> [TmuxReattachSpec] {
        var specs: [TmuxReattachSpec] = []
        let remoteHost = try validatedRemoteHost(command.remoteHost)

        for session in command.sessions ?? [] {
            let name = try TmuxTarget.validatedName(session, field: "session")
            specs.append(
                TmuxReattachSpec(
                    target: name,
                    path: nil,
                    title: "tmux \(name)",
                    remoteHost: remoteHost
                )
            )
        }

        for target in command.targets ?? [] {
            let target = try TmuxTarget.validatedTarget(target)
            specs.append(
                TmuxReattachSpec(
                    target: target,
                    path: nil,
                    title: "tmux \(target)",
                    remoteHost: remoteHost
                )
            )
        }

        for id in command.ids ?? [] {
            if id.hasPrefix("\(GraphitePath.root).") {
                let path = try GraphitePath(parse: id)
                let target = try TmuxTarget.from(path: path).windowTarget
                specs.append(
                    TmuxReattachSpec(
                        target: target,
                        path: path,
                        title: "\(path.app) \(path.instance)",
                        remoteHost: remoteHost
                    )
                )
            } else {
                let target = try TmuxTarget.validatedTarget(id)
                specs.append(
                    TmuxReattachSpec(
                        target: target,
                        path: nil,
                        title: "tmux \(target)",
                        remoteHost: remoteHost
                    )
                )
            }
        }

        var seen: Set<String> = []
        return specs.filter { spec in
            let key = "\(spec.remoteHost ?? "local")|\(spec.target)"
            guard !seen.contains(key) else { return false }
            seen.insert(key)
            return true
        }
    }

    private func validatedRemoteHost(_ value: String?) throws -> String? {
        guard let value else { return nil }
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return nil }

        let disallowed = CharacterSet.whitespacesAndNewlines
            .union(CharacterSet(charactersIn: ";'\"`$\\"))
        guard candidate.rangeOfCharacter(from: disallowed) == nil,
              !candidate.hasPrefix("-")
        else {
            throw TmuxTargetError.invalidField(field: "remoteHost", value: value)
        }

        return candidate
    }

    private func selectNodes(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        if command.normalizedSelectionMode == "clear" {
            selectedIDs.removeAll()
            schedulePersistStateIfConfigured()
            return controlResponse(
                command,
                ok: true,
                message: "selection cleared"
            )
        }

        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: false)
            selectedIDs = HudVantageSelectionState(ids: selectedIDs)
                .applying(
                    Set(resolved.map(\.id)),
                    mode: HudVantageSelectionMode(normalized: command.normalizedSelectionMode)
                )
                .ids
            if let first = resolved.first {
                bringToFront(first.id)
            }
            schedulePersistStateIfConfigured()
            return controlResponse(
                command,
                ok: true,
                message: "selected \(selectedIDs.count)",
                nodesOverride: resolved
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func inspectNodes(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            return controlResponse(
                command,
                ok: true,
                message: "inspected \(resolved.count)",
                nodesOverride: resolved
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func focusNodes(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            guard let focusRect = boundingRect(for: resolved) else {
                throw HudVantageControlNodeError.emptySelection
            }
            selectedIDs = Set(resolved.map(\.id))
            centerCanvas(on: CGPoint(x: focusRect.midX, y: focusRect.midY))
            if let first = resolved.first {
                bringToFront(first.id)
            }
            return controlResponse(
                command,
                ok: true,
                message: "focused \(resolved.count)",
                nodesOverride: resolved
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func enterFocusMode(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            guard resolved.count == 1, let node = resolved.first else {
                return controlResponse(
                    command,
                    ok: false,
                    message: "focus mode requires exactly one terminal",
                    errorCode: "invalid_focus_target",
                    nodesOverride: resolved
                )
            }
            enterFocusMode(node.id)
            return controlResponse(
                command,
                ok: true,
                message: "focus mode \(node.title)",
                nodesOverride: [node]
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func exitFocusMode(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        exitFocusMode()
        return controlResponse(
            command,
            ok: true,
            message: "focus mode closed"
        )
    }

    private func popOutNodes(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            selectedIDs = Set(resolved.map(\.id))
            popOut(nodes: resolved)
            return controlResponse(
                command,
                ok: true,
                message: "popped out \(resolved.count)",
                nodesOverride: resolved
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func applyViewportCommand(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        if command.reset == true {
            resetCanvasViewport()
        }
        if command.fit == true {
            fitCanvasToViewport()
        }
        if command.panX != nil || command.panY != nil || command.scale != nil {
            canvasState = canvasState.replaying(
                panX: command.panX.map { CGFloat($0) },
                panY: command.panY.map { CGFloat($0) },
                scale: command.scale.map { CGFloat($0) }
            )
        }
        schedulePersistStateIfConfigured()

        return controlResponse(
            command,
            ok: true,
            message: "viewport updated"
        )
    }

    private func closeNodes(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            let ids = Set(resolved.map(\.id))
            for node in nodes where ids.contains(node.id) {
                node.stop()
            }
            nodes.removeAll { ids.contains($0.id) }
            selectedIDs.subtract(ids)
            persistStateIfConfigured()

            return controlResponse(
                command,
                ok: true,
                message: "closed \(resolved.count)"
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func controlNodeErrorResponse(
        _ command: HudVantageControlCommand,
        _ error: Error
    ) -> HudVantageControlResponse {
        let nodeError = error as? HudVantageControlNodeError
        return controlResponse(
            command,
            ok: false,
            message: error.localizedDescription,
            errorCode: nodeError?.errorCode ?? "node_error"
        )
    }

    private func resolveNodes(
        from command: HudVantageControlCommand,
        allowSelectionFallback: Bool
    ) throws -> [TerminalNode] {
        let selectors = nodeSelectors(from: command)
        if selectors.isEmpty {
            if allowSelectionFallback {
                let selected = nodes.filter { selectedIDs.contains($0.id) }
                guard !selected.isEmpty else {
                    throw HudVantageControlNodeError.emptySelection
                }
                return selected
            }
            throw HudVantageControlNodeError.missingSelector
        }

        var resolved: [TerminalNode] = []
        var seen: Set<UUID> = []
        for selector in selectors {
            let matches = nodes(matching: selector)
            guard !matches.isEmpty else {
                throw HudVantageControlNodeError.notFound(selector)
            }
            guard matches.count == 1 else {
                throw HudVantageControlNodeError.ambiguous(selector)
            }
            let node = matches[0]
            if !seen.contains(node.id) {
                resolved.append(node)
                seen.insert(node.id)
            }
        }
        return resolved
    }

    private func nodeSelectors(from command: HudVantageControlCommand) -> [String] {
        var selectors: [String] = []
        if let nodeID = command.nodeID {
            selectors.append(nodeID)
        }
        selectors.append(contentsOf: command.nodeIDs ?? [])
        selectors.append(contentsOf: command.ids ?? [])
        return selectors
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func nodes(matching selector: String) -> [TerminalNode] {
        let normalized = selector.lowercased()
        return nodes.filter { node in
            let uuid = node.id.uuidString.lowercased()
            if uuid == normalized || uuid.hasPrefix(normalized) {
                return true
            }
            if node.title.lowercased() == normalized {
                return true
            }
            switch node.runtimeIdentity {
            case .localPTY:
                return false
            case .tmux(let target, let path, let remoteHost):
                return target.lowercased() == normalized
                    || path?.description.lowercased() == normalized
                    || remoteHost.map { "\($0):\(target)".lowercased() == normalized } == true
            }
        }
    }

    private func boundingRect(for nodes: [TerminalNode]) -> CGRect? {
        guard let first = nodes.first else { return nil }
        return nodes.dropFirst().reduce(nodeFrame(first)) { rect, node in
            rect.union(nodeFrame(node))
        }
    }

    private func requestTmuxInstall(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        if let tmuxURL = TerminalNode.localTmuxURL {
            return controlResponse(
                command,
                ok: true,
                message: "tmux already available at \(tmuxURL.path)"
            )
        }

        let installer = command.installer?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let installer, installer != "homebrew" {
            return controlResponse(
                command,
                ok: false,
                message: "unsupported tmux installer \(installer); use homebrew"
            )
        }

        guard command.confirmInstall == true else {
            return controlResponse(
                command,
                ok: false,
                message: "tmux is missing; installing it requires confirmInstall: true",
                requiresPermission: true
            )
        }

        guard !tmuxInstallInProgress else {
            return controlResponse(
                command,
                ok: true,
                message: "tmux install already in progress"
            )
        }

        guard TmuxToolchain.homebrewURL != nil else {
            return controlResponse(
                command,
                ok: false,
                message: "Homebrew not found; install Homebrew or tmux manually"
            )
        }

        startTmuxInstall()

        return controlResponse(
            command,
            ok: true,
            message: "tmux install started with Homebrew"
        )
    }

    private func startTmuxInstall() {
        if let tmuxURL = TerminalNode.localTmuxURL {
            tmuxInstallMessage = "tmux already available at \(tmuxURL.path)"
            controlStatus = tmuxInstallMessage
            return
        }

        guard !tmuxInstallInProgress else { return }
        tmuxInstallInProgress = true
        tmuxInstallMessage = "Installing tmux with Homebrew..."
        controlStatus = tmuxInstallMessage

        Task {
            let result = await TmuxToolchain.installTmuxWithHomebrew()
            tmuxInstallInProgress = false
            tmuxInstallMessage = result.message
            controlStatus = result.message
        }
    }

    private func saveWorkspaceState(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let url = stateURL(for: command)
        do {
            let snapshot = workspaceSnapshot(workspaceID: command.workspaceID ?? configuration.workspaceID)
            try writeWorkspaceSnapshot(snapshot, to: url)
            return controlResponse(
                command,
                ok: true,
                message: "saved \(snapshot.nodes.count) durable node\(snapshot.nodes.count == 1 ? "" : "s")"
            )
        } catch {
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription
            )
        }
    }

    private func restoreWorkspaceState(
        _ command: HudVantageControlCommand
    ) -> HudVantageControlResponse {
        let url = stateURL(for: command)

        do {
            let snapshot = try readWorkspaceSnapshot(from: url)
            if let requestedWorkspace = command.workspaceID,
               snapshot.workspaceID != GraphitePath.slugify(requestedWorkspace, fallback: configuration.workspaceID) {
                return controlResponse(
                    command,
                    ok: false,
                    message: "state belongs to workspace \(snapshot.workspaceID)"
                )
            }

            guard !snapshot.nodes.isEmpty else {
                return controlResponse(
                    command,
                    ok: false,
                    message: "state has no durable nodes"
                )
            }

            let shouldReset = command.reset ?? true
            if shouldReset {
                stopAllNodes()
                nextIndex = 1
                nextZIndex = 1
            }

            var restored: [TerminalNode] = []
            restored.reserveCapacity(snapshot.nodes.count)

            do {
                for nodeSnapshot in snapshot.nodes {
                    if let node = try terminalNode(from: nodeSnapshot, createIfMissing: command.createIfMissing == true) {
                        restored.append(node)
                        nextIndex += 1
                    }
                }
            } catch {
                restored.forEach { $0.stop() }
                throw error
            }

            guard !restored.isEmpty else {
                return controlResponse(
                    command,
                    ok: false,
                    message: "state had no restorable tmux nodes"
                )
            }

            if shouldReset {
                nodes = restored
            } else {
                nodes.append(contentsOf: restored)
            }

            let restoredIDs = Set(restored.map(\.id))
            let savedSelection = Set(snapshot.selectedNodeIDs).intersection(restoredIDs)
            selectedIDs = savedSelection.isEmpty ? restoredIDs : savedSelection
            if let savedFocus = snapshot.focusedNodeID, restoredIDs.contains(savedFocus) {
                focusedNodeID = savedFocus
            } else {
                focusedNodeID = nil
            }
            canvasState = canvasState.replaying(
                panX: CGFloat(snapshot.viewport.panX),
                panY: CGFloat(snapshot.viewport.panY),
                scale: CGFloat(snapshot.viewport.scale)
            )
            applyLayoutSnapshot(snapshot.layout)
            nextZIndex = (nodes.map(\.zIndex).max() ?? 0) + 1

            return controlResponse(
                command,
                ok: true,
                message: "restored \(restored.count) durable node\(restored.count == 1 ? "" : "s")"
            )
        } catch {
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription
            )
        }
    }

    private func persistStateIfConfigured() {
        guard configuration.restoresStateOnLaunch else { return }
        let span = hudVantagePerfTrace.beginSpan("state.persist")
        let startedAt = CFAbsoluteTimeGetCurrent()
        let snapshot = workspaceSnapshot(workspaceID: configuration.workspaceID)
        do {
            try writeWorkspaceSnapshot(snapshot, to: configuredStateURL())
            perfTracker.increment("state.persist.write")
            span.end()
        } catch {
            perfTracker.increment("state.persist.error")
            span.end("error")
        }
        perfTracker.recordTiming(
            "state.persist",
            durationMS: (CFAbsoluteTimeGetCurrent() - startedAt) * 1_000
        )
    }

    private func schedulePersistStateIfConfigured() {
        guard configuration.restoresStateOnLaunch else { return }
        perfTracker.increment("state.persist.request")
        guard pendingPersistTask == nil else {
            perfTracker.increment("state.persist.coalesced")
            return
        }
        perfTracker.increment("state.persist.scheduled")
        pendingPersistTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else {
                pendingPersistTask = nil
                return
            }
            persistStateIfConfigured()
            pendingPersistTask = nil
        }
    }

    private func workspaceSnapshot(workspaceID: String) -> HudVantageWorkspaceSnapshot {
        let durableNodes = nodes.compactMap(durableSnapshot)
        let durableIDs = Set(durableNodes.map(\.id))
        let focusedDurableID = focusedNodeID.flatMap { id in
            durableIDs.contains(id) ? id : nil
        }

        return HudVantageWorkspaceSnapshot(
            workspaceID: GraphitePath.slugify(workspaceID, fallback: configuration.workspaceID),
            surfaceTitle: configuration.surfaceTitle,
            viewport: HudVantageViewportSnapshot(
                panX: Double(canvasState.pan.width),
                panY: Double(canvasState.pan.height),
                scale: Double(canvasState.scale)
            ),
            layout: HudVantageSurfaceLayoutSnapshot(
                canvasTool: canvasTool.rawValue,
                navigationFilter: navigationFilter.rawValue,
                navigationTagFilter: navigationTagFilter?.rawValue,
                navigationCollapsed: navigationCollapsed,
                navigationWidth: Double(navigationWidth),
                inspectorCollapsed: inspectorCollapsed,
                inspectorWidth: Double(inspectorWidth)
            ),
            nodes: durableNodes,
            selectedNodeIDs: selectedIDs.filter { durableIDs.contains($0) },
            focusedNodeID: focusedDurableID,
            groups: workspaceGroups(from: durableNodes)
        )
    }

    private func workspaceGroups(
        from durableNodes: [HudVantageNodeSnapshot]
    ) -> [HudVantageWorkspaceGroupSnapshot] {
        let grouped = Dictionary(grouping: durableNodes) { node in
            node.tag
        }
        return grouped.compactMap { tag, nodes in
            guard let tag else { return nil }
            let label = CanvasTag(rawValue: tag)?.label ?? tag
            return HudVantageWorkspaceGroupSnapshot(
                id: "tag.\(tag)",
                name: label,
                nodeIDs: nodes.map(\.id).sorted { $0.uuidString < $1.uuidString },
                tags: [tag]
            )
        }
        .sorted { $0.id < $1.id }
    }

    private func applyLayoutSnapshot(_ layout: HudVantageSurfaceLayoutSnapshot?) {
        guard let layout else { return }

        if let restoredTool = CanvasTool(rawValue: layout.canvasTool) {
            canvasTool = restoredTool
        }

        if let restoredFilter = CanvasNavigationFilter(rawValue: layout.navigationFilter) {
            navigationFilter = restoredFilter
        }
        navigationTagFilter = layout.navigationTagFilter.flatMap(CanvasTag.init(rawValue:))

        navigationCollapsed = layout.navigationCollapsed
        inspectorCollapsed = layout.inspectorCollapsed
        navigationWidth = clamped(CGFloat(layout.navigationWidth), to: 210...360)
        inspectorWidth = clamped(CGFloat(layout.inspectorWidth), to: 250...440)
    }

    private func clamped(_ value: CGFloat, to range: ClosedRange<CGFloat>) -> CGFloat {
        min(max(value, range.lowerBound), range.upperBound)
    }

    private func durableSnapshot(for node: TerminalNode) -> HudVantageNodeSnapshot? {
        guard case .tmux(let target, let path, let remoteHost) = node.runtimeIdentity else {
            return nil
        }

        return HudVantageNodeSnapshot(
            id: node.id,
            title: node.title,
            subtitle: node.subtitle,
            tint: node.tint.rawValue,
            x: Double(node.origin.x),
            y: Double(node.origin.y),
            width: Double(node.size.width),
            height: Double(node.size.height),
            zIndex: node.zIndex,
            tag: node.tag?.rawValue,
            runtime: HudVantageRuntimeReference(
                kind: "tmux",
                target: target,
                graphitePath: path?.description,
                remoteHost: remoteHost
            )
        )
    }

    private func controlNodeSummary(for node: TerminalNode) -> HudVantageControlNode {
        switch node.runtimeIdentity {
        case .localPTY:
            return HudVantageControlNode(
                id: node.id,
                title: node.title,
                subtitle: node.subtitle,
                runtimeKind: "local-pty",
                selected: selectedIDs.contains(node.id),
                x: Double(node.origin.x),
                y: Double(node.origin.y),
                width: Double(node.size.width),
                height: Double(node.size.height),
                zIndex: node.zIndex,
                tag: node.tag?.rawValue
            )
        case .tmux(let target, let path, let remoteHost):
            return HudVantageControlNode(
                id: node.id,
                title: node.title,
                subtitle: node.subtitle,
                runtimeKind: "tmux",
                target: target,
                graphitePath: path?.description,
                remoteHost: remoteHost,
                selected: selectedIDs.contains(node.id),
                x: Double(node.origin.x),
                y: Double(node.origin.y),
                width: Double(node.size.width),
                height: Double(node.size.height),
                zIndex: node.zIndex,
                tag: node.tag?.rawValue
            )
        }
    }

    private func terminalNode(
        from snapshot: HudVantageNodeSnapshot,
        createIfMissing: Bool
    ) throws -> TerminalNode? {
        guard snapshot.runtime.kind == "tmux" else { return nil }
        guard let targetValue = snapshot.runtime.target else {
            throw HudVantageStateError.missingRuntimeTarget(snapshot.id)
        }

        let target = try TmuxTarget.validatedTarget(targetValue)
        let remoteHost = try validatedRemoteHost(snapshot.runtime.remoteHost)
        let path = try snapshot.runtime.graphitePath.map(GraphitePath.init(parse:))

        if remoteHost == nil, TerminalNode.localTmuxURL == nil {
            throw HudVantageStateError.tmuxMissing
        }

        if remoteHost == nil,
           !TerminalNode.canCreateTmuxTarget(target, createIfMissing: createIfMissing),
           !TerminalNode.localTmuxTargetExists(target) {
            throw HudVantageStateError.missingTmuxTarget(target)
        }

        let size = CGSize(
            width: max(300.0, CGFloat(snapshot.width)),
            height: max(200.0, CGFloat(snapshot.height))
        )

        return TerminalNode(
            id: snapshot.id,
            index: nextIndex,
            origin: CGPoint(x: snapshot.x, y: snapshot.y),
            size: size,
            tint: HudTint.from(token: snapshot.tint),
            zIndex: snapshot.zIndex,
            processSpec: TerminalNode.tmuxAttachSpec(
                target: target,
                createIfMissing: createIfMissing,
                remoteHost: remoteHost,
                workingDirectoryURL: configuration.workingDirectoryURL
            ),
            title: snapshot.title,
            subtitle: snapshot.subtitle,
            runtimeIdentity: .tmux(
                target: target,
                path: path,
                remoteHost: remoteHost
            ),
            tag: snapshot.tag.flatMap(CanvasTag.init(rawValue:))
        )
    }

    private func writeWorkspaceSnapshot(
        _ snapshot: HudVantageWorkspaceSnapshot,
        to url: URL
    ) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(snapshot)
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: url, options: [.atomic])
    }

    private func readWorkspaceSnapshot(from url: URL) throws -> HudVantageWorkspaceSnapshot {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw HudVantageStateError.stateFileMissing(url.path)
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(HudVantageWorkspaceSnapshot.self, from: data)
    }

    private func stateURL(for command: HudVantageControlCommand) -> URL {
        if let statePath = command.statePath?.trimmingCharacters(in: .whitespacesAndNewlines),
           !statePath.isEmpty {
            return URL(fileURLWithPath: statePath)
        }
        return configuredStateURL()
    }

    private func configuredStateURL() -> URL {
        let environment = ProcessInfo.processInfo.environment
        if let statePath = environment["HUDSON_VANTAGE_STATE_FILE"]
            ?? environment["TERMINI_CANVAS_STATE_FILE"],
            !statePath.isEmpty {
            return URL(fileURLWithPath: statePath)
        }
        return configuration.stateURL
    }

    private func selectNode(_ id: UUID) {
        selectedIDs = HudVantageSelectionState(ids: selectedIDs)
            .applying([id], mode: pointerSelectionMode())
            .ids
        if selectedIDs.contains(id) {
            bringToFront(id)
        }
        schedulePersistStateIfConfigured()
    }

    private func focusSelection() {
        guard selectedIDs.count == 1, let id = selectedIDs.first else { return }
        enterFocusMode(id)
    }

    private func enterFocusMode(_ id: UUID) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        focusedNodeID = id
        selectedIDs = [id]
        transientHandActive = false
        panStart = nil
        zoomStart = nil
        selectionDrag = nil
        bringToFront(id)
        controlStatus = "Focus mode · \(node.title)"
        perfTracker.increment("focusMode.enter")
        schedulePersistStateIfConfigured()
    }

    private func exitFocusMode() {
        guard focusedNodeID != nil else { return }
        focusedNodeID = nil
        controlStatus = "Focus mode closed"
        perfTracker.increment("focusMode.exit")
        schedulePersistStateIfConfigured()
    }

    private func popOutSelection() {
        let selected = selectedNodes
        guard !selected.isEmpty else { return }
        popOut(nodes: selected)
    }

    private func popOut(nodes nodesToPopOut: [TerminalNode]) {
        guard !nodesToPopOut.isEmpty else { return }
        let windowID = UUID()
        let title = nodesToPopOut.count == 1
            ? nodesToPopOut[0].title
            : "\(nodesToPopOut.count) terminals"
        let rootView = TerminalPopOutWindow(
            title: title,
            nodes: nodesToPopOut
        ) {
            popOutWindows[windowID]?.close()
        }
        .hudTheme(activeTheme)
        .environment(\.colorScheme, activeColorScheme)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 980, height: 680),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        let delegate = VantagePopOutWindowDelegate {
            popOutWindows[windowID] = nil
            popOutDelegates[windowID] = nil
        }
        window.title = "Vantage · \(title)"
        window.isReleasedWhenClosed = false
        window.delegate = delegate
        window.contentViewController = NSHostingController(rootView: rootView)
        window.center()
        window.makeKeyAndOrderFront(nil)

        popOutDelegates[windowID] = delegate
        popOutWindows[windowID] = window
        controlStatus = "Popped out \(nodesToPopOut.count)"
        perfTracker.increment("focusMode.popOut")
        perfTracker.set("focusMode.popOutCount", to: nodesToPopOut.count)
    }

    private func closePopOutWindows() {
        let windows = Array(popOutWindows.values)
        popOutWindows.removeAll()
        popOutDelegates.removeAll()
        windows.forEach { $0.close() }
    }

    private func centerNode(_ id: UUID) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        centerCanvas(on: CGPoint(x: node.origin.x + node.size.width / 2, y: node.origin.y + node.size.height / 2))
    }

    private func tagSelection(as tag: CanvasTag?) {
        guard !selectedIDs.isEmpty else { return }
        nodes
            .filter { selectedIDs.contains($0.id) }
            .forEach { $0.tag = tag }
        schedulePersistStateIfConfigured()
    }

    private func beginDraggingNode(_ id: UUID) {
        perfTracker.increment("node.drag.begin")
        if !selectedIDs.contains(id) {
            selectedIDs = [id]
        }
        bringToFront(id)
    }

    private func bringToFront(_ id: UUID) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.zIndex = nextZIndex
        nextZIndex += 1
    }

    private func close(_ id: UUID) {
        nodes.first { $0.id == id }?.stop()
        nodes.removeAll { $0.id == id }
        selectedIDs.remove(id)
        if focusedNodeID == id {
            focusedNodeID = nil
        }
        persistStateIfConfigured()
    }

    private func move(_ id: UUID, delta: CGSize) {
        perfTracker.increment("node.move.delta")
        let idsToMove = selectedIDs.contains(id) && selectedIDs.count > 1
            ? selectedIDs
            : Set([id])

        for node in nodes where idsToMove.contains(node.id) {
            node.move(by: delta)
        }
    }

    private func resize(_ id: UUID, delta: CGSize) {
        perfTracker.increment("node.resize.delta")
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.resize(by: delta)
    }

    private func finishNodeTransform() {
        perfTracker.increment("node.transform.end")
        schedulePersistStateIfConfigured()
    }

    private func worldDelta(_ screenDelta: CGSize, scale: CGFloat? = nil) -> CGSize {
        let resolvedScale = max(scale ?? canvasState.scale, Self.minimumCanvasScale)
        return CGSize(
            width: screenDelta.width / resolvedScale,
            height: screenDelta.height / resolvedScale
        )
    }

    private func resetTerminals() {
        focusedNodeID = nil
        stopAllNodes()
        nextIndex = 1
        nextZIndex = 1

        let first = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 88, y: 86),
            size: CGSize(width: 520, height: 330),
            tint: .cyan,
            zIndex: nextZIndex,
            workingDirectoryURL: configuration.workingDirectoryURL
        )
        nextIndex += 1
        nextZIndex += 1

        let second = TerminalNode(
            index: nextIndex,
            origin: CGPoint(x: 420, y: 292),
            size: CGSize(width: 470, height: 292),
            tint: .green,
            zIndex: nextZIndex,
            workingDirectoryURL: configuration.workingDirectoryURL
        )
        nextIndex += 1
        nextZIndex += 1

        nodes = [first, second]
        selectedIDs = [second.id]
        resetCanvasViewport()
        schedulePersistStateIfConfigured()
    }

    private func stopAllNodes() {
        focusedNodeID = nil
        nodes.forEach { $0.stop() }
        nodes.removeAll(keepingCapacity: true)
        selectedIDs.removeAll()
        resetCanvasViewport()
    }

    private func controlResponse(
        _ command: HudVantageControlCommand,
        ok: Bool,
        message: String,
        errorCode: String? = nil,
        requiresPermission: Bool? = nil,
        nodesOverride: [TerminalNode]? = nil
    ) -> HudVantageControlResponse {
        let responseNodes = nodesOverride ?? nodes
        return HudVantageControlResponse(
            apiVersion: command.resolvedAPIVersion,
            id: command.id,
            action: command.normalizedAction,
            ok: ok,
            message: message,
            errorCode: errorCode,
            workspaceID: command.workspaceID ?? configuration.workspaceID,
            nodeCount: nodes.count,
            nodes: command.includeNodes == false ? nil : responseNodes.map(controlNodeSummary),
            selectedNodeIDs: selectedIDs.sorted { $0.uuidString < $1.uuidString },
            focusedNodeID: focusedNodeID,
            viewport: command.includeViewport == false ? nil : controlViewport(),
            metrics: command.includeMetrics == false ? nil : controlMetrics(),
            appPID: getpid(),
            childPIDs: command.includeChildren == true ? childProcessIDs() : nil,
            commandPath: controlAPI.commandURL.path,
            responsePath: controlAPI.responseURL.path,
            statePath: stateURL(for: command).path,
            tmuxPath: TerminalNode.localTmuxURL?.path,
            tmuxInstallInProgress: tmuxInstallInProgress,
            requiresPermission: requiresPermission,
            installerCommand: TmuxToolchain.homebrewInstallCommandDescription
        )
    }

    private func controlViewport() -> HudVantageControlViewport {
        let worldRect = canvasState.visibleWorldRect
        return HudVantageControlViewport(
            panX: Double(canvasState.pan.width),
            panY: Double(canvasState.pan.height),
            scale: Double(canvasState.scale),
            viewportWidth: Double(canvasState.viewportSize.width),
            viewportHeight: Double(canvasState.viewportSize.height),
            worldMinX: Double(worldRect.minX),
            worldMinY: Double(worldRect.minY),
            worldWidth: Double(worldRect.width),
            worldHeight: Double(worldRect.height)
        )
    }

    private func controlMetrics() -> HudVantageControlMetrics {
        let localPTYCount = nodes.filter { node in
            if case .localPTY = node.runtimeIdentity { return true }
            return false
        }.count
        let tmuxNodes = nodes.filter { node in
            if case .tmux = node.runtimeIdentity { return true }
            return false
        }
        let remoteTmuxCount = tmuxNodes.filter { node in
            if case .tmux(_, _, let remoteHost) = node.runtimeIdentity {
                return remoteHost != nil
            }
            return false
        }.count
        let liveSurfaceCount = nodes.filter { rendersLiveSurface(for: $0) }.count
        let virtualizedSurfaceCount = max(0, nodes.count - liveSurfaceCount)

        perfTracker.set("surface.nodeCount", to: nodes.count)
        perfTracker.set("surface.selectedCount", to: selectedIDs.count)
        perfTracker.set("surface.localPTYCount", to: localPTYCount)
        perfTracker.set("surface.tmuxCount", to: tmuxNodes.count)
        perfTracker.set("surface.remoteTmuxCount", to: remoteTmuxCount)
        perfTracker.set("surface.liveSurfaceCount", to: liveSurfaceCount)
        perfTracker.set("surface.virtualizedSurfaceCount", to: virtualizedSurfaceCount)
        perfTracker.set("surface.focusModeActive", to: isTerminalFocusActive ? 1 : 0)
        perfTracker.set("surface.popOutWindowCount", to: popOutWindows.count)

        return HudVantageControlMetrics(
            nodeCount: nodes.count,
            selectedCount: selectedIDs.count,
            localPTYCount: localPTYCount,
            tmuxCount: tmuxNodes.count,
            remoteTmuxCount: remoteTmuxCount,
            liveSurfaceCount: liveSurfaceCount,
            controlCommandCount: controlCommandCount,
            lastCommandAction: lastControlAction,
            lastCommandDurationMS: lastControlDurationMS,
            perf: perfTracker.snapshot(),
            minScale: Double(Self.minimumCanvasScale),
            maxScale: Double(Self.maximumCanvasScale)
        )
    }

    private func childProcessIDs() -> [Int32] {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-axo", "pid=,ppid=,comm="]
        process.standardOutput = pipe

        do {
            try process.run()
        } catch {
            return []
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard let output = String(data: data, encoding: .utf8) else { return [] }
        let appPID = getpid()

        return output
            .split(separator: "\n")
            .compactMap { line -> Int32? in
                let parts = line.split(separator: " ", maxSplits: 2, omittingEmptySubsequences: true)
                guard parts.count >= 2,
                      let pid = Int32(parts[0]),
                      let parentPID = Int32(parts[1]),
                      parentPID == appPID
                else { return nil }
                return pid
            }
            .sorted()
    }

    private func tint(for index: Int) -> HudTint {
        [.cyan, .blue, .teal, .green][(index - 1) % 4]
    }

    private func clamp(_ value: Int, lower: Int, upper: Int) -> Int {
        min(max(value, lower), upper)
    }

    private func pointerSelectionMode() -> HudVantageSelectionMode {
        let flags = NSEvent.modifierFlags
        if flags.contains(.command) {
            return .toggle
        }
        if flags.contains(.option) {
            return .subtract
        }
        if flags.contains(.shift) {
            return .add
        }
        return .replace
    }

    private var canvasWorldBounds: CGRect {
        guard let first = nodes.first else {
            return CGRect(x: 0, y: 0, width: 920, height: 560)
        }

        let bounds = nodes.dropFirst().reduce(nodeFrame(first)) { rect, node in
            rect.union(nodeFrame(node))
        }
        return bounds.insetBy(dx: -96, dy: -96)
    }
}

private struct TerminalNodeView: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let isFocused: Bool
    let rendersLiveSurface: Bool
    let canvasPan: CGSize
    let canvasScale: CGFloat
    let onSelect: () -> Void
    let onFocus: () -> Void
    let onDragBegin: () -> Void
    let onClose: () -> Void
    let onMove: (CGSize) -> Void
    let onResize: (CGSize) -> Void
    let onTransformEnd: () -> Void

    @Environment(\.hudTheme) private var theme
    @State private var isDragging = false
    @State private var lastDragTranslation: CGSize = .zero
    @State private var isResizing = false
    @State private var lastResizeTranslation: CGSize = .zero

    private var screenOrigin: CGPoint {
        CGPoint(
            x: canvasPan.width + node.origin.x * canvasScale,
            y: canvasPan.height + node.origin.y * canvasScale
        )
    }

    private var screenSize: CGSize {
        CGSize(
            width: max(HudVantageMetrics.nodeMinimumScreenSize, node.size.width * canvasScale),
            height: max(HudVantageMetrics.nodeMinimumScreenSize, node.size.height * canvasScale)
        )
    }

    private var shouldRenderMarker: Bool {
        screenSize.width < 110 || screenSize.height < 74
    }

    var body: some View {
        nodeSurface
        .position(
            x: screenOrigin.x + screenSize.width / 2,
            y: screenOrigin.y + screenSize.height / 2
        )
        .zIndex(node.zIndex)
        .transaction { transaction in
            transaction.animation = nil
        }
        .onTapGesture(perform: onSelect)
    }

    @ViewBuilder
    private var nodeSurface: some View {
        if shouldRenderMarker {
            TerminalNodeMarker(
                node: node,
                isSelected: isSelected,
                screenSize: screenSize
            )
            .gesture(dragGesture)
        } else {
            VStack(spacing: 0) {
                titleBar
                if rendersLiveSurface {
                    TerminalSurfaceContainer(controller: node.controller)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(theme.palette.bg)
                } else {
                    TerminalPreview(node: node)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(theme.palette.bg)
                }
            }
            .frame(width: screenSize.width, height: screenSize.height)
            .background(theme.palette.bg)
            .clipShape(RoundedRectangle(cornerRadius: theme.radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.card)
                    .stroke(isSelected ? HudSurface.tintFocus(node.tint.color) : theme.hairline.standard)
            )
            .shadow(
                color: theme.vantageShadow,
                radius: isSelected
                    ? HudVantageMetrics.terminalCardSelectedShadowRadius
                    : HudVantageMetrics.terminalCardShadowRadius,
                x: .zero,
                y: HudSpacing.xl
            )
            .overlay(alignment: .bottomTrailing) {
                if !isFocused {
                    resizeHandle
                }
            }
        }
    }

    private var titleBar: some View {
        HStack(spacing: HudSpacing.lg) {
            HStack(spacing: HudSpacing.sm) {
                Circle()
                    .fill(theme.palette.statusError)
                    .frame(
                        width: HudVantageMetrics.terminalTrafficLightSize,
                        height: HudVantageMetrics.terminalTrafficLightSize
                    )
                    .onTapGesture {
                        onClose()
                    }
                Circle()
                    .fill(theme.palette.statusWarn)
                    .frame(
                        width: HudVantageMetrics.terminalTrafficLightSize,
                        height: HudVantageMetrics.terminalTrafficLightSize
                    )
                Circle()
                    .fill(node.tint.color)
                    .frame(
                        width: HudVantageMetrics.terminalTrafficLightSize,
                        height: HudVantageMetrics.terminalTrafficLightSize
                    )
            }
            Image(systemName: "terminal")
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
            Text(node.title)
                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
            Spacer()
            Text(node.subtitle)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(theme.palette.dim)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            CanvasIconButton(
                systemName: "rectangle.inset.filled",
                help: "Focus terminal",
                action: onFocus
            )
            .disabled(isFocused)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudVantageMetrics.terminalTitleBarHeight)
        .background(theme.palette.chrome)
        .contentShape(Rectangle())
        .gesture(dragGesture)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("termini-canvas"))
            .onChanged { value in
                if !isDragging {
                    isDragging = true
                    lastDragTranslation = .zero
                    onDragBegin()
                }

                let delta = CGSize(
                    width: value.translation.width - lastDragTranslation.width,
                    height: value.translation.height - lastDragTranslation.height
                )
                lastDragTranslation = value.translation
                onMove(delta)
            }
            .onEnded { _ in
                isDragging = false
                lastDragTranslation = .zero
                onTransformEnd()
            }
    }

    private var resizeHandle: some View {
        ResizeGrip()
            .frame(
                width: HudVantageMetrics.resizeGripSize,
                height: HudVantageMetrics.resizeGripSize
            )
            .contentShape(Rectangle())
            .help("Resize")
            .accessibilityLabel("Resize terminal")
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named("termini-canvas"))
                    .onChanged { value in
                        if !isResizing {
                            isResizing = true
                            lastResizeTranslation = .zero
                            onSelect()
                        }

                        let delta = CGSize(
                            width: value.translation.width - lastResizeTranslation.width,
                            height: value.translation.height - lastResizeTranslation.height
                        )
                        lastResizeTranslation = value.translation
                        onResize(delta)
                    }
                    .onEnded { _ in
                        isResizing = false
                        lastResizeTranslation = .zero
                        onTransformEnd()
                    }
            )
    }
}

private struct TerminalPopOutWindow: View {
    let title: String
    let nodes: [TerminalNode]
    let onClose: () -> Void

    @State private var focusedID: UUID?
    @Environment(\.hudTheme) private var theme

    private var focusedNode: TerminalNode? {
        guard let focusedID else { return nil }
        return nodes.first { $0.id == focusedID }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: theme.hairline.standard)
            content
        }
        .frame(
            minWidth: HudVantageMetrics.popOutMinimumWidth,
            minHeight: HudVantageMetrics.popOutMinimumHeight
        )
        .background(theme.palette.bg)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: nodes.first?.tint.color ?? theme.palette.statusInfo)
            VStack(alignment: .leading, spacing: 1) {
                Text("Vantage Pop-out")
                    .font(HudFont.mono(10, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(theme.palette.muted)
                Text(title)
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(theme.palette.ink)
                    .lineLimit(1)
            }

            HudBadge("\(nodes.count)", tint: theme.palette.statusInfo, dot: true)

            if nodes.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: HudSpacing.sm) {
                        CanvasFilterButton(
                            title: "Grid",
                            isActive: focusedID == nil,
                            action: { focusedID = nil }
                        )
                        ForEach(nodes) { node in
                            CanvasFilterButton(
                                title: node.title,
                                isActive: focusedID == node.id,
                                action: { focusedID = node.id }
                            )
                        }
                    }
                }
                .frame(maxWidth: HudVantageMetrics.popOutTabStripMaxWidth)
            }

            Spacer()
            HudButton("Close", icon: "xmark", style: .ghost, action: onClose)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.navHeight)
        .background(theme.palette.chrome)
    }

    @ViewBuilder
    private var content: some View {
        if nodes.count == 1, let node = nodes.first {
            TerminalPopOutTerminal(node: node)
        } else if let focusedNode {
            TerminalPopOutTerminal(node: focusedNode)
        } else {
            GeometryReader { proxy in
                ScrollView {
                    LazyVGrid(
                        columns: gridColumns(for: proxy.size.width),
                        spacing: HudSpacing.lg
                    ) {
                        ForEach(nodes) { node in
                            TerminalPopOutCard(node: node) {
                                focusedID = node.id
                            }
                        }
                    }
                    .padding(HudSpacing.xxl)
                }
            }
        }
    }

    private func gridColumns(for width: CGFloat) -> [GridItem] {
        let count = max(1, min(3, Int(width / 420)))
        return Array(
            repeating: GridItem(.flexible(minimum: 320), spacing: HudSpacing.lg),
            count: count
        )
    }
}

private struct TerminalPopOutTerminal: View {
    @ObservedObject var node: TerminalNode
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            TerminalPopOutTitleBar(node: node)
            TerminalSurfaceContainer(controller: node.controller)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(theme.palette.bg)
        }
        .background(theme.palette.bg)
    }
}

private struct TerminalPopOutCard: View {
    @ObservedObject var node: TerminalNode
    let onFocus: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            TerminalPopOutTitleBar(node: node, onFocus: onFocus)
            TerminalSurfaceContainer(controller: node.controller)
                .frame(height: HudVantageMetrics.popOutTerminalPreviewHeight)
                .background(theme.palette.bg)
        }
        .background(theme.palette.bg)
        .clipShape(RoundedRectangle(cornerRadius: theme.radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .stroke(theme.hairline.standard)
        )
        .shadow(color: theme.vantageShadow, radius: HudSpacing.xl, x: 0, y: HudSpacing.md)
    }
}

private struct TerminalPopOutTitleBar: View {
    @ObservedObject var node: TerminalNode
    var onFocus: (() -> Void)?
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: node.tint.color, size: HudDotSize.small)
            Image(systemName: "terminal")
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
            Text(node.title)
                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
                .lineLimit(1)
            Spacer()
            Text(node.subtitle)
                .font(HudFont.mono(9))
                .foregroundStyle(theme.palette.dim)
                .lineLimit(1)
            if let onFocus {
                CanvasIconButton(
                    systemName: "rectangle.inset.filled",
                    help: "Focus terminal in pop-out",
                    action: onFocus
                )
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudVantageMetrics.terminalTitleBarHeight)
        .background(theme.palette.chrome)
    }
}

private final class VantagePopOutWindowDelegate: NSObject, NSWindowDelegate {
    private let onClose: @MainActor () -> Void

    init(onClose: @escaping @MainActor () -> Void) {
        self.onClose = onClose
    }

    func windowWillClose(_ notification: Notification) {
        Task { @MainActor in
            onClose()
        }
    }
}

private struct ResizeGrip: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Canvas { context, size in
            var path = Path()
            for offset in stride(from: CGFloat(6), through: 18, by: 5) {
                path.move(to: CGPoint(x: size.width - offset, y: size.height - 3))
                path.addLine(to: CGPoint(x: size.width - 3, y: size.height - offset))
            }

            context.stroke(
                path,
                with: .color(theme.palette.dim),
                style: StrokeStyle(lineWidth: HudStrokeWidth.standard, lineCap: .round)
            )
        }
        .padding(HudVantageMetrics.resizeGripInset)
    }
}

private struct TerminalNodeMarker: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let screenSize: CGSize

    @Environment(\.hudTheme) private var theme

    private var markerSize: CGSize {
        CGSize(
            width: max(
                HudVantageMetrics.nodeMarkerMinimumWidth,
                min(HudVantageMetrics.nodeMarkerMaximumWidth, screenSize.width)
            ),
            height: max(
                HudVantageMetrics.nodeMarkerMinimumHeight,
                min(HudVantageMetrics.nodeMarkerMaximumHeight, screenSize.height)
            )
        )
    }

    var body: some View {
        RoundedRectangle(cornerRadius: theme.radius.standard)
            .fill(isSelected ? HudSurface.selected(node.tint.color) : theme.vantageControlFill)
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: theme.radius.tight)
                    .fill(node.tint.color)
                    .frame(
                        width: max(
                            HudVantageMetrics.nodeMarkerStripeWidth,
                            markerSize.width * HudVantageMetrics.nodeMarkerStripeFraction
                        )
                    )
                    .padding(.vertical, HudVantageMetrics.resizeGripInset)
                    .padding(.leading, HudVantageMetrics.resizeGripInset)
            }
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? HudSurface.tintFocus(node.tint.color) : theme.hairline.standard)
            )
            .frame(width: markerSize.width, height: markerSize.height)
            .shadow(
                color: theme.vantageShadow,
                radius: isSelected ? HudSpacing.lg : HudSpacing.xs,
                x: .zero,
                y: HudSpacing.xs
            )
            .accessibilityLabel(node.title)
    }
}

private struct SelectionMarquee: View {
    let rect: CGRect
    @Environment(\.hudTheme) private var theme

    var body: some View {
        RoundedRectangle(cornerRadius: theme.radius.standard)
            .fill(HudSurface.selected(theme.palette.statusInfo))
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(
                        HudSurface.tintFocus(theme.palette.statusInfo),
                        style: StrokeStyle(
                            lineWidth: HudStrokeWidth.standard,
                            dash: [HudSpacing.sm, HudSpacing.xs]
                        )
                    )
            )
            .frame(width: max(1, rect.width), height: max(1, rect.height))
            .offset(x: rect.minX, y: rect.minY)
            .allowsHitTesting(false)
    }
}

private struct TerminalPreview: View {
    @ObservedObject var node: TerminalNode
    @Environment(\.hudTheme) private var theme

    var body: some View {
        ZStack(alignment: .topLeading) {
            theme.palette.bg

            Canvas { context, size in
                let columnWidth: CGFloat = 18
                let rowHeight: CGFloat = 13
                let columns = max(1, Int(size.width / columnWidth))
                let rows = max(1, Int(size.height / rowHeight))

                for row in 0..<rows {
                    for column in 0..<columns {
                        let alpha = 0.18 + Double((row + column) % 5) * 0.035
                        let rect = CGRect(
                            x: CGFloat(column) * columnWidth + 8,
                            y: CGFloat(row) * rowHeight + 8,
                            width: columnWidth * 0.52,
                            height: 1
                        )
                        context.fill(
                            Path(roundedRect: rect, cornerRadius: 0.5),
                            with: .color(node.tint.color.opacity(alpha))
                        )
                    }
                }
            }
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                HudBadge(node.runtimeIdentity.badge, tint: node.tint.color, dot: true)
                Text("surface virtualized")
                    .font(HudFont.mono(10))
                    .foregroundStyle(theme.palette.muted)
                Text("zoom/select to attach renderer")
                    .font(HudFont.mono(10))
                    .foregroundStyle(theme.palette.dim)
            }
            .padding(HudSpacing.xl)
        }
    }
}

private struct InfiniteCanvasBackground: View {
    let pan: CGSize
    let scale: CGFloat
    var worldStep: CGFloat = 20
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Canvas { context, size in
            drawGrid(context: &context, size: size)
        }
    }

    private func drawGrid(context: inout GraphicsContext, size: CGSize) {
        let step = normalizedScreenStep
        let majorStep = step * 5

        strokeGrid(
            context: &context,
            size: size,
            step: step,
            offsetX: screenOffset(for: pan.width, step: step),
            offsetY: screenOffset(for: pan.height, step: step),
            color: theme.palette.ink.opacity(HudOpacity.ghost),
            lineWidth: HudStrokeWidth.standard
        )

        strokeGrid(
            context: &context,
            size: size,
            step: majorStep,
            offsetX: screenOffset(for: pan.width, step: majorStep),
            offsetY: screenOffset(for: pan.height, step: majorStep),
            color: theme.palette.ink.opacity(HudOpacity.subtle),
            lineWidth: 1.15
        )
    }

    private func strokeGrid(
        context: inout GraphicsContext,
        size: CGSize,
        step: CGFloat,
        offsetX: CGFloat,
        offsetY: CGFloat,
        color: Color,
        lineWidth: CGFloat
    ) {
        var path = Path()

        var x = offsetX
        while x <= size.width {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: size.height))
            x += step
        }

        var y = offsetY
        while y <= size.height {
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
            y += step
        }

        context.stroke(path, with: .color(color), lineWidth: lineWidth)
    }

    private var normalizedScreenStep: CGFloat {
        var step = worldStep * scale
        while step < 9 {
            step *= 2
        }
        while step > 48 {
            step /= 2
        }
        return step
    }

    private func screenOffset(for panValue: CGFloat, step: CGFloat) -> CGFloat {
        let offset = panValue.truncatingRemainder(dividingBy: step)
        return offset >= 0 ? offset : offset + step
    }
}

private struct CanvasNavigationPanel: View {
    @Binding var width: CGFloat
    let nodes: [TerminalNode]
    let minimapNodes: [TerminalNode]
    let totalCount: Int
    let selectedCount: Int
    @Binding var filter: CanvasNavigationFilter
    @Binding var tagFilter: CanvasTag?
    let selectedIDs: Set<UUID>
    let viewportWorldRect: CGRect
    let canvasWorldBounds: CGRect
    let canvasScale: CGFloat
    let onSelectNode: (UUID) -> Void
    let onCenterNode: (UUID) -> Void
    let onTagSelection: (CanvasTag?) -> Void
    let onCenterWorldPoint: (CGPoint) -> Void
    let onFit: () -> Void
    let onCollapse: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                header
                HudDivider(color: theme.hairline.standard)
                filters
                    .padding(.horizontal, HudSpacing.xl)
                    .padding(.vertical, HudSpacing.lg)
                HudDivider(color: theme.hairline.subtle)

                ScrollView {
                    LazyVStack(spacing: HudSpacing.sm) {
                        ForEach(nodes) { node in
                            CanvasNavigationRow(
                                node: node,
                                isSelected: selectedIDs.contains(node.id),
                                onSelect: { onSelectNode(node.id) },
                                onCenter: { onCenterNode(node.id) }
                            )
                        }

                        if nodes.isEmpty {
                            Text("No terminals")
                                .font(HudFont.mono(10))
                                .foregroundStyle(theme.palette.dim)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(HudSpacing.xl)
                        }
                    }
                    .padding(HudSpacing.xl)
                }

                HudDivider(color: theme.hairline.subtle)
                footer
                    .padding(HudSpacing.xl)
            }
            .frame(width: width)
            .frame(maxHeight: .infinity)
            .background(theme.palette.chrome)

            PanelResizeHandle(
                side: .right,
                width: $width,
                range: 210...360
            )
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: theme.palette.statusInfo)
            VStack(alignment: .leading, spacing: 1) {
                Text("Termini Canvas")
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(theme.palette.ink)
                Text("Figma for shells")
                    .font(HudFont.mono(9))
                    .foregroundStyle(theme.palette.dim)
            }
            Spacer()
            CanvasIconButton(
                systemName: "sidebar.left",
                help: "Hide navigator",
                action: onCollapse
            )
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudLayout.navHeight)
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack {
                HudSectionLabel("Workspace")
                Spacer()
                HudBadge("\(totalCount)", tint: theme.palette.statusInfo)
            }

            HStack(spacing: HudSpacing.sm) {
                ForEach(CanvasNavigationFilter.allCases) { option in
                    CanvasFilterButton(
                        title: option.label,
                        isActive: filter == option,
                        action: { filter = option }
                    )
                }
            }

            tagFilterControls

            Text("\(selectedCount) selected")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.muted)

            if selectedCount > 0 {
                selectionTagTools
            }
        }
    }

    private var tagFilterControls: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Tags")
            HStack(spacing: HudSpacing.sm) {
                CanvasTagFilterButton(
                    tag: nil,
                    isActive: tagFilter == nil,
                    count: totalCount,
                    action: { tagFilter = nil }
                )
                ForEach(CanvasTag.allCases) { tag in
                    CanvasTagFilterButton(
                        tag: tag,
                        isActive: tagFilter == tag,
                        count: tagCount(for: tag),
                        action: { tagFilter = tag }
                    )
                }
            }
        }
    }

    private var selectionTagTools: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Tag Selection")
            HStack(spacing: HudSpacing.sm) {
                CanvasTagActionButton(
                    tag: nil,
                    action: { onTagSelection(nil) }
                )
                ForEach(CanvasTag.allCases) { tag in
                    CanvasTagActionButton(
                        tag: tag,
                        action: { onTagSelection(tag) }
                    )
                }
            }
        }
    }

    private func tagCount(for tag: CanvasTag) -> Int {
        minimapNodes.filter { $0.tag == tag }.count
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack {
                HudSectionLabel("Minimap")
                Spacer()
                CanvasIconButton(
                    systemName: "viewfinder",
                    help: "Fit world",
                    action: onFit
                )
                Text(formattedZoom(canvasScale))
                    .font(HudFont.mono(10, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
            }

            CanvasMiniMap(
                nodes: minimapNodes,
                selectedIDs: selectedIDs,
                worldBounds: canvasWorldBounds,
                viewportWorldRect: viewportWorldRect,
                onCenterWorldPoint: onCenterWorldPoint
            )
            .frame(height: HudVantageMetrics.minimapHeight)
        }
    }
}

private struct CanvasNavigationRow: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let onSelect: () -> Void
    let onCenter: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            Button(action: onSelect) {
                HStack(spacing: HudSpacing.md) {
                    HudStatusDot(color: node.tint.color, size: 6)
                    Text(node.title)
                        .font(HudFont.mono(11, weight: .semibold))
                        .foregroundStyle(theme.palette.ink)
                        .lineLimit(1)
                    Spacer(minLength: HudSpacing.sm)
                    if let tag = node.tag {
                        CanvasTagPill(tag: tag)
                    }
                }
            }
            .buttonStyle(.plain)

            CanvasIconButton(
                systemName: "scope",
                help: "Center terminal",
                action: onCenter
            )
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.xs)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(isSelected ? HudSurface.selected(node.tint.color) : theme.vantageControlFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .stroke(isSelected ? HudSurface.tintStrong(node.tint.color) : theme.hairline.subtle)
        )
    }
}

private struct CanvasTagPill: View {
    let tag: CanvasTag
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Text(tag.label.uppercased())
            .font(HudFont.mono(8, weight: .bold))
            .foregroundStyle(tag.tint(in: theme))
            .padding(.horizontal, HudSpacing.sm)
            .frame(height: HudIconSize.micro)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.tight)
                    .fill(HudSurface.tintFill(tag.tint(in: theme)))
            )
    }
}

private struct CanvasTagFilterButton: View {
    let tag: CanvasTag?
    let isActive: Bool
    let count: Int
    let action: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.xs) {
                Image(systemName: tag?.symbolName ?? "tag")
                    .font(HudFont.ui(9, weight: .semibold))
                Text("\(count)")
                    .font(HudFont.mono(9, weight: .bold))
            }
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, HudSpacing.sm)
            .frame(height: HudLayout.rowHeightCompact)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(borderColor)
            )
        }
        .buttonStyle(.plain)
        .help(helpText)
        .accessibilityLabel(helpText)
    }

    private var tint: Color {
        tag?.tint(in: theme) ?? theme.palette.statusInfo
    }

    private var foregroundColor: Color {
        isActive ? tint : theme.palette.muted
    }

    private var backgroundColor: Color {
        isActive ? HudSurface.tintFill(tint) : theme.vantageControlFill
    }

    private var borderColor: Color {
        isActive ? HudSurface.tintBorder(tint) : theme.hairline.subtle
    }

    private var helpText: String {
        if let tag {
            return "Filter by \(tag.label)"
        }
        return "Show all tags"
    }
}

private struct CanvasTagActionButton: View {
    let tag: CanvasTag?
    let action: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            Image(systemName: tag?.symbolName ?? "tag.slash")
                .font(HudFont.ui(10, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .fill(HudSurface.tintFill(tint))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .stroke(HudSurface.tintBorder(tint))
                )
        }
        .buttonStyle(.plain)
        .help(helpText)
        .accessibilityLabel(helpText)
    }

    private var tint: Color {
        tag?.tint(in: theme) ?? theme.palette.dim
    }

    private var helpText: String {
        if let tag {
            return "Tag selection as \(tag.label)"
        }
        return "Clear tags from selection"
    }
}

private enum PanelResizeSide {
    case left
    case right
}

private struct PanelResizeHandle: View {
    let side: PanelResizeSide
    @Binding var width: CGFloat
    let range: ClosedRange<CGFloat>

    @State private var startWidth: CGFloat?
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.hairline.subtle)
            .frame(width: HudVantageMetrics.panelResizeHandleWidth)
            .overlay {
                Capsule()
                    .fill(HudSurface.tintMuted(theme.palette.dim))
                    .frame(
                        width: HudStrokeWidth.standard,
                        height: HudVantageMetrics.panelResizeIndicatorHeight
                    )
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let start = startWidth ?? width
                        startWidth = start
                        let signedDelta = side == .right
                            ? value.translation.width
                            : -value.translation.width
                        width = min(max(start + signedDelta, range.lowerBound), range.upperBound)
                    }
                    .onEnded { _ in
                        startWidth = nil
                    }
            )
            .help("Resize panel")
            .accessibilityLabel("Resize panel")
    }
}

private struct CanvasInspectorPanel: View {
    @Binding var width: CGFloat
    let selectedNodes: [TerminalNode]
    let totalCount: Int
    let tmuxAvailable: Bool
    let tmuxInstallInProgress: Bool
    let tmuxInstallMessage: String
    let onCenterNode: (TerminalNode) -> Void
    let onCloseNode: (UUID) -> Void
    let onInstallTmux: () -> Void
    let onCollapse: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: 0) {
            PanelResizeHandle(
                side: .left,
                width: $width,
                range: 250...440
            )

            VStack(spacing: 0) {
                header
                HudDivider(color: theme.hairline.standard)

                ScrollView {
                    content
                        .padding(HudSpacing.xl)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(width: width)
            .frame(maxHeight: .infinity)
            .background(theme.palette.chrome)
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudSectionLabel("Detail")
            Spacer()
            HudBadge("\(totalCount)", tint: theme.palette.statusInfo)
            CanvasIconButton(
                systemName: "sidebar.right",
                help: "Hide inspector",
                action: onCollapse
            )
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.navHeight)
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudVantagePrerequisiteCheck(
                title: "tmux",
                status: tmuxPrerequisiteStatus,
                detail: tmuxPrerequisiteDetail,
                actionTitle: tmuxAvailable ? nil : tmuxInstallActionTitle,
                actionIcon: "arrow.down.circle",
                actionDisabled: tmuxInstallInProgress,
                action: onInstallTmux
            )

            if let node = selectedNodes.first, selectedNodes.count == 1 {
                TerminalDetailView(
                    node: node,
                    onCenter: { onCenterNode(node) },
                    onClose: { onCloseNode(node.id) }
                )
            } else if selectedNodes.count > 1 {
                MultiTerminalDetailView(count: selectedNodes.count)
            } else {
                EmptyInspectorState()
            }
        }
    }

    private var tmuxPrerequisiteStatus: HudVantagePrerequisiteStatus {
        if tmuxAvailable {
            return .ready
        }
        if tmuxInstallInProgress {
            return .running
        }
        return .missing
    }

    private var tmuxPrerequisiteDetail: String {
        if !tmuxInstallMessage.isEmpty {
            return tmuxInstallMessage
        }
        if tmuxAvailable {
            return "Local tmux-backed sessions can be attached and restored."
        }
        return "Local tmux is required for durable local sessions. Remote tmux over SSH can still be attached without a local install."
    }

    private var tmuxInstallActionTitle: String {
        tmuxInstallInProgress ? "Installing..." : "Install tmux"
    }
}

private struct TerminalDetailView: View {
    @ObservedObject var node: TerminalNode
    let onCenter: () -> Void
    let onClose: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HStack(spacing: HudSpacing.md) {
                HudStatusDot(color: node.tint.color, size: 8)
                VStack(alignment: .leading, spacing: 2) {
                    Text(node.title)
                        .font(HudFont.mono(13, weight: .semibold))
                        .foregroundStyle(theme.palette.ink)
                    Text(node.subtitle)
                        .font(HudFont.mono(10))
                        .foregroundStyle(theme.palette.dim)
                }
                Spacer()
            }

            InspectorMetricGrid(metrics: [
                ("X", "\(Int(node.origin.x))"),
                ("Y", "\(Int(node.origin.y))"),
                ("W", "\(Int(node.size.width))"),
                ("H", "\(Int(node.size.height))"),
                ("Z", "\(Int(node.zIndex))"),
                ("ID", String(node.id.uuidString.prefix(8))),
            ])

            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("Runtime")
                HudBadge(node.runtimeIdentity.badge, tint: node.tint.color, dot: true)
                Text(node.runtimeIdentity.detail)
                    .font(HudFont.mono(10))
                    .foregroundStyle(theme.palette.muted)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                if let path = node.runtimeIdentity.graphitePath {
                    Text(path)
                        .font(HudFont.mono(9))
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(3)
                        .minimumScaleFactor(0.7)
                }
            }

            HStack(spacing: HudSpacing.md) {
                HudButton("Center", icon: "scope", style: .secondary, action: onCenter)
                HudButton("Close", icon: "xmark", style: .ghost, action: onClose)
            }

            Spacer(minLength: 0)
        }
    }
}

private struct InspectorMetricGrid: View {
    let metrics: [(String, String)]
    @Environment(\.hudTheme) private var theme

    var body: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: HudSpacing.md),
                GridItem(.flexible(), spacing: HudSpacing.md),
            ],
            spacing: HudSpacing.md
        ) {
            ForEach(metrics, id: \.0) { metric in
                VStack(alignment: .leading, spacing: 2) {
                    Text(metric.0)
                        .font(HudFont.mono(9, weight: .semibold))
                        .foregroundStyle(theme.palette.dim)
                    Text(metric.1)
                        .font(HudFont.mono(12, weight: .semibold))
                        .foregroundStyle(theme.palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .padding(HudSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.vantageControlFill))
                .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
            }
        }
    }
}

private struct MultiTerminalDetailView: View {
    let count: Int
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudBadge("\(count) SELECTED", tint: theme.palette.statusInfo, dot: true)
            Text("Group detail actions land here: tile, move, send, capture, fork workspace.")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct EmptyInspectorState: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudBadge("NO SELECTION", tint: theme.palette.dim)
            Text("Select a terminal to inspect its canvas placement and runtime identity.")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct CanvasFilterButton: View {
    let title: String
    let isActive: Bool
    let action: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        let tint = theme.palette.statusInfo

        Button(action: action) {
            Text(title)
                .font(HudFont.mono(9, weight: .semibold))
                .foregroundStyle(isActive ? tint : theme.palette.muted)
                .padding(.horizontal, HudSpacing.md)
                .frame(height: HudVantageMetrics.filterButtonHeight)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.tight)
                        .fill(isActive ? HudSurface.selected(tint) : theme.vantageControlFill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.tight)
                        .stroke(isActive ? HudSurface.tintStrong(tint) : theme.hairline.subtle)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct CommandKeyButton: View {
    let action: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.xs) {
                Image(systemName: "command")
                    .font(HudFont.ui(10, weight: .semibold))
                Text("K")
                    .font(HudFont.mono(10, weight: .semibold))
            }
            .foregroundStyle(theme.palette.muted)
            .frame(
                width: HudVantageMetrics.commandButtonWidth,
                height: HudLayout.rowHeightCompact
            )
            .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.vantageControlFill))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
        }
        .buttonStyle(.plain)
        .help("Command palette")
        .accessibilityLabel("Command palette")
    }
}

private struct CanvasMiniMap: View {
    let nodes: [TerminalNode]
    let selectedIDs: Set<UUID>
    let worldBounds: CGRect
    let viewportWorldRect: CGRect
    let onCenterWorldPoint: (CGPoint) -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                draw(context: context, size: size)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        onCenterWorldPoint(worldPoint(for: value.location, in: proxy.size))
                    }
            )
            .background(
                RoundedRectangle(cornerRadius: theme.radius.card)
                    .fill(theme.vantageControlFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.card)
                    .stroke(theme.hairline.standard)
            )
        }
    }

    private func draw(context: GraphicsContext, size: CGSize) {
        let scale = minimapScale(in: size)
        let inset = minimapInset(in: size, scale: scale)

        var worldPath = Path(
            roundedRect: CGRect(
                x: inset.width,
                y: inset.height,
                width: worldBounds.width * scale,
                height: worldBounds.height * scale
            ),
            cornerRadius: theme.radius.tight
        )
        context.stroke(worldPath, with: .color(theme.hairline.subtle), lineWidth: HudStrokeWidth.standard)

        for node in nodes {
            let rect = CGRect(
                x: inset.width + (node.origin.x - worldBounds.minX) * scale,
                y: inset.height + (node.origin.y - worldBounds.minY) * scale,
                width: max(2, node.size.width * scale),
                height: max(2, node.size.height * scale)
            )
            let path = Path(roundedRect: rect, cornerRadius: 2)
            let selected = selectedIDs.contains(node.id)
            context.fill(path, with: .color(node.tint.color.opacity(selected ? 0.52 : 0.28)))
            context.stroke(
                path,
                with: .color(selected ? theme.palette.ink : HudSurface.tintMuted(node.tint.color)),
                lineWidth: selected ? 1.2 : 0.7
            )
        }

        let viewport = CGRect(
            x: inset.width + (viewportWorldRect.minX - worldBounds.minX) * scale,
            y: inset.height + (viewportWorldRect.minY - worldBounds.minY) * scale,
            width: viewportWorldRect.width * scale,
            height: viewportWorldRect.height * scale
        )
        worldPath = Path(roundedRect: viewport, cornerRadius: theme.radius.tight)
        context.stroke(worldPath, with: .color(theme.palette.statusInfo), lineWidth: 1.4)
    }

    private func worldPoint(for location: CGPoint, in size: CGSize) -> CGPoint {
        let scale = minimapScale(in: size)
        let inset = minimapInset(in: size, scale: scale)
        return CGPoint(
            x: min(max((location.x - inset.width) / scale + worldBounds.minX, worldBounds.minX), worldBounds.maxX),
            y: min(max((location.y - inset.height) / scale + worldBounds.minY, worldBounds.minY), worldBounds.maxY)
        )
    }

    private func minimapScale(in size: CGSize) -> CGFloat {
        guard worldBounds.width > 0, worldBounds.height > 0 else { return 1 }
        return min(
            (size.width - 16) / worldBounds.width,
            (size.height - 16) / worldBounds.height
        )
    }

    private func minimapInset(in size: CGSize, scale: CGFloat) -> CGSize {
        CGSize(
            width: max(8, (size.width - worldBounds.width * scale) / 2),
            height: max(8, (size.height - worldBounds.height * scale) / 2)
        )
    }
}

private struct ViewportStatusChip: View {
    let rect: CGRect
    let scale: CGFloat
    let tool: CanvasTool
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "viewfinder")
                .font(HudFont.ui(10, weight: .semibold))
            Text(
                "VIEW x \(Int(rect.minX)) y \(Int(rect.minY)) · \(Int(rect.width)) x \(Int(rect.height)) · \(tool.statusLabel) · \(formattedZoom(scale))"
            )
            .font(HudFont.mono(10, weight: .semibold))
        }
        .foregroundStyle(theme.palette.muted)
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudVantageMetrics.viewportChipHeight)
        .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.vantageControlFill))
        .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
    }
}

private struct CanvasInputBridge: NSViewRepresentable {
    let onScroll: (CGSize, CGPoint) -> Void
    let onMagnify: (CGFloat, CGPoint) -> Void
    let canBeginSpacePan: (CGPoint) -> Bool
    let onSpacePanChanged: (Bool) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onScroll: onScroll,
            onMagnify: onMagnify,
            canBeginSpacePan: canBeginSpacePan,
            onSpacePanChanged: onSpacePanChanged
        )
    }

    func makeNSView(context: Context) -> EventView {
        let view = EventView()
        view.coordinator = context.coordinator
        context.coordinator.view = view
        context.coordinator.installMonitor()
        return view
    }

    func updateNSView(_ nsView: EventView, context: Context) {
        context.coordinator.onScroll = onScroll
        context.coordinator.onMagnify = onMagnify
        context.coordinator.canBeginSpacePan = canBeginSpacePan
        context.coordinator.onSpacePanChanged = onSpacePanChanged
        context.coordinator.view = nsView
    }

    static func dismantleNSView(_ nsView: EventView, coordinator: Coordinator) {
        coordinator.removeMonitor()
    }

    final class EventView: NSView {
        weak var coordinator: Coordinator?

        override func hitTest(_ point: NSPoint) -> NSView? {
            nil
        }
    }

    final class Coordinator {
        var onScroll: (CGSize, CGPoint) -> Void
        var onMagnify: (CGFloat, CGPoint) -> Void
        var canBeginSpacePan: (CGPoint) -> Bool
        var onSpacePanChanged: (Bool) -> Void
        weak var view: EventView?
        private var monitor: Any?
        private var spacePanActive = false

        init(
            onScroll: @escaping (CGSize, CGPoint) -> Void,
            onMagnify: @escaping (CGFloat, CGPoint) -> Void,
            canBeginSpacePan: @escaping (CGPoint) -> Bool,
            onSpacePanChanged: @escaping (Bool) -> Void
        ) {
            self.onScroll = onScroll
            self.onMagnify = onMagnify
            self.canBeginSpacePan = canBeginSpacePan
            self.onSpacePanChanged = onSpacePanChanged
        }

        func installMonitor() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(
                matching: [.scrollWheel, .magnify, .keyDown, .keyUp]
            ) { [weak self] event in
                guard let self,
                      let view,
                      view.window === event.window
                else {
                    self?.setSpacePanActive(false)
                    return event
                }

                switch event.type {
                case .scrollWheel:
                    guard let location = self.viewportLocation(for: event) else { return event }
                    let delta = CGSize(
                        width: event.scrollingDeltaX,
                        height: event.scrollingDeltaY
                    )
                    self.onScroll(delta, location)
                    return nil
                case .magnify:
                    guard let location = self.viewportLocation(for: event) else { return event }
                    self.onMagnify(event.magnification, location)
                    return nil
                case .keyDown:
                    guard event.keyCode == 49 else { return event }
                    guard !event.isARepeat else { return self.spacePanActive ? nil : event }
                    guard let location = self.pointerLocationInViewport(),
                          self.canBeginSpacePan(location)
                    else { return event }
                    self.setSpacePanActive(true)
                    return nil
                case .keyUp:
                    guard event.keyCode == 49 else { return event }
                    guard self.spacePanActive else { return event }
                    self.setSpacePanActive(false)
                    return nil
                default:
                    return event
                }
            }
        }

        func removeMonitor() {
            if let monitor {
                NSEvent.removeMonitor(monitor)
            }
            monitor = nil
            setSpacePanActive(false)
        }

        private func viewportLocation(for event: NSEvent) -> CGPoint? {
            guard let view else { return nil }
            let local = view.convert(event.locationInWindow, from: nil)
            return viewportLocation(fromLocalPoint: local)
        }

        private func pointerLocationInViewport() -> CGPoint? {
            guard let view, let window = view.window else { return nil }
            let local = view.convert(window.mouseLocationOutsideOfEventStream, from: nil)
            return viewportLocation(fromLocalPoint: local)
        }

        private func viewportLocation(fromLocalPoint local: CGPoint) -> CGPoint? {
            guard let view else { return nil }
            guard view.bounds.contains(local) else { return nil }
            return CGPoint(
                x: local.x,
                y: view.bounds.height - local.y
            )
        }

        private func setSpacePanActive(_ isActive: Bool) {
            guard spacePanActive != isActive else { return }
            spacePanActive = isActive
            onSpacePanChanged(isActive)
        }

        deinit {
            removeMonitor()
        }
    }
}

private struct CanvasToolSwitch: View {
    let tool: CanvasTool
    let onSelect: () -> Void
    let onHand: () -> Void

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            CanvasIconButton(
                systemName: "cursorarrow",
                help: "Select terminals",
                isActive: tool == .select,
                action: onSelect
            )
            CanvasIconButton(
                systemName: "hand.raised",
                help: "Pan canvas",
                isActive: tool == .hand,
                action: onHand
            )
        }
    }
}

private struct CanvasZoomTool: View {
    let scale: CGFloat
    let onZoomOut: () -> Void
    let onZoomIn: () -> Void
    let onReset: () -> Void
    let onFit: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            CanvasIconButton(
                systemName: "minus.magnifyingglass",
                help: "Zoom out",
                action: onZoomOut
            )

            Text(formattedZoom(scale))
                .font(HudFont.mono(10, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
                .frame(width: HudVantageMetrics.zoomLabelWidth)

            CanvasIconButton(
                systemName: "plus.magnifyingglass",
                help: "Zoom in",
                action: onZoomIn
            )

            CanvasIconButton(
                systemName: "arrow.counterclockwise",
                help: "Reset zoom",
                action: onReset
            )

            CanvasIconButton(
                systemName: "viewfinder",
                help: "Fit canvas",
                action: onFit
            )
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .fill(theme.palette.chrome)
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .stroke(theme.hairline.standard)
        )
        .shadow(
            color: theme.vantageShadow,
            radius: HudVantageMetrics.zoomControlShadowRadius,
            x: .zero,
            y: HudSpacing.md
        )
    }
}

private struct CanvasIconButton: View {
    let systemName: String
    let help: String
    var isActive = false
    let action: () -> Void

    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(isActive ? theme.palette.statusInfo : theme.palette.muted)
                .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .fill(background)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .stroke(border)
                )
        }
        .buttonStyle(.plain)
        .help(help)
        .accessibilityLabel(help)
        .onHover { isHovering = $0 }
    }

    private var background: Color {
        if isActive {
            return HudSurface.selected(theme.palette.statusInfo)
        }
        return isHovering ? theme.vantageControlHoverFill : theme.vantageControlFill
    }

    private var border: Color {
        if isActive {
            return HudSurface.tintStrong(theme.palette.statusInfo)
        }
        return isHovering ? theme.hairline.standard : theme.hairline.subtle
    }
}

private struct TerminalSurfaceContainer: View, Equatable {
    let controller: TerminiTerminalController
    @Environment(\.colorScheme) private var colorScheme

    static func == (lhs: TerminalSurfaceContainer, rhs: TerminalSurfaceContainer) -> Bool {
        lhs.controller === rhs.controller
    }

    var body: some View {
        HudTerminalSurface(
            controller: controller,
            showsSystemKeyboard: true,
            appearance: .hudsonDefault(for: colorScheme, fontSize: 12)
        )
    }
}

private struct TerminalInspectorRow: View {
    @ObservedObject var node: TerminalNode
    let isSelected: Bool
    let onSelect: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: HudSpacing.md) {
                HudStatusDot(color: node.tint.color, size: 6)
                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    Text(node.title)
                        .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                        .foregroundStyle(theme.palette.ink)
                    Text("\(Int(node.size.width)) x \(Int(node.size.height))")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(theme.palette.muted)
                }
                Spacer()
            }
            .padding(HudSpacing.xl)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(isSelected ? HudSurface.selected(node.tint.color) : theme.vantageControlFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? HudSurface.tintStrong(node.tint.color) : theme.hairline.subtle)
            )
        }
        .buttonStyle(.plain)
    }
}
