import SwiftUI
import HudsonUI
import HudsonShell

enum DemoPage: String, CaseIterable, Identifiable {
    case shell
    case complications
    case primitives
    case hudAI
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
    @State private var showingNavSheet = false

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
            content
                .navigationTitle(page.title)
                .navigationBarTitleDisplayMode(.inline)
                .hudComplications(activeComplications)
        }
        .sheet(isPresented: $showingNavSheet) { navSheet }
    }

    private var navSheet: some View {
        NavigationStack {
            List(DemoPage.allCases) { p in
                Button {
                    page = p
                    showingNavSheet = false
                } label: {
                    Label(p.title, systemImage: p.icon)
                        .foregroundStyle(.primary)
                }
            }
            .navigationTitle("Pages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showingNavSheet = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder
    private var content: some View {
        switch page {
        case .shell:         ShellTab()
        case .complications: ComplicationsTab(custom: $customComplications, style: $customStyle)
        case .primitives:    PrimitivesTab()
        case .hudAI:         HudAITab()
        case .vox:           VoxTab()
        case .settings:      SettingsTab()
        case .logs:          LogsTab()
        case .terminal:      TerminalTab()
        case .about:         AboutTab()
        }
    }

    private var activeComplications: HudPhoneComplications {
        if let customComplications, page == .complications {
            return customComplications
        }
        return defaultNavComplications
    }

    private var defaultNavComplications: HudPhoneComplications {
        .init(
            topLeft: .init(icon: "list.bullet", action: { page = .logs }),
            topRight: .init(icon: "ellipsis.circle", action: { showingNavSheet = true }),
            bottomLeft: .init(icon: "gearshape", action: { page = .settings }),
            bottomRight: .init(icon: "rectangle.3.group", action: { page = .shell }),
            center: .init(
                icon: "circle.grid.2x2",
                role: .accent,
                longPressModes: rendererStyleModes,
                action: { page = .complications }
            )
        )
    }

    /// Long-press modes on the center complication cycle the renderer style —
    /// a real "alternative action for this slot" semantic, not a navigation
    /// menu in disguise. Tap → go to the Complications page; long-press →
    /// pick how the chrome itself renders.
    private var rendererStyleModes: [HudPhoneComplications.Mode] {
        [
            .init(id: "tray", icon: "rectangle.bottomthird.inset.filled", label: "Tray") {
                customStyle = .tray
            },
            .init(id: "scattered", icon: "circle.grid.cross.fill", label: "Scattered") {
                customStyle = .scattered
            },
            .init(id: "minimal", icon: "circle.fill", label: "Minimal") {
                customStyle = .minimal
            },
        ]
    }
}
