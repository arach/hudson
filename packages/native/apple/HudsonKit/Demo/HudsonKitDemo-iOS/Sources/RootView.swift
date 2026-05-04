import SwiftUI
import HudsonUI
import HudsonShell

enum DemoPage: String, CaseIterable, Identifiable {
    case shell
    case complications
    case settings
    case logs
    case about

    var id: String { rawValue }

    var title: String {
        switch self {
        case .shell:         return "Shell"
        case .complications: return "Complications"
        case .settings:      return "Settings"
        case .logs:          return "Logs"
        case .about:         return "About"
        }
    }

    var icon: String {
        switch self {
        case .shell:         return "rectangle.3.group"
        case .complications: return "circle.grid.2x2"
        case .settings:      return "gearshape"
        case .logs:          return "list.bullet.rectangle"
        case .about:         return "info.circle"
        }
    }
}

struct RootView: View {
    @State private var page: DemoPage = .shell
    @State private var customComplications: HudPhoneComplications? = nil
    @State private var customStyle: HudPhoneComplicationsStyle = .tray

    var body: some View {
        HudPhoneAppShell(complicationsStyle: customStyle) {
            content
                .navigationTitle(page.title)
                .navigationBarTitleDisplayMode(.inline)
                .hudComplications(activeComplications)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch page {
        case .shell:         ShellTab()
        case .complications: ComplicationsTab(custom: $customComplications, style: $customStyle)
        case .settings:      SettingsTab()
        case .logs:          LogsTab()
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
            topRight: .init(icon: "info.circle", action: { page = .about }),
            bottomLeft: .init(icon: "gearshape", action: { page = .settings }),
            bottomRight: .init(icon: "rectangle.3.group", action: { page = .shell }),
            center: .init(
                icon: "circle.grid.2x2",
                role: .accent,
                longPressModes: DemoPage.allCases.map { p in
                    .init(id: p.rawValue, icon: p.icon, label: p.title) { page = p }
                },
                action: { page = .shell }
            )
        )
    }
}
