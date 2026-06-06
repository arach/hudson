import SwiftUI
import HudsonBridge
import HudsonUI
import HudsonShell

enum DemoPage: String, CaseIterable, Identifiable {
    case shell
    case complications
    case primitives
    case hudAI
    case web
    case terminal
    case capture
    case vox
    case audio
    case onboarding
    case keyboard
    case settings
    case logs
    case about

    var id: String { rawValue }

    static let primaryTabs: [DemoPage] = [.shell, .primitives, .hudAI, .logs, .settings]

    var isPrimaryTab: Bool {
        DemoPage.primaryTabs.contains(self)
    }

    var title: String {
        switch self {
        case .shell:         return "Shell"
        case .complications: return "Complications"
        case .primitives:    return "Primitives"
        case .hudAI:         return "HudAI"
        case .web:           return "Web"
        case .capture:       return "Capture"
        case .vox:           return "Vox"
        case .audio:         return "Audio"
        case .onboarding:    return "Onboarding"
        case .keyboard:      return "Keyboard"
        case .settings:      return "Settings"
        case .logs:          return "Logs"
        case .terminal:      return "Terminal"
        case .about:         return "About"
        }
    }

    var icon: String {
        switch self {
        case .shell:         return "rectangle.3.group"
        case .complications: return "circle.grid.2x2"
        case .primitives:    return "square.stack.3d.up"
        case .hudAI:         return "sparkles"
        case .web:           return "safari"
        case .capture:       return "text.viewfinder"
        case .vox:           return "waveform"
        case .audio:         return "mic.circle"
        case .onboarding:    return "sparkles.rectangle.stack"
        case .keyboard:      return "keyboard"
        case .settings:      return "gearshape"
        case .logs:          return "list.bullet.rectangle"
        case .terminal:      return "terminal"
        case .about:         return "info.circle"
        }
    }
}

struct RootView: View {
    @State private var page: DemoPage
    @State private var customComplications: HudPhoneComplications? = nil
    @State private var customStyle: HudPhoneComplicationsStyle = .tray
    @State private var lastDeepLink: HudDeepLink? = nil
    @State private var deepLinkError: String? = nil

    init() {
        let args = ProcessInfo.processInfo.arguments
        if let idx = args.firstIndex(of: "--page"), idx + 1 < args.count,
           let page = DemoPage(rawValue: args[idx + 1]) {
            self._page = State(initialValue: page)
        } else {
            self._page = State(initialValue: .shell)
        }
    }

    var body: some View {
        HudPhoneAppShell(complicationsStyle: customStyle) {
            rootContent
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { navigationToolbar }
        }
        .onOpenURL(perform: handleDeepLink)
    }

    @ViewBuilder
    private var rootContent: some View {
        if page.isPrimaryTab {
            TabView(selection: $page) {
                ForEach(DemoPage.primaryTabs) { p in
                    content(for: p)
                        .tag(p)
                        .tabItem {
                            Label(p.title, systemImage: p.icon)
                        }
                }
            }
        } else {
            content(for: page)
                .toolbar(.hidden, for: .tabBar)
        }
    }

    private var navigationTitle: String {
        page == .settings ? "" : page.title
    }

    @ToolbarContentBuilder
    private var navigationToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Menu {
                ForEach(DemoPage.allCases) { p in
                    Button {
                        page = p
                    } label: {
                        Label(p.title, systemImage: p.icon)
                    }
                }
            } label: {
                Image(systemName: "square.grid.2x2")
            }
            .accessibilityLabel("Switch demo page")
        }

        ToolbarItem(placement: .topBarTrailing) {
            Button {
                page = .settings
            } label: {
                Image(systemName: "gearshape")
            }
            .accessibilityLabel("Settings")
        }
    }

    @ViewBuilder
    private func content(for page: DemoPage) -> some View {
        switch page {
        case .shell:         ShellTab()
        case .complications:
            ComplicationsTab(custom: $customComplications, style: $customStyle)
                .hudComplications(customComplications ?? .empty)
                .toolbar(.hidden, for: .tabBar)
        case .primitives:    PrimitivesTab()
        case .hudAI:         HudAITab()
        case .web:           WebTab()
        case .capture:       CaptureTab()
        case .vox:           VoxTab()
        case .audio:         AudioTab()
        case .onboarding:    OnboardingTab()
        case .keyboard:      KeyboardTab()
        case .settings:      SettingsTab(lastDeepLink: lastDeepLink, deepLinkError: deepLinkError)
        case .logs:          LogsTab()
        case .terminal:      TerminalTab()
        case .about:         AboutTab()
        }
    }

    private func handleDeepLink(_ url: URL) {
        do {
            let link = try HudDeepLink.parse(url)
            lastDeepLink = link
            deepLinkError = nil

            withAnimation(.easeOut(duration: 0.18)) {
                page = destination(for: link.route)
            }
        } catch {
            lastDeepLink = nil
            deepLinkError = error.localizedDescription
            withAnimation(.easeOut(duration: 0.18)) {
                page = .settings
            }
        }
    }

    private func destination(for route: HudDeepLinkRoute) -> DemoPage {
        switch route {
        case .home, .workspace, .node:
            return .shell
        case .keyboard:
            return .keyboard
        case .settings, .pair:
            return .settings
        case .onboarding:
            return .onboarding
        case .terminal:
            return .terminal
        case .capture:
            return .capture
        case .web:
            return .web
        case .unknown:
            return .settings
        }
    }
}
