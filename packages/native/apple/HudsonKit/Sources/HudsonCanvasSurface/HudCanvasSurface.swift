import Darwin
import Foundation
import SwiftUI
import AppKit
import WebKit
import HudsonDiff
import HudsonLive
import HudsonObservability
import HudsonUI
import HudsonShell
import HudsonTerminal
import HudsonCanvasCore
import Termini

private let hudCanvasPerfTrace = HudTrace(category: "canvas.perf")
private let hudCanvasFrameProbeEnabled = ProcessInfo.processInfo.environment["HUDSON_CANVAS_FRAME_PROBE"] == "1"

private enum HudCanvasMetrics {
    static let terminalTitleBarHeight = HudLayout.fieldHeight
    static let terminalTrafficLightSize = HudDotSize.large
    static let terminalCompactChromeWidth: CGFloat = 320
    static let terminalMinimalChromeWidth: CGFloat = 196
    static let terminalCompactChromeHeight: CGFloat = 176
    static let terminalMinimalChromeHeight: CGFloat = 132
    static let terminalSecondaryChromeWidth: CGFloat = 430
    static let terminalSecondaryChromeHeight: CGFloat = 220
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
    static let filterButtonHeight = HudLayout.rowHeightCompact - HudSpacing.xs
    static let commandButtonWidth = HudLayout.rowHeightRegular
    static let viewportChipHeight = HudLayout.rowHeightCompact - HudSpacing.xxs
    static let statusBarHeight = HudLayout.statusBarHeight + HudSpacing.sm
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
    static let appearanceSheetWidth = HudLayout.cliffWidth
    static let appearanceSheetHeight = HudLayout.dialogWidth
        + HudLayout.rowHeightRegular
        + HudLayout.fieldHeight
    static let settingsScopeRailWidth = HudLayout.panelWidth
        - HudSpacing.huge
        - HudSpacing.xxxl
        - HudSpacing.xxl
        - HudSpacing.md
    static let commandPaletteWidth = HudLayout.popoverWidth
        + HudLayout.rowHeightRegular
        + HudSpacing.huge
        + HudSpacing.md
    static let lensWidth = HudLayout.dialogWidth
        + HudLayout.rowHeightRegular
        + HudSpacing.huge
    static let commandPaletteTopPadding = HudLayout.navHeight
        + HudSpacing.huge
        + HudSpacing.lg
    static let announceOverlayMaxWidth = HudLayout.popoverWidth + HudSpacing.huge + HudSpacing.xl
    static let announceOverlayShadowRadius = HudSpacing.xxxl - HudSpacing.xxs
    static let sceneTabMaxWidth = HudLayout.panelWidth - HudSpacing.huge - HudSpacing.xxxl - HudSpacing.xl
}

private extension HudTheme {
    var canvasControlFill: Color {
        palette.ink.opacity(HudOpacity.ghost)
    }

    var canvasControlHoverFill: Color {
        palette.ink.opacity(HudOpacity.subtle)
    }

    var canvasShadow: Color {
        self == .lightDraft ? palette.ink.opacity(HudOpacity.soft) : HudSurface.scrim
    }
}

private enum CanvasDocumentKind: String, Hashable {
    case file
    case plan
    case diff
    case note
    case preview

    init(runtimeKind: String) {
        switch runtimeKind {
        case "code", "code-file", "source", "source-file":
            self = .file
        case "plan", "plan-doc", "plan-document":
            self = .plan
        case "diff", "patch", "review-diff", "running-diff":
            self = .diff
        case "preview", "app-preview", "browser-preview":
            self = .preview
        case "note", "markdown", "document":
            self = .note
        default:
            self = .file
        }
    }

    var runtimeKind: String {
        switch self {
        case .file: "file"
        case .plan: "plan"
        case .diff: "diff"
        case .note: "note"
        case .preview: "preview"
        }
    }

    var badge: String {
        switch self {
        case .file: "FILE"
        case .plan: "PLAN"
        case .diff: "DIFF"
        case .note: "NOTE"
        case .preview: "PREVIEW"
        }
    }

    var symbolName: String {
        switch self {
        case .file: "doc.text"
        case .plan: "checklist"
        case .diff: "arrow.triangle.pull"
        case .note: "note.text"
        case .preview: "rectangle.on.rectangle"
        }
    }
}

private enum CanvasDocumentContentSource: Hashable {
    case inline
    case path
    case empty
}

private struct CanvasDocumentContent {
    var text: String
    var byteCount: Int
    var readByteCount: Int
    var truncated: Bool
}

private struct CanvasDocumentArtifact {
    var kind: CanvasDocumentKind
    var path: String?
    var language: String?
    var content: String
    var role: String?
    var contentSource: CanvasDocumentContentSource
    var byteCount: Int
    var readByteCount: Int
    var truncated: Bool
    var diffDocument: HudDiffDocument?

    var detail: String {
        if let path, !path.isEmpty {
            return path
        }
        if let role, !role.isEmpty {
            return role
        }
        return kind.badge.lowercased()
    }
}

private enum CanvasArtifactSaveError: LocalizedError {
    case missingArtifact

    var errorDescription: String? {
        switch self {
        case .missingArtifact:
            "No document artifact is available to save."
        }
    }
}

private let hudCanvasLegacyDocumentPaths: [String: String] = [
    "packages/native/apple/HudsonKit/Sources/HudsonCanvas/HudCanvasSurface.swift":
        "packages/native/apple/HudsonKit/Sources/HudsonCanvasSurface/HudCanvasSurface.swift",
    "packages/native/apple/HudsonKit/Sources/HudsonCanvas/HudCanvasSetupManifest.swift":
        "packages/native/apple/HudsonKit/Sources/HudsonCanvasSurface/HudCanvasSetupManifest.swift",
]

private final class CanvasArtifactFileWatcher {
    let url: URL
    private var source: DispatchSourceFileSystemObject?
    private var fileDescriptor: CInt = -1
    private var isArmed = false

    init?(
        url: URL,
        onChange: @escaping @MainActor () -> Void
    ) {
        let descriptor = open(url.path, O_EVTONLY)
        guard descriptor >= 0 else { return nil }

        self.url = url
        self.fileDescriptor = descriptor

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: descriptor,
            eventMask: [.write, .extend, .attrib, .delete, .rename],
            queue: .main
        )
        source.setEventHandler { [weak self] in
            guard self?.isArmed == true else { return }
            Task { @MainActor in
                onChange()
            }
        }
        source.setCancelHandler {
            close(descriptor)
        }
        self.source = source
        source.resume()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.isArmed = true
        }
    }

    deinit {
        cancel()
    }

    func cancel() {
        guard let source else { return }
        self.source = nil
        isArmed = false
        fileDescriptor = -1
        source.cancel()
    }
}

@MainActor
private final class TerminalNode: ObservableObject, Identifiable {
    enum RuntimeIdentity {
        case localPTY
        case tmux(target: String, path: GraphitePath?, remoteHost: String?)
        case document(CanvasDocumentArtifact)

        var badge: String {
            switch self {
            case .localPTY: "LOCAL PTY"
            case .tmux(_, _, let remoteHost): remoteHost == nil ? "TMUX" : "SSH TMUX"
            case .document(let artifact): artifact.kind.badge
            }
        }

        var detail: String {
            switch self {
            case .localPTY:
                "zsh · local PTY"
            case .tmux(let target, _, let remoteHost):
                remoteHost.map { "\($0) · \(target)" } ?? target
            case .document(let artifact):
                artifact.detail
            }
        }

        var graphitePath: String? {
            guard case .tmux(_, let path, _) = self else { return nil }
            return path?.description
        }

        var isTerminal: Bool {
            switch self {
            case .localPTY, .tmux:
                return true
            case .document:
                return false
            }
        }

        var symbolName: String {
            switch self {
            case .localPTY, .tmux:
                return "terminal"
            case .document(let artifact):
                return artifact.kind.symbolName
            }
        }
    }

    let id: UUID
    let externalID: String?
    let workspace: TerminiLocalPTYWorkspace?
    @Published var title: String
    @Published var subtitle: String
    let tint: HudTint
    @Published var runtimeIdentity: RuntimeIdentity

    @Published var origin: CGPoint
    @Published var size: CGSize
    @Published var zIndex: Double
    @Published var tag: CanvasTag?
    @Published var styleOverride: HudCanvasTerminalStyleOverride?
    @Published var liveSource: HudLiveSourceDescriptor?

    init(
        id: UUID = UUID(),
        externalID: String? = nil,
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
        styleOverride: HudCanvasTerminalStyleOverride? = nil,
        liveSource: HudLiveSourceDescriptor? = nil,
        workingDirectoryURL: URL? = nil
    ) {
        let controller = runtimeIdentity.isTerminal ? TerminiTerminalController() : nil
        self.id = id
        self.externalID = externalID
        self.workspace = controller.map {
            TerminiLocalPTYWorkspace(
                processSpec: processSpec ?? Self.localShellSpec(workingDirectoryURL: workingDirectoryURL),
                controller: $0
            )
        }
        self.title = title ?? "Session \(index)"
        self.subtitle = subtitle ?? runtimeIdentity.detail
        self.origin = origin
        self.size = size
        self.tint = tint
        self.zIndex = zIndex
        self.runtimeIdentity = runtimeIdentity
        self.tag = tag
        self.styleOverride = styleOverride?.isEmpty == true ? nil : styleOverride
        self.liveSource = liveSource
        workspace?.start()
    }

    var controller: TerminiTerminalController? {
        workspace?.controller
    }

    var isTerminal: Bool {
        runtimeIdentity.isTerminal
    }

    var symbolName: String {
        runtimeIdentity.symbolName
    }

    var documentArtifact: CanvasDocumentArtifact? {
        guard case .document(let artifact) = runtimeIdentity else { return nil }
        return artifact
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
        workspace?.stop()
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
                arguments: [
                    "-tt",
                    remoteHost,
                    "sh -lc \(shellQuoted(remoteTmuxAttachScript(target: target, createIfMissing: canCreate)))",
                ],
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
                "HUDSON_CANVAS": "1",
                "HUDSON_TERMINI_CANVAS": "1",
            ],
            workingDirectoryURL: workingDirectoryURL ?? defaultWorkingDirectoryURL
        )
    }

    private static func remoteTmuxAttachScript(
        target: String,
        createIfMissing: Bool
    ) -> String {
        let quotedTarget = shellQuoted(target)
        if createIfMissing {
            return """
            export TERM=xterm-256color
            if ! command -v tmux >/dev/null 2>&1; then
              printf 'tmux not found on remote host\\n' >&2
              exit 127
            fi
            exec tmux new-session -A -s \(quotedTarget)
            """
        }

        return """
        export TERM=xterm-256color
        target=\(quotedTarget)
        if ! command -v tmux >/dev/null 2>&1; then
          printf 'tmux not found on remote host\\n' >&2
          exit 127
        fi
        for _ in 1 2 3 4 5; do
          if tmux has-session -t "$target" >/dev/null 2>&1; then
            exec tmux attach-session -t "$target"
          fi
          sleep 0.25
        done
        printf 'tmux target %s not found on remote host\\n' "$target" >&2
        exit 1
        """
    }

    private static func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\"'\"'"))'"
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
        if let configuredPath = ProcessInfo.processInfo.environment["HUDSON_CANVAS_WORKDIR"],
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

private enum CanvasNavigationItem: String, Hashable {
    case canvas
    case terminal
    case navigator
    case lens
    case appearance
    case fit
    case newTerminal
    case inspector

    var title: String {
        switch self {
        case .canvas:      "Canvas"
        case .terminal:    "Terminal"
        case .navigator:   "Navigator"
        case .lens:        "Lens"
        case .appearance:  "Appearance"
        case .fit:         "Fit Canvas"
        case .newTerminal: "New Terminal"
        case .inspector:   "Inspector"
        }
    }

    var icon: String {
        switch self {
        case .canvas:      "square.grid.3x3"
        case .terminal:    "terminal"
        case .navigator:   "sidebar.left"
        case .lens:        "magnifyingglass"
        case .appearance:  "gearshape"
        case .fit:         "viewfinder"
        case .newTerminal: "plus"
        case .inspector:   "sidebar.right"
        }
    }

    var selectedIcon: String? {
        switch self {
        case .terminal:   "terminal.fill"
        case .appearance: "gearshape.fill"
        default:          nil
        }
    }
}

private enum CanvasLensTarget: Hashable {
    case node(UUID)
}

private struct CanvasLensResult: Identifiable, Hashable {
    var target: CanvasLensTarget
    var icon: String
    var title: String
    var detail: String
    var badge: String
    var snippet: String
    var tint: HudTint
    var score: Int

    var id: CanvasLensTarget { target }
}

private struct CanvasPersistenceToken: Hashable {
    var canvasTool: CanvasTool
    var navigationFilter: CanvasNavigationFilter
    var navigationTagFilter: CanvasTag?
    var navigationCollapsed: Bool
    var navigationWidth: CGFloat
    var minimapCollapsed: Bool
    var inspectorCollapsed: Bool
    var inspectorWidth: CGFloat
    var styleProfile: HudCanvasStyleProfile
    var tagStyleOverrides: [CanvasTag: HudCanvasTerminalStyleOverride]
}

private enum CanvasSpotlightKind {
    case agents
    case code
    case plans
    case diffs

    var label: String {
        switch self {
        case .agents: "agents"
        case .code: "code"
        case .plans: "plans"
        case .diffs: "diffs"
        }
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
        case .focus: theme.palette.statusInfo
        case .watch: theme.palette.muted
        case .parked: theme.palette.dim
        }
    }
}

private struct SelectionDrag {
    var start: CGPoint
    var current: CGPoint
    var baseSelection: Set<UUID>
    var mode: HudCanvasSelectionMode

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

private struct TmuxHealthSubject {
    var nodeID: UUID?
    var target: String
    var path: GraphitePath?
    var remoteHost: String?
}

private struct CanvasPresentationState: Hashable {
    var title: String?
    var subtitle: String?
    var badge: String?
    var cobrand: String?
    var productName: String?
    var hostName: String?
    var icon: String?
    var theme: String?
    var accent: String?

    mutating func apply(_ presentation: HudCanvasSetupPresentation?) {
        guard let presentation else { return }
        title = presentation.title ?? title
        subtitle = presentation.subtitle ?? subtitle
        badge = presentation.badge ?? badge
        cobrand = presentation.cobrand ?? cobrand
        productName = presentation.productName ?? productName
        hostName = presentation.hostName ?? hostName
        icon = presentation.icon ?? icon
        theme = presentation.theme ?? theme
        accent = presentation.accent ?? accent
    }
}

struct CanvasSceneTab: Identifiable, Equatable {
    let manifestPath: String?
    let title: String
    let subtitle: String?
    let badge: String?
    let accent: String?
    let appliedAt: Date

    var id: String {
        manifestPath ?? "inline-\(appliedAt.timeIntervalSince1970)"
    }

    static let recentsCap = 8

    static func make(
        manifestPath: String?,
        presentation: HudCanvasSetupPresentation?,
        fallbackTitle: String
    ) -> CanvasSceneTab {
        let title: String = {
            if let value = presentation?.title, !value.isEmpty { return value }
            if let value = presentation?.productName, !value.isEmpty { return value }
            if let path = manifestPath, !path.isEmpty {
                return URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent
            }
            return fallbackTitle
        }()
        return CanvasSceneTab(
            manifestPath: manifestPath,
            title: title,
            subtitle: presentation?.subtitle,
            badge: presentation?.badge,
            accent: presentation?.accent ?? presentation?.theme,
            appliedAt: Date()
        )
    }

    static func promoting(
        _ tab: CanvasSceneTab,
        in tabs: [CanvasSceneTab],
        limit: Int = recentsCap
    ) -> [CanvasSceneTab] {
        var promoted = tabs.filter { $0.id != tab.id }
        promoted.insert(tab, at: 0)
        return Array(promoted.prefix(limit))
    }
}

private enum HudCanvasStateError: Error, LocalizedError {
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

private enum HudCanvasSetupError: Error, LocalizedError {
    case missingManifest
    case manifestFileMissing(String)
    case unsupportedRuntime(String)
    case missingRuntimeTarget(String)

    var errorCode: String {
        switch self {
        case .missingManifest: "missing_setup_manifest"
        case .manifestFileMissing: "setup_manifest_missing"
        case .unsupportedRuntime: "unsupported_setup_runtime"
        case .missingRuntimeTarget: "missing_setup_runtime_target"
        }
    }

    var errorDescription: String? {
        switch self {
        case .missingManifest:
            "setup requires an inline manifest or manifestPath"
        case .manifestFileMissing(let path):
            "setup manifest not found: \(path)"
        case .unsupportedRuntime(let runtime):
            "unsupported setup runtime \(runtime)"
        case .missingRuntimeTarget(let title):
            "setup node \(title) is missing a tmux target"
        }
    }
}

private enum HudCanvasControlStyleError: Error, LocalizedError {
    case invalidScope(String)
    case invalidPreset(String)
    case invalidValue(field: String, value: String)
    case missingTag
    case unsupportedField(scope: String, field: String)

    var errorCode: String {
        switch self {
        case .invalidScope: "invalid_style_scope"
        case .invalidPreset: "invalid_style_preset"
        case .invalidValue: "invalid_style_value"
        case .missingTag: "missing_style_tag"
        case .unsupportedField: "unsupported_style_field"
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidScope(let scope):
            "style scope must be workspace, tag, or terminal; got \(scope)"
        case .invalidPreset(let preset):
            "unknown style preset \(preset)"
        case .invalidValue(let field, let value):
            "unknown \(field) value \(value)"
        case .missingTag:
            "tag scope requires a tag"
        case .unsupportedField(let scope, let field):
            "\(field) is only supported for workspace style, not \(scope)"
        }
    }
}

private enum HudCanvasControlNodeError: Error, LocalizedError {
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

private func formattedBytes(_ bytes: Int) -> String {
    if bytes < 1_024 {
        return "\(bytes)b"
    }
    if bytes < 1_024 * 1_024 {
        return String(format: "%.1fkb", Double(bytes) / 1_024)
    }
    return String(format: "%.1fmb", Double(bytes) / (1_024 * 1_024))
}

/// Native Hudson surface for composable agent workspaces.
///
/// The current implementation focuses on local PTYs, local tmux, remote tmux
/// over SSH, manifest-defined file/plan/diff artifacts, and JSONL-driven
/// external control. It is intentionally embeddable: Scout, Talkie, Fabric, or
/// a standalone app can each host their own Canvas by supplying a
/// `HudCanvasConfiguration`.
public struct HudCanvasSurface: View {
    private static let tileLimit = 128
    private static let largeTileLimit = 512
    private static let defaultPerfHarnessCount = 64
    private static let defaultPerfHarnessRateMS = 250.0
    private static let minimumCanvasScale: CGFloat = 0.002
    private static let maximumCanvasScale: CGFloat = 64

    private let configuration: HudCanvasConfiguration

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.hudTheme) private var inheritedTheme

    @State private var nodes: [TerminalNode] = []
    @State private var selectedIDs: Set<UUID> = []
    @State private var navigationFilter: CanvasNavigationFilter = .all
    @State private var navigationTagFilter: CanvasTag?
    @State private var navigationRailCompact = true
    @State private var navigationRailLabelWidth: CGFloat = 132
    @State private var navigationRailSelection: CanvasNavigationItem? = .canvas
    @State private var navigationCollapsed = false
    @State private var navigationWidth: CGFloat = 254
    @State private var minimapCollapsed = false
    @State private var inspectorCollapsed = false
    @State private var inspectorWidth: CGFloat = 300
    @State private var focusedNodeID: UUID?
    @State private var popOutWindows: [UUID: NSWindow] = [:]
    @State private var popOutDelegates: [UUID: CanvasPopOutWindowDelegate] = [:]
    @State private var nextIndex = 3
    @State private var nextZIndex: Double = 3
    @StateObject private var controlAPI: HudCanvasControlAPI
    @StateObject private var frameRateMonitor = HudCanvasFrameRateMonitor()
    @State private var controlStatus = "API ready"
    @State private var controlCommandCount = 0
    @State private var lastControlAction: String?
    @State private var lastControlDurationMS: Double?
    @State private var perfTracker = HudCanvasPerfTracker()
    @State private var tmuxInstallInProgress = false
    @State private var tmuxInstallMessage = ""
    @State private var tmuxInstallConfirmationPresented = false
    @State private var perfHarnessPrefix: String?
    @State private var didBootstrap = false
    @State private var canvasTool: CanvasTool = .select
    @State private var styleProfile: HudCanvasStyleProfile = .adaptive
    @State private var tagStyleOverrides: [CanvasTag: HudCanvasTerminalStyleOverride] = [:]
    @State private var presentationState = CanvasPresentationState()
    @State private var activeWorkspaceID: String?
    @State private var activeHandoffID: String?
    @State private var sceneTabs: [CanvasSceneTab] = []
    @State private var announceTab: CanvasSceneTab?
    @State private var announceDismissTask: Task<Void, Never>?
    @State private var hoverPoint: CGPoint?
    @State private var zoomGestureAnchor: CGPoint?
    @State private var appearanceSettingsPresented = false
    @State private var commandPalettePresented = false
    @State private var lensPresented = false
    @State private var lensQuery = ""
    @State private var lensSelectedIndex = 0
    @State private var canvasState = HudCanvasState(
        minimumScale: HudCanvasSurface.minimumCanvasScale,
        maximumScale: HudCanvasSurface.maximumCanvasScale
    )
    @State private var transientHandActive = false
    @State private var panStart: CGSize?
    @State private var zoomStart: CGFloat?
    @State private var selectionDrag: SelectionDrag?
    @State private var pendingPersistTask: Task<Void, Never>?
    @State private var documentWatchers: [UUID: CanvasArtifactFileWatcher] = [:]
    @State private var pendingArtifactReloadIDs: Set<UUID> = []
    @State private var pendingArtifactReloadTask: Task<Void, Never>?

    public init(configuration: HudCanvasConfiguration = .init()) {
        self.configuration = configuration
        _controlAPI = StateObject(
            wrappedValue: HudCanvasControlAPI(
                commandURL: configuration.commandURL,
                responseURL: configuration.responseURL
            )
        )
    }

    public var body: some View {
        AnyView(surfaceBody)
    }

    private var surfaceBody: some View {
        shellView
        .onAppear {
            bootstrapIfNeeded()
            startControlAPI()
            synchronizeDocumentWatchers()
        }
        .onDisappear {
            pendingPersistTask?.cancel()
            pendingPersistTask = nil
            pendingArtifactReloadTask?.cancel()
            pendingArtifactReloadTask = nil
            cancelDocumentWatchers()
            persistStateIfConfigured()
            controlAPI.stop()
            frameRateMonitor.reset()
            closePopOutWindows()
            stopAllNodes()
            didBootstrap = false
        }
        .onChange(of: persistenceToken) { _, _ in
            schedulePersistStateIfConfigured()
        }
        .onChange(of: lensQuery) { _, _ in
            lensSelectedIndex = 0
        }
        .onReceive(NotificationCenter.default.publisher(for: .canvasHostCommand)) { notification in
            handleHostCommand(notification)
        }
        .onAppear {
            publishHostStatus()
        }
        .onChange(of: nodes.count) { _, _ in
            publishHostStatus()
        }
        .onChange(of: selectedIDs) { _, _ in
            publishHostStatus()
        }
        .onChange(of: controlStatus) { _, _ in
            publishHostStatus()
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
        .environment(\.hudsonSidebarStyle, HudSidebarStyle(surface: .base))
        .overlay {
            AnyView(surfaceOverlay)
        }
        .sheet(isPresented: $appearanceSettingsPresented) {
            AnyView(appearanceSettingsSheet)
        }
        .onExitCommand {
            if dismissTopOverlay() {
                return
            }
            if appearanceSettingsPresented {
                appearanceSettingsPresented = false
            } else if isTerminalFocusActive {
                exitFocusMode()
            }
        }
        .background(
            HudWindowChrome(
                colorScheme: .dark,
                titleVisibility: .visible,
                titlebarAppearsTransparent: false,
                usesFullSizeContentView: false,
                isMovableByWindowBackground: false,
                hidesToolbar: false
            )
        )
        #if os(macOS)
        .toolbarBackground(.visible, for: .windowToolbar)
        .toolbarBackground(Color.black, for: .windowToolbar)
        .toolbarColorScheme(.dark, for: .windowToolbar)
        #endif
    }

    private var shellView: HudAppShell<AnyView, AnyView, EmptyView, EmptyView, AnyView, AnyView> {
        HudAppShell {
            AnyView(navigationShellSlot)
        } trailing: {
            AnyView(inspectorShellSlot)
        } content: {
            AnyView(terminalCanvasShell)
        } statusBar: {
            AnyView(statusBar)
        }
    }

    @ViewBuilder
    private var navigationShellSlot: some View {
        canvasNavigationShell
    }

    private var canvasNavigationShell: some View {
        HStack(spacing: 0) {
            navigationRail
                .zIndex(2)
            if !isTerminalFocusActive {
                navigationPanel
                    .zIndex(1)
            }
        }
    }

    @ViewBuilder
    private var inspectorShellSlot: some View {
        if !isTerminalFocusActive {
            inspectorPanel
        }
    }

    private var activeColorScheme: ColorScheme {
        styleProfile.chromeStyle.colorScheme(
            inheritedTheme: inheritedTheme,
            systemColorScheme: colorScheme,
            followsSystemColorScheme: configuration.followsSystemColorScheme
        )
    }

    private var activeTheme: HudTheme {
        styleProfile.chromeStyle.hudTheme(
            inheritedTheme: inheritedTheme,
            systemColorScheme: colorScheme,
            followsSystemColorScheme: configuration.followsSystemColorScheme
        )
    }

    private var terminalAppearance: HudTerminalAppearance {
        styleProfile.terminalAppearance(for: activeColorScheme)
    }

    private var persistenceToken: CanvasPersistenceToken {
        CanvasPersistenceToken(
            canvasTool: canvasTool,
            navigationFilter: navigationFilter,
            navigationTagFilter: navigationTagFilter,
            navigationCollapsed: navigationCollapsed,
            navigationWidth: navigationWidth,
            minimapCollapsed: minimapCollapsed,
            inspectorCollapsed: inspectorCollapsed,
            inspectorWidth: inspectorWidth,
            styleProfile: styleProfile,
            tagStyleOverrides: tagStyleOverrides
        )
    }

    @ViewBuilder
    private var surfaceOverlay: some View {
        commandPaletteOverlay
        lensOverlay
        announceOverlay
    }

    @ViewBuilder
    private var announceOverlay: some View {
        if let tab = announceTab {
            VStack(spacing: HudSpacing.xs) {
                if let badge = tab.badge, !badge.isEmpty {
                    HudBadge(
                        badge.uppercased(),
                        tint: activeTheme.palette.statusInfo,
                        dot: true
                    )
                }
                Text(tab.title)
                    .font(HudFont.mono(HudTextSize.base, weight: .bold))
                    .foregroundStyle(activeTheme.palette.ink)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                if let subtitle = tab.subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(HudFont.mono(HudTextSize.sm))
                        .foregroundStyle(activeTheme.palette.muted)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
            }
            .padding(.horizontal, HudSpacing.xl)
            .padding(.vertical, HudSpacing.lg)
            .frame(maxWidth: HudCanvasMetrics.announceOverlayMaxWidth)
            .background(
                RoundedRectangle(cornerRadius: activeTheme.radius.card)
                    .fill(activeTheme.palette.chrome)
            )
            .overlay(
                RoundedRectangle(cornerRadius: activeTheme.radius.card)
                    .strokeBorder(activeTheme.hairline.standard, lineWidth: 0.5)
            )
            .shadow(color: activeTheme.canvasShadow, radius: HudCanvasMetrics.announceOverlayShadowRadius, y: HudSpacing.sm)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .allowsHitTesting(false)
            .transition(
                .opacity.combined(
                    with: .scale(scale: 0.96, anchor: .center)
                )
            )
        }
    }

    @ViewBuilder
    private var commandPaletteOverlay: some View {
        if commandPalettePresented {
            CanvasCommandPalette(
                selectedCount: selectedIDs.count,
                onOpenAppearance: openAppearanceSettings,
                onOpenLens: {
                    commandPalettePresented = false
                    openLens()
                },
                onLayoutByTag: {
                    commandPalettePresented = false
                    layoutNodesByTag()
                },
                onCreateTerminal: {
                    commandPalettePresented = false
                    spawnTerminal()
                },
                onFocusSelection: {
                    commandPalettePresented = false
                    focusSelection()
                },
                onPopOutSelection: {
                    commandPalettePresented = false
                    popOutSelection()
                },
                onClose: { commandPalettePresented = false }
            )
        }
    }

    @ViewBuilder
    private var lensOverlay: some View {
        if lensPresented {
            CanvasLensOverlay(
                query: $lensQuery,
                selectedIndex: $lensSelectedIndex,
                results: lensResults,
                onClose: closeLens,
                onActivate: activateLensResult,
                onHoverResult: hoverLensResult
            )
        }
    }

    private var appearanceSettingsSheet: some View {
        CanvasAppearanceSettingsSurface(
            profile: $styleProfile,
            tagStyleOverrides: $tagStyleOverrides,
            selectedNode: singleSelectedNode,
            inheritedProfile: singleSelectedNode.map { inheritedStyleProfile(for: $0) },
            selectedStyleOverride: singleSelectedNode.map { terminalStyleBinding(for: $0) },
            onClose: { appearanceSettingsPresented = false }
        )
        .frame(
            width: HudCanvasMetrics.appearanceSheetWidth,
            height: HudCanvasMetrics.appearanceSheetHeight
        )
        .hudTheme(activeTheme)
        .environment(\.colorScheme, activeColorScheme)
    }

    private func hoverLensResult(_ result: CanvasLensResult) {
        guard let index = lensResults.firstIndex(of: result) else { return }
        lensSelectedIndex = index
    }

    private func resolvedStyleProfile(for node: TerminalNode) -> HudCanvasStyleProfile {
        var resolved = styleProfile
        if let tag = node.tag {
            resolved = resolved.applyingTerminalOverride(tagStyleOverrides[tag])
        }
        resolved = resolved.applyingTerminalOverride(node.styleOverride)
        return resolved
    }

    private func inheritedStyleProfile(for node: TerminalNode) -> HudCanvasStyleProfile {
        guard let tag = node.tag else { return styleProfile }
        return styleProfile.applyingTerminalOverride(tagStyleOverrides[tag])
    }

    private func terminalAppearance(for node: TerminalNode) -> HudTerminalAppearance {
        resolvedStyleProfile(for: node).terminalAppearance(for: activeColorScheme)
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

    private var navigationRailEntries: [HudSidebarEntry<CanvasNavigationItem>] {
        [
            .item(navigationRailItem(.canvas)),
            .item(navigationRailItem(.terminal)),
            .section(id: "workspace", title: "Workspace"),
            .item(navigationRailItem(.navigator)),
            .item(navigationRailItem(.lens)),
            .item(navigationRailItem(.appearance)),
            .section(id: "actions", title: "Actions"),
            .item(navigationRailItem(.fit)),
            .item(navigationRailItem(.newTerminal)),
            .item(navigationRailItem(.inspector)),
        ]
    }

    private func navigationRailItem(_ item: CanvasNavigationItem) -> HudSidebarItem<CanvasNavigationItem> {
        HudSidebarItem(
            id: item,
            title: item.title,
            icon: item.icon,
            selectedIcon: item.selectedIcon
        )
    }

    private var navigationSidebarVariant: HudNavigationSidebarVariant {
        switch configuration.navigationStyle {
        case .standard:     .standard
        case .verticalTabs: .verticalTabs
        }
    }

    private var navigationSidebarAccent: Color {
        configuration.navigationStyle == .verticalTabs
            ? activeTheme.palette.ink
            : activeTheme.palette.statusInfo
    }

    private var navigationSidebarStyle: HudSidebarStyle {
        guard configuration.navigationStyle == .verticalTabs else {
            return HudSidebarStyle(
                surface: .base,
                indicator: .kinetic,
                icon: .kinetic,
                motion: .kinetic
            )
        }
        return HudSidebarStyle(
            surface: .glass,
            indicator: .base,
            icon: .editorial,
            motion: .base
        )
    }

    private var verticalSceneTabs: [HudSidebarVerticalTab<String>] {
        sceneTabs.map { tab in
            HudSidebarVerticalTab(
                id: tab.id,
                title: tab.title,
                subtitle: tab.subtitle,
                badge: tab.badge,
                icon: tab.manifestPath == nil ? "square.dashed" : "rectangle.stack"
            )
        }
    }

    private var activeSceneTabBinding: Binding<String?> {
        Binding(
            get: { activeSceneTabID },
            set: { nextID in
                guard let nextID,
                      nextID != activeSceneTabID,
                      let tab = sceneTabs.first(where: { $0.id == nextID })
                else {
                    return
                }
                applySceneTab(tab)
            }
        )
    }

    private var navigationRail: some View {
        let tabProgress = navigationRailCompact ? 1.0 : 0.0
        return HudNavigationSidebar(
            selection: Binding(
                get: { activeNavigationRailSelection },
                set: { next in
                    if let next {
                        activateNavigationRailItem(next)
                    }
                }
            ),
            entries: navigationRailEntries,
            isCompact: navigationRailCompact,
            variant: navigationSidebarVariant,
            accent: navigationSidebarAccent,
            labelWidth: navigationRailLabelWidth,
            railHeader: {
                HudsonKitMark()
                    .foregroundStyle(activeTheme.palette.ink)
                    .frame(width: HudIconSize.small, height: HudIconSize.small)
                    .accessibilityLabel("Toggle Canvas rail labels")
            },
            labelHeader: {
                VStack(alignment: .leading, spacing: 1) {
                    Text("HUDSONKIT")
                        .font(HudFont.mono(HudTextSize.xxs, weight: .bold))
                        .tracking(1.2)
                        .foregroundStyle(activeTheme.palette.ink)
                    Text(presentationTitle)
                        .font(HudFont.ui(HudTextSize.xxs, weight: .medium))
                        .foregroundStyle(activeTheme.palette.muted)
                }
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .accessibilityLabel("Toggle Canvas rail labels")
            },
            verticalTabs: {
                if configuration.navigationStyle == .verticalTabs {
                    HudSidebarVerticalTabs(
                        selection: activeSceneTabBinding,
                        tabs: verticalSceneTabs,
                        progress: tabProgress,
                        labelWidth: navigationRailLabelWidth,
                        accent: activeTheme.palette.statusInfo,
                        title: "Workspaces",
                        createLabel: "New workspace",
                        onCreate: createBlankWorkspace
                    )
                }
            },
            footer: {
                HStack(spacing: 0) {
                    HudStatusDot(color: liveSourceCount > 0 ? activeTheme.palette.statusOk : activeTheme.palette.dim)
                        .frame(width: HudSidebarLayout.railWidth, height: HudLayout.rowHeightCompact)

                    if !navigationRailCompact {
                        Text(liveSourceCount > 0 ? "\(liveSourceCount) live" : "idle")
                            .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                            .foregroundStyle(activeTheme.palette.muted)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                            .transition(.opacity)
                    }
                }
                .frame(height: HudLayout.rowHeightCompact, alignment: .leading)
            }
        )
        .resizable(
            isCompact: $navigationRailCompact,
            labelWidth: $navigationRailLabelWidth,
            minLabelWidth: 112,
            maxLabelWidth: 180
        )
        .environment(\.hudsonSidebarStyle, navigationSidebarStyle)
    }

    private var activeNavigationRailSelection: CanvasNavigationItem? {
        if isTerminalFocusActive {
            return .terminal
        }
        if lensPresented {
            return .lens
        }
        if appearanceSettingsPresented {
            return .appearance
        }
        return navigationRailSelection
    }

    private func activateNavigationRailItem(_ item: CanvasNavigationItem) {
        navigationRailSelection = item

        switch item {
        case .canvas:
            if isTerminalFocusActive {
                exitFocusMode()
            }
            controlStatus = "Canvas"

        case .terminal:
            focusTerminalFromRail()

        case .navigator:
            withAnimation(HudMotion.chromeSpring) {
                navigationCollapsed.toggle()
            }
            controlStatus = navigationCollapsed ? "Navigator hidden" : "Navigator"

        case .lens:
            if isTerminalFocusActive {
                exitFocusMode()
            }
            openLens()

        case .appearance:
            if isTerminalFocusActive {
                exitFocusMode()
            }
            openAppearanceSettings()

        case .fit:
            if isTerminalFocusActive {
                exitFocusMode()
            }
            handleCanvasShortcut(.fitViewport)

        case .newTerminal:
            if isTerminalFocusActive {
                exitFocusMode()
            }
            spawnTerminal()
            controlStatus = "New terminal"

        case .inspector:
            if isTerminalFocusActive {
                exitFocusMode()
            }
            withAnimation(HudMotion.chromeSpring) {
                inspectorCollapsed.toggle()
            }
            controlStatus = inspectorCollapsed ? "Inspector hidden" : "Inspector"
        }
    }

    private func focusTerminalFromRail() {
        if isTerminalFocusActive {
            return
        }

        if let selectedTerminal = selectedNodes.first(where: \.isTerminal) {
            enterFocusMode(selectedTerminal.id)
            return
        }

        if let firstTerminal = nodes.first(where: \.isTerminal) {
            enterFocusMode(firstTerminal.id)
            return
        }

        spawnTerminal()
        if let spawnedTerminal = selectedNodes.first(where: \.isTerminal) {
            enterFocusMode(spawnedTerminal.id)
        }
    }

    @ViewBuilder
    private var navigationPanel: some View {
        if !navigationCollapsed {
            HudSidebarPanel(
                width: $navigationWidth,
                edge: .leading,
                widthRange: 210...360
            ) {
                CanvasNavigationPanel(
                    nodes: navigationNodes,
                    minimapNodes: nodes,
                    totalCount: nodes.count,
                    selectedCount: selectedIDs.count,
                    filter: $navigationFilter,
                    tagFilter: $navigationTagFilter,
                    minimapCollapsed: $minimapCollapsed,
                    selectedIDs: selectedIDs,
                    viewportWorldRect: canvasState.visibleWorldRect,
                    canvasWorldBounds: canvasWorldBounds,
                    canvasScale: canvasState.scale,
                    onSelectNode: selectNode,
                    onCenterNode: centerNode,
                    onTagSelection: tagSelection(as:),
                    onCenterWorldPoint: centerCanvas(on:),
                    onFit: fitCanvasToViewport,
                    onOpenAppearanceSettings: openAppearanceSettings
                )
            }
        }
    }

    @ViewBuilder
    private var inspectorPanel: some View {
        if !inspectorCollapsed {
            HudSidebarPanel(
                width: $inspectorWidth,
                edge: .trailing,
                widthRange: 250...440
            ) {
                CanvasInspectorPanel(
                    selectedNodes: selectedNodes,
                    tmuxAvailable: TerminalNode.localTmuxURL != nil,
                    tmuxInstallInProgress: tmuxInstallInProgress,
                    tmuxInstallMessage: tmuxInstallMessage,
                    onCenterNode: { node in
                        centerCanvas(on: CGPoint(x: node.origin.x + node.size.width / 2, y: node.origin.y + node.size.height / 2))
                    },
                    onCloseNode: close,
                    onInstallTmux: { tmuxInstallConfirmationPresented = true }
                )
            }
        }
    }

    private var selectedNodes: [TerminalNode] {
        nodes.filter { selectedIDs.contains($0.id) }
    }

    private var singleSelectedNode: TerminalNode? {
        let selected = selectedNodes
        return selected.count == 1 ? selected[0] : nil
    }

    private func openCommandPalette() {
        lensPresented = false
        commandPalettePresented = true
        controlStatus = "Command palette"
    }

    private func openAppearanceSettings() {
        commandPalettePresented = false
        lensPresented = false
        appearanceSettingsPresented = true
        controlStatus = "Appearance settings"
    }

    @discardableResult
    private func dismissTopOverlay() -> Bool {
        if lensPresented {
            closeLens()
            return true
        }
        if commandPalettePresented {
            commandPalettePresented = false
            return true
        }
        return false
    }

    private func openLens() {
        commandPalettePresented = false
        lensPresented = true
        lensSelectedIndex = 0
        controlStatus = "Lens"
    }

    private func handleHostCommand(_ notification: Notification) {
        guard let raw = notification.userInfo?["command"] as? String,
              let command = CanvasHostCommand(rawValue: raw) else {
            return
        }

        switch command {
        case .showCommandPalette:
            openCommandPalette()
        case .showAppearanceSettings:
            openAppearanceSettings()
        case .openLens:
            openLens()
        case .fitViewport:
            handleCanvasShortcut(.fitViewport)
        case .resetViewport:
            handleCanvasShortcut(.resetViewport)
        case .layoutByTag:
            handleCanvasShortcut(.layoutByTag)
        case .saveWorkspace:
            persistStateIfConfigured()
            controlStatus = "Workspace saved"
        case .clearSelection:
            selectedIDs.removeAll()
            controlStatus = "Selection cleared"
        case .toggleNavigator:
            if !isTerminalFocusActive {
                navigationCollapsed.toggle()
            }
        case .toggleInspector:
            if !isTerminalFocusActive {
                inspectorCollapsed.toggle()
            }
        }
    }

    private func publishHostStatus() {
        HudCanvasHostStatusCenter.post(
            HudCanvasHostStatus(
                workspaceID: configuration.workspaceID,
                nodeCount: nodes.count,
                selectedCount: selectedIDs.count,
                controlStatus: controlStatus
            )
        )
    }

    private func closeLens() {
        lensPresented = false
        lensQuery = ""
        lensSelectedIndex = 0
    }

    private var lensResults: [CanvasLensResult] {
        guard lensPresented else { return [] }
        return searchLensResults(matching: lensQuery)
    }

    private func searchLensResults(matching query: String) -> [CanvasLensResult] {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedQuery = trimmedQuery.lowercased()

        let results = nodes.compactMap { node -> CanvasLensResult? in
            let fields = lensSearchFields(for: node)
            let haystack = fields.joined(separator: "\n").lowercased()
            let score = lensScore(
                query: normalizedQuery,
                node: node,
                fields: fields,
                haystack: haystack
            )

            if !normalizedQuery.isEmpty, score == nil {
                return nil
            }

            return CanvasLensResult(
                target: .node(node.id),
                icon: node.symbolName,
                title: node.title,
                detail: node.subtitle,
                badge: node.runtimeIdentity.badge,
                snippet: lensSnippet(
                    query: normalizedQuery,
                    fields: fields,
                    fallback: node.runtimeIdentity.detail
                ),
                tint: node.tint,
                score: score ?? 900
            )
        }

        return results
            .sorted { lhs, rhs in
                if lhs.score != rhs.score {
                    return lhs.score < rhs.score
                }
                return lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
            }
            .prefix(24)
            .map { $0 }
    }

    private func lensSearchFields(for node: TerminalNode) -> [String] {
        var fields = [
            node.title,
            node.subtitle,
            node.id.uuidString,
            node.externalID ?? "",
            node.tag?.rawValue ?? "",
            node.tag?.label ?? "",
            node.runtimeIdentity.badge,
            node.runtimeIdentity.detail,
        ]

        switch node.runtimeIdentity {
        case .localPTY:
            break
        case .tmux(let target, let path, let remoteHost):
            fields.append(target)
            fields.append(path?.description ?? "")
            fields.append(remoteHost ?? "")
        case .document(let artifact):
            fields.append(artifact.kind.runtimeKind)
            fields.append(artifact.path ?? "")
            fields.append(artifact.language ?? "")
            fields.append(artifact.role ?? "")
            fields.append(artifact.content)
        }

        if let visibleText = node.controller?.visibleText(), !visibleText.isEmpty {
            fields.append(visibleText)
        }

        return fields.filter { !$0.isEmpty }
    }

    private func lensScore(
        query: String,
        node: TerminalNode,
        fields: [String],
        haystack: String
    ) -> Int? {
        guard !query.isEmpty else {
            return selectedIDs.contains(node.id) ? 80 : 900
        }

        if node.title.lowercased().hasPrefix(query) {
            return 0
        }
        if node.title.lowercased().contains(query) {
            return 10
        }
        if node.tag?.rawValue.lowercased() == query || node.tag?.label.lowercased() == query {
            return 20
        }
        if node.runtimeIdentity.badge.lowercased().contains(query) {
            return 30
        }
        if fields.dropFirst(2).contains(where: { $0.lowercased().contains(query) }) {
            return 40
        }
        if haystack.contains(query) {
            return 70
        }
        return nil
    }

    private func lensSnippet(query: String, fields: [String], fallback: String) -> String {
        guard !query.isEmpty else { return fallback }
        guard let field = fields.first(where: { $0.lowercased().contains(query) }) else {
            return fallback
        }

        let lines = field.split(whereSeparator: \.isNewline).map(String.init)
        let match = lines.first { $0.lowercased().contains(query) } ?? field
        let trimmed = match.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 140 else { return trimmed }
        return "\(trimmed.prefix(137))..."
    }

    private func activateLensResult(_ result: CanvasLensResult) {
        switch result.target {
        case .node(let id):
            guard nodes.contains(where: { $0.id == id }) else { return }
            selectedIDs = [id]
            centerNode(id)
            bringToFront(id)
            controlStatus = "Lens: \(result.title)"
        }
        closeLens()
    }

    private func selectNextLensResult(_ delta: Int) {
        let results = lensResults
        guard !results.isEmpty else {
            lensSelectedIndex = 0
            return
        }
        lensSelectedIndex = (lensSelectedIndex + delta + results.count) % results.count
    }

    private func activateSelectedLensResult() {
        let results = lensResults
        guard !results.isEmpty else { return }
        let index = min(max(lensSelectedIndex, 0), results.count - 1)
        activateLensResult(results[index])
    }

    private func terminalStyleBinding(for node: TerminalNode) -> Binding<HudCanvasTerminalStyleOverride> {
        Binding(
            get: { node.styleOverride ?? .empty },
            set: { override in
                setTerminalStyleOverride(node.id, override: override.isEmpty ? nil : override)
            }
        )
    }

    private var tmuxInstallPermissionMessage: String {
        let command = TmuxToolchain.homebrewInstallCommandDescription
            ?? "Homebrew was not found in PATH or common install locations."
        return "Canvas will run \(command). This is only needed for local tmux-backed sessions."
    }

    private var presentationTitle: String {
        presentationState.title ?? presentationState.productName ?? configuration.surfaceTitle
    }

    private var presentationSubtitle: String {
        presentationState.subtitle ?? presentationState.cobrand ?? configuration.surfaceSubtitle
    }

    private var canvasLinkLabel: String? {
        let workspace = activeWorkspaceID ?? configuration.workspaceID
        if let handoffID = compactHandoffID(activeHandoffID) {
            return "\(workspace) · \(handoffID)"
        }
        return workspace
    }

    private func compactHandoffID(_ value: String?) -> String? {
        guard var handoffID = trimmed(value) else { return nil }
        if handoffID.hasPrefix("handoff-") {
            handoffID.removeFirst("handoff-".count)
        }
        return String(handoffID.prefix(18))
    }

    private var environmentContextLabel: String {
        let lane = configuration.commandURL.lastPathComponent
        let scope = configuration.commandURL.path.hasPrefix("/tmp/") ? "LOCAL DEV" : "HOST"
        return "\(scope) · \(configuration.workspaceID) · \(lane)"
    }

    private func canvasLinkText(_ label: String) -> some View {
        Text(label)
            .font(HudFont.mono(9, weight: .semibold))
            .foregroundStyle(activeTheme.palette.statusInfo.opacity(HudOpacity.emphatic))
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .help("Scout/Canvas link identifier")
    }

    private var terminalCanvasShell: some View {
        VStack(spacing: 0) {
            if configuration.navigationStyle == .standard {
                sceneTabBar
            }
            canvasViewport
        }
    }

    private var sceneTabBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: HudSpacing.xs) {
                        ForEach(sceneTabs) { tab in
                            sceneTabButton(tab)
                        }
                    }
                    .padding(.leading, HudSpacing.xxl)
                    .padding(.trailing, HudSpacing.sm)
                    .padding(.vertical, HudSpacing.xs)
                }
                newWorkspaceButton
                    .padding(.trailing, HudSpacing.xxl)
            }
            .frame(height: HudLayout.buttonHeight)
            .background(activeTheme.palette.chrome)
            HudDivider(color: activeTheme.hairline.standard)
        }
    }

    private var newWorkspaceButton: some View {
        Button {
            createBlankWorkspace()
        } label: {
            Image(systemName: "plus")
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(activeTheme.palette.muted)
                .frame(width: HudIconSize.small, height: HudIconSize.small)
                .background(
                    RoundedRectangle(cornerRadius: activeTheme.radius.standard)
                        .fill(Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: activeTheme.radius.standard)
                        .strokeBorder(activeTheme.hairline.standard, lineWidth: 0.5)
                )
        }
        .buttonStyle(.plain)
        .help("New workspace")
    }

    private func sceneTabButton(_ tab: CanvasSceneTab) -> some View {
        let isActive = tab.id == activeSceneTabID
        return Button {
            if !isActive {
                applySceneTab(tab)
            }
        } label: {
            HStack(spacing: HudSpacing.xs) {
                HudStatusDot(
                    color: isActive
                        ? activeTheme.palette.statusInfo
                        : activeTheme.palette.muted,
                    size: HudDotSize.tiny
                )
                Text(tab.title)
                    .font(HudFont.mono(HudTextSize.xxs, weight: isActive ? .bold : .regular))
                    .tracking(0.6)
                    .foregroundStyle(
                        isActive
                            ? activeTheme.palette.ink
                            : activeTheme.palette.muted
                    )
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .padding(.horizontal, HudSpacing.sm)
            .padding(.vertical, HudSpacing.xs)
            .frame(maxWidth: HudCanvasMetrics.sceneTabMaxWidth)
            .background(
                RoundedRectangle(cornerRadius: activeTheme.radius.standard)
                    .fill(
                        isActive
                            ? HudSurface.tintFill(activeTheme.palette.statusInfo)
                            : Color.clear
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: activeTheme.radius.standard)
                    .strokeBorder(
                        isActive
                            ? HudSurface.tintMuted(activeTheme.palette.statusInfo)
                            : activeTheme.hairline.standard,
                        lineWidth: 0.5
                    )
            )
        }
        .buttonStyle(.plain)
        .help(tab.subtitle ?? tab.title)
        .accessibilityValue(isActive ? "Selected" : "Not selected")
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }


    private var canvasViewport: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                activeTheme.palette.bg
                InfiniteCanvasBackground(
                    pan: canvasBackgroundPan,
                    scale: canvasBackgroundScale,
                    styleProfile: styleProfile
                )
                .allowsHitTesting(false)

                terminalCanvas
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .allowsHitTesting(isTerminalFocusActive || effectiveCanvasTool == .select)

                if !isTerminalFocusActive, let rect = selectionDrag?.viewportRect {
                    SelectionMarquee(rect: rect)
                }

                if hudCanvasFrameProbeEnabled {
                    CanvasFrameRateProbe(
                        monitor: frameRateMonitor,
                        onSample: updateFrameRatePerfCounters
                    )
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
                    },
                    onCommandPalette: openCommandPalette,
                    onShortcut: handleCanvasShortcut,
                    onCursorMoved: { point in hoverPoint = point },
                    isLensPresented: lensPresented,
                    allowsCanvasScrollInput: !isTerminalFocusActive,
                    cursor: canvasCursor
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
            .overlay(alignment: .top) {
                if !isTerminalFocusActive {
                    CanvasActionToolbar(
                        tool: effectiveCanvasTool,
                        onSelect: { canvasTool = .select },
                        onHand: { canvasTool = .hand },
                        onCommandPalette: openCommandPalette,
                        onFocus: focusSelection,
                        onPopOut: popOutSelection,
                        onNew: spawnTerminal,
                        focusDisabled: selectedIDs.count != 1,
                        popOutDisabled: selectedIDs.isEmpty
                    )
                    .padding(.top, HudSpacing.lg)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if !isTerminalFocusActive {
                    CanvasZoomTool(
                        scale: canvasState.scale,
                        onZoomOut: { zoom(by: 0.8) },
                        onZoomIn: { zoom(by: 1.25) },
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
                if zoomStart == nil {
                    zoomStart = canvasState.scale
                    zoomGestureAnchor = hoverPoint ?? canvasState.viewportCenter
                }
                let start = zoomStart ?? canvasState.scale
                let anchor = zoomGestureAnchor ?? canvasState.viewportCenter
                setCanvasScale(start * value, around: anchor)
            }
            .onEnded { _ in
                zoomStart = nil
                zoomGestureAnchor = nil
            }
    }

    private func zoom(by factor: CGFloat) {
        setCanvasScale(canvasState.scale * factor, around: canvasState.viewportCenter)
    }

    private func handleCanvasShortcut(_ shortcut: CanvasKeyboardShortcut) {
        switch shortcut {
        case .openLens:
            openLens()
        case .lensNext:
            guard lensPresented else { return }
            selectNextLensResult(1)
        case .lensPrevious:
            guard lensPresented else { return }
            selectNextLensResult(-1)
        case .lensActivate:
            guard lensPresented else { return }
            activateSelectedLensResult()
        case .escape:
            if dismissTopOverlay() {
                return
            }
            if isTerminalFocusActive {
                exitFocusMode()
            } else {
                selectedIDs.removeAll()
                controlStatus = "Selection cleared"
            }
        case .pan(let delta):
            guard !lensPresented, !isTerminalFocusActive else { return }
            canvasState = canvasState.panned(by: delta)
            controlStatus = "Canvas travel"
            schedulePersistStateIfConfigured()
        case .resetViewport:
            guard !lensPresented, !isTerminalFocusActive else { return }
            resetCanvasViewport()
            schedulePersistStateIfConfigured()
            controlStatus = "Viewport reset"
        case .fitViewport:
            guard !lensPresented, !isTerminalFocusActive else { return }
            fitCanvasToViewport()
            controlStatus = "Fit canvas"
        case .layoutByTag:
            guard !lensPresented, !isTerminalFocusActive else { return }
            layoutNodesByTag()
        case .spotlight(let kind):
            guard !lensPresented, !isTerminalFocusActive else { return }
            spotlight(kind)
        }
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
        selectedIDs = HudCanvasSelectionState(ids: selectionDrag.baseSelection)
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
        guard node.isTerminal else { return false }

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
        return 1
    }

    private func displayPan(for node: TerminalNode, scale: CGFloat) -> CGSize {
        guard focusedNode?.id == node.id else { return canvasState.pan }

        let size = focusScreenSize
        return CGSize(
            width: (canvasState.viewportSize.width - size.width) / 2 - node.origin.x * scale,
            height: (canvasState.viewportSize.height - size.height) / 2 - node.origin.y * scale
        )
    }

    private var focusScreenSize: CGSize {
        let inset = CGFloat(styleProfile.focusPadding)
        return CGSize(
            width: max(360, canvasState.viewportSize.width - inset * 2),
            height: max(260, canvasState.viewportSize.height - inset * 2)
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
                        workspaceStyleProfile: styleProfile,
                        tagStyleOverrides: tagStyleOverrides,
                        activeColorScheme: activeColorScheme,
                        canvasPan: displayPan(for: node, scale: displayScale),
                        canvasScale: displayScale,
                        screenSizeOverride: isFocused ? focusScreenSize : nil,
                        documentBaseURL: configuration.workingDirectoryURL,
                        onSelect: { selectNode(node.id) },
                        onFocus: { enterFocusMode(node.id) },
                        onPopOut: { popOut(nodes: [node]) },
                        onAppearanceSettings: {
                            selectNode(node.id)
                            openAppearanceSettings()
                        },
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
        .coordinateSpace(name: "canvas-canvas")
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
            HudGrainOverlay(opacity: 0.035)

            HStack(spacing: HudSpacing.lg) {
                Text("\(nodes.count) nodes")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.dim)
                Text("\(liveSourceCount) live")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.muted)
                Text("·")
                    .font(HudFont.mono(10))
                    .foregroundStyle(activeTheme.palette.dim)
                Text(environmentContextLabel)
                    .font(HudFont.mono(9))
                    .foregroundStyle(activeTheme.palette.dim)
                    .lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, HudSpacing.xxl)

            ViewportStatusChip(
                rect: canvasState.visibleWorldRect,
                scale: canvasState.scale,
                tool: effectiveCanvasTool
            )
        }
        .frame(height: HudCanvasMetrics.statusBarHeight)
        .background(activeTheme.palette.bg)
    }

    private var canvasCursor: CanvasCursor {
        if transientHandActive || panStart != nil {
            return .closedHand
        }
        return effectiveCanvasTool == .hand ? .openHand : .arrow
    }

    private var controlPerfLabel: String {
        guard let action = lastControlAction, let duration = lastControlDurationMS else {
            return "api idle"
        }

        return "\(action) \(String(format: "%.1f", duration))ms"
    }

    private func updateFrameRatePerfCounters(_ sample: HudCanvasFrameRateSample?) {
        guard let sample else {
            perfTracker.set("surface.fps", to: 0)
            perfTracker.set("surface.frameMS", to: 0)
            perfTracker.set("surface.slowestFrameMS", to: 0)
            return
        }

        perfTracker.set("surface.fps", to: sample.roundedFramesPerSecond)
        perfTracker.set("surface.frameMS", to: sample.roundedAverageFrameDurationMS)
        perfTracker.set("surface.slowestFrameMS", to: Int(sample.slowestFrameDurationMS.rounded()))
    }

    private var liveSourceCount: Int {
        nodes.compactMap(\.liveSource).filter { $0.status.isReceiving }.count
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
            let span = hudCanvasPerfTrace.beginSpan(
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
        if let command = bootstrapSetupCommand() {
            let response = applySetupCommand(command)
            controlStatus = response.message
            if response.ok || !nodes.isEmpty {
                return
            }
        }
        resetTerminals()
    }

    private func bootstrapReattachCommand() -> HudCanvasControlCommand? {
        let environment = ProcessInfo.processInfo.environment
        let ids = parseEnvironmentList(
            environment["HUDSON_CANVAS_REATTACH_IDS"]
                ?? environment["TERMINI_CANVAS_REATTACH_IDS"]
        )
        let sessions = parseEnvironmentList(
            environment["HUDSON_CANVAS_REATTACH_SESSIONS"]
                ?? environment["TERMINI_CANVAS_REATTACH_SESSIONS"]
        )
        let targets = parseEnvironmentList(
            environment["HUDSON_CANVAS_REATTACH_TARGETS"]
                ?? environment["TERMINI_CANVAS_REATTACH_TARGETS"]
        )
        let remoteHost = environment["HUDSON_CANVAS_REATTACH_REMOTE_HOST"]
            ?? environment["TERMINI_CANVAS_REATTACH_REMOTE_HOST"]

        guard !ids.isEmpty || !sessions.isEmpty || !targets.isEmpty else {
            return nil
        }

        return HudCanvasControlCommand(
            id: "bootstrap-reattach",
            action: "reattach",
            reset: true,
            ids: ids.isEmpty ? nil : ids,
            sessions: sessions.isEmpty ? nil : sessions,
            targets: targets.isEmpty ? nil : targets,
            createIfMissing: (environment["HUDSON_CANVAS_REATTACH_CREATE"]
                ?? environment["TERMINI_CANVAS_REATTACH_CREATE"]) == "1",
            remoteHost: remoteHost
        )
    }

    private func bootstrapRestoreCommand() -> HudCanvasControlCommand? {
        let environment = ProcessInfo.processInfo.environment
        let shouldRestore = configuration.restoresStateOnLaunch
            || environment["HUDSON_CANVAS_RESTORE_ON_LAUNCH"] == "1"
            || environment["TERMINI_CANVAS_RESTORE_ON_LAUNCH"] == "1"
        guard shouldRestore else { return nil }

        let statePath = environment["HUDSON_CANVAS_STATE_FILE"]
            ?? environment["TERMINI_CANVAS_STATE_FILE"]

        return HudCanvasControlCommand(
            id: "bootstrap-restore",
            action: "restore",
            workspaceID: configuration.workspaceID,
            statePath: statePath,
            reset: true,
            createIfMissing: (environment["HUDSON_CANVAS_RESTORE_CREATE"]
                ?? environment["TERMINI_CANVAS_RESTORE_CREATE"]) == "1"
        )
    }

    private func bootstrapSetupCommand() -> HudCanvasControlCommand? {
        let environment = ProcessInfo.processInfo.environment
        let setupPath = environment["HUDSON_CANVAS_SETUP_FILE"]
            ?? environment["TERMINI_CANVAS_SETUP_FILE"]
            ?? configuration.launchSetupURL?.path
        guard let setupPath, !setupPath.isEmpty else { return nil }

        return HudCanvasControlCommand(
            id: "bootstrap-setup",
            action: "setup",
            workspaceID: configuration.workspaceID,
            manifestPath: setupPath,
            fit: true,
            createIfMissing: true,
            includeStyle: true
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
        case "reload", "reload-documents", "refresh", "refresh-documents":
            return reloadDocumentNodes(command)
        case "style", "set-style", "appearance", "set-appearance", "settings", "set-settings":
            return applyStyleCommand(command)
        case "tmux-status", "tmuxstatus", "tmux-health", "tmuxhealth", "health":
            return tmuxHealthStatus(command)
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
        case "setup", "apply-setup", "setup-workspace", "apply-workspace", "compose":
            return applySetupCommand(command)
        case "clear":
            stopAllNodes()
            schedulePersistStateIfConfigured()
            return controlResponse(
                command,
                ok: true,
                message: "cleared nodes"
            )
        case "reset":
            resetTerminals()
            return controlResponse(
                command,
                ok: true,
                message: "reset nodes"
            )
        case "status":
            return controlResponse(
                command,
                ok: true,
                message: "\(nodes.count) nodes"
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        let span = hudCanvasPerfTrace.beginSpan("tmux.reattach")
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        let span = hudCanvasPerfTrace.beginSpan("perf.harness")
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
        let rootURL = URL(fileURLWithPath: "/tmp/hudson-canvas-perf-\(prefix)", isDirectory: true)
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

            let attachCommand = HudCanvasControlCommand(
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        let span = hudCanvasPerfTrace.beginSpan("perf.cleanup")
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
                let script = "i=0; while :; do printf '%s hudson-canvas \(session) line %05d\\n' \"$(date +%H:%M:%S)\" \"$i\" >> \(quotedLogPath); i=$((i+1)); sleep \(rateSeconds); done & tail -n 50 -f \(quotedLogPath)"
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
        from command: HudCanvasControlCommand
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
            selectedIDs = HudCanvasSelectionState(ids: selectedIDs)
                .applying(
                    Set(resolved.map(\.id)),
                    mode: HudCanvasSelectionMode(normalized: command.normalizedSelectionMode)
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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

    private func reloadDocumentNodes(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let targetNodes: [TerminalNode]
            if nodeSelectors(from: command).isEmpty {
                let selectedDocuments = nodes.filter { node in
                    selectedIDs.contains(node.id) && node.documentArtifact != nil
                }
                targetNodes = selectedDocuments.isEmpty
                    ? nodes.filter { $0.documentArtifact != nil }
                    : selectedDocuments
            } else {
                targetNodes = try resolveNodes(from: command, allowSelectionFallback: false)
            }

            var reloaded: [TerminalNode] = []
            var skipped = 0
            for node in targetNodes {
                if reloadDocumentNode(node) {
                    reloaded.append(node)
                } else {
                    skipped += 1
                }
            }

            if !reloaded.isEmpty {
                perfTracker.increment("artifact.reload", by: reloaded.count)
                restartDocumentWatchers(for: Set(reloaded.map(\.id)))
                synchronizeDocumentWatchers()
                schedulePersistStateIfConfigured()
            }

            return controlResponse(
                command,
                ok: true,
                message: "reloaded \(reloaded.count) document\(reloaded.count == 1 ? "" : "s")"
                    + (skipped > 0 ? " · skipped \(skipped)" : ""),
                nodesOverride: reloaded
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func reloadDocumentNode(_ node: TerminalNode) -> Bool {
        guard case .document(let artifact) = node.runtimeIdentity,
              artifact.contentSource != .inline,
              let path = artifact.path,
              !path.isEmpty
        else {
            return false
        }

        let updated = documentArtifact(
            kind: artifact.kind,
            path: path,
            language: artifact.language,
            inlineContent: nil,
            role: artifact.role
        )
        node.runtimeIdentity = .document(updated)
        node.subtitle = updated.detail
        recordDocumentLiveEvent(
            for: node,
            kind: "document.reload",
            summary: "\(updated.kind.badge.lowercased()) reloaded"
        )
        return true
    }

    private func synchronizeDocumentWatchers() {
        let watchableNodes = nodes.filter { node in
            guard case .document(let artifact) = node.runtimeIdentity,
                  artifact.contentSource != .inline,
                  let path = artifact.path,
                  !path.isEmpty
            else {
                return false
            }
            return FileManager.default.fileExists(atPath: documentURL(for: path).path)
        }
        let watchableIDs = Set(watchableNodes.map(\.id))

        let staleWatcherIDs = documentWatchers.keys.filter { !watchableIDs.contains($0) }
        for id in staleWatcherIDs {
            documentWatchers[id]?.cancel()
            documentWatchers[id] = nil
            if let node = nodes.first(where: { $0.id == id }) {
                updateDocumentLiveSource(
                    for: node,
                    status: .offline,
                    detail: "watch detached"
                )
            }
        }

        for node in nodes where node.documentArtifact == nil {
            node.liveSource = nil
        }

        for node in nodes where node.documentArtifact != nil && !watchableIDs.contains(node.id) {
            guard let artifact = node.documentArtifact else { continue }
            if artifact.contentSource == .inline {
                node.liveSource = nil
            } else {
                updateDocumentLiveSource(
                    for: node,
                    status: .offline,
                    detail: "path unavailable"
                )
            }
        }

        for node in watchableNodes {
            guard let artifact = node.documentArtifact,
                  let path = artifact.path
            else { continue }
            if documentWatchers[node.id] != nil {
                updateDocumentLiveSource(
                    for: node,
                    status: .live,
                    detail: liveDetail(for: artifact)
                )
                continue
            }

            updateDocumentLiveSource(
                for: node,
                status: .connecting,
                detail: "attaching file watcher"
            )
            let url = documentURL(for: path)
            documentWatchers[node.id] = CanvasArtifactFileWatcher(url: url) { [id = node.id] in
                scheduleArtifactReload(for: id)
            }
            if documentWatchers[node.id] != nil {
                updateDocumentLiveSource(
                    for: node,
                    status: .live,
                    detail: liveDetail(for: artifact)
                )
                perfTracker.increment("artifact.watch.started")
            } else {
                updateDocumentLiveSource(
                    for: node,
                    status: .error,
                    detail: "file watcher failed"
                )
                perfTracker.increment("artifact.watch.failed")
            }
        }

        perfTracker.set("artifact.watch.active", to: documentWatchers.count)
    }

    private func cancelDocumentWatchers() {
        for watcher in documentWatchers.values {
            watcher.cancel()
        }
        documentWatchers.removeAll()
        perfTracker.set("artifact.watch.active", to: 0)
    }

    private func scheduleArtifactReload(for id: UUID) {
        if let node = nodes.first(where: { $0.id == id }) {
            updateDocumentLiveSource(
                for: node,
                status: .replaying,
                detail: "file changed; reloading"
            )
        }
        pendingArtifactReloadIDs.insert(id)
        perfTracker.increment("artifact.watch.event")
        guard pendingArtifactReloadTask == nil else {
            perfTracker.increment("artifact.watch.coalesced")
            return
        }

        pendingArtifactReloadTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 180_000_000)
            guard !Task.isCancelled else {
                pendingArtifactReloadTask = nil
                return
            }

            let ids = pendingArtifactReloadIDs
            pendingArtifactReloadIDs.removeAll()
            pendingArtifactReloadTask = nil
            reloadChangedArtifacts(ids)
        }
    }

    private func reloadChangedArtifacts(_ ids: Set<UUID>) {
        let startedAt = CFAbsoluteTimeGetCurrent()
        var reloaded = 0
        for id in ids {
            guard let node = nodes.first(where: { $0.id == id }) else { continue }
            if reloadDocumentNode(node) {
                reloaded += 1
            } else {
                updateDocumentLiveSource(
                    for: node,
                    status: .stale,
                    detail: "change detected; reload skipped"
                )
            }
        }
        if reloaded > 0 {
            perfTracker.increment("artifact.watch.reload", by: reloaded)
            perfTracker.recordTiming(
                "artifact.watch.reload",
                durationMS: (CFAbsoluteTimeGetCurrent() - startedAt) * 1_000
            )
            restartDocumentWatchers(for: ids)
            synchronizeDocumentWatchers()
            schedulePersistStateIfConfigured()
        }
    }

    private func restartDocumentWatchers(for ids: Set<UUID>) {
        for id in ids {
            documentWatchers[id]?.cancel()
            documentWatchers[id] = nil
        }
    }

    private func documentLiveSourceID(for node: TerminalNode) -> String {
        let stableID = node.externalID?.trimmingCharacters(in: .whitespacesAndNewlines)
        let nodeToken = (stableID?.isEmpty == false ? stableID : node.id.uuidString) ?? node.id.uuidString
        return "canvas.\(configuration.workspaceID).artifact.\(GraphitePath.slugify(nodeToken, fallback: node.id.uuidString.lowercased()))"
    }

    private func updateDocumentLiveSource(
        for node: TerminalNode,
        status: HudLiveStatus,
        detail: String? = nil
    ) {
        guard let artifact = node.documentArtifact else {
            node.liveSource = nil
            return
        }

        let descriptor = baseDocumentLiveSource(
            for: node,
            artifact: artifact,
            status: status,
            detail: detail
        )
        node.liveSource = descriptor
    }

    private func recordDocumentLiveEvent(
        for node: TerminalNode,
        kind: String,
        summary: String
    ) {
        guard let artifact = node.documentArtifact else {
            node.liveSource = nil
            return
        }

        let descriptor = baseDocumentLiveSource(
            for: node,
            artifact: artifact,
            status: .live,
            detail: liveDetail(for: artifact)
        )
        let timestamp = Date()
        let event = HudLiveEvent(
            id: "\(kind):\(node.id.uuidString):\(Int(timestamp.timeIntervalSince1970 * 1_000))",
            sourceID: descriptor.id,
            timestamp: timestamp,
            kind: kind,
            summary: summary,
            metadata: liveMetadata(for: node, artifact: artifact)
        )
        node.liveSource = descriptor.receiving(event)
    }

    private func baseDocumentLiveSource(
        for node: TerminalNode,
        artifact: CanvasDocumentArtifact,
        status: HudLiveStatus,
        detail: String?
    ) -> HudLiveSourceDescriptor {
        var descriptor = node.liveSource ?? HudLiveSourceDescriptor(
            id: documentLiveSourceID(for: node),
            label: node.title,
            kind: "artifact.\(artifact.kind.runtimeKind)",
            status: status,
            detail: detail ?? liveDetail(for: artifact),
            capabilities: .snapshotOnly,
            metadata: liveMetadata(for: node, artifact: artifact)
        )
        descriptor.label = node.title
        descriptor.kind = "artifact.\(artifact.kind.runtimeKind)"
        descriptor.status = status
        descriptor.detail = detail ?? liveDetail(for: artifact)
        descriptor.capabilities = .snapshotOnly
        descriptor.metadata = liveMetadata(for: node, artifact: artifact)
        return descriptor
    }

    private func liveDetail(for artifact: CanvasDocumentArtifact) -> String {
        if let path = artifact.path, !path.isEmpty {
            return "watching \(URL(fileURLWithPath: path).lastPathComponent)"
        }
        return artifact.detail
    }

    private func liveMetadata(
        for node: TerminalNode,
        artifact: CanvasDocumentArtifact
    ) -> [String: String] {
        var metadata: [String: String] = [
            "nodeID": node.id.uuidString,
            "workspaceID": configuration.workspaceID,
            "artifactKind": artifact.kind.runtimeKind,
        ]
        if let externalID = node.externalID {
            metadata["externalID"] = externalID
        }
        if let path = artifact.path {
            metadata["path"] = path
        }
        if let role = artifact.role {
            metadata["role"] = role
        }
        return metadata
    }

    private func focusNodes(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            guard let focusRect = boundingRect(for: resolved) else {
                throw HudCanvasControlNodeError.emptySelection
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            guard resolved.count == 1, let node = resolved.first else {
                return controlResponse(
                    command,
                    ok: false,
                    message: "focus mode requires exactly one node",
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        exitFocusMode()
        return controlResponse(
            command,
            ok: true,
            message: "focus mode closed"
        )
    }

    private func popOutNodes(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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

    private func applySetupCommand(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let manifest = try setupManifest(from: command)
            let report = applySetupManifest(manifest, command: command)
            let health = manifest.nodes.isEmpty
                ? nil
                : nodes.compactMap(tmuxHealthSubject).map {
                    tmuxHealth(
                        for: $0,
                        probeRemote: false,
                        timeoutSeconds: remoteHealthTimeoutSeconds(from: command)
                    )
                }
            let failedCount = report.failedNodes.count
            return controlResponse(
                command,
                ok: failedCount == 0,
                message: failedCount == 0
                    ? setupSuccessMessage(report)
                    : "setup applied with \(failedCount) failure\(failedCount == 1 ? "" : "s")",
                errorCode: failedCount == 0 ? nil : "setup_partial_failure",
                nodesOverride: setupResponseNodes(from: report),
                style: controlStyleSummary(includeTerminalOverrides: true),
                tmuxHealth: health,
                setup: report
            )
        } catch let error as HudCanvasSetupError {
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription,
                errorCode: error.errorCode
            )
        } catch {
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription,
                errorCode: "setup_error"
            )
        }
    }

    private func recordSceneTab(
        manifest: HudCanvasSetupManifest,
        command: HudCanvasControlCommand
    ) {
        let path = trimmed(command.manifestPath ?? command.statePath)
        let tab = CanvasSceneTab.make(
            manifestPath: path,
            presentation: manifest.presentation,
            fallbackTitle: configuration.surfaceTitle
        )
        if let path, !path.isEmpty {
            sceneTabs = CanvasSceneTab.promoting(tab, in: sceneTabs)
        }
        triggerSceneAnnounce(tab)
    }

    private func triggerSceneAnnounce(_ tab: CanvasSceneTab) {
        announceDismissTask?.cancel()
        withAnimation(.easeInOut(duration: 0.28)) {
            announceTab = tab
        }
        announceDismissTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_700_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeInOut(duration: 0.32)) {
                announceTab = nil
            }
        }
    }

    private func applySceneTab(_ tab: CanvasSceneTab) {
        if let path = tab.manifestPath, !path.isEmpty {
            let command = HudCanvasControlCommand(
                apiVersion: "v0",
                kind: "hudson.canvas.command",
                id: "scene-tab-\(UUID().uuidString)",
                action: "setup",
                manifestPath: path,
                createIfMissing: true,
                removeMissing: true
            )
            _ = applySetupCommand(command)
        } else {
            activateBlankWorkspace(tab)
        }
    }

    private func createBlankWorkspace() {
        let existingBlanks = sceneTabs.filter { $0.manifestPath == nil }.count
        let title = "Workspace \(existingBlanks + 1)"
        switchToBlankWorkspace(named: title)
    }

    private func switchToBlankWorkspace(named title: String) {
        activateBlankWorkspace(
            CanvasSceneTab(
                manifestPath: nil,
                title: title,
                subtitle: nil,
                badge: nil,
                accent: nil,
                appliedAt: Date()
            )
        )
    }

    private func activateBlankWorkspace(_ tab: CanvasSceneTab) {
        stopAllNodes()
        activeWorkspaceID = GraphitePath.slugify(tab.title, fallback: configuration.workspaceID)
        activeHandoffID = nil
        presentationState = CanvasPresentationState(
            title: tab.title,
            subtitle: tab.subtitle,
            badge: tab.badge,
            cobrand: nil,
            productName: nil,
            hostName: nil,
            icon: nil,
            theme: nil,
            accent: tab.accent
        )
        sceneTabs = CanvasSceneTab.promoting(tab, in: sceneTabs)
        triggerSceneAnnounce(tab)
        schedulePersistStateIfConfigured()
    }

    private var activeSceneTabID: String? {
        sceneTabs.first?.id
    }

    private func setupHandoffID(
        from manifest: HudCanvasSetupManifest,
        command: HudCanvasControlCommand
    ) -> String? {
        if let handoffID = trimmed(manifest.handoffId) {
            return handoffID
        }
        guard let commandID = trimmed(command.id),
              commandID.hasPrefix("openscout-handoff-") else {
            return nil
        }
        return String(commandID.dropFirst("openscout-".count))
    }

    private func setupSuccessMessage(_ report: HudCanvasSetupReport) -> String {
        let created = report.createdNodeIDs.count
        let reused = report.reusedNodeIDs.count
        let removed = report.removedNodeIDs.count
        return "setup applied: \(created) created, \(reused) reused, \(removed) removed"
    }

    private func setupResponseNodes(from report: HudCanvasSetupReport) -> [TerminalNode]? {
        let ids = Set(report.createdNodeIDs + report.reusedNodeIDs + report.updatedNodeIDs)
        guard !ids.isEmpty else { return nil }
        return nodes.filter { ids.contains($0.id) }
    }

    private func setupManifest(from command: HudCanvasControlCommand) throws -> HudCanvasSetupManifest {
        if let manifest = command.setupManifest {
            return manifest
        }

        guard let path = trimmed(command.manifestPath ?? command.statePath) else {
            throw HudCanvasSetupError.missingManifest
        }

        guard FileManager.default.fileExists(atPath: path) else {
            throw HudCanvasSetupError.manifestFileMissing(path)
        }

        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(HudCanvasSetupManifest.self, from: data)
    }

    private func applySetupManifest(
        _ manifest: HudCanvasSetupManifest,
        command: HudCanvasControlCommand
    ) -> HudCanvasSetupReport {
        let span = hudCanvasPerfTrace.beginSpan("setup.apply")
        var report = HudCanvasSetupReport(
            workspaceID: manifest.workspaceID ?? command.workspaceID ?? configuration.workspaceID,
            presentation: manifest.presentation
        )
        var touchedIDs = Set<UUID>()

        activeWorkspaceID = report.workspaceID
        activeHandoffID = setupHandoffID(from: manifest, command: command)
        presentationState.apply(manifest.presentation)
        recordSceneTab(manifest: manifest, command: command)
        applySetupPresentationTheme(manifest.presentation)
        if let style = manifest.style {
            applySetupStyle(style)
        }
        if let layout = manifest.layout {
            applySetupLayout(layout)
        }

        let createIfMissing = command.createIfMissing
            ?? manifest.createIfMissing
            ?? false
        let removeMissing = command.removeMissing
            ?? manifest.removeMissing
            ?? false

        for (offset, setupNode) in manifest.nodes.enumerated() {
            do {
                if let existing = try existingSetupNode(for: setupNode) {
                    let didUpdate = try updateExistingSetupNode(existing, from: setupNode)
                    report.reusedNodeIDs.append(existing.id)
                    if didUpdate {
                        report.updatedNodeIDs.append(existing.id)
                    }
                    touchedIDs.insert(existing.id)
                } else {
                    let node = try terminalNode(
                        from: setupNode,
                        offset: offset,
                        createIfMissing: setupNode.createIfMissing ?? createIfMissing
                    )
                    nodes.append(node)
                    report.createdNodeIDs.append(node.id)
                    touchedIDs.insert(node.id)
                    nextIndex += 1
                }
            } catch {
                report.failedNodes.append(
                    HudCanvasSetupFailure(
                        id: setupNode.id ?? setupNode.nodeID?.uuidString,
                        title: setupNode.title,
                        message: error.localizedDescription
                    )
                )
            }
        }

        if removeMissing {
            let removed = nodes
                .filter { !touchedIDs.contains($0.id) }
                .map(\.id)
            if !removed.isEmpty {
                for node in nodes where removed.contains(node.id) {
                    node.stop()
                }
                nodes.removeAll { removed.contains($0.id) }
                selectedIDs.subtract(removed)
                report.removedNodeIDs = removed
            }
        }

        applySetupSelection(manifest, touchedIDs: touchedIDs)
        applySetupViewport(manifest.viewport, command: command)
        nextZIndex = max(nextZIndex, (nodes.map(\.zIndex).max() ?? 0) + 1)
        controlStatus = "Setup · \(report.createdNodeIDs.count) created · \(report.reusedNodeIDs.count) reused"
        perfTracker.increment("setup.apply")
        perfTracker.set("setup.created", to: report.createdNodeIDs.count)
        perfTracker.set("setup.reused", to: report.reusedNodeIDs.count)
        perfTracker.set("setup.failed", to: report.failedNodes.count)
        synchronizeDocumentWatchers()
        schedulePersistStateIfConfigured()
        span.end(report.failedNodes.isEmpty ? "ok" : "partial")
        return report
    }

    private func applySetupPresentationTheme(_ presentation: HudCanvasSetupPresentation?) {
        guard let theme = trimmed(presentation?.theme),
              styleProfile.id == HudCanvasStyleProfile.adaptive.id,
              let preset = HudCanvasStyleProfile.presets.first(where: { controlToken($0.id) == controlToken(theme) })
        else { return }
        styleProfile = preset
    }

    private func applySetupStyle(_ style: HudCanvasSetupStyle) {
        let command = HudCanvasControlCommand(
            action: "style",
            stylePreset: style.stylePreset ?? style.preset,
            chromeStyle: style.chromeStyle,
            terminalTheme: style.terminalTheme,
            terminalThemeID: style.terminalThemeID,
            terminalFontFamily: style.terminalFontFamily,
            terminalFontSize: style.terminalFontSize,
            canvasGridMode: style.canvasGridMode,
            canvasGridStep: style.canvasGridStep,
            canvasMinorOpacity: style.canvasMinorOpacity,
            canvasMajorOpacity: style.canvasMajorOpacity,
            focusPadding: style.focusPadding
        )
        if let updated = try? workspaceStyleProfile(applying: command, to: styleProfile) {
            styleProfile = updated
        }
        for entry in style.tagStyles ?? [:] {
            guard let tag = try? controlTag(from: entry.key), !entry.value.isEmpty else { continue }
            tagStyleOverrides[tag] = entry.value
        }
    }

    private func applySetupLayout(_ layout: HudCanvasSetupLayout) {
        if let tool = layout.canvasTool.flatMap(CanvasTool.init(rawValue:)) {
            canvasTool = tool
        }
        if let filter = layout.navigationFilter.flatMap(CanvasNavigationFilter.init(rawValue:)) {
            navigationFilter = filter
        }
        if let tag = layout.navigationTagFilter.flatMap(CanvasTag.init(rawValue:)) {
            navigationTagFilter = tag
        }
        if let navigationCollapsed = layout.navigationCollapsed {
            self.navigationCollapsed = navigationCollapsed
        }
        if let navigationWidth = layout.navigationWidth {
            self.navigationWidth = clamped(CGFloat(navigationWidth), to: 210...360)
        }
        if let minimapCollapsed = layout.minimapCollapsed {
            self.minimapCollapsed = minimapCollapsed
        }
        if let inspectorCollapsed = layout.inspectorCollapsed {
            self.inspectorCollapsed = inspectorCollapsed
        }
        if let inspectorWidth = layout.inspectorWidth {
            self.inspectorWidth = clamped(CGFloat(inspectorWidth), to: 250...440)
        }
    }

    private func applySetupViewport(
        _ viewport: HudCanvasSetupViewport?,
        command: HudCanvasControlCommand
    ) {
        if viewport?.reset == true || command.reset == true {
            resetCanvasViewport()
        }
        if viewport?.fit == true || command.fit == true {
            fitCanvasToViewport()
        }
        if viewport?.panX != nil || viewport?.panY != nil || viewport?.scale != nil {
            canvasState = canvasState.replaying(
                panX: viewport?.panX.map { CGFloat($0) },
                panY: viewport?.panY.map { CGFloat($0) },
                scale: viewport?.scale.map { CGFloat($0) }
            )
        }
    }

    private func applySetupSelection(
        _ manifest: HudCanvasSetupManifest,
        touchedIDs: Set<UUID>
    ) {
        var selected = Set(manifest.selectedNodeIDs).intersection(Set(nodes.map(\.id)))
        for selector in manifest.selection {
            let matches = nodes(matching: selector)
            if matches.count == 1, let node = matches.first {
                selected.insert(node.id)
            }
        }
        if selected.isEmpty {
            selected = touchedIDs
        }
        selectedIDs = selected

        if let focusedID = manifest.focusedNodeID, nodes.contains(where: { $0.id == focusedID }) {
            focusedNodeID = focusedID
        } else if let selector = manifest.focused,
                  let node = nodes(matching: selector).first {
            focusedNodeID = node.id
        }
    }

    private func existingSetupNode(for setupNode: HudCanvasSetupNode) throws -> TerminalNode? {
        if let uuid = setupNode.nodeID ?? setupNode.id.flatMap(UUID.init(uuidString:)) {
            return nodes.first { $0.id == uuid }
        }
        if let externalID = setupNode.id?.trimmingCharacters(in: .whitespacesAndNewlines),
           !externalID.isEmpty,
           let match = nodes.first(where: { $0.externalID == externalID }) {
            return match
        }
        if isDocumentRuntimeKind(setupRuntimeKind(for: setupNode)),
           let path = setupDocumentPath(for: setupNode) {
            return nodes.first { node in
                guard case .document(let artifact) = node.runtimeIdentity else { return false }
                return artifact.path == path
            }
        }
        if let path = try setupGraphitePath(for: setupNode) {
            return nodes.first { node in
                guard case .tmux(_, let nodePath, _) = node.runtimeIdentity else { return false }
                return nodePath == path
            }
        }
        if let target = try setupTmuxTarget(for: setupNode) {
            let remoteHost = try validatedRemoteHost(setupNode.remoteHost ?? setupNode.runtime?.remoteHost)
            return nodes.first { node in
                guard case .tmux(let nodeTarget, _, let nodeRemoteHost) = node.runtimeIdentity else { return false }
                return nodeTarget == target && nodeRemoteHost == remoteHost
            }
        }
        return nil
    }

    private func updateExistingSetupNode(
        _ node: TerminalNode,
        from setupNode: HudCanvasSetupNode
    ) throws -> Bool {
        var changed = false
        if let x = setupNode.x ?? setupNode.layout?.x {
            node.origin.x = CGFloat(x)
            changed = true
        }
        if let y = setupNode.y ?? setupNode.layout?.y {
            node.origin.y = CGFloat(y)
            changed = true
        }
        if let width = setupNode.width ?? setupNode.layout?.width {
            node.size.width = max(300, CGFloat(width))
            changed = true
        }
        if let height = setupNode.height ?? setupNode.layout?.height {
            node.size.height = max(200, CGFloat(height))
            changed = true
        }
        if let zIndex = setupNode.zIndex {
            node.zIndex = zIndex
            changed = true
        }
        if let tagValue = setupNode.tag {
            node.tag = tagValue.isEmpty ? nil : try controlTag(from: tagValue)
            changed = true
        }
        if let style = try setupNodeStyleOverride(setupNode) {
            node.styleOverride = style.isEmpty ? nil : style
            changed = true
        }
        if isDocumentRuntimeKind(setupRuntimeKind(for: setupNode)) {
            let artifact = documentArtifact(from: setupNode, runtimeKind: setupRuntimeKind(for: setupNode))
            node.runtimeIdentity = .document(artifact)
            node.title = setupNode.title ?? documentTitle(for: artifact)
            node.subtitle = setupNode.subtitle ?? artifact.detail
            changed = true
        }
        return changed
    }

    private func terminalNode(
        from setupNode: HudCanvasSetupNode,
        offset: Int,
        createIfMissing: Bool
    ) throws -> TerminalNode {
        let runtimeKind = setupRuntimeKind(for: setupNode)
        let nodeID = setupNode.nodeID
            ?? setupNode.id.flatMap(UUID.init(uuidString:))
            ?? UUID()
        let layout = setupNode.layout
        let origin = CGPoint(
            x: CGFloat(setupNode.x ?? layout?.x ?? (72 + Double(offset * 38))),
            y: CGFloat(setupNode.y ?? layout?.y ?? (76 + Double(offset * 38)))
        )
        let size = CGSize(
            width: max(300, CGFloat(setupNode.width ?? layout?.width ?? 500)),
            height: max(200, CGFloat(setupNode.height ?? layout?.height ?? 316))
        )
        let tint = HudTint.from(token: setupNode.tint ?? tint(for: nextIndex).rawValue)
        let zIndex = setupNode.zIndex ?? nextZIndex
        nextZIndex = max(nextZIndex, zIndex + 1)
        let tag = try setupNode.tag.map { try controlTag(from: $0) }
        let style = try setupNodeStyleOverride(setupNode)

        switch runtimeKind {
        case "file", "code", "code-file", "source", "source-file",
             "plan", "plan-doc", "plan-document",
             "diff", "patch", "review-diff", "running-diff",
             "note", "markdown", "document",
             "preview", "app-preview", "browser-preview":
            let artifact = documentArtifact(from: setupNode, runtimeKind: runtimeKind)
            return TerminalNode(
                id: nodeID,
                externalID: setupNode.id,
                index: nextIndex,
                origin: origin,
                size: size,
                tint: tint,
                zIndex: zIndex,
                title: setupNode.title ?? documentTitle(for: artifact),
                subtitle: setupNode.subtitle ?? artifact.detail,
                runtimeIdentity: .document(artifact),
                tag: tag,
                styleOverride: style
            )

        case "local-pty", "localpty", "pty":
            return TerminalNode(
                id: nodeID,
                externalID: setupNode.id,
                index: nextIndex,
                origin: origin,
                size: size,
                tint: tint,
                zIndex: zIndex,
                title: setupNode.title,
                subtitle: setupNode.subtitle,
                tag: tag,
                styleOverride: style,
                workingDirectoryURL: configuration.workingDirectoryURL
            )

        case "tmux", "remote-tmux", "sshtmux", "ssh-tmux":
            guard let target = try setupTmuxTarget(for: setupNode) else {
                throw HudCanvasSetupError.missingRuntimeTarget(setupNode.title ?? setupNode.id ?? "untitled")
            }
            let path = try setupGraphitePath(for: setupNode)
            let remoteHost = try validatedRemoteHost(setupNode.remoteHost ?? setupNode.runtime?.remoteHost)
            if remoteHost == nil, TerminalNode.localTmuxURL == nil {
                throw HudCanvasStateError.tmuxMissing
            }
            if remoteHost == nil,
               !TerminalNode.canCreateTmuxTarget(target, createIfMissing: createIfMissing),
               !TerminalNode.localTmuxTargetExists(target) {
                throw HudCanvasStateError.missingTmuxTarget(target)
            }
            return TerminalNode(
                id: nodeID,
                externalID: setupNode.id,
                index: nextIndex,
                origin: origin,
                size: size,
                tint: tint,
                zIndex: zIndex,
                processSpec: TerminalNode.tmuxAttachSpec(
                    target: target,
                    createIfMissing: createIfMissing,
                    remoteHost: remoteHost,
                    workingDirectoryURL: configuration.workingDirectoryURL
                ),
                title: setupNode.title ?? path.map { "\($0.app) \($0.instance)" } ?? "tmux \(target)",
                subtitle: setupNode.subtitle ?? remoteHost.map { "ssh · \($0)" } ?? "tmux · \(target)",
                runtimeIdentity: .tmux(target: target, path: path, remoteHost: remoteHost),
                tag: tag,
                styleOverride: style
            )

        default:
            throw HudCanvasSetupError.unsupportedRuntime(runtimeKind)
        }
    }

    private func setupRuntimeKind(for setupNode: HudCanvasSetupNode) -> String {
        let kind = setupNode.runtime?.kind
            ?? setupNode.runtimeKind
            ?? ((setupNode.path ?? setupNode.runtime?.path ?? setupNode.content ?? setupNode.runtime?.content) == nil
                ? ((setupNode.target ?? setupNode.runtime?.target ?? setupNode.graphitePath ?? setupNode.runtime?.graphitePath) == nil
                    ? "local-pty"
                    : "tmux")
                : "file")
        return kind.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func isDocumentRuntimeKind(_ runtimeKind: String) -> Bool {
        switch runtimeKind {
        case "file", "code", "code-file", "source", "source-file",
             "plan", "plan-doc", "plan-document",
             "diff", "patch", "review-diff", "running-diff",
             "note", "markdown", "document",
             "preview", "app-preview", "browser-preview":
            return true
        default:
            return false
        }
    }

    private func normalizedDocumentPath(_ path: String?) -> String? {
        guard let path = trimmed(path) else { return nil }
        return hudCanvasLegacyDocumentPaths[path] ?? path
    }

    private func normalizedLegacyDocumentPathReferences(in text: String) -> String {
        hudCanvasLegacyDocumentPaths.reduce(text) { value, entry in
            value.replacingOccurrences(of: entry.key, with: entry.value)
        }
    }

    private func setupDocumentPath(for setupNode: HudCanvasSetupNode) -> String? {
        normalizedDocumentPath(setupNode.path ?? setupNode.runtime?.path ?? setupNode.target ?? setupNode.runtime?.target)
    }

    private func documentArtifact(
        from setupNode: HudCanvasSetupNode,
        runtimeKind: String
    ) -> CanvasDocumentArtifact {
        let kind = CanvasDocumentKind(runtimeKind: runtimeKind)
        let path = setupDocumentPath(for: setupNode)
        let language = trimmed(setupNode.language ?? setupNode.runtime?.language)
            ?? inferredLanguage(from: path)
        let inlineContent = setupNode.content ?? setupNode.runtime?.content
        return documentArtifact(
            kind: kind,
            path: path,
            language: language,
            inlineContent: inlineContent,
            role: trimmed(setupNode.role ?? setupNode.runtime?.role)
        )
    }

    private func documentArtifact(
        kind: CanvasDocumentKind,
        path: String?,
        language: String?,
        inlineContent: String?,
        role: String?
    ) -> CanvasDocumentArtifact {
        let content: CanvasDocumentContent
        let source: CanvasDocumentContentSource
        if let inlineContent {
            content = CanvasDocumentContent(
                text: inlineContent,
                byteCount: inlineContent.utf8.count,
                readByteCount: inlineContent.utf8.count,
                truncated: false
            )
            source = .inline
        } else if let path {
            content = readDocumentPreview(path: path, kind: kind)
            source = .path
        } else {
            content = CanvasDocumentContent(
                text: "",
                byteCount: 0,
                readByteCount: 0,
                truncated: false
            )
            source = .empty
        }

        let diffDocument = kind == .diff
            ? parseDiffDocument(
                content.text,
                title: path?.split(separator: "/").last.map(String.init),
                language: language ?? "diff"
            )
            : nil

        return CanvasDocumentArtifact(
            kind: kind,
            path: path,
            language: language,
            content: content.text,
            role: role,
            contentSource: source,
            byteCount: content.byteCount,
            readByteCount: content.readByteCount,
            truncated: content.truncated,
            diffDocument: diffDocument
        )
    }

    private func documentTitle(for artifact: CanvasDocumentArtifact) -> String {
        if let path = artifact.path,
           let last = path.split(separator: "/").last,
           !last.isEmpty {
            return String(last)
        }
        return artifact.kind.badge.capitalized
    }

    private func inferredLanguage(from path: String?) -> String? {
        guard let ext = path?.split(separator: ".").last?.lowercased() else { return nil }
        switch ext {
        case "swift": return "swift"
        case "ts", "tsx": return "typescript"
        case "js", "jsx": return "javascript"
        case "json": return "json"
        case "md", "markdown": return "markdown"
        case "diff", "patch": return "diff"
        case "sh", "bash", "zsh": return "shell"
        default: return String(ext)
        }
    }

    private func parseDiffDocument(
        _ text: String,
        title: String?,
        language: String?
    ) -> HudDiffDocument {
        let startedAt = CFAbsoluteTimeGetCurrent()
        let document = HudUnifiedDiffParser.parse(
            text,
            title: title,
            language: language
        )
        let duration = (CFAbsoluteTimeGetCurrent() - startedAt) * 1_000
        perfTracker.increment("artifact.diff.parse")
        perfTracker.increment("artifact.diff.files", by: document.stats.files)
        perfTracker.increment("artifact.diff.hunks", by: document.stats.hunks)
        perfTracker.increment("artifact.diff.rows", by: document.rows.count)
        perfTracker.recordTiming("artifact.diff.parse", durationMS: duration)
        return document
    }

    private func readDocumentPreview(
        path: String,
        kind: CanvasDocumentKind
    ) -> CanvasDocumentContent {
        let url = documentURL(for: path)
        let limit = documentPreviewByteLimit(for: kind)
        do {
            let startedAt = CFAbsoluteTimeGetCurrent()
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            let previewData = data.prefix(limit)
            guard var text = String(data: previewData, encoding: .utf8) else {
                return CanvasDocumentContent(
                    text: "Unable to preview \(path): file is not UTF-8 text.",
                    byteCount: data.count,
                    readByteCount: previewData.count,
                    truncated: data.count > previewData.count
                )
            }
            if data.count > previewData.count {
                text += "\n\n... truncated preview ..."
                perfTracker.increment("artifact.document.truncated")
            }
            let duration = (CFAbsoluteTimeGetCurrent() - startedAt) * 1_000
            perfTracker.increment("artifact.document.read")
            perfTracker.increment("artifact.document.bytes", by: data.count)
            perfTracker.increment("artifact.document.readBytes", by: previewData.count)
            if kind == .diff {
                perfTracker.increment("artifact.diff.read")
                perfTracker.increment("artifact.diff.bytes", by: data.count)
            }
            perfTracker.recordTiming("artifact.document.read", durationMS: duration)
            return CanvasDocumentContent(
                text: text,
                byteCount: data.count,
                readByteCount: previewData.count,
                truncated: data.count > previewData.count
            )
        } catch {
            perfTracker.increment("artifact.document.readError")
            return CanvasDocumentContent(
                text: "Unable to preview \(path): \(error.localizedDescription)",
                byteCount: 0,
                readByteCount: 0,
                truncated: false
            )
        }
    }

    private func documentPreviewByteLimit(for kind: CanvasDocumentKind) -> Int {
        switch kind {
        case .diff:
            1_024 * 1_024
        default:
            16 * 1024
        }
    }

    private func documentURL(for path: String) -> URL {
        let resolvedPath = normalizedDocumentPath(path) ?? path
        if resolvedPath.hasPrefix("/") {
            return URL(fileURLWithPath: resolvedPath)
        }
        let base = configuration.workingDirectoryURL
            ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        return base.appendingPathComponent(resolvedPath)
    }

    private func setupGraphitePath(for setupNode: HudCanvasSetupNode) throws -> GraphitePath? {
        let candidate = setupNode.graphitePath
            ?? setupNode.runtime?.graphitePath
            ?? (setupNode.id?.hasPrefix("\(GraphitePath.root).") == true ? setupNode.id : nil)
        return try candidate.map(GraphitePath.init(parse:))
    }

    private func setupTmuxTarget(for setupNode: HudCanvasSetupNode) throws -> String? {
        if let target = setupNode.target ?? setupNode.runtime?.target {
            return try TmuxTarget.validatedTarget(target)
        }
        if let path = try setupGraphitePath(for: setupNode) {
            return try TmuxTarget.from(path: path).windowTarget
        }
        if setupRuntimeKind(for: setupNode).contains("tmux"),
           let id = setupNode.id,
           UUID(uuidString: id) == nil {
            return try TmuxTarget.validatedTarget(id)
        }
        return nil
    }

    private func setupNodeStyleOverride(
        _ setupNode: HudCanvasSetupNode
    ) throws -> HudCanvasTerminalStyleOverride? {
        var override = setupNode.style ?? .empty
        if let terminalTheme = setupNode.terminalTheme ?? setupNode.terminalThemeID {
            override.terminalThemeID = try controlEnumValue(
                terminalTheme,
                field: "terminalTheme",
                cases: HudCanvasTerminalThemeID.allCases,
                label: \.label
            )
        }
        if let terminalFontFamily = setupNode.terminalFontFamily {
            override.terminalFontFamily = terminalFontFamily
        }
        if let terminalFontSize = setupNode.terminalFontSize {
            override.terminalFontSize = clamp(terminalFontSize, lower: 8, upper: 28)
        }
        return override.isEmpty ? nil : override
    }

    private func applyStyleCommand(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let scope = try resolvedStyleScope(for: command)
            switch scope {
            case "workspace":
                let previous = styleProfile
                styleProfile = try workspaceStyleProfile(applying: command, to: styleProfile)
                if previous != styleProfile {
                    schedulePersistStateIfConfigured()
                }
                return controlResponse(
                    command,
                    ok: true,
                    message: previous == styleProfile ? "workspace style unchanged" : "workspace style updated",
                    style: controlStyleSummary(includeTerminalOverrides: true)
                )

            case "tag":
                try rejectWorkspaceOnlyStyleFields(command, scope: scope)
                let tag = try controlTag(from: command.tag)
                let previous = tagStyleOverrides[tag] ?? .empty
                let updated = try terminalStyleOverride(applying: command, to: previous)
                if updated.isEmpty {
                    tagStyleOverrides[tag] = nil
                } else {
                    tagStyleOverrides[tag] = updated
                }
                if previous != updated {
                    schedulePersistStateIfConfigured()
                }
                return controlResponse(
                    command,
                    ok: true,
                    message: previous == updated
                        ? "\(tag.label) tag style unchanged"
                        : "\(tag.label) tag style updated",
                    style: controlStyleSummary(includeTerminalOverrides: true)
                )

            case "terminal":
                try rejectWorkspaceOnlyStyleFields(command, scope: scope)
                let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
                var changedCount = 0
                for node in resolved {
                    let previous = node.styleOverride ?? .empty
                    let updated = try terminalStyleOverride(applying: command, to: previous)
                    node.styleOverride = updated.isEmpty ? nil : updated
                    if previous != updated {
                        changedCount += 1
                    }
                }
                if changedCount > 0 {
                    schedulePersistStateIfConfigured()
                }
                return controlResponse(
                    command,
                    ok: true,
                    message: changedCount == 0
                        ? "terminal style unchanged"
                        : "updated \(changedCount) terminal style\(changedCount == 1 ? "" : "s")",
                    nodesOverride: resolved,
                    style: controlStyleSummary(includeTerminalOverrides: true)
                )

            default:
                throw HudCanvasControlStyleError.invalidScope(scope)
            }
        } catch let error as HudCanvasControlStyleError {
            return controlResponse(
                command,
                ok: false,
                message: error.localizedDescription,
                errorCode: error.errorCode,
                style: controlStyleSummary(includeTerminalOverrides: true)
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func tmuxHealthStatus(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let subjects = try tmuxHealthSubjects(from: command)
            let health = subjects.map {
                tmuxHealth(
                    for: $0,
                    probeRemote: command.probeRemote ?? false,
                    timeoutSeconds: remoteHealthTimeoutSeconds(from: command)
                )
            }
            return controlResponse(
                command,
                ok: true,
                message: health.isEmpty
                    ? "no tmux nodes"
                    : "checked \(health.count) tmux target\(health.count == 1 ? "" : "s")",
                tmuxHealth: health
            )
        } catch {
            return controlNodeErrorResponse(command, error)
        }
    }

    private func remoteHealthTimeoutSeconds(from command: HudCanvasControlCommand) -> Double {
        let timeoutMS = command.timeoutMS ?? 3_000
        return clamp(timeoutMS / 1_000, lower: 0.5, upper: 30)
    }

    private func closeNodes(
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
        do {
            let resolved = try resolveNodes(from: command, allowSelectionFallback: true)
            let ids = Set(resolved.map(\.id))
            for node in nodes where ids.contains(node.id) {
                node.stop()
            }
            nodes.removeAll { ids.contains($0.id) }
            selectedIDs.subtract(ids)
            synchronizeDocumentWatchers()
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

    private func resolvedStyleScope(for command: HudCanvasControlCommand) throws -> String {
        if let explicit = command.styleScope?.trimmingCharacters(in: .whitespacesAndNewlines),
           !explicit.isEmpty {
            switch explicit.lowercased() {
            case "workspace", "surface", "global":
                return "workspace"
            case "tag", "group":
                return "tag"
            case "terminal", "term", "node", "nodes", "selection", "selected":
                return "terminal"
            default:
                throw HudCanvasControlStyleError.invalidScope(explicit)
            }
        }

        if command.tag?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            return "tag"
        }
        if !nodeSelectors(from: command).isEmpty {
            return "terminal"
        }
        return "workspace"
    }

    private func workspaceStyleProfile(
        applying command: HudCanvasControlCommand,
        to profile: HudCanvasStyleProfile
    ) throws -> HudCanvasStyleProfile {
        var resolved = command.reset == true ? .adaptive : profile

        if let presetID = trimmed(command.stylePreset) {
            guard let preset = HudCanvasStyleProfile.presets.first(where: { controlToken($0.id) == controlToken(presetID) }) else {
                throw HudCanvasControlStyleError.invalidPreset(presetID)
            }
            resolved = preset
        }
        if let chromeStyle = trimmed(command.chromeStyle) {
            resolved.chromeStyle = try controlEnumValue(
                chromeStyle,
                field: "chromeStyle",
                cases: HudCanvasChromeStyle.allCases,
                label: \.label
            )
        }
        if let terminalTheme = trimmed(command.terminalTheme ?? command.terminalThemeID) {
            resolved.terminalThemeID = try controlEnumValue(
                terminalTheme,
                field: "terminalTheme",
                cases: HudCanvasTerminalThemeID.allCases,
                label: \.label
            )
        }
        if let terminalFontFamily = trimmed(command.terminalFontFamily) {
            resolved.terminalFontFamily = terminalFontFamily
        }
        if let terminalFontSize = command.terminalFontSize {
            resolved.terminalFontSize = clamp(terminalFontSize, lower: 8, upper: 28)
        }
        if let canvasGridMode = trimmed(command.canvasGridMode) {
            resolved.canvasGridMode = try controlEnumValue(
                canvasGridMode,
                field: "canvasGridMode",
                cases: HudCanvasGridMode.allCases,
                label: \.label
            )
        }
        if let canvasGridStep = command.canvasGridStep {
            resolved.canvasGridStep = clamp(canvasGridStep, lower: 4, upper: 160)
        }
        if let canvasMinorOpacity = command.canvasMinorOpacity {
            resolved.canvasMinorOpacity = clamp(canvasMinorOpacity, lower: 0, upper: 1)
        }
        if let canvasMajorOpacity = command.canvasMajorOpacity {
            resolved.canvasMajorOpacity = clamp(canvasMajorOpacity, lower: 0, upper: 1)
        }
        if let focusPadding = command.focusPadding {
            resolved.focusPadding = clamp(focusPadding, lower: 0, upper: 160)
        }

        return resolved
    }

    private func terminalStyleOverride(
        applying command: HudCanvasControlCommand,
        to override: HudCanvasTerminalStyleOverride
    ) throws -> HudCanvasTerminalStyleOverride {
        var resolved = command.reset == true ? .empty : override

        if let presetID = trimmed(command.stylePreset) {
            guard let preset = HudCanvasStyleProfile.presets.first(where: { controlToken($0.id) == controlToken(presetID) }) else {
                throw HudCanvasControlStyleError.invalidPreset(presetID)
            }
            resolved.terminalThemeID = preset.terminalThemeID
            resolved.terminalFontFamily = preset.terminalFontFamily
            resolved.terminalFontSize = preset.terminalFontSize
        }
        if let terminalTheme = trimmed(command.terminalTheme ?? command.terminalThemeID) {
            resolved.terminalThemeID = try controlEnumValue(
                terminalTheme,
                field: "terminalTheme",
                cases: HudCanvasTerminalThemeID.allCases,
                label: \.label
            )
        }
        if let terminalFontFamily = trimmed(command.terminalFontFamily) {
            resolved.terminalFontFamily = terminalFontFamily
        }
        if let terminalFontSize = command.terminalFontSize {
            resolved.terminalFontSize = clamp(terminalFontSize, lower: 8, upper: 28)
        }

        return resolved
    }

    private func rejectWorkspaceOnlyStyleFields(
        _ command: HudCanvasControlCommand,
        scope: String
    ) throws {
        if command.chromeStyle != nil {
            throw HudCanvasControlStyleError.unsupportedField(scope: scope, field: "chromeStyle")
        }
        if command.canvasGridMode != nil {
            throw HudCanvasControlStyleError.unsupportedField(scope: scope, field: "canvasGridMode")
        }
        if command.canvasGridStep != nil {
            throw HudCanvasControlStyleError.unsupportedField(scope: scope, field: "canvasGridStep")
        }
        if command.canvasMinorOpacity != nil {
            throw HudCanvasControlStyleError.unsupportedField(scope: scope, field: "canvasMinorOpacity")
        }
        if command.canvasMajorOpacity != nil {
            throw HudCanvasControlStyleError.unsupportedField(scope: scope, field: "canvasMajorOpacity")
        }
        if command.focusPadding != nil {
            throw HudCanvasControlStyleError.unsupportedField(scope: scope, field: "focusPadding")
        }
    }

    private func controlTag(from value: String?) throws -> CanvasTag {
        guard let value = trimmed(value) else {
            throw HudCanvasControlStyleError.missingTag
        }
        guard let tag = CanvasTag.allCases.first(where: { controlToken($0.rawValue) == controlToken(value) || controlToken($0.label) == controlToken(value) }) else {
            throw HudCanvasControlStyleError.invalidValue(field: "tag", value: value)
        }
        return tag
    }

    private func controlEnumValue<T: RawRepresentable>(
        _ value: String,
        field: String,
        cases: [T],
        label: (T) -> String
    ) throws -> T where T.RawValue == String {
        let token = controlToken(value)
        guard let match = cases.first(where: { controlToken($0.rawValue) == token || controlToken(label($0)) == token }) else {
            throw HudCanvasControlStyleError.invalidValue(field: field, value: value)
        }
        return match
    }

    private func controlToken(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()
            .replacingOccurrences(of: #"[^a-z0-9]+"#, with: "", options: .regularExpression)
    }

    private func trimmed(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func tmuxHealthSubjects(from command: HudCanvasControlCommand) throws -> [TmuxHealthSubject] {
        if !nodeSelectors(from: command).isEmpty {
            do {
                return try resolveNodes(from: command, allowSelectionFallback: false).compactMap(tmuxHealthSubject)
            } catch {
                if command.nodeID != nil || command.nodeIDs?.isEmpty == false {
                    throw error
                }
                return try tmuxReattachSpecs(from: command).map {
                    TmuxHealthSubject(nodeID: nil, target: $0.target, path: $0.path, remoteHost: $0.remoteHost)
                }
            }
        }
        if command.sessions?.isEmpty == false || command.targets?.isEmpty == false || command.ids?.isEmpty == false {
            return try tmuxReattachSpecs(from: command).map {
                TmuxHealthSubject(nodeID: nil, target: $0.target, path: $0.path, remoteHost: $0.remoteHost)
            }
        }
        return nodes.compactMap(tmuxHealthSubject)
    }

    private func tmuxHealthSubject(for node: TerminalNode) -> TmuxHealthSubject? {
        guard case .tmux(let target, let path, let remoteHost) = node.runtimeIdentity else { return nil }
        return TmuxHealthSubject(
            nodeID: node.id,
            target: target,
            path: path,
            remoteHost: remoteHost
        )
    }

    private func tmuxHealth(
        for subject: TmuxHealthSubject,
        probeRemote: Bool = false,
        timeoutSeconds: Double = 3
    ) -> HudCanvasTmuxHealth {
        let parts = tmuxTargetParts(subject.target)

        if let remoteHost = subject.remoteHost {
            guard probeRemote else {
                return HudCanvasTmuxHealth(
                    nodeID: subject.nodeID,
                    target: subject.target,
                    graphitePath: subject.path?.description,
                    remoteHost: remoteHost,
                    status: "remote-unverified",
                    session: parts.session,
                    window: parts.window,
                    message: "remote tmux probe skipped"
                )
            }

            let result = TmuxRemoteHealthProbe().check(
                remoteHost: remoteHost,
                target: subject.target,
                timeoutSeconds: timeoutSeconds
            )
            return HudCanvasTmuxHealth(
                nodeID: subject.nodeID,
                target: subject.target,
                graphitePath: subject.path?.description,
                remoteHost: remoteHost,
                status: result.status,
                session: result.session ?? parts.session,
                window: result.window ?? parts.window,
                activeWindow: result.activeWindow,
                attachedClients: result.attachedClients,
                paneCount: result.paneCount,
                message: result.message
            )
        }

        guard TerminalNode.localTmuxURL != nil else {
            return HudCanvasTmuxHealth(
                nodeID: subject.nodeID,
                target: subject.target,
                graphitePath: subject.path?.description,
                status: "tmux-missing",
                session: parts.session,
                window: parts.window,
                message: "tmux executable not found locally"
            )
        }

        guard TerminalNode.localTmuxTargetExists(subject.target) else {
            return HudCanvasTmuxHealth(
                nodeID: subject.nodeID,
                target: subject.target,
                graphitePath: subject.path?.description,
                status: "session-missing",
                session: parts.session,
                window: parts.window,
                message: "tmux target not found"
            )
        }

        let activeWindow = try? runTmuxHarnessCommand([
            "display-message",
            "-t",
            subject.target,
            "-p",
            "#{window_name}",
        ]).trimmingCharacters(in: .whitespacesAndNewlines)
        let attachedClients = (try? runTmuxHarnessCommand([
            "display-message",
            "-t",
            subject.target,
            "-p",
            "#{session_attached}",
        ]).trimmingCharacters(in: .whitespacesAndNewlines)).flatMap(Int.init)
        let paneCount = try? runTmuxHarnessCommand([
            "list-panes",
            "-t",
            subject.target,
            "-F",
            "#{pane_id}",
        ]).split(separator: "\n", omittingEmptySubsequences: true).count

        return HudCanvasTmuxHealth(
            nodeID: subject.nodeID,
            target: subject.target,
            graphitePath: subject.path?.description,
            status: "ready",
            session: parts.session,
            window: parts.window,
            activeWindow: activeWindow,
            attachedClients: attachedClients,
            paneCount: paneCount,
            message: "tmux target is available"
        )
    }

    private func tmuxTargetParts(_ target: String) -> (session: String, window: String?) {
        let paneTrimmed = target.split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? target
        let parts = paneTrimmed.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        if parts.count == 2 {
            return (String(parts[0]), String(parts[1]))
        }
        return (paneTrimmed, nil)
    }

    private func controlNodeErrorResponse(
        _ command: HudCanvasControlCommand,
        _ error: Error
    ) -> HudCanvasControlResponse {
        let nodeError = error as? HudCanvasControlNodeError
        return controlResponse(
            command,
            ok: false,
            message: error.localizedDescription,
            errorCode: nodeError?.errorCode ?? "node_error"
        )
    }

    private func resolveNodes(
        from command: HudCanvasControlCommand,
        allowSelectionFallback: Bool
    ) throws -> [TerminalNode] {
        let selectors = nodeSelectors(from: command)
        if selectors.isEmpty {
            if allowSelectionFallback {
                let selected = nodes.filter { selectedIDs.contains($0.id) }
                guard !selected.isEmpty else {
                    throw HudCanvasControlNodeError.emptySelection
                }
                return selected
            }
            throw HudCanvasControlNodeError.missingSelector
        }

        var resolved: [TerminalNode] = []
        var seen: Set<UUID> = []
        for selector in selectors {
            let matches = nodes(matching: selector)
            guard !matches.isEmpty else {
                throw HudCanvasControlNodeError.notFound(selector)
            }
            guard matches.count == 1 else {
                throw HudCanvasControlNodeError.ambiguous(selector)
            }
            let node = matches[0]
            if !seen.contains(node.id) {
                resolved.append(node)
                seen.insert(node.id)
            }
        }
        return resolved
    }

    private func nodeSelectors(from command: HudCanvasControlCommand) -> [String] {
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
            if node.externalID?.lowercased() == normalized {
                return true
            }
            switch node.runtimeIdentity {
            case .localPTY:
                return false
            case .tmux(let target, let path, let remoteHost):
                return target.lowercased() == normalized
                    || path?.description.lowercased() == normalized
                    || remoteHost.map { "\($0):\(target)".lowercased() == normalized } == true
            case .document(let artifact):
                return artifact.path?.lowercased() == normalized
                    || artifact.role?.lowercased() == normalized
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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
        _ command: HudCanvasControlCommand
    ) -> HudCanvasControlResponse {
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

            let shouldReset = command.reset ?? true
            if snapshot.nodes.isEmpty {
                if shouldReset {
                    resetTerminals()
                }
                canvasState = canvasState.replaying(
                    panX: CGFloat(snapshot.viewport.panX),
                    panY: CGFloat(snapshot.viewport.panY),
                    scale: CGFloat(snapshot.viewport.scale)
                )
                applyLayoutSnapshot(snapshot.layout)
                return controlResponse(
                    command,
                    ok: true,
                    message: "restored layout"
                )
            }

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
            synchronizeDocumentWatchers()

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
        let span = hudCanvasPerfTrace.beginSpan("state.persist")
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

    private func workspaceSnapshot(workspaceID: String) -> HudCanvasWorkspaceSnapshot {
        let durableNodes = nodes.compactMap(durableSnapshot)
        let durableIDs = Set(durableNodes.map(\.id))
        let focusedDurableID = focusedNodeID.flatMap { id in
            durableIDs.contains(id) ? id : nil
        }

        return HudCanvasWorkspaceSnapshot(
            workspaceID: GraphitePath.slugify(workspaceID, fallback: configuration.workspaceID),
            surfaceTitle: configuration.surfaceTitle,
            viewport: HudCanvasViewportSnapshot(
                panX: Double(canvasState.pan.width),
                panY: Double(canvasState.pan.height),
                scale: Double(canvasState.scale)
            ),
            layout: HudCanvasSurfaceLayoutSnapshot(
                canvasTool: canvasTool.rawValue,
                navigationFilter: navigationFilter.rawValue,
                navigationTagFilter: navigationTagFilter?.rawValue,
                navigationCollapsed: navigationCollapsed,
                navigationWidth: Double(navigationWidth),
                minimapCollapsed: minimapCollapsed,
                inspectorCollapsed: inspectorCollapsed,
                inspectorWidth: Double(inspectorWidth),
                style: styleProfile,
                tagStyles: tagStyleSnapshot()
            ),
            nodes: durableNodes,
            selectedNodeIDs: selectedIDs.filter { durableIDs.contains($0) },
            focusedNodeID: focusedDurableID,
            groups: workspaceGroups(from: durableNodes)
        )
    }

    private func workspaceGroups(
        from durableNodes: [HudCanvasNodeSnapshot]
    ) -> [HudCanvasWorkspaceGroupSnapshot] {
        let grouped = Dictionary(grouping: durableNodes) { node in
            node.tag
        }
        return grouped.compactMap { tag, nodes in
            guard let tag else { return nil }
            let label = CanvasTag(rawValue: tag)?.label ?? tag
            return HudCanvasWorkspaceGroupSnapshot(
                id: "tag.\(tag)",
                name: label,
                nodeIDs: nodes.map(\.id).sorted { $0.uuidString < $1.uuidString },
                tags: [tag]
            )
        }
        .sorted { $0.id < $1.id }
    }

    private func applyLayoutSnapshot(_ layout: HudCanvasSurfaceLayoutSnapshot?) {
        guard let layout else { return }

        if let restoredTool = CanvasTool(rawValue: layout.canvasTool) {
            canvasTool = restoredTool
        }

        if let restoredFilter = CanvasNavigationFilter(rawValue: layout.navigationFilter) {
            navigationFilter = restoredFilter
        }
        navigationTagFilter = layout.navigationTagFilter.flatMap(CanvasTag.init(rawValue:))

        navigationCollapsed = layout.navigationCollapsed
        if let restoredMinimapCollapsed = layout.minimapCollapsed {
            minimapCollapsed = restoredMinimapCollapsed
        }
        inspectorCollapsed = layout.inspectorCollapsed
        navigationWidth = clamped(CGFloat(layout.navigationWidth), to: 210...360)
        inspectorWidth = clamped(CGFloat(layout.inspectorWidth), to: 250...440)
        if let style = layout.style {
            styleProfile = style
        }
        tagStyleOverrides = restoredTagStyles(from: layout)
    }

    private func tagStyleSnapshot() -> [String: HudCanvasTerminalStyleOverride]? {
        let snapshot = Dictionary(
            uniqueKeysWithValues: tagStyleOverrides.compactMap { tag, override in
                override.isEmpty ? nil : (tag.rawValue, override)
            }
        )
        return snapshot.isEmpty ? nil : snapshot
    }

    private func restoredTagStyles(
        from layout: HudCanvasSurfaceLayoutSnapshot
    ) -> [CanvasTag: HudCanvasTerminalStyleOverride] {
        (layout.tagStyles ?? [:]).reduce(into: [:]) { restored, entry in
            guard let tag = CanvasTag(rawValue: entry.key), !entry.value.isEmpty else { return }
            restored[tag] = entry.value
        }
    }

    private func clamped(_ value: CGFloat, to range: ClosedRange<CGFloat>) -> CGFloat {
        min(max(value, range.lowerBound), range.upperBound)
    }

    private func durableSnapshot(for node: TerminalNode) -> HudCanvasNodeSnapshot? {
        let runtime: HudCanvasRuntimeReference
        switch node.runtimeIdentity {
        case .localPTY:
            return nil
        case .tmux(let target, let path, let remoteHost):
            runtime = HudCanvasRuntimeReference(
                kind: "tmux",
                target: target,
                graphitePath: path?.description,
                remoteHost: remoteHost
            )
        case .document(let artifact):
            runtime = HudCanvasRuntimeReference(
                kind: artifact.kind.runtimeKind,
                path: artifact.path,
                language: artifact.language,
                content: artifact.contentSource == .inline ? artifact.content : nil,
                role: artifact.role
            )
        }

        return HudCanvasNodeSnapshot(
            id: node.id,
            externalID: node.externalID,
            title: node.title,
            subtitle: node.subtitle,
            tint: node.tint.rawValue,
            x: Double(node.origin.x),
            y: Double(node.origin.y),
            width: Double(node.size.width),
            height: Double(node.size.height),
            zIndex: node.zIndex,
            tag: node.tag?.rawValue,
            style: node.styleOverride?.isEmpty == true ? nil : node.styleOverride,
            runtime: runtime
        )
    }

    private func controlNodeSummary(for node: TerminalNode) -> HudCanvasControlNode {
        switch node.runtimeIdentity {
        case .localPTY:
            return HudCanvasControlNode(
                id: node.id,
                externalID: node.externalID,
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
            return HudCanvasControlNode(
                id: node.id,
                externalID: node.externalID,
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
        case .document(let artifact):
            return HudCanvasControlNode(
                id: node.id,
                externalID: node.externalID,
                title: node.title,
                subtitle: node.subtitle,
                runtimeKind: artifact.kind.runtimeKind,
                path: artifact.path,
                language: artifact.language,
                role: artifact.role,
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
        from snapshot: HudCanvasNodeSnapshot,
        createIfMissing: Bool
    ) throws -> TerminalNode? {
        let runtimeKind = snapshot.runtime.kind
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if isDocumentRuntimeKind(runtimeKind) {
            let kind = CanvasDocumentKind(runtimeKind: runtimeKind)
            let path = normalizedDocumentPath(snapshot.runtime.path)
            let artifact = documentArtifact(
                kind: kind,
                path: path,
                language: snapshot.runtime.language ?? inferredLanguage(from: path),
                inlineContent: snapshot.runtime.content,
                role: snapshot.runtime.role
            )
            return TerminalNode(
                id: snapshot.id,
                externalID: snapshot.externalID,
                index: nextIndex,
                origin: CGPoint(x: snapshot.x, y: snapshot.y),
                size: CGSize(
                    width: max(300.0, CGFloat(snapshot.width)),
                    height: max(200.0, CGFloat(snapshot.height))
                ),
                tint: HudTint.from(token: snapshot.tint),
                zIndex: snapshot.zIndex,
                title: snapshot.title,
                subtitle: normalizedLegacyDocumentPathReferences(in: snapshot.subtitle),
                runtimeIdentity: .document(artifact),
                tag: snapshot.tag.flatMap(CanvasTag.init(rawValue:)),
                styleOverride: snapshot.style
            )
        }

        guard runtimeKind == "tmux" else { return nil }
        guard let targetValue = snapshot.runtime.target else {
            throw HudCanvasStateError.missingRuntimeTarget(snapshot.id)
        }

        let target = try TmuxTarget.validatedTarget(targetValue)
        let remoteHost = try validatedRemoteHost(snapshot.runtime.remoteHost)
        let path = try snapshot.runtime.graphitePath.map(GraphitePath.init(parse:))

        if remoteHost == nil, TerminalNode.localTmuxURL == nil {
            throw HudCanvasStateError.tmuxMissing
        }

        if remoteHost == nil,
           !TerminalNode.canCreateTmuxTarget(target, createIfMissing: createIfMissing),
           !TerminalNode.localTmuxTargetExists(target) {
            throw HudCanvasStateError.missingTmuxTarget(target)
        }

        let size = CGSize(
            width: max(300.0, CGFloat(snapshot.width)),
            height: max(200.0, CGFloat(snapshot.height))
        )

        return TerminalNode(
            id: snapshot.id,
            externalID: snapshot.externalID,
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
            tag: snapshot.tag.flatMap(CanvasTag.init(rawValue:)),
            styleOverride: snapshot.style
        )
    }

    private func writeWorkspaceSnapshot(
        _ snapshot: HudCanvasWorkspaceSnapshot,
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

    private func readWorkspaceSnapshot(from url: URL) throws -> HudCanvasWorkspaceSnapshot {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw HudCanvasStateError.stateFileMissing(url.path)
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(HudCanvasWorkspaceSnapshot.self, from: data)
    }

    private func stateURL(for command: HudCanvasControlCommand) -> URL {
        if let statePath = command.statePath?.trimmingCharacters(in: .whitespacesAndNewlines),
           !statePath.isEmpty {
            return URL(fileURLWithPath: statePath)
        }
        return configuredStateURL()
    }

    private func configuredStateURL() -> URL {
        let environment = ProcessInfo.processInfo.environment
        if let statePath = environment["HUDSON_CANVAS_STATE_FILE"]
            ?? environment["TERMINI_CANVAS_STATE_FILE"],
            !statePath.isEmpty {
            return URL(fileURLWithPath: statePath)
        }
        return configuration.stateURL
    }

    private func selectNode(_ id: UUID) {
        selectedIDs = HudCanvasSelectionState(ids: selectedIDs)
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
        navigationRailSelection = .terminal
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
        navigationRailSelection = .canvas
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
            : "\(nodesToPopOut.count) nodes"
        let terminalAppearances = Dictionary(
            uniqueKeysWithValues: nodesToPopOut.map { node in
                (node.id, terminalAppearance(for: node))
            }
        )
        let rootView = TerminalPopOutWindow(
            title: title,
            nodes: nodesToPopOut,
            terminalAppearances: terminalAppearances,
            fallbackTerminalAppearance: terminalAppearance,
            documentBaseURL: configuration.workingDirectoryURL
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
        let delegate = CanvasPopOutWindowDelegate {
            popOutWindows[windowID] = nil
            popOutDelegates[windowID] = nil
        }
        window.title = "Canvas · \(title)"
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

    private func layoutNodesByTag() {
        guard !nodes.isEmpty else { return }

        let visibleOrigin = canvasState.worldPoint(
            fromViewportPoint: CGPoint(x: HudSpacing.huge, y: HudSpacing.huge)
        )
        let groups = tagLayoutGroups()
        var x = visibleOrigin.x
        let y = visibleOrigin.y
        let columnGap: CGFloat = 72
        let rowGap: CGFloat = 48

        for group in groups {
            var columnY = y
            let columnWidth = max(420, group.nodes.map(\.size.width).max() ?? 420)
            for node in group.nodes {
                node.origin = CGPoint(x: x, y: columnY)
                node.zIndex = nextZIndex
                nextZIndex += 1
                columnY += node.size.height + rowGap
            }
            x += columnWidth + columnGap
        }

        if let rect = boundingRect(for: nodes) {
            canvasState = canvasState.fitting(rect)
        }
        controlStatus = navigationTagFilter.map { "Grouped \($0.label)" } ?? "Grouped by tag"
        schedulePersistStateIfConfigured()
    }

    private func tagLayoutGroups() -> [(tag: CanvasTag?, nodes: [TerminalNode])] {
        var orderedTags: [CanvasTag?] = []
        if let navigationTagFilter {
            orderedTags.append(navigationTagFilter)
        }
        orderedTags.append(contentsOf: CanvasTag.allCases.map(Optional.some))
        orderedTags.append(nil)

        var seen: Set<String> = []
        return orderedTags.compactMap { tag in
            let key = tag?.rawValue ?? "__untagged"
            guard seen.insert(key).inserted else { return nil }
            let groupedNodes = nodes
                .filter { $0.tag == tag }
                .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            guard !groupedNodes.isEmpty else { return nil }
            return (tag, groupedNodes)
        }
    }

    private func spotlight(_ kind: CanvasSpotlightKind) {
        let scopedNodes = navigationTagFilter.map { tag in
            nodes.filter { $0.tag == tag }
        } ?? nodes
        let matches = scopedNodes.filter { node in
            switch kind {
            case .agents:
                return node.isTerminal
            case .code:
                return node.documentArtifact?.kind == .file
            case .plans:
                return node.documentArtifact?.kind == .plan
            case .diffs:
                return node.documentArtifact?.kind == .diff
            }
        }

        guard !matches.isEmpty else {
            controlStatus = "No \(kind.label)"
            return
        }

        selectedIDs = Set(matches.map(\.id))
        navigationFilter = .selected
        if let rect = boundingRect(for: matches) {
            canvasState = canvasState.fitting(rect)
        }
        controlStatus = "Spotlight \(kind.label)"
        schedulePersistStateIfConfigured()
    }

    private func setTerminalStyleOverride(
        _ id: UUID,
        override: HudCanvasTerminalStyleOverride?
    ) {
        guard let node = nodes.first(where: { $0.id == id }) else { return }
        node.styleOverride = override?.isEmpty == true ? nil : override
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
        cancelDocumentWatchers()
        nodes.forEach { $0.stop() }
        nodes.removeAll(keepingCapacity: true)
        selectedIDs.removeAll()
        resetCanvasViewport()
    }

    private func controlResponse(
        _ command: HudCanvasControlCommand,
        ok: Bool,
        message: String,
        errorCode: String? = nil,
        requiresPermission: Bool? = nil,
        nodesOverride: [TerminalNode]? = nil,
        style: HudCanvasControlStyle? = nil,
        tmuxHealth: [HudCanvasTmuxHealth]? = nil,
        setup: HudCanvasSetupReport? = nil
    ) -> HudCanvasControlResponse {
        let responseNodes = nodesOverride ?? nodes
        return HudCanvasControlResponse(
            apiVersion: command.resolvedAPIVersion,
            id: command.id,
            action: command.normalizedAction,
            ok: ok,
            message: message,
            errorCode: errorCode,
            workspaceID: activeWorkspaceID ?? command.workspaceID ?? configuration.workspaceID,
            handoffId: activeHandoffID,
            nodeCount: nodes.count,
            nodes: command.includeNodes == false ? nil : responseNodes.map(controlNodeSummary),
            selectedNodeIDs: selectedIDs.sorted { $0.uuidString < $1.uuidString },
            focusedNodeID: focusedNodeID,
            viewport: command.includeViewport == false ? nil : controlViewport(),
            metrics: command.includeMetrics == false ? nil : controlMetrics(),
            style: style ?? (command.includeStyle == true ? controlStyleSummary(includeTerminalOverrides: true) : nil),
            tmuxHealth: tmuxHealth,
            setup: setup,
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

    private func controlStyleSummary(includeTerminalOverrides: Bool) -> HudCanvasControlStyle {
        let terminalOverrides: [String: HudCanvasTerminalStyleOverride]?
        if includeTerminalOverrides {
            let values = Dictionary(
                uniqueKeysWithValues: nodes.compactMap { node -> (String, HudCanvasTerminalStyleOverride)? in
                    guard let override = node.styleOverride, !override.isEmpty else { return nil }
                    return (node.id.uuidString, override)
                }
            )
            terminalOverrides = values.isEmpty ? nil : values
        } else {
            terminalOverrides = nil
        }

        return HudCanvasControlStyle(
            workspace: styleProfile,
            tagOverrides: tagStyleSnapshot(),
            terminalOverrides: terminalOverrides
        )
    }

    private func controlViewport() -> HudCanvasControlViewport {
        let worldRect = canvasState.visibleWorldRect
        return HudCanvasControlViewport(
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

    private func controlMetrics() -> HudCanvasControlMetrics {
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
        let documentNodes = nodes.compactMap(\.documentArtifact)
        let diffNodes = documentNodes.filter { $0.kind == .diff }
        let truncatedDocumentCount = documentNodes.filter(\.truncated).count

        perfTracker.set("surface.nodeCount", to: nodes.count)
        perfTracker.set("surface.selectedCount", to: selectedIDs.count)
        perfTracker.set("surface.localPTYCount", to: localPTYCount)
        perfTracker.set("surface.tmuxCount", to: tmuxNodes.count)
        perfTracker.set("surface.remoteTmuxCount", to: remoteTmuxCount)
        perfTracker.set("surface.liveSurfaceCount", to: liveSurfaceCount)
        perfTracker.set("surface.virtualizedSurfaceCount", to: virtualizedSurfaceCount)
        perfTracker.set("surface.documentCount", to: documentNodes.count)
        perfTracker.set("surface.diffCount", to: diffNodes.count)
        perfTracker.set("surface.truncatedDocumentCount", to: truncatedDocumentCount)
        perfTracker.set("surface.focusModeActive", to: isTerminalFocusActive ? 1 : 0)
        perfTracker.set("surface.popOutWindowCount", to: popOutWindows.count)

        return HudCanvasControlMetrics(
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

    private func clamp(_ value: Double, lower: Double, upper: Double) -> Double {
        min(max(value, lower), upper)
    }

    private func pointerSelectionMode() -> HudCanvasSelectionMode {
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
    let workspaceStyleProfile: HudCanvasStyleProfile
    let tagStyleOverrides: [CanvasTag: HudCanvasTerminalStyleOverride]
    let activeColorScheme: ColorScheme
    let canvasPan: CGSize
    let canvasScale: CGFloat
    let screenSizeOverride: CGSize?
    let documentBaseURL: URL?
    let onSelect: () -> Void
    let onFocus: () -> Void
    let onPopOut: () -> Void
    let onAppearanceSettings: () -> Void
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
        if let screenSizeOverride {
            return screenSizeOverride
        }

        return CGSize(
            width: max(HudCanvasMetrics.nodeMinimumScreenSize, node.size.width * canvasScale),
            height: max(HudCanvasMetrics.nodeMinimumScreenSize, node.size.height * canvasScale)
        )
    }

    private var shouldRenderMarker: Bool {
        screenSize.width < 110 || screenSize.height < 74
    }

    private enum TitleBarMode: Equatable {
        case full
        case compact
        case minimal
    }

    private var titleBarMode: TitleBarMode {
        if screenSize.width < HudCanvasMetrics.terminalMinimalChromeWidth
            || screenSize.height < HudCanvasMetrics.terminalMinimalChromeHeight {
            return .minimal
        }
        if screenSize.width < HudCanvasMetrics.terminalCompactChromeWidth
            || screenSize.height < HudCanvasMetrics.terminalCompactChromeHeight {
            return .compact
        }
        return .full
    }

    private var titleBarSpacing: CGFloat {
        switch titleBarMode {
        case .full: HudSpacing.lg
        case .compact: HudSpacing.md
        case .minimal: HudSpacing.sm
        }
    }

    private var titleBarHorizontalPadding: CGFloat {
        switch titleBarMode {
        case .full: HudSpacing.xxl
        case .compact: HudSpacing.lg
        case .minimal: HudSpacing.md
        }
    }

    private var shouldShowSecondaryTitleChrome: Bool {
        titleBarMode == .full
            && screenSize.width >= HudCanvasMetrics.terminalSecondaryChromeWidth
            && screenSize.height >= HudCanvasMetrics.terminalSecondaryChromeHeight
    }

    private var shouldShowCompactFocusButton: Bool {
        titleBarMode == .compact
            && screenSize.width >= HudCanvasMetrics.terminalCompactChromeWidth - HudSpacing.xxxl
            && screenSize.height >= HudCanvasMetrics.terminalCompactChromeHeight
    }

    private var titleBarKindLabel: String {
        switch node.runtimeIdentity {
        case .localPTY:
            "PTY"
        case .tmux(_, _, let remoteHost):
            remoteHost == nil ? "TMUX" : "SSH"
        case .document(let artifact):
            artifact.kind.badge
        }
    }

    private var shouldShowKindBadge: Bool {
        titleBarMode == .compact
            && screenSize.width >= HudCanvasMetrics.terminalMinimalChromeWidth + HudSpacing.xxxl
    }

    private var terminalAppearance: HudTerminalAppearance {
        var resolved = workspaceStyleProfile
        if let tag = node.tag {
            resolved = resolved.applyingTerminalOverride(tagStyleOverrides[tag])
        }
        resolved = resolved.applyingTerminalOverride(node.styleOverride)
        return resolved.terminalAppearance(for: activeColorScheme)
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
        .contextMenu {
            Button(isFocused ? "Focused" : "Focus Node", action: onFocus)
                .disabled(isFocused)
            Button("Pop Out", action: onPopOut)
            Button("Appearance Settings", action: onAppearanceSettings)
            Divider()
            Button("Close", role: .destructive, action: onClose)
        }
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
                if rendersLiveSurface, let controller = node.controller {
                    TerminalSurfaceContainer(
                        controller: controller,
                        appearance: terminalAppearance
                    )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(terminalAppearance.backgroundColor)
                } else if node.documentArtifact != nil {
                    DocumentArtifactPreview(
                        node: node,
                        mode: isFocused ? .full : .canvas,
                        canvasDetail: documentCanvasDetail,
                        documentBaseURL: documentBaseURL
                    )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(theme.palette.bg)
                } else {
                    TerminalPreview(node: node)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(theme.palette.bg)
                }
            }
            .frame(width: screenSize.width, height: screenSize.height)
            .background(node.isTerminal ? terminalAppearance.backgroundColor : theme.palette.bg)
            .clipShape(RoundedRectangle(cornerRadius: theme.radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.card)
                    .stroke(isSelected ? HudSurface.tintFocus(node.tint.color) : theme.hairline.standard)
            )
            .shadow(
                color: theme.canvasShadow,
                radius: isSelected
                    ? HudCanvasMetrics.terminalCardSelectedShadowRadius
                    : HudCanvasMetrics.terminalCardShadowRadius,
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
        HStack(spacing: titleBarSpacing) {
            titleBarLeadingChrome
            Text(node.title)
                .font(HudFont.mono(titleBarMode == .minimal ? HudTextSize.xxs : HudTextSize.sm, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)

            if titleBarMode == .full {
                if shouldShowSecondaryTitleChrome {
                    Text(node.subtitle)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .truncationMode(.middle)
                }
                if let liveSource = node.liveSource {
                    HudLiveIndicator(source: liveSource, displayMode: .compact, chrome: .ghost)
                }
                titleBarFocusButton
            } else if titleBarMode == .compact {
                if let liveSource = node.liveSource {
                    HudLiveIndicator(source: liveSource, displayMode: .dot, chrome: .ghost)
                }
                if shouldShowCompactFocusButton {
                    titleBarFocusButton
                }
            } else if let liveSource = node.liveSource {
                HudLiveIndicator(source: liveSource, displayMode: .dot, chrome: .ghost)
            }
        }
        .padding(.horizontal, titleBarHorizontalPadding)
        .frame(height: HudCanvasMetrics.terminalTitleBarHeight)
        .background(theme.palette.chrome)
        .contentShape(Rectangle())
        .gesture(dragGesture)
    }

    private var documentCanvasDetail: DocumentArtifactCanvasDetail {
        if screenSize.width >= 640, screenSize.height >= 380 {
            return .preview
        }
        if screenSize.width >= 430, screenSize.height >= 250 {
            return .metrics
        }
        return .summary
    }

    @ViewBuilder
    private var titleBarLeadingChrome: some View {
        switch titleBarMode {
        case .full:
            fullTitleBarLights
            Image(systemName: node.symbolName)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
        case .compact:
            if shouldShowKindBadge {
                HudBadge(titleBarKindLabel, tint: theme.palette.statusInfo, dot: true)
            } else {
                sourceDot
                Image(systemName: node.symbolName)
                    .font(HudFont.ui(HudTextSize.xxs, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
            }
        case .minimal:
            sourceDot
            Image(systemName: node.symbolName)
                .font(HudFont.ui(HudTextSize.xxs, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
        }
    }

    private var fullTitleBarLights: some View {
        HStack(spacing: HudSpacing.sm) {
            closeLight
            Circle()
                .fill(theme.palette.dim.opacity(HudOpacity.ghost))
                .frame(
                    width: HudCanvasMetrics.terminalTrafficLightSize,
                    height: HudCanvasMetrics.terminalTrafficLightSize
                )
            Circle()
                .fill(theme.palette.muted.opacity(HudOpacity.subtle))
                .frame(
                    width: HudCanvasMetrics.terminalTrafficLightSize,
                    height: HudCanvasMetrics.terminalTrafficLightSize
                )
        }
    }

    private var sourceDot: some View {
        Circle()
            .fill(theme.palette.muted)
            .frame(
                width: HudCanvasMetrics.terminalTrafficLightSize,
                height: HudCanvasMetrics.terminalTrafficLightSize
            )
    }

    private var closeLight: some View {
        Circle()
            .fill(theme.palette.muted.opacity(HudOpacity.subtle))
            .frame(
                width: HudCanvasMetrics.terminalTrafficLightSize,
                height: HudCanvasMetrics.terminalTrafficLightSize
            )
            .onTapGesture {
                onClose()
            }
    }

    private var titleBarFocusButton: some View {
        CanvasIconButton(
            systemName: "rectangle.inset.filled",
            help: "Focus node",
            action: onFocus
        )
        .disabled(isFocused)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("canvas-canvas"))
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
                width: HudCanvasMetrics.resizeGripSize,
                height: HudCanvasMetrics.resizeGripSize
            )
            .contentShape(Rectangle())
            .help("Resize")
            .accessibilityLabel("Resize node")
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named("canvas-canvas"))
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
    let terminalAppearances: [UUID: HudTerminalAppearance]
    let fallbackTerminalAppearance: HudTerminalAppearance
    let documentBaseURL: URL?
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
            minWidth: HudCanvasMetrics.popOutMinimumWidth,
            minHeight: HudCanvasMetrics.popOutMinimumHeight
        )
        .background(theme.palette.bg)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: nodes.first?.tint.color ?? theme.palette.statusInfo)
            VStack(alignment: .leading, spacing: 1) {
                Text("Canvas Pop-out")
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
                .frame(maxWidth: HudCanvasMetrics.popOutTabStripMaxWidth)
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
            TerminalPopOutTerminal(
                node: node,
                terminalAppearance: terminalAppearance(for: node),
                documentBaseURL: documentBaseURL
            )
        } else if let focusedNode {
            TerminalPopOutTerminal(
                node: focusedNode,
                terminalAppearance: terminalAppearance(for: focusedNode),
                documentBaseURL: documentBaseURL
            )
        } else {
            GeometryReader { proxy in
                ScrollView {
                    LazyVGrid(
                        columns: gridColumns(for: proxy.size.width),
                        spacing: HudSpacing.lg
                    ) {
                        ForEach(nodes) { node in
                            TerminalPopOutCard(
                                node: node,
                                terminalAppearance: terminalAppearance(for: node),
                                documentBaseURL: documentBaseURL
                            ) {
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

    private func terminalAppearance(for node: TerminalNode) -> HudTerminalAppearance {
        terminalAppearances[node.id] ?? fallbackTerminalAppearance
    }
}

private struct TerminalPopOutTerminal: View {
    @ObservedObject var node: TerminalNode
    let terminalAppearance: HudTerminalAppearance
    let documentBaseURL: URL?
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            TerminalPopOutTitleBar(node: node)
            if let controller = node.controller {
                TerminalSurfaceContainer(
                    controller: controller,
                    appearance: terminalAppearance
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(terminalAppearance.backgroundColor)
            } else {
                DocumentArtifactPreview(
                    node: node,
                    mode: .full,
                    canvasDetail: .preview,
                    documentBaseURL: documentBaseURL
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(theme.palette.bg)
            }
        }
        .background(node.isTerminal ? terminalAppearance.backgroundColor : theme.palette.bg)
    }
}

private struct TerminalPopOutCard: View {
    @ObservedObject var node: TerminalNode
    let terminalAppearance: HudTerminalAppearance
    let documentBaseURL: URL?
    let onFocus: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            TerminalPopOutTitleBar(node: node, onFocus: onFocus)
            if let controller = node.controller {
                TerminalSurfaceContainer(
                    controller: controller,
                    appearance: terminalAppearance
                )
                    .frame(height: HudCanvasMetrics.popOutTerminalPreviewHeight)
                    .background(terminalAppearance.backgroundColor)
            } else {
                DocumentArtifactPreview(
                    node: node,
                    mode: .canvas,
                    canvasDetail: .metrics,
                    documentBaseURL: documentBaseURL
                )
                    .frame(height: HudCanvasMetrics.popOutTerminalPreviewHeight)
                    .background(theme.palette.bg)
            }
        }
        .background(node.isTerminal ? terminalAppearance.backgroundColor : theme.palette.bg)
        .clipShape(RoundedRectangle(cornerRadius: theme.radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .stroke(theme.hairline.standard)
        )
        .shadow(color: theme.canvasShadow, radius: HudSpacing.xl, x: 0, y: HudSpacing.md)
    }
}

private struct TerminalPopOutTitleBar: View {
    @ObservedObject var node: TerminalNode
    var onFocus: (() -> Void)?
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.lg) {
            HudStatusDot(color: theme.palette.muted, size: HudDotSize.small)
            Image(systemName: node.symbolName)
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
                    help: "Focus node in pop-out",
                    action: onFocus
                )
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudCanvasMetrics.terminalTitleBarHeight)
        .background(theme.palette.chrome)
    }
}

private final class CanvasPopOutWindowDelegate: NSObject, NSWindowDelegate {
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
        .padding(HudCanvasMetrics.resizeGripInset)
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
                HudCanvasMetrics.nodeMarkerMinimumWidth,
                min(HudCanvasMetrics.nodeMarkerMaximumWidth, screenSize.width)
            ),
            height: max(
                HudCanvasMetrics.nodeMarkerMinimumHeight,
                min(HudCanvasMetrics.nodeMarkerMaximumHeight, screenSize.height)
            )
        )
    }

    var body: some View {
        RoundedRectangle(cornerRadius: theme.radius.standard)
            .fill(isSelected ? HudSurface.selected(node.tint.color) : theme.canvasControlFill)
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: theme.radius.tight)
                    .fill(node.tint.color)
                    .frame(
                        width: max(
                            HudCanvasMetrics.nodeMarkerStripeWidth,
                            markerSize.width * HudCanvasMetrics.nodeMarkerStripeFraction
                        )
                    )
                    .padding(.vertical, HudCanvasMetrics.resizeGripInset)
                    .padding(.leading, HudCanvasMetrics.resizeGripInset)
            }
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? HudSurface.tintFocus(node.tint.color) : theme.hairline.standard)
            )
            .frame(width: markerSize.width, height: markerSize.height)
            .shadow(
                color: theme.canvasShadow,
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
                            with: .color(theme.palette.muted.opacity(alpha))
                        )
                    }
                }
            }
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                HudBadge(node.runtimeIdentity.badge, tint: theme.palette.statusInfo, dot: true)
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

private enum DocumentArtifactPreviewMode {
    case canvas
    case full
}

private enum DocumentArtifactCanvasDetail {
    case summary
    case metrics
    case preview
}

private struct DocumentArtifactPreview: View {
    @ObservedObject var node: TerminalNode
    let mode: DocumentArtifactPreviewMode
    let canvasDetail: DocumentArtifactCanvasDetail
    var documentBaseURL: URL?
    @Environment(\.hudTheme) private var theme

    private var artifact: CanvasDocumentArtifact? {
        node.documentArtifact
    }

    var body: some View {
        switch mode {
        case .canvas:
            lightweightCanvasPreview
                .background(theme.palette.bg)
        case .full:
            ZStack(alignment: .topLeading) {
                theme.palette.bg

                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    header

                    if let path = artifact?.path {
                        Text(path)
                            .font(HudFont.mono(9))
                            .foregroundStyle(theme.palette.dim)
                            .lineLimit(2)
                            .minimumScaleFactor(0.74)
                    }

                    fullPreview
                }
                .padding(HudSpacing.xl)
            }
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            HudBadge(artifact?.kind.badge ?? "DOC", tint: theme.palette.statusInfo, dot: true)
            if let language = artifact?.language {
                HudBadge(language.uppercased(), tint: theme.palette.statusInfo)
            }
            if let role = artifact?.role {
                HudBadge(role.uppercased(), tint: theme.palette.dim)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var lightweightCanvasPreview: some View {
        switch artifact?.kind {
        case .diff:
            DiffArtifactCanvasPreview(
                document: diffDocument,
                tint: theme.palette.statusInfo,
                byteCount: artifact?.byteCount ?? 0,
                readByteCount: artifact?.readByteCount ?? 0,
                isTruncated: artifact?.truncated == true,
                detail: canvasDetail
            )
        case .plan, .note:
            PlanArtifactCanvasPreview(text: previewText, tint: theme.palette.statusInfo)
        default:
            CodeArtifactCanvasPreview(
                text: previewText,
                detail: compactDetail,
                tint: theme.palette.statusInfo
            )
        }
    }

    @ViewBuilder
    private var fullPreview: some View {
        switch artifact?.kind {
        case .diff:
            DiffArtifactFullPreview(document: diffDocument, tint: theme.palette.statusInfo)
        case .plan, .note:
            PlanArtifactFullPreview(text: previewText, tint: theme.palette.statusInfo)
        default:
            CodeArtifactFullPreview(
                text: previewText,
                path: artifact?.path,
                language: artifact?.language,
                readOnly: artifact?.contentSource == .empty,
                tint: theme.palette.statusInfo,
                onChange: { _ in },
                onSave: saveNodeArtifactContent
            )
        }
    }

    private var compactDetail: String {
        if let path = artifact?.path?.split(separator: "/").last {
            return String(path)
        }
        if let role = artifact?.role {
            return role
        }
        return "manifest-defined artifact"
    }

    private var previewText: String {
        let text = artifact?.content.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !text.isEmpty {
            return text
        }
        return "No preview content."
    }

    private var diffDocument: HudDiffDocument {
        if let document = artifact?.diffDocument {
            return document
        }
        return HudUnifiedDiffParser.parse(
            previewText,
            title: node.title,
            language: artifact?.language ?? "diff"
        )
    }

    private func updateNodeArtifactContent(_ next: String) {
        guard var artifact else { return }
        artifact.content = next
        artifact.readByteCount = next.utf8.count
        artifact.byteCount = next.utf8.count
        artifact.truncated = false
        artifact.diffDocument = artifact.kind == .diff
            ? HudUnifiedDiffParser.parse(next, title: node.title, language: artifact.language ?? "diff")
            : nil
        node.runtimeIdentity = .document(artifact)
    }

    private func saveNodeArtifactContent(_ next: String) throws {
        guard let artifact else {
            throw CanvasArtifactSaveError.missingArtifact
        }

        if let path = artifact.path, !path.isEmpty {
            let url = documentURL(for: path)
            try next.write(to: url, atomically: true, encoding: .utf8)
        }

        updateNodeArtifactContent(next)
    }

    private func documentURL(for path: String) -> URL {
        if path.hasPrefix("/") {
            return URL(fileURLWithPath: path)
        }
        let base = documentBaseURL
            ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        return base.appendingPathComponent(path)
    }
}

private struct CodeArtifactCanvasPreview: View {
    let text: String
    let detail: String
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        ZStack(alignment: .topLeading) {
            previewBackground

            Canvas { context, size in
                let gutterWidth: CGFloat = 34
                let rowHeight: CGFloat = 14
                let rows = max(4, Int((size.height - HudSpacing.xxl) / rowHeight))
                let maxWidth = max(24, size.width - gutterWidth - HudSpacing.xxl)

                for row in 0..<rows {
                    let y = HudSpacing.lg + CGFloat(row) * rowHeight
                    let numberRect = CGRect(x: HudSpacing.md, y: y, width: 14, height: 1)
                    let codeRect = CGRect(
                        x: gutterWidth,
                        y: y,
                        width: maxWidth * lineWidthFactor(row),
                        height: 1.2
                    )
                    context.fill(
                        Path(roundedRect: numberRect, cornerRadius: 0.6),
                        with: .color(theme.palette.dim.opacity(HudOpacity.soft))
                    )
                    context.fill(
                        Path(roundedRect: codeRect, cornerRadius: 0.6),
                        with: .color(rowTint(row).opacity(lineOpacity(row)))
                    )
                }
            }
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                Text("CODE")
                    .font(HudFont.mono(10, weight: .bold))
                    .foregroundStyle(tint)
                Text(detail)
                    .font(HudFont.mono(10))
                    .foregroundStyle(theme.palette.muted)
                    .lineLimit(2)
                    .minimumScaleFactor(0.72)
                Text("focus for line view")
                    .font(HudFont.mono(9))
                    .foregroundStyle(theme.palette.dim)
            }
            .padding(HudSpacing.xl)
        }
        .artifactCardStroke(theme: theme)
    }

    private var previewBackground: some View {
        RoundedRectangle(cornerRadius: theme.radius.standard)
            .fill(theme.palette.ink.opacity(HudOpacity.ghost))
    }

    private func lineWidthFactor(_ row: Int) -> CGFloat {
        min(0.95, 0.34 + CGFloat((row * 7) % 11) / 18)
    }

    private func rowTint(_ row: Int) -> Color {
        row % 6 == 0 ? tint : theme.palette.ink
    }

    private func lineOpacity(_ row: Int) -> Double {
        HudOpacity.subtle + Double(row % 4) * HudOpacity.ghost
    }
}

private struct DiffArtifactCanvasPreview: View {
    let document: HudDiffDocument
    let tint: Color
    let byteCount: Int
    let readByteCount: Int
    let isTruncated: Bool
    let detail: DocumentArtifactCanvasDetail
    @Environment(\.hudTheme) private var theme

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(theme.palette.ink.opacity(HudOpacity.ghost))

            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.sm) {
                    HudBadge("DIFF", tint: tint, dot: true)
                    DiffStatPill(
                        label: "\(document.stats.files)f",
                        color: theme.palette.statusInfo
                    )
                    DiffStatPill(label: "+\(document.stats.additions)", color: theme.palette.muted)
                    DiffStatPill(label: "-\(document.stats.deletions)", color: theme.palette.dim)
                    if document.stats.hunks > 0 {
                        DiffStatPill(
                            label: "\(document.stats.hunks)h",
                            color: theme.palette.muted
                        )
                    }
                    Spacer(minLength: 0)
                }

                diffBody
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                HStack(spacing: HudSpacing.sm) {
                    Text(footerLabel)
                        .font(HudFont.mono(9))
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                    Spacer(minLength: 0)
                    if isTruncated {
                        HudBadge("TRUNC", tint: theme.palette.muted)
                    }
                }
            }
            .padding(HudSpacing.xl)
        }
        .artifactCardStroke(theme: theme)
    }

    @ViewBuilder
    private var diffBody: some View {
        switch detail {
        case .summary:
            diffSkeleton
        case .metrics:
            ZStack(alignment: .topLeading) {
                diffSkeleton
                fileList
                    .padding(.top, HudSpacing.sm)
            }
        case .preview:
            diffSnippet
        }
    }

    private var diffSkeleton: some View {
        Canvas { context, size in
            let rowHeight: CGFloat = 16
            let rows = max(4, Int(size.height / rowHeight))
            let maxWidth = max(40, size.width - HudSpacing.xxl)
            for row in 0..<rows {
                let kind = row % 5
                let color = kind == 1
                    ? theme.palette.statusInfo.opacity(HudOpacity.subtle)
                    : (kind == 3 ? theme.palette.dim.opacity(HudOpacity.subtle) : theme.palette.ink.opacity(HudOpacity.ghost))
                let barRect = CGRect(
                    x: 0,
                    y: CGFloat(row) * rowHeight + 2,
                    width: 3,
                    height: rowHeight - 6
                )
                let lineRect = CGRect(
                    x: HudSpacing.md,
                    y: CGFloat(row) * rowHeight + 5,
                    width: maxWidth * min(0.9, 0.42 + CGFloat((row * 5) % 9) / 16),
                    height: 1.2
                )
                context.fill(
                    Path(roundedRect: barRect, cornerRadius: 1),
                    with: .color(color.opacity(kind == 0 ? 0.16 : 0.7))
                )
                context.fill(
                    Path(roundedRect: lineRect, cornerRadius: 0.6),
                    with: .color(color.opacity(kind == 0 ? 0.14 : 0.28))
                )
            }
        }
        .allowsHitTesting(false)
    }

    private var fileList: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xs) {
            ForEach(Array(document.files.prefix(4))) { file in
                HStack(spacing: HudSpacing.sm) {
                    Circle()
                        .fill(file.stats.deletions > 0 ? theme.palette.dim : theme.palette.muted)
                        .frame(width: HudDotSize.tiny, height: HudDotSize.tiny)
                    Text(file.displayPath(fallback: document.title))
                        .font(HudFont.mono(9))
                        .foregroundStyle(theme.palette.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 0)
                    Text("+\(file.stats.additions) -\(file.stats.deletions)")
                        .font(HudFont.mono(8))
                        .foregroundStyle(theme.palette.dim)
                }
            }
        }
        .padding(HudSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(theme.palette.bg.opacity(HudOpacity.emphatic))
        )
    }

    private var diffSnippet: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xs) {
            if let firstFile = document.files.first {
                HStack(spacing: HudSpacing.sm) {
                    Text(firstFile.displayPath(fallback: document.title))
                        .font(HudFont.mono(9, weight: .semibold))
                        .foregroundStyle(theme.palette.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 0)
                    Text("+\(firstFile.stats.additions) -\(firstFile.stats.deletions)")
                        .font(HudFont.mono(8))
                        .foregroundStyle(theme.palette.dim)
                }
            }
            ForEach(snippetRows) { row in
                HStack(spacing: HudSpacing.sm) {
                    Text(row.marker)
                        .font(HudFont.mono(9, weight: .bold))
                        .foregroundStyle(color(for: row.kind))
                        .frame(width: HudSpacing.lg)
                    Text(highlightedRowText(row))
                        .font(HudFont.mono(9, weight: .light))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
        }
        .padding(HudSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(theme.palette.bg.opacity(HudOpacity.emphatic))
        )
    }

    private var snippetRows: [HudDiffRow] {
        document.files
            .first?
            .hunks
            .first?
            .rows
            .prefix(24)
            .map { $0 } ?? []
    }

    private func color(for kind: HudDiffRowKind) -> Color {
        switch kind {
        case .addition: theme.palette.statusInfo
        case .deletion: theme.palette.dim
        case .context: theme.palette.muted
        case .metadata: theme.palette.statusInfo
        }
    }

    private func highlightedRowText(_ row: HudDiffRow) -> AttributedString {
        let text = row.text.isEmpty ? " " : row.text
        switch row.kind {
        case .context:
            var attributed = AttributedString(text)
            attributed.foregroundColor = theme.palette.muted
            return attributed
        case .metadata:
            var attributed = AttributedString(text)
            attributed.foregroundColor = theme.palette.statusInfo
            return attributed
        case .addition, .deletion:
            let file = document.files.first
            let language = file?.newPath ?? file?.oldPath ?? file?.language
            return HudCodeHighlighter.highlight(text, language: language)
        }
    }


    private var footerLabel: String {
        let fileLabel = "\(document.stats.files) file\(document.stats.files == 1 ? "" : "s")"
        let hunkLabel = "\(document.stats.hunks) hunk\(document.stats.hunks == 1 ? "" : "s")"
        if byteCount > 0 {
            return "\(fileLabel) · \(hunkLabel) · \(formattedBytes(readByteCount))"
        }
        return "\(fileLabel) · \(hunkLabel)"
    }
}

private struct PlanArtifactCanvasPreview: View {
    let text: String
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudBadge("PLAN", tint: tint, dot: true)
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                ForEach(planLines, id: \.self) { line in
                    HStack(spacing: HudSpacing.md) {
                        Circle()
                            .stroke(tint.opacity(HudOpacity.emphatic), lineWidth: HudStrokeWidth.standard)
                            .frame(width: HudDotSize.medium, height: HudDotSize.medium)
                        Text(line)
                            .font(HudFont.mono(10))
                            .foregroundStyle(theme.palette.muted)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(HudSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(theme.palette.ink.opacity(HudOpacity.ghost))
        )
        .artifactCardStroke(theme: theme)
    }

    private var planLines: [String] {
        let lines = text
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !$0.hasPrefix("#") }
            .prefix(6)
            .map { line in
                line
                    .replacingOccurrences(of: #"^[-*]\s+"#, with: "", options: .regularExpression)
                    .replacingOccurrences(of: #"^\d+\.\s+"#, with: "", options: .regularExpression)
            }
        return lines.isEmpty ? ["Manifest-defined plan"] : Array(lines)
    }
}

private struct CodeArtifactFullPreview: View {
    let text: String
    let path: String?
    let language: String?
    let readOnly: Bool
    let tint: Color
    let onChange: (String) -> Void
    let onSave: (String) throws -> Void
    @Environment(\.hudTheme) private var theme

    private var lines: [String] {
        previewLines(text, limit: 420)
    }

    var body: some View {
        Group {
            if HudsonCodeEditorWebBundle.indexURL != nil {
                HudsonCodeEditorWebView(
                    payload: HudsonCodeEditorWebPayload(
                        id: path ?? "inline",
                        title: path?.split(separator: "/").last.map(String.init),
                        path: path,
                        language: language,
                        text: text,
                        readOnly: readOnly,
                        tintHex: "#5eead4"
                    ),
                    onChange: onChange,
                    onSave: onSave
                )
            } else {
                ReadOnlyArtifactWebPreview(
                    payload: ArtifactHTMLRenderer.codePayload(
                        lines: lines,
                        language: language,
                        tintHex: "#5eead4"
                    )
                )
            }
        }
        .artifactFullSurface(theme: theme)
    }

    private func syntaxTint(for line: String) -> Color {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("//") || trimmed.hasPrefix("#") {
            return theme.palette.dim
        }
        if trimmed.hasPrefix("import ") || trimmed.hasPrefix("@") {
            return theme.palette.statusInfo
        }
        if trimmed.contains("func ") || trimmed.contains("struct ") || trimmed.contains("class ") {
            return tint
        }
        if trimmed.contains("let ") || trimmed.contains("var ") {
            return theme.palette.muted
        }
        return theme.palette.ink
    }
}

private struct CodeLineRow: View {
    let number: Int
    let line: String
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            Text("\(number)")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.dim)
                .frame(width: HudIconSize.huge, alignment: .trailing)
                .padding(.trailing, HudSpacing.lg)
            Rectangle()
                .fill(tint.opacity(number % 7 == 0 ? HudOpacity.muted : HudOpacity.subtle))
                .frame(width: HudStrokeWidth.bold)
                .padding(.trailing, HudSpacing.lg)
            Text(line.isEmpty ? " " : line)
                .font(HudFont.mono(11))
                .foregroundStyle(tint)
                .textSelection(.enabled)
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.vertical, HudSpacing.xxs)
        .padding(.trailing, HudSpacing.xxl)
    }
}

private struct DiffArtifactFullPreview: View {
    let document: HudDiffDocument
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        NativeDiffFullPreview(document: document, tint: tint)
        .artifactFullSurface(theme: theme)
    }
}

private struct NativeDiffFullPreview: View {
    let document: HudDiffDocument
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: HudSpacing.md) {
                HudBadge("DIFF", tint: tint, dot: true)
                Text("\(document.stats.files) file\(document.stats.files == 1 ? "" : "s")")
                    .font(HudFont.mono(10))
                    .foregroundStyle(theme.palette.muted)
                Spacer(minLength: 0)
                DiffStatPill(label: "+\(document.stats.additions)", color: theme.palette.muted)
                DiffStatPill(label: "-\(document.stats.deletions)", color: theme.palette.dim)
            }
            .padding(.horizontal, HudSpacing.xl)
            .frame(height: HudLayout.rowHeightRegular)

            HudDivider(color: theme.hairline.subtle)

            ScrollView([.vertical, .horizontal]) {
                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: []) {
                    ForEach(document.files) { file in
                        NativeDiffFileSection(file: file, fallbackTitle: document.title, tint: tint)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, HudSpacing.md)
            }
        }
    }
}

private struct NativeDiffFileSection: View {
    let file: HudDiffFile
    let fallbackTitle: String?
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: HudSpacing.md) {
                HudStatusDot(color: theme.palette.statusInfo, size: HudDotSize.small)
                Text(file.displayPath(fallback: fallbackTitle))
                    .font(HudFont.mono(11, weight: .semibold))
                    .foregroundStyle(theme.palette.ink)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text("+\(file.stats.additions) -\(file.stats.deletions)")
                    .font(HudFont.mono(10, weight: .semibold))
                    .foregroundStyle(theme.palette.dim)
            }
            .padding(.horizontal, HudSpacing.xl)
            .frame(height: HudLayout.rowHeightRegular)
            .background(theme.palette.chrome.opacity(HudOpacity.ghost))

            ForEach(file.hunks) { hunk in
                NativeDiffHunkSection(hunk: hunk, language: file.newPath ?? file.oldPath ?? file.language)
            }
        }
    }
}

private struct NativeDiffHunkSection: View {
    let hunk: HudDiffHunk
    let language: String?
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(hunk.header ?? "@@ -\(hunk.oldStart),\(hunk.oldLineCount) +\(hunk.newStart),\(hunk.newLineCount) @@")
                .font(HudFont.mono(10, weight: .semibold))
                .foregroundStyle(theme.palette.statusInfo)
                .padding(.horizontal, HudSpacing.xl)
                .frame(minWidth: HudLayout.cliffWidth, minHeight: HudLayout.rowHeightCompact, alignment: .leading)
                .background(theme.palette.statusInfo.opacity(HudOpacity.ghost))

            ForEach(hunk.rows) { row in
                NativeDiffRowView(row: row, language: language)
            }
        }
    }
}

private struct NativeDiffRowView: View {
    let row: HudDiffRow
    let language: String?
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            Rectangle()
                .fill(barColor)
                .frame(width: HudStrokeWidth.bold + HudStrokeWidth.standard)
            Text(row.oldLine.map(String.init) ?? "")
                .font(HudFont.mono(10))
                .foregroundStyle(gutterColor)
                .frame(width: HudLayout.rowHeightRegular, alignment: .trailing)
                .padding(.trailing, HudSpacing.md)
            Text(row.newLine.map(String.init) ?? "")
                .font(HudFont.mono(10))
                .foregroundStyle(gutterColor)
                .frame(width: HudLayout.rowHeightRegular, alignment: .trailing)
                .padding(.trailing, HudSpacing.lg)
            Text(row.marker)
                .font(HudFont.mono(11, weight: .semibold))
                .foregroundStyle(barColor)
                .frame(width: HudIconSize.micro, alignment: .center)
            Text(highlightedText)
                .font(HudFont.mono(11, weight: .light))
                .textSelection(.enabled)
                .fixedSize(horizontal: true, vertical: false)
        }
        .frame(minWidth: HudLayout.cliffWidth, minHeight: HudSpacing.xxxl, alignment: .leading)
        .background(backgroundColor)
    }

    private var highlightedText: AttributedString {
        let text = row.text.isEmpty ? " " : row.text
        switch row.kind {
        case .context:
            var attributed = AttributedString(text)
            attributed.foregroundColor = theme.palette.muted
            return attributed
        case .metadata:
            var attributed = AttributedString(text)
            attributed.foregroundColor = theme.palette.statusInfo
            return attributed
        case .addition, .deletion:
            return HudCodeHighlighter.highlight(text, language: language)
        }
    }

    private var barColor: Color {
        switch row.kind {
        case .addition: theme.palette.statusInfo
        case .deletion: theme.palette.dim
        case .context: Color.clear
        case .metadata: theme.palette.dim
        }
    }

    private var backgroundColor: Color {
        switch row.kind {
        case .addition: theme.palette.statusInfo.opacity(HudOpacity.ghost)
        case .deletion: theme.palette.dim.opacity(HudOpacity.ghost)
        case .metadata: theme.palette.ink.opacity(HudOpacity.ghost)
        case .context: Color.clear
        }
    }

    private var gutterColor: Color {
        switch row.kind {
        case .addition, .deletion: barColor.opacity(HudOpacity.emphatic)
        default: theme.palette.dim
        }
    }

    private var textColor: Color {
        switch row.kind {
        case .addition, .deletion: theme.palette.ink
        case .metadata: theme.palette.muted
        case .context: theme.palette.ink.opacity(HudOpacity.emphatic)
        }
    }
}

private struct PlanArtifactFullPreview: View {
    let text: String
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            artifactHeader(title: "PLAN", detail: "workspace intent", tint: tint)
            HudDivider(color: theme.hairline.subtle)
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    ForEach(Array(previewLines(text, limit: 180).enumerated()), id: \.offset) { _, line in
                        PlanLineRow(line: line, tint: tint)
                    }
                }
                .padding(HudSpacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .artifactFullSurface(theme: theme)
    }
}

private struct PlanLineRow: View {
    let line: String
    let tint: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        if line.hasPrefix("#") {
            Text(line.replacingOccurrences(of: #"^#+\s*"#, with: "", options: .regularExpression))
                .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
        } else {
            HStack(alignment: .top, spacing: HudSpacing.md) {
                Circle()
                    .fill(tint.opacity(HudOpacity.emphatic))
                    .frame(width: HudDotSize.small, height: HudDotSize.small)
                    .padding(.top, HudSpacing.sm)
                Text(cleanedLine)
                    .font(HudFont.mono(11))
                    .foregroundStyle(theme.palette.muted)
                    .textSelection(.enabled)
            }
        }
    }

    private var cleanedLine: String {
        line
            .replacingOccurrences(of: #"^[-*]\s+"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"^\d+\.\s+"#, with: "", options: .regularExpression)
    }
}

private struct DiffStatPill: View {
    let label: String
    let color: Color
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Text(label)
            .font(HudFont.mono(9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, HudSpacing.sm)
            .frame(height: HudLayout.rowHeightCompact)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.tight)
                    .fill(color.opacity(HudOpacity.subtle))
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.tight)
                    .stroke(color.opacity(HudOpacity.soft))
            )
    }
}

private enum HudsonCodeEditorWebBundle {
    static let messageHandlerName = "hudsonCodeEditor"

    static var indexURL: URL? {
        Bundle.module.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "HudsonCodeEditor"
        )
        ?? Bundle.module.url(forResource: "index", withExtension: "html")
    }

    static func configuration(handler: WKScriptMessageHandler) -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(handler, name: messageHandlerName)
        return configuration
    }

    static func tearDown(_ webView: WKWebView) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: messageHandlerName
        )
        webView.configuration.userContentController.removeAllUserScripts()
        webView.loadHTMLString(
            "<!doctype html><meta charset='utf-8'><body style='background:#0a0f12'></body>",
            baseURL: nil
        )
    }
}

private struct HudsonCodeEditorWebPayload: Codable, Equatable {
    var id: String
    var title: String?
    var path: String?
    var language: String?
    var text: String
    var readOnly: Bool
    var tintHex: String
}

private struct HudsonCodeEditorSaveResult: Codable {
    var id: String?
    var success: Bool
    var text: String?
    var error: String?
}

private struct HudsonCodeEditorWebView: NSViewRepresentable {
    let payload: HudsonCodeEditorWebPayload
    let onChange: (String) -> Void
    let onSave: (String) throws -> Void

    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView(
            frame: .zero,
            configuration: HudsonCodeEditorWebBundle.configuration(handler: context.coordinator)
        )
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        if let indexURL = HudsonCodeEditorWebBundle.indexURL {
            webView.loadFileURL(
                indexURL,
                allowingReadAccessTo: indexURL.deletingLastPathComponent()
            )
        } else {
            webView.loadHTMLString(
                "<html><body style='background:#0a0f12;color:#94a3b8;font:12px monospace'>Hudson editor bundle missing.</body></html>",
                baseURL: nil
            )
        }
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.payload = payload
        context.coordinator.onChange = onChange
        context.coordinator.onSave = onSave
        context.coordinator.renderPayloadIfReady(in: webView)
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.tearDown()
        HudsonCodeEditorWebBundle.tearDown(webView)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(payload: payload, onChange: onChange, onSave: onSave)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var payload: HudsonCodeEditorWebPayload
        var onChange: (String) -> Void
        var onSave: (String) throws -> Void
        private var isReady = false
        private var renderedPayload: HudsonCodeEditorWebPayload?
        private var isTornDown = false
        private let encoder = JSONEncoder()

        init(
            payload: HudsonCodeEditorWebPayload,
            onChange: @escaping (String) -> Void,
            onSave: @escaping (String) throws -> Void
        ) {
            self.payload = payload
            self.onChange = onChange
            self.onSave = onSave
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !isTornDown else { return }
            isReady = true
            renderPayloadIfReady(in: webView, force: true)
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard !isTornDown else { return }
            guard message.name == "hudsonCodeEditor",
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String
            else { return }

            switch type {
            case "ready":
                isReady = true
                if let webView = message.webView {
                    renderPayloadIfReady(in: webView, force: true)
                }
            case "change":
                guard let text = body["text"] as? String else { return }
                onChange(text)
            case "save":
                guard let text = body["text"] as? String else { return }
                let id = body["id"] as? String
                do {
                    try onSave(text)
                    if let webView = message.webView {
                        renderSaveResult(
                            HudsonCodeEditorSaveResult(
                                id: id,
                                success: true,
                                text: text,
                                error: nil
                            ),
                            in: webView
                        )
                    }
                } catch {
                    if let webView = message.webView {
                        renderSaveResult(
                            HudsonCodeEditorSaveResult(
                                id: id,
                                success: false,
                                text: nil,
                                error: error.localizedDescription
                            ),
                            in: webView
                        )
                    }
                }
            default:
                break
            }
        }

        func renderPayloadIfReady(in webView: WKWebView, force: Bool = false) {
            guard !isTornDown else { return }
            guard isReady else { return }
            guard force || renderedPayload != payload else { return }
            guard let data = try? encoder.encode(payload),
                  let json = String(data: data, encoding: .utf8)
            else { return }

            renderedPayload = payload
            webView.evaluateJavaScript(
                "window.__hudsonCodeEditor?.setDocument(\(json));",
                completionHandler: nil
            )
        }

        private func renderSaveResult(_ result: HudsonCodeEditorSaveResult, in webView: WKWebView) {
            guard !isTornDown else { return }
            guard let data = try? encoder.encode(result),
                  let json = String(data: data, encoding: .utf8)
            else { return }

            webView.evaluateJavaScript(
                "window.__hudsonCodeEditor?.saveResult(\(json));",
                completionHandler: nil
            )
        }

        func tearDown() {
            isTornDown = true
            renderedPayload = nil
            onChange = { _ in }
            onSave = { _ in }
        }
    }
}

private struct ArtifactWebPayload: Codable, Equatable {
    var kind: String
    var title: String
    var subtitle: String
    var tintHex: String
    var stats: [ArtifactWebStat] = []
    var rows: [ArtifactWebRow]
}

private struct ArtifactWebStat: Codable, Equatable {
    var label: String
    var kind: String
}

private struct ArtifactWebRow: Codable, Equatable {
    var kind: String
    var number: Int?
    var oldLine: Int?
    var newLine: Int?
    var marker: String?
    var text: String
}

private struct ReadOnlyArtifactWebPreview: NSViewRepresentable {
    let payload: ArtifactWebPayload

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        webView.loadHTMLString(ArtifactHTMLRenderer.shellHTML, baseURL: nil)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.payload = payload
        context.coordinator.renderPayloadIfReady(in: webView)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(payload: payload)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var payload: ArtifactWebPayload
        private var isReady = false
        private var renderedPayload: ArtifactWebPayload?
        private let encoder = JSONEncoder()

        init(payload: ArtifactWebPayload) {
            self.payload = payload
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isReady = true
            renderPayloadIfReady(in: webView, force: true)
        }

        func renderPayloadIfReady(in webView: WKWebView, force: Bool = false) {
            guard isReady else { return }
            guard force || renderedPayload != payload else { return }
            guard let data = try? encoder.encode(payload),
                  let json = String(data: data, encoding: .utf8)
            else { return }

            renderedPayload = payload
            webView.evaluateJavaScript("window.__hudsonRender(\(json));", completionHandler: nil)
        }
    }
}

private enum ArtifactHTMLRenderer {
    static func codePayload(lines: [String], language: String?, tintHex: String) -> ArtifactWebPayload {
        ArtifactWebPayload(
            kind: "code",
            title: language?.uppercased() ?? "CODE",
            subtitle: "\(lines.count) visible lines",
            tintHex: tintHex,
            rows: lines.enumerated().map { index, line in
                ArtifactWebRow(
                    kind: codeKind(line),
                    number: index + 1,
                    text: line.isEmpty ? " " : line
                )
            }
        )
    }

    static let shellHTML = #"""
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              color-scheme: dark;
              --bg: #111414;
              --panel: #151918;
              --panel-2: #0d100f;
              --line: rgba(255,255,255,.08);
              --line-soft: rgba(255,255,255,.05);
              --text: #e6f2ed;
              --muted: #7f8d89;
              --dim: #56625f;
              --tint: #5eead4;
              --add: #24d77e;
              --del: #ff5f6d;
              --info: #4aa8ff;
              --warn: #f7b955;
            }
            * { box-sizing: border-box; }
            html, body {
              width: 100%;
              min-height: 100%;
              margin: 0;
              background: var(--bg);
              color: var(--text);
              font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              overflow: auto;
            }
            body { padding: 0; }
            header {
              position: sticky;
              top: 0;
              z-index: 2;
              display: flex;
              align-items: center;
              gap: 10px;
              min-height: 40px;
              padding: 8px 14px;
              border-bottom: 1px solid var(--line);
              background: color-mix(in srgb, var(--panel-2) 92%, transparent);
              backdrop-filter: blur(16px);
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              height: 20px;
              padding: 0 8px;
              border: 1px solid color-mix(in srgb, var(--tint) 45%, transparent);
              border-radius: 5px;
              color: var(--tint);
              background: color-mix(in srgb, var(--tint) 14%, transparent);
              font-weight: 700;
              letter-spacing: .08em;
              font-size: 10px;
            }
            .badge:before {
              content: "";
              width: 5px;
              height: 5px;
              border-radius: 999px;
              background: var(--tint);
            }
            .subtitle { color: var(--muted); font-size: 11px; }
            .spacer { flex: 1; }
            .stats {
              display: inline-flex;
              align-items: center;
              gap: 8px;
            }
            .stat {
              height: 22px;
              min-width: 32px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0 8px;
              border-radius: 5px;
              font-weight: 700;
            }
            .stat.add { color: var(--add); background: color-mix(in srgb, var(--add) 13%, transparent); }
            .stat.del { color: var(--del); background: color-mix(in srgb, var(--del) 13%, transparent); }
            .stat.info { color: var(--info); background: color-mix(in srgb, var(--info) 13%, transparent); }
            main {
              width: max-content;
              min-width: 100%;
              padding: 10px 0 18px 0;
            }
            pre {
              margin: 0;
              white-space: pre;
              font: inherit;
              line-height: 18px;
            }
            .code-row,
            .diff-row {
              display: grid;
              align-items: start;
              min-height: 20px;
            }
            .code-row {
              grid-template-columns: 52px 3px minmax(620px, max-content);
              column-gap: 14px;
              padding: 1px 22px 1px 0;
            }
            .code-row .ln,
            .diff-row .ln {
              color: var(--dim);
              text-align: right;
              user-select: none;
            }
            .code-row .bar {
              width: 2px;
              min-height: 18px;
              border-radius: 2px;
              background: var(--line);
            }
            .code-row.decl .bar { background: color-mix(in srgb, var(--tint) 68%, transparent); }
            .code-row.import .bar { background: color-mix(in srgb, var(--info) 62%, transparent); }
            .code-row.comment pre { color: var(--muted); }
            .code-row.decl pre { color: var(--text); font-weight: 700; }
            .code-row.import pre { color: #b9dcff; }
            .diff-row {
              grid-template-columns: 3px 30px 30px 16px minmax(540px, max-content);
              column-gap: 8px;
              padding: 1px 24px 1px 0;
            }
            .diff-row .change-bar {
              width: 3px;
              min-height: 20px;
              border-radius: 2px;
              background: transparent;
            }
            .diff-row .mark {
              color: var(--dim);
              text-align: center;
              font-weight: 700;
              user-select: none;
            }
            .diff-row.file,
            .diff-row.hunk,
            .diff-row.meta {
              grid-template-columns: 3px 16px minmax(540px, max-content);
              column-gap: 8px;
            }
            .diff-row.file .old,
            .diff-row.file .new,
            .diff-row.hunk .old,
            .diff-row.hunk .new,
            .diff-row.meta .old,
            .diff-row.meta .new {
              display: none;
            }
            .diff-row.file .mark,
            .diff-row.hunk .mark,
            .diff-row.meta .mark {
              grid-column: 2;
            }
            .diff-row.file pre,
            .diff-row.hunk pre,
            .diff-row.meta pre {
              grid-column: 3;
            }
            .diff-row.add {
              background: linear-gradient(90deg, color-mix(in srgb, var(--add) 11%, transparent), transparent 72%);
            }
            .diff-row.add .change-bar { background: var(--add); }
            .diff-row.add .mark,
            .diff-row.add .ln { color: var(--add); }
            .diff-row.del {
              background: linear-gradient(90deg, color-mix(in srgb, var(--del) 12%, transparent), transparent 72%);
            }
            .diff-row.del .change-bar { background: var(--del); }
            .diff-row.del .mark,
            .diff-row.del .ln { color: var(--del); }
            .diff-row.hunk {
              margin-top: 8px;
              background: color-mix(in srgb, var(--info) 10%, transparent);
              color: #b9dcff;
            }
            .diff-row.hunk .change-bar { background: var(--info); }
            .diff-row.file {
              margin-top: 10px;
              background: color-mix(in srgb, var(--warn) 10%, transparent);
              font-weight: 700;
            }
            .diff-row.file .change-bar { background: var(--warn); }
            .diff-row.meta { color: var(--muted); background: var(--line-soft); }
            ::selection { background: color-mix(in srgb, var(--tint) 35%, transparent); }
          </style>
        </head>
        <body>
          <header>
            <span id="badge" class="badge">READY</span>
            <span id="subtitle" class="subtitle">waiting for payload</span>
            <span class="spacer"></span>
            <span id="stats" class="stats"></span>
          </header>
          <main id="content" class="code-view"></main>
          <script>
            (function () {
              const badge = document.getElementById("badge");
              const subtitle = document.getElementById("subtitle");
              const stats = document.getElementById("stats");
              const content = document.getElementById("content");

              function textElement(tag, className, value) {
                const element = document.createElement(tag);
                if (className) element.className = className;
                element.textContent = value == null || value === "" ? " " : String(value);
                return element;
              }

              function renderStats(values) {
                stats.replaceChildren();
                (values || []).forEach(function (stat) {
                  const element = textElement("span", "stat " + (stat.kind || "info"), stat.label);
                  stats.appendChild(element);
                });
              }

              function renderCodeRow(row) {
                const element = document.createElement("div");
                element.className = "code-row " + (row.kind || "plain");
                element.appendChild(textElement("div", "ln", row.number));
                const bar = document.createElement("div");
                bar.className = "bar";
                element.appendChild(bar);
                element.appendChild(textElement("pre", "", row.text));
                return element;
              }

              function renderDiffRow(row) {
                const element = document.createElement("div");
                element.className = "diff-row " + (row.kind || "ctx");
                const bar = document.createElement("div");
                bar.className = "change-bar";
                element.appendChild(bar);
                element.appendChild(textElement("div", "ln old", row.oldLine));
                element.appendChild(textElement("div", "ln new", row.newLine));
                element.appendChild(textElement("div", "mark", row.marker));
                element.appendChild(textElement("pre", "", row.text));
                return element;
              }

              window.__hudsonRender = function (payload) {
                const next = payload || {};
                document.documentElement.style.setProperty("--tint", next.tintHex || "#5eead4");
                badge.textContent = next.title || "PREVIEW";
                subtitle.textContent = next.subtitle || "";
                renderStats(next.stats);
                content.className = next.kind === "diff" ? "diff-view" : "code-view";
                content.replaceChildren();
                (next.rows || []).forEach(function (row) {
                  content.appendChild(next.kind === "diff" ? renderDiffRow(row) : renderCodeRow(row));
                });
              };
            }());
          </script>
        </body>
        </html>
        """#

    private static func codeKind(_ line: String) -> String {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("//") || trimmed.hasPrefix("#") {
            return "comment"
        }
        if trimmed.hasPrefix("import ") || trimmed.hasPrefix("@") {
            return "import"
        }
        if trimmed.contains("func ") || trimmed.contains("struct ") || trimmed.contains("class ") {
            return "decl"
        }
        return "plain"
    }
}

private func artifactHeader(title: String, detail: String, tint: Color) -> some View {
    HStack(spacing: HudSpacing.md) {
        HudBadge(title, tint: tint, dot: true)
        Text(detail)
            .font(HudFont.mono(10))
            .foregroundStyle(.secondary)
            .lineLimit(1)
        Spacer(minLength: 0)
    }
    .padding(.horizontal, HudSpacing.xl)
    .frame(height: HudLayout.rowHeightRegular)
}

private func previewLines(_ text: String, limit: Int) -> [String] {
    Array(
        text
            .split(separator: "\n", omittingEmptySubsequences: false)
            .prefix(limit)
            .map(String.init)
    )
}

private extension View {
    func artifactCardStroke(theme: HudTheme) -> some View {
        self
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(theme.hairline.subtle)
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    func artifactFullSurface(theme: HudTheme) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(theme.palette.ink.opacity(HudOpacity.ghost))
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(theme.hairline.subtle)
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct InfiniteCanvasBackground: View {
    let pan: CGSize
    let scale: CGFloat
    let styleProfile: HudCanvasStyleProfile
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Canvas { context, size in
            drawGrid(context: &context, size: size)
        }
    }

    private func drawGrid(context: inout GraphicsContext, size: CGSize) {
        guard styleProfile.canvasGridMode != .none else { return }

        let step = normalizedScreenStep
        let majorStep = step * 5
        let minorColor = theme.palette.ink.opacity(styleProfile.canvasMinorOpacity)
        let majorColor = theme.palette.ink.opacity(styleProfile.canvasMajorOpacity)

        if styleProfile.canvasGridMode == .dots {
            drawDots(
                context: &context,
                size: size,
                step: max(step, 14),
                offsetX: screenOffset(for: pan.width, step: max(step, 14)),
                offsetY: screenOffset(for: pan.height, step: max(step, 14)),
                color: minorColor,
                radius: 0.7
            )
            drawDots(
                context: &context,
                size: size,
                step: majorStep,
                offsetX: screenOffset(for: pan.width, step: majorStep),
                offsetY: screenOffset(for: pan.height, step: majorStep),
                color: majorColor,
                radius: 1.2
            )
            return
        }

        strokeGrid(
            context: &context,
            size: size,
            step: step,
            offsetX: screenOffset(for: pan.width, step: step),
            offsetY: screenOffset(for: pan.height, step: step),
            color: minorColor,
            lineWidth: HudStrokeWidth.standard
        )

        strokeGrid(
            context: &context,
            size: size,
            step: majorStep,
            offsetX: screenOffset(for: pan.width, step: majorStep),
            offsetY: screenOffset(for: pan.height, step: majorStep),
            color: majorColor,
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

    private func drawDots(
        context: inout GraphicsContext,
        size: CGSize,
        step: CGFloat,
        offsetX: CGFloat,
        offsetY: CGFloat,
        color: Color,
        radius: CGFloat
    ) {
        var path = Path()
        var x = offsetX
        while x <= size.width {
            var y = offsetY
            while y <= size.height {
                path.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                y += step
            }
            x += step
        }
        context.fill(path, with: .color(color))
    }

    private var normalizedScreenStep: CGFloat {
        var step = CGFloat(styleProfile.canvasGridStep) * scale
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
    let nodes: [TerminalNode]
    let minimapNodes: [TerminalNode]
    let totalCount: Int
    let selectedCount: Int
    @Binding var filter: CanvasNavigationFilter
    @Binding var tagFilter: CanvasTag?
    @Binding var minimapCollapsed: Bool
    let selectedIDs: Set<UUID>
    let viewportWorldRect: CGRect
    let canvasWorldBounds: CGRect
    let canvasScale: CGFloat
    let onSelectNode: (UUID) -> Void
    let onCenterNode: (UUID) -> Void
    let onTagSelection: (CanvasTag?) -> Void
    let onCenterWorldPoint: (CGPoint) -> Void
    let onFit: () -> Void
    let onOpenAppearanceSettings: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
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
                        Text("No nodes")
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
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HStack {
                HudSectionLabel("Workspace")
                Spacer()
                Text("\(totalCount)")
                    .font(HudFont.mono(9, weight: .semibold))
                    .foregroundStyle(theme.palette.dim)
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
            CanvasNavigationSettingsRow(
                onOpen: onOpenAppearanceSettings
            )

            HudDivider(color: theme.hairline.subtle)

            HStack {
                HudSectionLabel("Minimap")
                Spacer()
                CanvasIconButton(
                    systemName: minimapCollapsed ? "chevron.down" : "chevron.up",
                    help: minimapCollapsed ? "Show minimap" : "Hide minimap",
                    action: { minimapCollapsed.toggle() }
                )
                CanvasIconButton(
                    systemName: "viewfinder",
                    help: "Fit world",
                    action: onFit
                )
                Text(formattedZoom(canvasScale))
                    .font(HudFont.mono(10, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
            }

            if !minimapCollapsed {
                CanvasMiniMap(
                    nodes: minimapNodes,
                    selectedIDs: selectedIDs,
                    worldBounds: canvasWorldBounds,
                    viewportWorldRect: viewportWorldRect,
                    onCenterWorldPoint: onCenterWorldPoint
                )
                .frame(height: HudCanvasMetrics.minimapHeight)
            }
        }
    }
}

private struct CanvasNavigationSettingsRow: View {
    let onOpen: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: HudSpacing.md) {
                Text("Settings")
                    .font(HudFont.mono(10, weight: .semibold))
                    .foregroundStyle(theme.palette.ink)
                Spacer()
                Image(systemName: "gearshape")
                    .font(HudFont.ui(12, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
                    .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(height: HudLayout.rowHeightRegular)
            .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.canvasControlFill))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
        }
        .buttonStyle(.plain)
        .help("Appearance settings")
        .accessibilityLabel("Appearance settings")
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
                    Text(node.title)
                        .font(HudFont.mono(11, weight: .semibold))
                        .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
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
                help: "Center node",
                action: onCenter
            )
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.xs)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(isSelected ? theme.canvasControlHoverFill : theme.canvasControlFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .stroke(isSelected ? theme.hairline.standard : theme.hairline.subtle)
        )
    }
}

private struct CanvasTagPill: View {
    let tag: CanvasTag
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Text(tag.label.uppercased())
            .font(HudFont.mono(8, weight: .bold))
            .foregroundStyle(theme.palette.dim)
            .padding(.horizontal, HudSpacing.sm)
            .frame(height: HudIconSize.micro)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.tight)
                    .fill(theme.canvasControlFill)
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

    private var foregroundColor: Color {
        isActive ? theme.palette.ink : theme.palette.muted
    }

    private var backgroundColor: Color {
        isActive ? theme.canvasControlHoverFill : theme.canvasControlFill
    }

    private var borderColor: Color {
        isActive ? theme.hairline.standard : theme.hairline.subtle
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
                .foregroundStyle(theme.palette.muted)
                .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .fill(theme.canvasControlFill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .stroke(theme.hairline.subtle)
                )
        }
        .buttonStyle(.plain)
        .help(helpText)
        .accessibilityLabel(helpText)
    }

    private var helpText: String {
        if let tag {
            return "Tag selection as \(tag.label)"
        }
        return "Clear tags from selection"
    }
}

private struct CanvasInspectorPanel: View {
    let selectedNodes: [TerminalNode]
    let tmuxAvailable: Bool
    let tmuxInstallInProgress: Bool
    let tmuxInstallMessage: String
    let onCenterNode: (TerminalNode) -> Void
    let onCloseNode: (UUID) -> Void
    let onInstallTmux: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: theme.hairline.subtle)

            ScrollView {
                content
                    .padding(HudSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            HudSectionLabel("Detail")
            Spacer()
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.navHeight)
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudCanvasPrerequisiteCheck(
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

    private var tmuxPrerequisiteStatus: HudCanvasPrerequisiteStatus {
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

private struct CanvasAppearanceSettingsSurface: View {
    @Binding var profile: HudCanvasStyleProfile
    @Binding var tagStyleOverrides: [CanvasTag: HudCanvasTerminalStyleOverride]
    let selectedNode: TerminalNode?
    let inheritedProfile: HudCanvasStyleProfile?
    let selectedStyleOverride: Binding<HudCanvasTerminalStyleOverride>?
    let onClose: () -> Void

    @State private var selectedScope: CanvasAppearanceScope = .workspace
    @Environment(\.hudTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: theme.hairline.standard)

            HStack(spacing: 0) {
                scopeRail
                Rectangle()
                    .fill(theme.hairline.subtle)
                    .frame(width: HudStrokeWidth.thin)
                settingsContent
            }
        }
        .background(theme.palette.bg)
    }

    private var header: some View {
        HStack(spacing: HudSpacing.lg) {
            Image(systemName: "paintpalette")
                .font(HudFont.ui(13, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
            VStack(alignment: .leading, spacing: 1) {
                Text("Appearance Settings")
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(theme.palette.ink)
                Text(profile.name)
                    .font(HudFont.mono(9))
                    .foregroundStyle(theme.palette.dim)
            }
            Spacer()
            HudButton("Done", icon: "checkmark", style: .secondary, action: onClose)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.navHeight)
        .background(theme.palette.chrome)
    }

    private var scopeRail: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Scope", tint: theme.palette.dim)

            VStack(spacing: HudSpacing.sm) {
                ForEach(availableScopes) { scope in
                    CanvasSettingsScopeRow(
                        scope: scope,
                        isSelected: currentScope == scope,
                        onSelect: { selectedScope = scope }
                    )
                }
            }

            Spacer()
        }
        .padding(HudSpacing.xl)
        .frame(width: HudCanvasMetrics.settingsScopeRailWidth)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(theme.palette.chrome)
    }

    private var settingsContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                contextHeader
                scopeSettings
            }
            .padding(HudSpacing.xxl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var contextHeader: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            Text(currentScope.title)
                .font(HudFont.ui(18, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
            Text(currentScope.explanation(selectedNode: selectedNode))
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var scopeSettings: some View {
        switch currentScope {
        case .workspace:
            CanvasStyleSettings(profile: $profile)

        case .tag(let tag):
            CanvasTerminalOverrideControls(
                title: "Terminal Defaults",
                subtitle: "\(tag.label) tag inherits workspace settings",
                override: tagStyleBinding(for: tag),
                baseProfile: profile,
                inheritedLabel: "Workspace",
                tint: theme.palette.muted
            )

        case .terminal:
            if let selectedNode,
               let inheritedProfile,
               let selectedStyleOverride {
                CanvasTerminalOverrideControls(
                    title: "Terminal Defaults",
                    subtitle: "\(selectedNode.title) inherits workspace and tag settings",
                    override: selectedStyleOverride,
                    baseProfile: inheritedProfile,
                    inheritedLabel: "Parent",
                    tint: theme.palette.muted
                )
            } else {
                EmptyTerminalScope()
            }
        }
    }

    private var currentScope: CanvasAppearanceScope {
        availableScopes.contains(selectedScope) ? selectedScope : .workspace
    }

    private var availableScopes: [CanvasAppearanceScope] {
        var scopes: [CanvasAppearanceScope] = [.workspace]
        scopes.append(contentsOf: CanvasTag.allCases.map(CanvasAppearanceScope.tag))
        if selectedNode != nil {
            scopes.append(.terminal)
        }
        return scopes
    }

    private func tagStyleBinding(for tag: CanvasTag) -> Binding<HudCanvasTerminalStyleOverride> {
        Binding(
            get: { tagStyleOverrides[tag] ?? .empty },
            set: { override in
                if override.isEmpty {
                    tagStyleOverrides[tag] = nil
                } else {
                    tagStyleOverrides[tag] = override
                }
            }
        )
    }
}

private enum CanvasAppearanceScope: Hashable, Identifiable {
    case workspace
    case tag(CanvasTag)
    case terminal

    var id: String {
        switch self {
        case .workspace: "workspace"
        case .tag(let tag): "tag.\(tag.rawValue)"
        case .terminal: "terminal"
        }
    }

    var title: String {
        switch self {
        case .workspace: "Workspace"
        case .tag(let tag): "\(tag.label) Tag"
        case .terminal: "Selected Terminal"
        }
    }

    var subtitle: String {
        switch self {
        case .workspace: "Default"
        case .tag: "Tag override"
        case .terminal: "Local override"
        }
    }

    var icon: String {
        switch self {
        case .workspace: "macwindow"
        case .tag: "tag"
        case .terminal: "terminal"
        }
    }

    @MainActor
    func explanation(selectedNode: TerminalNode?) -> String {
        switch self {
        case .workspace:
            return "Workspace settings define the shell, canvas, and default terminal appearance."
        case .tag(let tag):
            return "\(tag.label) tag settings override workspace terminal defaults. Empty values inherit from workspace."
        case .terminal:
            let name = selectedNode?.title ?? "The selected terminal"
            return "\(name) overrides its parent context. Empty values inherit from the workspace and tag cascade."
        }
    }
}

private struct CanvasSettingsScopeRow: View {
    let scope: CanvasAppearanceScope
    let isSelected: Bool
    let onSelect: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: scope.icon)
                    .font(HudFont.ui(11, weight: .semibold))
                    .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.dim)
                    .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)

                VStack(alignment: .leading, spacing: 1) {
                    Text(scope.title)
                        .font(HudFont.mono(10, weight: .semibold))
                        .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                    Text(scope.subtitle)
                        .font(HudFont.mono(9))
                        .foregroundStyle(theme.palette.dim)
                }
                Spacer()
            }
            .padding(.horizontal, HudSpacing.sm)
            .frame(height: HudLayout.rowHeightRegular)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(isSelected ? theme.canvasControlFill : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? theme.hairline.standard : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct EmptyTerminalScope: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HudSettingsSection("Terminal Defaults", labelTint: theme.palette.dim) {
            HudSettingsRow(
                icon: "terminal",
                iconColor: theme.palette.dim,
                title: "No terminal selected",
                subtitle: "Select a terminal to edit its local override."
            )
        }
    }
}

private struct CanvasStyleSettings: View {
    @Binding var profile: HudCanvasStyleProfile
    @Environment(\.hudTheme) private var theme

    private let fontFamilies = ["SF Mono", "JetBrains Mono", "Menlo", "Monaco"]

    var body: some View {
        HudSettingsSection("Workspace Style", labelTint: theme.palette.dim) {
            HudSettingsPickerRow(
                title: "Preset",
                subtitle: "Workspace defaults",
                value: profile.name,
                icon: "slider.horizontal.3",
                iconColor: theme.palette.muted,
                selection: presetBinding
            ) {
                ForEach(HudCanvasStyleProfile.presets) { preset in
                    Text(preset.name).tag(preset.id)
                }
            }

            HudDivider(color: theme.hairline.subtle)

            HudSettingsPickerRow(
                title: "Shell",
                subtitle: "Window chrome",
                value: profile.chromeStyle.label,
                icon: "macwindow",
                iconColor: theme.palette.muted,
                selection: $profile.chromeStyle
            ) {
                ForEach(HudCanvasChromeStyle.allCases) { style in
                    Text(style.label).tag(style)
                }
            }

            HudDivider(color: theme.hairline.subtle)

            HudSettingsPickerRow(
                title: "Terminal",
                subtitle: "Workspace default",
                value: profile.terminalThemeID.label,
                icon: "terminal",
                iconColor: theme.palette.muted,
                selection: $profile.terminalThemeID
            ) {
                ForEach(HudCanvasTerminalThemeID.allCases) { terminalTheme in
                    Text(terminalTheme.label).tag(terminalTheme)
                }
            }

            HudDivider(color: theme.hairline.subtle)

            HudSettingsPickerRow(
                title: "Font",
                subtitle: "\(String(format: "%.1f", profile.terminalFontSize)) pt",
                value: profile.terminalFontFamily,
                icon: "textformat",
                iconColor: theme.palette.muted,
                selection: $profile.terminalFontFamily
            ) {
                ForEach(fontFamilies, id: \.self) { family in
                    Text(family).tag(family)
                }
            }

            HudSettingsSliderRow(
                title: "Font Size",
                value: "\(String(format: "%.1f", profile.terminalFontSize)) pt",
                icon: "textformat.size",
                iconColor: theme.palette.muted,
                number: $profile.terminalFontSize,
                in: 10...18,
                step: 0.5
            )

            HudDivider(color: theme.hairline.subtle)

            HudSettingsControlRow(
                title: "Grid",
                subtitle: "\(Int(profile.canvasGridStep)) pt",
                value: profile.canvasGridMode.label,
                icon: "grid",
                iconColor: theme.palette.muted
            ) {
                Picker("Grid", selection: $profile.canvasGridMode) {
                    ForEach(HudCanvasGridMode.allCases) { mode in
                        Text(mode.label).tag(mode)
                    }
                }
                .labelsHidden()
                .pickerStyle(.segmented)
                .frame(width: HudLayout.popoverWidthCompact / 2)
            }

            HudSettingsSliderRow(
                title: "Grid Spacing",
                value: "\(Int(profile.canvasGridStep)) pt",
                icon: "square.grid.3x3",
                iconColor: theme.palette.muted,
                number: $profile.canvasGridStep,
                in: 12...40,
                step: 2
            )

            HudSettingsSliderRow(
                title: "Focus Inset",
                value: "\(Int(profile.focusPadding)) pt",
                icon: "rectangle.inset.filled",
                iconColor: theme.palette.muted,
                number: $profile.focusPadding,
                in: 4...56,
                step: 2
            )
        }
    }

    private var presetBinding: Binding<String> {
        Binding(
            get: { profile.id },
            set: { id in
                if let preset = HudCanvasStyleProfile.preset(id: id) {
                    profile = preset
                }
            }
        )
    }
}

private struct CanvasTerminalOverrideControls: View {
    let title: String
    let subtitle: String
    @Binding var override: HudCanvasTerminalStyleOverride
    let baseProfile: HudCanvasStyleProfile
    let inheritedLabel: String
    let tint: Color

    @Environment(\.hudTheme) private var theme

    private let inheritedToken = "__inherit__"
    private let fontFamilies = ["SF Mono", "JetBrains Mono", "Menlo", "Monaco"]

    var body: some View {
        HudSettingsSection(title, labelTint: tint) {
            HudSettingsRow(
                icon: override.isEmpty ? "arrow.triangle.branch" : "paintbrush",
                iconColor: tint,
                title: override.isEmpty ? "Inherited" : "Override",
                subtitle: subtitle
            ) {
                HStack(spacing: HudSpacing.sm) {
                    HudBadge(override.isEmpty ? "INHERIT" : "OVERRIDE", tint: tint, dot: !override.isEmpty)
                    Button {
                        override = .empty
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .font(HudFont.ui(10, weight: .semibold))
                            .foregroundStyle(override.isEmpty ? theme.palette.dim : theme.palette.muted)
                            .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                    }
                    .buttonStyle(.plain)
                    .disabled(override.isEmpty)
                    .help("Reset style override")
                }
            }

            HudDivider(color: theme.hairline.subtle)

            HudSettingsPickerRow(
                title: "Theme",
                value: resolvedProfile.terminalThemeID.label,
                icon: "terminal",
                iconColor: tint,
                selection: themeBinding
            ) {
                Text(inheritedLabel).tag(inheritedToken)
                ForEach(HudCanvasTerminalThemeID.allCases) { terminalTheme in
                    Text(terminalTheme.label).tag(terminalTheme.rawValue)
                }
            }

            HudDivider(color: theme.hairline.subtle)

            HudSettingsPickerRow(
                title: "Font",
                value: resolvedProfile.terminalFontFamily,
                icon: "textformat",
                iconColor: tint,
                selection: fontBinding
            ) {
                Text(inheritedLabel).tag(inheritedToken)
                ForEach(fontFamilies, id: \.self) { family in
                    Text(family).tag(family)
                }
            }

            HudSettingsSliderRow(
                title: "Size",
                value: "\(String(format: "%.1f", resolvedProfile.terminalFontSize)) pt",
                icon: "textformat.size",
                iconColor: tint,
                number: fontSizeBinding,
                in: 10...18,
                step: 0.5
            )
        }
    }

    private var resolvedProfile: HudCanvasStyleProfile {
        baseProfile.applyingTerminalOverride(override)
    }

    private var themeBinding: Binding<String> {
        Binding(
            get: { override.terminalThemeID?.rawValue ?? inheritedToken },
            set: { rawValue in
                override.terminalThemeID = rawValue == inheritedToken
                    ? nil
                    : HudCanvasTerminalThemeID(rawValue: rawValue)
            }
        )
    }

    private var fontBinding: Binding<String> {
        Binding(
            get: { override.terminalFontFamily ?? inheritedToken },
            set: { value in
                override.terminalFontFamily = value == inheritedToken ? nil : value
            }
        )
    }

    private var fontSizeBinding: Binding<Double> {
        Binding(
            get: { override.terminalFontSize ?? baseProfile.terminalFontSize },
            set: { value in
                override.terminalFontSize = value
            }
        )
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
                HudStatusDot(color: theme.palette.muted, size: 8)
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
                HudBadge(node.runtimeIdentity.badge, tint: theme.palette.statusInfo, dot: true)
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

            if let liveSource = node.liveSource {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudSectionLabel("Live Source")
                    HudLiveIndicator(source: liveSource, displayMode: .expanded, chrome: .ghost)
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
                .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.canvasControlFill))
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
            Text("Select a node to inspect its canvas placement and runtime identity.")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct CanvasLensOverlay: View {
    @Binding var query: String
    @Binding var selectedIndex: Int
    let results: [CanvasLensResult]
    let onClose: () -> Void
    let onActivate: (CanvasLensResult) -> Void
    let onHoverResult: (CanvasLensResult) -> Void

    @FocusState private var searchFocused: Bool
    @Environment(\.hudTheme) private var theme

    var body: some View {
        ZStack(alignment: .top) {
            HudSurface.scrim.opacity(HudOpacity.emphatic)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(spacing: 0) {
                header
                HudDivider(color: theme.hairline.standard)
                resultList
            }
            .frame(width: HudCanvasMetrics.lensWidth)
            .background(RoundedRectangle(cornerRadius: theme.radius.card).fill(theme.palette.chrome))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.card).stroke(theme.hairline.standard))
            .shadow(color: theme.canvasShadow, radius: HudSpacing.huge, x: 0, y: HudSpacing.xxl)
            .padding(.top, HudCanvasMetrics.commandPaletteTopPadding)
        }
        .onAppear {
            searchFocused = true
            selectedIndex = min(max(selectedIndex, 0), max(results.count - 1, 0))
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "magnifyingglass")
                .font(HudFont.ui(13, weight: .semibold))
                .foregroundStyle(theme.palette.statusInfo)
                .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(HudSurface.tintFill(theme.palette.statusInfo)))
                .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(HudSurface.tintBorder(theme.palette.statusInfo)))

            TextField("Search titles, tags, files, diffs, terminal buffers", text: $query)
                .textFieldStyle(.plain)
                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
                .focused($searchFocused)
                .onSubmit {
                    activateSelectedResult()
                }

            CanvasShortcutHint("RETURN")
            CanvasShortcutHint("ESC")

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(HudFont.ui(10, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
                    .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
            }
            .buttonStyle(.plain)
            .help("Close Lens")
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.navHeight)
    }

    @ViewBuilder
    private var resultList: some View {
        if results.isEmpty {
            VStack(spacing: HudSpacing.md) {
                Image(systemName: query.isEmpty ? "rectangle.stack.badge.plus" : "magnifyingglass")
                    .font(HudFont.ui(18, weight: .semibold))
                    .foregroundStyle(theme.palette.dim)
                Text(query.isEmpty ? "Start typing to search the canvas" : "No matches")
                    .font(HudFont.mono(10, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
            }
            .frame(maxWidth: .infinity)
            .frame(height: HudLayout.rowHeightRegular * 3)
        } else {
            ScrollView {
                LazyVStack(spacing: HudSpacing.sm) {
                    ForEach(results.indices, id: \.self) { index in
                        let result = results[index]
                        CanvasLensResultRow(
                            result: result,
                            isSelected: index == clampedSelectedIndex,
                            action: { onActivate(result) }
                        )
                        .onHover { hovering in
                            if hovering {
                                onHoverResult(result)
                            }
                        }
                    }
                }
                .padding(HudSpacing.lg)
            }
            .frame(maxHeight: HudLayout.dialogWidth)
        }
    }

    private var clampedSelectedIndex: Int {
        guard !results.isEmpty else { return 0 }
        return min(max(selectedIndex, 0), results.count - 1)
    }

    private func activateSelectedResult() {
        guard !results.isEmpty else { return }
        onActivate(results[clampedSelectedIndex])
    }
}

private struct CanvasLensResultRow: View {
    let result: CanvasLensResult
    let isSelected: Bool
    let action: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: result.icon)
                    .font(HudFont.ui(12, weight: .semibold))
                    .foregroundStyle(result.tint.color)
                    .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                    .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(HudSurface.tintFill(result.tint.color)))
                    .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(HudSurface.tintBorder(result.tint.color)))

                VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                    HStack(spacing: HudSpacing.sm) {
                        Text(result.title)
                            .font(HudFont.mono(10, weight: .semibold))
                            .foregroundStyle(theme.palette.ink)
                            .lineLimit(1)
                        HudBadge(result.badge, tint: result.tint.color, dot: false)
                    }
                    Text(result.snippet.isEmpty ? result.detail : result.snippet)
                        .font(HudFont.mono(9))
                        .foregroundStyle(theme.palette.muted)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "viewfinder")
                    .font(HudFont.ui(10, weight: .semibold))
                    .foregroundStyle(isSelected ? result.tint.color : theme.palette.dim)
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(height: HudLayout.rowHeightRegular)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(isSelected ? HudSurface.selected(result.tint.color) : theme.canvasControlFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? HudSurface.tintBorder(result.tint.color) : theme.hairline.subtle)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct CanvasShortcutHint: View {
    let title: String
    @Environment(\.hudTheme) private var theme

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(HudFont.mono(8, weight: .bold))
            .foregroundStyle(theme.palette.dim)
            .padding(.horizontal, HudSpacing.sm)
            .frame(height: HudLayout.textDocumentModeButtonHeight)
            .background(RoundedRectangle(cornerRadius: theme.radius.tight).fill(theme.canvasControlFill))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.tight).stroke(theme.hairline.subtle))
    }
}

private struct CanvasCommandPalette: View {
    let selectedCount: Int
    let onOpenAppearance: () -> Void
    let onOpenLens: () -> Void
    let onLayoutByTag: () -> Void
    let onCreateTerminal: () -> Void
    let onFocusSelection: () -> Void
    let onPopOutSelection: () -> Void
    let onClose: () -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        ZStack(alignment: .top) {
            HudSurface.scrim.opacity(HudOpacity.emphatic)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(spacing: 0) {
                header
                HudDivider(color: theme.hairline.standard)
                VStack(spacing: HudSpacing.sm) {
                    CanvasCommandRow(
                        icon: "magnifyingglass",
                        title: "Canvas Lens",
                        detail: "Cmd+F or / · nodes, artifacts, visible terminals",
                        tint: theme.palette.statusInfo,
                        action: onOpenLens
                    )
                    CanvasCommandRow(
                        icon: "square.grid.2x2",
                        title: "Group By Tag",
                        detail: "G · focus, watch, parked, untagged",
                        tint: theme.palette.muted,
                        action: onLayoutByTag
                    )
                    CanvasCommandRow(
                        icon: "paintpalette",
                        title: "Appearance Settings",
                        detail: "Workspace, tag, terminal",
                        tint: theme.palette.statusInfo,
                        action: onOpenAppearance
                    )
                    CanvasCommandRow(
                        icon: "plus",
                        title: "New Terminal",
                        detail: "Create local PTY",
                        tint: theme.palette.muted,
                        action: onCreateTerminal
                    )
                    CanvasCommandRow(
                        icon: "rectangle.inset.filled",
                        title: "Focus Selection",
                        detail: "\(selectedCount) selected",
                        tint: theme.palette.statusInfo,
                        isDisabled: selectedCount != 1,
                        action: onFocusSelection
                    )
                    CanvasCommandRow(
                        icon: "rectangle.on.rectangle",
                        title: "Pop Out Selection",
                        detail: "\(selectedCount) selected",
                        tint: theme.palette.muted,
                        isDisabled: selectedCount == 0,
                        action: onPopOutSelection
                    )
                }
                .padding(HudSpacing.lg)
            }
            .frame(width: HudCanvasMetrics.commandPaletteWidth)
            .background(RoundedRectangle(cornerRadius: theme.radius.card).fill(theme.palette.chrome))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.card).stroke(theme.hairline.standard))
            .shadow(color: theme.canvasShadow, radius: 28, x: 0, y: 18)
            .padding(.top, HudCanvasMetrics.commandPaletteTopPadding)
        }
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "command")
                .font(HudFont.ui(13, weight: .semibold))
                .foregroundStyle(theme.palette.muted)
            Text("Command Palette")
                .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                .foregroundStyle(theme.palette.ink)
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(HudFont.ui(10, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
                    .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
            }
            .buttonStyle(.plain)
            .help("Close")
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.navHeight)
    }
}

private struct CanvasCommandRow: View {
    let icon: String
    let title: String
    let detail: String
    let tint: Color
    var isDisabled = false
    let action: () -> Void

    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: icon)
                    .font(HudFont.ui(12, weight: .semibold))
                    .foregroundStyle(isDisabled ? theme.palette.dim : tint)
                    .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                    .background(
                        RoundedRectangle(cornerRadius: theme.radius.standard)
                            .fill(isDisabled ? theme.canvasControlFill : HudSurface.tintFill(tint))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: theme.radius.standard)
                            .stroke(isDisabled ? theme.hairline.subtle : HudSurface.tintBorder(tint))
                    )

                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(HudFont.mono(10, weight: .semibold))
                        .foregroundStyle(isDisabled ? theme.palette.dim : theme.palette.ink)
                    Text(detail)
                        .font(HudFont.mono(9))
                        .foregroundStyle(theme.palette.dim)
                }
                Spacer()
                Image(systemName: "return")
                    .font(HudFont.ui(9, weight: .semibold))
                    .foregroundStyle(theme.palette.dim)
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(height: HudLayout.rowHeightRegular)
            .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.canvasControlFill))
            .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
    }
}

private struct CanvasFilterButton: View {
    let title: String
    let isActive: Bool
    let action: () -> Void
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(HudFont.mono(9, weight: .semibold))
                .foregroundStyle(isActive ? theme.palette.ink : theme.palette.muted)
                .padding(.horizontal, HudSpacing.md)
                .frame(height: HudCanvasMetrics.filterButtonHeight)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.tight)
                        .fill(isActive ? theme.canvasControlHoverFill : theme.canvasControlFill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.tight)
                        .stroke(isActive ? theme.hairline.standard : theme.hairline.subtle)
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
                width: HudCanvasMetrics.commandButtonWidth,
                height: HudLayout.rowHeightCompact
            )
            .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.canvasControlFill))
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
                    .fill(theme.canvasControlFill)
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
        .frame(height: HudCanvasMetrics.viewportChipHeight)
        .background(RoundedRectangle(cornerRadius: theme.radius.standard).fill(theme.canvasControlFill))
        .overlay(RoundedRectangle(cornerRadius: theme.radius.standard).stroke(theme.hairline.subtle))
    }
}

private struct CanvasFrameRateProbe: View {
    @ObservedObject var monitor: HudCanvasFrameRateMonitor
    let onSample: (HudCanvasFrameRateSample) -> Void

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: false)) { context in
            Color.clear
                .onAppear {
                    recordFrame(at: context.date)
                }
                .onChange(of: context.date) { _, date in
                    recordFrame(at: date)
                }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func recordFrame(at date: Date) {
        guard let sample = monitor.recordFrame(at: date) else {
            return
        }
        onSample(sample)
    }
}

private struct CanvasFrameRateHUD: View {
    let sample: HudCanvasFrameRateSample?
    let nodeCount: Int
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.md) {
            Circle()
                .fill(statusColor)
                .frame(width: HudDotSize.tiny, height: HudDotSize.tiny)

            Text(fpsText)
                .font(HudFont.mono(10, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(theme.palette.ink)

            Text("FPS")
                .font(HudFont.mono(9, weight: .semibold))
                .foregroundStyle(theme.palette.dim)

            Text("·")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.dim)

            Text(frameDurationText)
                .font(HudFont.mono(10, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(theme.palette.muted)

            Text("·")
                .font(HudFont.mono(10))
                .foregroundStyle(theme.palette.dim)

            Text("\(nodeCount) nodes")
                .font(HudFont.mono(9, weight: .semibold))
                .foregroundStyle(theme.palette.dim)
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.rowHeightCompact)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .fill(theme.palette.chrome.opacity(HudOpacity.emphatic))
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.standard)
                .stroke(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
        )
        .shadow(
            color: theme.canvasShadow,
            radius: HudSpacing.xl,
            x: 0,
            y: HudSpacing.sm
        )
        .help("Canvas frame rate, average frame time, and current node count")
    }

    private var fpsText: String {
        guard let sample else {
            return "--"
        }
        return "\(sample.roundedFramesPerSecond)"
    }

    private var frameDurationText: String {
        guard let sample else {
            return "sampling"
        }
        return "\(String(format: "%.1f", sample.averageFrameDurationMS))ms"
    }

    private var statusColor: Color {
        guard let sample else {
            return theme.palette.dim
        }
        if sample.framesPerSecond >= 50 {
            return theme.palette.statusOk
        }
        if sample.framesPerSecond >= 30 {
            return theme.palette.statusWarn
        }
        return theme.palette.statusError
    }
}

private enum CanvasCursor: Equatable {
    case arrow
    case openHand
    case closedHand

    var nsCursor: NSCursor {
        switch self {
        case .arrow: return .arrow
        case .openHand: return .openHand
        case .closedHand: return .closedHand
        }
    }
}

private enum CanvasKeyboardShortcut {
    case openLens
    case lensNext
    case lensPrevious
    case lensActivate
    case escape
    case pan(CGSize)
    case resetViewport
    case fitViewport
    case layoutByTag
    case spotlight(CanvasSpotlightKind)
}

private struct CanvasInputBridge: NSViewRepresentable {
    let onScroll: (CGSize, CGPoint) -> Void
    let onMagnify: (CGFloat, CGPoint) -> Void
    let canBeginSpacePan: (CGPoint) -> Bool
    let onSpacePanChanged: (Bool) -> Void
    let onCommandPalette: () -> Void
    let onShortcut: (CanvasKeyboardShortcut) -> Void
    let onCursorMoved: (CGPoint?) -> Void
    let isLensPresented: Bool
    let allowsCanvasScrollInput: Bool
    let cursor: CanvasCursor

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onScroll: onScroll,
            onMagnify: onMagnify,
            onCursorMoved: onCursorMoved,
            canBeginSpacePan: canBeginSpacePan,
            onSpacePanChanged: onSpacePanChanged,
            onCommandPalette: onCommandPalette,
            onShortcut: onShortcut
        )
    }

    func makeNSView(context: Context) -> EventView {
        let view = EventView()
        view.coordinator = context.coordinator
        view.cursor = cursor.nsCursor
        context.coordinator.allowsCanvasScrollInput = allowsCanvasScrollInput
        context.coordinator.view = view
        context.coordinator.installMonitor()
        return view
    }

    func updateNSView(_ nsView: EventView, context: Context) {
        context.coordinator.onScroll = onScroll
        context.coordinator.onMagnify = onMagnify
        context.coordinator.onCursorMoved = onCursorMoved
        context.coordinator.canBeginSpacePan = canBeginSpacePan
        context.coordinator.onSpacePanChanged = onSpacePanChanged
        context.coordinator.onCommandPalette = onCommandPalette
        context.coordinator.onShortcut = onShortcut
        context.coordinator.isLensPresented = isLensPresented
        context.coordinator.allowsCanvasScrollInput = allowsCanvasScrollInput
        context.coordinator.view = nsView
        nsView.cursor = cursor.nsCursor
    }

    static func dismantleNSView(_ nsView: EventView, coordinator: Coordinator) {
        coordinator.removeMonitor()
    }

    final class EventView: NSView {
        weak var coordinator: Coordinator?
        var cursor = NSCursor.arrow {
            didSet {
                guard cursor != oldValue else { return }
                discardCursorRects()
                window?.invalidateCursorRects(for: self)
                setCursorIfPointerIsInside()
            }
        }

        override func hitTest(_ point: NSPoint) -> NSView? {
            nil
        }

        override func resetCursorRects() {
            addCursorRect(bounds, cursor: cursor)
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            window?.acceptsMouseMovedEvents = true
            setCursorIfPointerIsInside()
        }

        func setCursorIfPointerIsInside() {
            guard let window else { return }
            let local = convert(window.mouseLocationOutsideOfEventStream, from: nil)
            guard bounds.contains(local) else { return }
            cursor.set()
        }
    }

    final class Coordinator {
        var onScroll: (CGSize, CGPoint) -> Void
        var onMagnify: (CGFloat, CGPoint) -> Void
        var onCursorMoved: (CGPoint?) -> Void
        var canBeginSpacePan: (CGPoint) -> Bool
        var onSpacePanChanged: (Bool) -> Void
        var onCommandPalette: () -> Void
        var onShortcut: (CanvasKeyboardShortcut) -> Void
        var isLensPresented = false
        var allowsCanvasScrollInput = true
        weak var view: EventView?
        private var monitor: Any?
        private var spacePanActive = false
        private var scrollAnchor: CGPoint?

        init(
            onScroll: @escaping (CGSize, CGPoint) -> Void,
            onMagnify: @escaping (CGFloat, CGPoint) -> Void,
            onCursorMoved: @escaping (CGPoint?) -> Void,
            canBeginSpacePan: @escaping (CGPoint) -> Bool,
            onSpacePanChanged: @escaping (Bool) -> Void,
            onCommandPalette: @escaping () -> Void,
            onShortcut: @escaping (CanvasKeyboardShortcut) -> Void
        ) {
            self.onScroll = onScroll
            self.onMagnify = onMagnify
            self.onCursorMoved = onCursorMoved
            self.canBeginSpacePan = canBeginSpacePan
            self.onSpacePanChanged = onSpacePanChanged
            self.onCommandPalette = onCommandPalette
            self.onShortcut = onShortcut
        }

        func installMonitor() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(
                matching: [.scrollWheel, .magnify, .keyDown, .keyUp, .mouseMoved, .leftMouseDragged]
            ) { [weak self] event in
                guard let self,
                      let view,
                      view.window === event.window
                else {
                    self?.setSpacePanActive(false)
                    return event
                }

                // Track cursor on every relevant event so SwiftUI gesture can use
                // an authoritative anchor at gesture start.
                self.onCursorMoved(self.viewportLocation(for: event))

                switch event.type {
                case .mouseMoved, .leftMouseDragged:
                    return event
                case .scrollWheel:
                    guard self.allowsCanvasScrollInput else {
                        self.scrollAnchor = nil
                        return event
                    }
                    guard let location = self.viewportLocation(for: event) else { return event }
                    let phase = event.phase
                    let momentum = event.momentumPhase
                    let isTrackpadGesture = !phase.isEmpty || !momentum.isEmpty
                    let delta = CGSize(
                        width: event.scrollingDeltaX,
                        height: event.scrollingDeltaY
                    )

                    if !isTrackpadGesture {
                        // Discrete event (mouse wheel): each click anchors fresh.
                        self.scrollAnchor = nil
                        self.onScroll(delta, location)
                        return nil
                    }

                    // Trackpad scroll: lock anchor at gesture start, hold through
                    // momentum so cursor drift between events can't move the pivot.
                    if phase.contains(.began) {
                        self.scrollAnchor = location
                    }
                    let anchor = self.scrollAnchor ?? location
                    self.onScroll(delta, anchor)
                    if phase.contains(.cancelled) || momentum.contains(.ended) {
                        self.scrollAnchor = nil
                    }
                    return nil
                case .magnify:
                    // Pinch-zoom is handled by the SwiftUI MagnificationGesture
                    // attached to the canvas (cursor-anchored, locked at gesture
                    // start). Pass the event through (don't consume) so SwiftUI's
                    // gesture system can pick it up.
                    return event
                case .keyDown:
                    if self.isLensPresented {
                        if let shortcut = self.lensShortcut(for: event) {
                            self.onShortcut(shortcut)
                            return nil
                        }
                        return event
                    }

                    if event.modifierFlags.contains(.command),
                       event.charactersIgnoringModifiers?.lowercased() == "k" {
                        self.onCommandPalette()
                        return nil
                    }

                    if event.modifierFlags.contains(.command),
                       event.charactersIgnoringModifiers?.lowercased() == "f" {
                        self.onShortcut(.openLens)
                        return nil
                    }

                    if let shortcut = self.canvasShortcut(for: event) {
                        self.onShortcut(shortcut)
                        return nil
                    }

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

        private func lensShortcut(for event: NSEvent) -> CanvasKeyboardShortcut? {
            switch event.keyCode {
            case 36:
                return .lensActivate
            case 53:
                return .escape
            case 125:
                return .lensNext
            case 126:
                return .lensPrevious
            default:
                return nil
            }
        }

        private func canvasShortcut(for event: NSEvent) -> CanvasKeyboardShortcut? {
            guard event.modifierFlags.intersection([.command, .control, .option]).isEmpty else {
                return nil
            }
            guard let location = pointerLocationInViewport(),
                  canBeginSpacePan(location)
            else {
                return nil
            }

            let multiplier: CGFloat = event.modifierFlags.contains(.shift) ? 2.5 : 1
            let step = HudLayout.rowHeightRegular * 3 * multiplier
            let token = event.charactersIgnoringModifiers?.lowercased()

            switch token {
            case "/":
                return .openLens
            case "h":
                return .pan(CGSize(width: step, height: 0))
            case "j":
                return .pan(CGSize(width: 0, height: -step))
            case "k":
                return .pan(CGSize(width: 0, height: step))
            case "l":
                return .pan(CGSize(width: -step, height: 0))
            case "0":
                return .resetViewport
            case "1":
                return .fitViewport
            case "g":
                return .layoutByTag
            case "a":
                return .spotlight(.agents)
            case "c":
                return .spotlight(.code)
            case "p":
                return .spotlight(.plans)
            case "d":
                return .spotlight(.diffs)
            default:
                if event.keyCode == 53 {
                    return .escape
                }
                return nil
            }
        }

        private func setSpacePanActive(_ isActive: Bool) {
            guard spacePanActive != isActive else { return }
            spacePanActive = isActive
            onSpacePanChanged(isActive)
            view?.setCursorIfPointerIsInside()
        }

        deinit {
            removeMonitor()
        }
    }
}

private struct CanvasActionToolbar: View {
    let tool: CanvasTool
    let onSelect: () -> Void
    let onHand: () -> Void
    let onCommandPalette: () -> Void
    let onFocus: () -> Void
    let onPopOut: () -> Void
    let onNew: () -> Void
    var focusDisabled = false
    var popOutDisabled = false

    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            CanvasToolSwitch(
                tool: tool,
                onSelect: onSelect,
                onHand: onHand
            )

            CanvasToolbarDivider()

            CommandKeyButton(action: onCommandPalette)

            CanvasToolbarDivider()

            CanvasToolbarIconButton(
                systemName: "rectangle.inset.filled",
                help: "Focus selection",
                isDisabled: focusDisabled,
                action: onFocus
            )

            CanvasToolbarIconButton(
                systemName: "rectangle.on.rectangle",
                help: "Pop out selection",
                isDisabled: popOutDisabled,
                action: onPopOut
            )

            CanvasToolbarIconButton(
                systemName: "plus",
                help: "New terminal",
                isDisabled: false,
                action: onNew
            )
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .fill(theme.palette.bg.opacity(HudOpacity.emphatic))
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .stroke(theme.hairline.standard)
        )
        .shadow(
            color: theme.canvasShadow,
            radius: HudCanvasMetrics.zoomControlShadowRadius,
            x: .zero,
            y: HudSpacing.md
        )
    }
}

private struct CanvasToolbarDivider: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.hairline.subtle)
            .frame(width: HudStrokeWidth.standard, height: HudLayout.rowHeightCompact - HudSpacing.sm)
    }
}

private struct CanvasToolbarIconButton: View {
    let systemName: String
    let help: String
    var isDisabled = false
    let action: () -> Void

    @State private var isHovering = false
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(isDisabled ? theme.palette.dim : theme.palette.muted)
                .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .fill(isHovering && !isDisabled ? theme.canvasControlHoverFill : theme.canvasControlFill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .stroke(theme.hairline.subtle)
                )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .help(help)
        .accessibilityLabel(help)
        .onHover { isHovering = $0 }
    }
}

private struct CanvasToolSwitch: View {
    let tool: CanvasTool
    let onSelect: () -> Void
    let onHand: () -> Void

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            CanvasIconButton(
                systemName: tool == .select ? "cursorarrow.rays" : "cursorarrow",
                help: "Select terminals",
                isActive: tool == .select,
                action: onSelect
            )
            CanvasIconButton(
                systemName: tool == .hand ? "hand.raised.fill" : "hand.raised",
                help: tool == .hand ? "Hand mode active" : "Pan canvas",
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
                .frame(width: HudCanvasMetrics.zoomLabelWidth)

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
                .fill(theme.palette.bg.opacity(HudOpacity.emphatic))
        )
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .stroke(theme.hairline.standard)
        )
        .shadow(
            color: theme.canvasShadow,
            radius: HudCanvasMetrics.zoomControlShadowRadius,
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
        return isHovering ? theme.canvasControlHoverFill : theme.canvasControlFill
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
    let appearance: HudTerminalAppearance

    static func == (lhs: TerminalSurfaceContainer, rhs: TerminalSurfaceContainer) -> Bool {
        lhs.controller === rhs.controller
            && lhs.appearance == rhs.appearance
    }

    var body: some View {
        HudTerminalSurface(
            controller: controller,
            showsSystemKeyboard: true,
            appearance: appearance
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
                    .fill(isSelected ? HudSurface.selected(node.tint.color) : theme.canvasControlFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? HudSurface.tintStrong(node.tint.color) : theme.hairline.subtle)
            )
        }
        .buttonStyle(.plain)
    }
}
