import SwiftUI
import HudsonUI
import HudsonShell

@main
struct HudsonKitShellReferenceApp: App {
    var body: some Scene {
        WindowGroup("HudsonKit Shell Reference") {
            ShellOnlyRootView()
                .frame(minWidth: 920, minHeight: 620)
        }
    }
}

private enum ShellOnlySection: String, CaseIterable, Identifiable {
    case welcome
    case configuration
    case runtime

    var id: String { rawValue }

    var title: String {
        switch self {
        case .welcome: return "Welcome"
        case .configuration: return "Configuration"
        case .runtime: return "Runtime"
        }
    }

    var icon: String {
        switch self {
        case .welcome: return "sparkles"
        case .configuration: return "slider.horizontal.3"
        case .runtime: return "gauge.with.dots.needle.67percent"
        }
    }

    var navItem: HudsonNavRailItem {
        HudsonNavRailItem(id: rawValue, label: title, icon: icon)
    }
}

private struct ShellOnlyRootView: View {
    @State private var section: ShellOnlySection = .welcome
    @State private var railExpanded = true
    @State private var inspectorCollapsed = false

    private let manifest = HudsonAppManifest(
        name: "Shell Reference",
        version: "0.1.0",
        tint: .cyan,
        targetLabel: "Shell"
    )

    var body: some View {
        HudsonAppShell {
            HudsonNavigationRail(
                selection: Binding(
                    get: { section.rawValue },
                    set: { next in
                        if let value = ShellOnlySection(rawValue: next) {
                            section = value
                        }
                    }
                ),
                items: ShellOnlySection.allCases.map(\.navItem),
                isExpanded: $railExpanded
            ) {
                railFooter
            }
        } trailing: {
            HudsonInspector(isCollapsed: $inspectorCollapsed) {
                HStack {
                    HudsonSectionLabel("Inspector")
                    Spacer()
                    HudsonBadge(section.title.uppercased(), tint: manifest.accent)
                }
            } content: {
                inspectorContent
            }
        } content: {
            ScrollView {
                shellContent
                    .padding(HudsonSpacing.xxl)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } statusBar: {
            statusBar
        }
        .hudsonAppManifest(manifest)
    }

    private var railFooter: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.md) {
            HudsonSectionLabel("Baseline")
            HudsonBadge("SHELL ONLY", tint: HudsonPalette.statusInfo, dot: true)
        }
    }

    private var shellContent: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.huge) {
            VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                HStack(spacing: HudsonSpacing.md) {
                    HudsonSectionLabel(section.title)
                    HudsonBadge("NO VOICE", tint: HudsonPalette.statusInfo)
                }
                Text("This target links HudsonUI and HudsonShell only. It is used as a clean memory baseline for the reference scaffold.")
                    .font(HudsonFont.ui(12))
                    .foregroundStyle(HudsonPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 760, alignment: .leading)
            }

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 260), spacing: HudsonSpacing.xl)],
                alignment: .leading,
                spacing: HudsonSpacing.xl
            ) {
                BaselineCard(title: "Shell", value: "HudsonAppShell", detail: "Chrome, status bar, inspector, and content slots.")
                BaselineCard(title: "Navigation", value: "HudsonNavigationRail", detail: "Reference app scaffold without feature modules.")
                BaselineCard(title: "Surfaces", value: "HudsonCard", detail: "Primitive UI surfaces and typography tokens.")
            }
        }
    }

    private var inspectorContent: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonKVRow("Section", value: section.title)
                    HudsonKVRow("Shell", value: railExpanded ? "Expanded" : "Compact")
                    HudsonKVRow("Modules", value: "None", valueColor: HudsonPalette.statusInfo)
                }
            }

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonSectionLabel("Measure", tint: HudsonPalette.muted)
                    Text("Compare this target against HudsonKitReference to isolate the cost of optional feature modules.")
                        .font(HudsonFont.ui(12))
                        .foregroundStyle(HudsonPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var statusBar: some View {
        HStack(spacing: HudsonSpacing.xl) {
            HudsonStatusDot(color: manifest.accent, pulses: true)
            Text("HUDSONKIT")
                .font(HudsonFont.mono(10, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HudsonPalette.muted)
            Text("shell-only reference")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.muted)
            Spacer()
            HudsonBadge(section.title.uppercased(), tint: manifest.accent)
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: HudsonLayout.statusBarHeight)
    }
}

private struct BaselineCard: View {
    let title: String
    let value: String
    let detail: String

    var body: some View {
        HudsonCard {
            VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                HudsonSectionLabel(title, tint: HudsonPalette.statusInfo)
                Text(value)
                    .font(HudsonFont.mono(13, weight: .semibold))
                    .foregroundStyle(HudsonPalette.ink)
                Text(detail)
                    .font(HudsonFont.ui(12))
                    .foregroundStyle(HudsonPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
