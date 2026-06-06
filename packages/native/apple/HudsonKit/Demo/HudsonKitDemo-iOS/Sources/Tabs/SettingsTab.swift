import SwiftUI
import HudsonBridge
import HudsonUI

private enum SettingsInspectorTab: String, CaseIterable, Identifiable {
    case workspace
    case canvas
    case agent
    case voice
    case links
    case shell
    case about

    var id: String { rawValue }

    var label: String {
        switch self {
        case .workspace: return "WORKSPACE"
        case .canvas: return "CANVAS"
        case .agent: return "AGENT"
        case .voice: return "VOICE"
        case .links: return "LINKS"
        case .shell: return "SHELL"
        case .about: return "ABOUT"
        }
    }
}

struct SettingsTab: View {
    let lastDeepLink: HudDeepLink?
    let deepLinkError: String?

    @State private var selectedTab: SettingsInspectorTab.ID = SettingsInspectorTab.workspace.id
    @State private var startupSurface = "canvas"
    @State private var layoutDensity = "compact"
    @State private var defaultNodeKind = "terminal"
    @State private var agentRuntime = "local"
    @State private var transcriptionEngine = "auto"
    @State private var voiceOutput = "device"
    @State private var chromeStyle = "tray"
    @State private var onboardingMode = "guided"
    @State private var snapToGrid = true
    @State private var showMinimap = true
    @State private var preserveSessions = true
    @State private var useLiveTranscription = true
    @State private var enableTerminal = true
    @State private var enableWebSurface = true
    @State private var enableOnboarding = true

    private let tabs = SettingsInspectorTab.allCases.map {
        HudInspectorTab(id: $0.id, label: $0.label.capitalized)
    }

    init(lastDeepLink: HudDeepLink? = nil, deepLinkError: String? = nil) {
        self.lastDeepLink = lastDeepLink
        self.deepLinkError = deepLinkError
    }

    var body: some View {
        HudInspectorSettings(
            title: "Hudson · Settings",
            subtitle: "iOS app shell",
            tabs: tabs,
            selection: $selectedTab
        ) { tabID in
            switch SettingsInspectorTab(rawValue: tabID) ?? .workspace {
            case .workspace: workspacePanel
            case .canvas: canvasPanel
            case .agent: agentPanel
            case .voice: voicePanel
            case .links: linksPanel
            case .shell: shellPanel
            case .about: aboutPanel
            }
        }
        .onAppear(perform: selectDeepLinkTabIfNeeded)
        .onChange(of: lastDeepLink) { _, _ in
            selectDeepLinkTabIfNeeded()
        }
    }

    private var workspacePanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Identity") {
                HudInspectorFieldRow("Workspace", value: "Hudson Mobile", hint: "dogfood app")
                HudInspectorFieldRow("Profile", value: "Local Dev", hint: "editable shell")
                HudInspectorFieldRow("Sync", value: "Snapshot", hint: "device first")
            }

            HudInspectorSection("Runtime") {
                HudInspectorMetricStrip([
                    .init("Nodes", value: "6"),
                    .init("Live", value: "3"),
                    .init("Loop", value: "Fast")
                ])
                HudInspectorCycleRow(
                    "Startup surface",
                    selection: $startupSurface,
                    choices: [
                        .init(id: "canvas", title: "Canvas"),
                        .init(id: "terminal", title: "Terminal"),
                        .init(id: "agent", title: "Agent")
                    ],
                    hint: "first view after launch"
                )
                HudInspectorCycleRow(
                    "Layout density",
                    selection: $layoutDensity,
                    choices: [
                        .init(id: "compact", title: "Compact"),
                        .init(id: "regular", title: "Regular"),
                        .init(id: "roomy", title: "Roomy")
                    ],
                    hint: "row rhythm"
                )
            }

            HudInspectorSection("Actions") {
                HudInspectorActionRow("Rebuild preview manifest", value: "Run", tone: .accent)
                HudInspectorActionRow("Clear local workspace cache", value: "Reset", tone: .warn)
            }
        }
    }

    private var canvasPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Surface") {
                HudInspectorFieldRow("Renderer", value: "Native", hint: "SwiftUI + Metal-ready")
                HudInspectorFieldRow("Terminal nodes", value: "Termini", hint: "session backed")
                HudInspectorFieldRow("Code nodes", value: "WebView", hint: "CodeMirror bridge")
            }

            HudInspectorSection("Behavior") {
                HudInspectorToggleRow("Snap to grid", isOn: $snapToGrid, valueOn: "On", valueOff: "Off", hint: "drag alignment")
                HudInspectorToggleRow("Minimap", isOn: $showMinimap, valueOn: "Shown", valueOff: "Hidden", hint: "canvas overview")
                HudInspectorCycleRow(
                    "Default node",
                    selection: $defaultNodeKind,
                    choices: [
                        .init(id: "terminal", title: "Terminal"),
                        .init(id: "code", title: "Code"),
                        .init(id: "note", title: "Note")
                    ],
                    hint: "new item"
                )
            }

            HudInspectorSection("State") {
                HudInspectorMetricStrip([
                    .init("Zoom", value: "84%"),
                    .init("Pan", value: "Live"),
                    .init("Tabs", value: "4")
                ])
            }
        }
    }

    private var agentPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Capabilities") {
                HudInspectorFieldRow("Agent home", value: "Ready", hint: "workspace context")
                HudInspectorFieldRow("Tool bridge", value: "Local", hint: "device shell")
                HudInspectorFieldRow(
                    "Onboarding",
                    value: enableOnboarding ? "Built in" : "Off",
                    hint: "configure per app",
                    inlineAction: HudInspectorInlineAction("Preview") {}
                )
            }

            HudInspectorSection("Defaults") {
                HudInspectorCycleRow(
                    "Runtime",
                    selection: $agentRuntime,
                    choices: [
                        .init(id: "local", title: "Local"),
                        .init(id: "bridge", title: "Mac Bridge"),
                        .init(id: "cloud", title: "Cloud")
                    ],
                    hint: "where work runs"
                )
                HudInspectorToggleRow("Preserve sessions", isOn: $preserveSessions, valueOn: "Yes", valueOff: "No", hint: "resume agents")
                HudInspectorToggleRow("Onboarding tool", isOn: $enableOnboarding, valueOn: "Ready", valueOff: "Off", hint: "setup flow")
            }

            HudInspectorSection("Readiness") {
                HudInspectorMetricStrip([
                    .init("Bridge", value: "Optional"),
                    .init("Tools", value: "4"),
                    .init("Auth", value: "Local")
                ])
            }
        }
    }

    private var voicePanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Transcription") {
                HudInspectorCycleRow(
                    "Engine",
                    selection: $transcriptionEngine,
                    choices: [
                        .init(id: "auto", title: "Auto"),
                        .init(id: "apple", title: "Apple Speech"),
                        .init(id: "local", title: "Local Model")
                    ],
                    hint: "dictation source"
                )
                HudInspectorToggleRow("Live transcription", isOn: $useLiveTranscription, valueOn: "On", valueOff: "Off", hint: "stream results")
                HudInspectorFieldRow("Vocabulary", value: "Project", hint: "context words")
            }

            HudInspectorSection("Output") {
                HudInspectorCycleRow(
                    "Speak replies",
                    selection: $voiceOutput,
                    choices: [
                        .init(id: "device", title: "iPhone"),
                        .init(id: "bridge", title: "Mac"),
                        .init(id: "silent", title: "Silent")
                    ],
                    hint: "agent responses"
                )
                HudInspectorFieldRow("Wake surface", value: "Command", hint: "mic affordance")
            }
        }
    }

    private var linksPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Last Opened") {
                HudInspectorFieldRow("Status", value: deepLinkStatus, hint: "router")
                HudInspectorFieldRow("Route", value: lastDeepLink?.route.title ?? "None", hint: lastDeepLink?.route.detail ?? "waiting")
                HudInspectorFieldRow("Source", value: lastDeepLink?.callback?.source ?? "Direct", hint: callbackHint)
                if let pairingCandidate {
                    HudInspectorFieldRow("Pair host", value: pairingCandidate.name, hint: pairingCandidate.primaryEndpoint?.kind.rawValue ?? "manual")
                }
            }

            HudInspectorSection("Core Routes") {
                HudInspectorFieldRow("Settings", value: "hudson://settings", hint: "section")
                HudInspectorFieldRow("Workspace", value: "hudson://workspace/local", hint: "canvas")
                HudInspectorFieldRow("Pairing", value: "hudson://pair?hostId=mac", hint: "QR payload")
                HudInspectorFieldRow("Capture", value: "hudson://capture?mode=ocr", hint: "OCR")
                HudInspectorFieldRow("Terminal", value: "hudson://terminal", hint: "session")
            }

            HudInspectorSection("Pairing Foundation") {
                HudInspectorFieldRow("Payload parser", value: "Ready", hint: pairingFoundationHint)
                HudInspectorFieldRow("Endpoint routes", value: "LAN + Tailnet", hint: "typed candidates")
                HudInspectorFieldRow("Trust store", value: "Memory", hint: "vault-ready protocol")
            }

            HudInspectorSection("iOS Core Order") {
                HudInspectorFieldRow("Deep links", value: "Ready", hint: "typed route spine")
                HudInspectorFieldRow("Pairing", value: "Ready", hint: "payload + trust")
                HudInspectorFieldRow("Mini keyboard", value: "Ready", hint: "phone shortcuts")
                HudInspectorFieldRow("Onboarding", value: "Built in", hint: "guided setup")
                HudInspectorFieldRow("Capture OCR", value: "Built in", hint: "Vision wrapper")
                HudInspectorFieldRow("Audio recording", value: "Built in", hint: "session + waveform")
                HudInspectorFieldRow("Web view", value: "Built in", hint: "WKWebView surface")
            }
        }
    }

    private var deepLinkStatus: String {
        if deepLinkError != nil { return "Error" }
        if lastDeepLink != nil { return "Received" }
        return "Idle"
    }

    private var callbackHint: String {
        if let deepLinkError { return deepLinkError }
        if lastDeepLink?.callback != nil { return "x-callback-url" }
        return "onOpenURL"
    }

    private var pairingCandidate: HudPairingCandidate? {
        guard let lastDeepLink else { return nil }
        return try? HudPairingCandidate.from(lastDeepLink)
    }

    private var pairingFoundationHint: String {
        guard let pairingCandidate else { return "deep link + QR" }
        return pairingCandidate.primaryEndpoint?.kind.rawValue ?? pairingCandidate.name
    }

    private func selectDeepLinkTabIfNeeded() {
        guard let route = lastDeepLink?.route else { return }

        switch route {
        case .settings(let section):
            selectedTab = section.flatMap { SettingsInspectorTab(rawValue: $0)?.id }
                ?? SettingsInspectorTab.links.id
        case .pair, .capture, .terminal, .web, .keyboard, .onboarding, .unknown:
            selectedTab = SettingsInspectorTab.links.id
        case .home, .workspace, .node:
            break
        }
    }

    private var shellPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Chrome") {
                HudInspectorCycleRow(
                    "Complications",
                    selection: $chromeStyle,
                    choices: [
                        .init(id: "tray", title: "Tray"),
                        .init(id: "scattered", title: "Scattered"),
                        .init(id: "minimal", title: "Minimal")
                    ],
                    hint: "corner controls"
                )
                HudInspectorFieldRow("Settings style", value: "Inspector", hint: "dense sections")
                HudInspectorCycleRow(
                    "Onboarding",
                    selection: $onboardingMode,
                    choices: [
                        .init(id: "guided", title: "Guided"),
                        .init(id: "checklist", title: "Checklist"),
                        .init(id: "hidden", title: "Hidden")
                    ],
                    hint: "first-run shell"
                )
            }

            HudInspectorSection("Embedded Surfaces") {
                HudInspectorToggleRow("Terminal", isOn: $enableTerminal, valueOn: "Built in", valueOff: "Off", hint: "Termini/Ghostty")
                HudInspectorToggleRow("Web view", isOn: $enableWebSurface, valueOn: "Built in", valueOff: "Off", hint: "WKWebView")
                HudInspectorFieldRow("Code editor", value: "CodeMirror", hint: "web-backed node")
            }

            HudInspectorSection("Navigation") {
                HudInspectorNavRow("Open page switcher")
                HudInspectorNavRow("Open shell diagnostics")
                HudInspectorNavRow("Open deep link routes")
            }
        }
    }

    private var aboutPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HudInspectorSection("Package") {
                HudInspectorFieldRow("Module", value: "HudsonKit", hint: "native/apple")
                HudInspectorFieldRow("Demo", value: "iOS", hint: "dogfood shell")
                HudInspectorFieldRow("Settings", value: "Inspector", hint: "Talkie-inspired")
            }

            HudInspectorSection("Principles") {
                HudInspectorFieldRow("Rows", value: "44pt", hint: "fixed rhythm")
                HudInspectorFieldRow("Sections", value: "Flat", hint: "no nested cards")
                HudInspectorFieldRow("Actions", value: "Inline", hint: "state-adjacent")
            }

            HudInspectorSection("Validation") {
                HudInspectorActionRow("Run UI smoke pass", value: "Run", tone: .accent)
                HudInspectorActionRow("Reset demo preferences", value: "Reset", tone: .warn)
            }
        }
    }
}
