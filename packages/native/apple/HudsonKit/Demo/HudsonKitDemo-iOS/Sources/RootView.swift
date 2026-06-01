import SwiftUI
import HudsonUI
import HudsonShell

enum DemoPage: String, CaseIterable, Identifiable {
    case shell
    case complications
    case primitives
    case hudAI
    case web
    case vox
    case settings
    case logs
    case terminal
    case about

    var id: String { rawValue }

    var title: String {
        switch self {
        case .shell:         return "Shell"
        case .complications: return "Complications"
        case .primitives:    return "Primitives"
        case .hudAI:         return "HudAI"
        case .web:           return "Web"
        case .vox:           return "Vox"
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
        case .vox:           return "waveform"
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
            TabView(selection: $page) {
                ForEach(DemoPage.allCases) { p in
                    content(for: p)
                        .tag(p)
                        .tabItem {
                            Label(p.title, systemImage: p.icon)
                        }
                }
            }
                .navigationTitle(navigationTitle)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { navigationToolbar }
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
        case .vox:           VoxTab()
        case .settings:      SettingsTab()
        case .logs:          LogsTab()
        case .terminal:      TerminalTab()
        case .about:         AboutTab()
        }
    }
}
