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

    var navItem: HRailItem {
        HRailItem(id: rawValue, label: title, icon: icon)
    }
}

private struct ShellOnlyRootView: View {
    @State private var section: ShellOnlySection = .welcome
    @State private var railExpanded = true
    @State private var inspectorCollapsed = false
    @State private var selectedBaseline = "shell"

    private let manifest = HAppManifest(
        name: "Shell Reference",
        version: "0.1.0",
        tint: .cyan,
        targetLabel: "Shell"
    )

    var body: some View {
        HAppShell {
            HNavigationRail(
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
            HInspector(isCollapsed: $inspectorCollapsed) {
                HStack {
                    HSectionLabel("Inspector")
                    Spacer()
                    HBadge(section.title.uppercased(), tint: manifest.accent)
                }
            } content: {
                inspectorContent
            }
        } content: {
            ScrollView {
                shellContent
                    .padding(HSpacing.xxl)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } statusBar: {
            statusBar
        }
        .hudsonAppManifest(manifest)
    }

    private var railFooter: some View {
        VStack(alignment: .leading, spacing: HSpacing.md) {
            HSectionLabel("Baseline")
            HBadge("SHELL ONLY", tint: HPalette.statusInfo, dot: true)
        }
    }

    private var shellContent: some View {
        VStack(alignment: .leading, spacing: HSpacing.huge) {
            VStack(alignment: .leading, spacing: HSpacing.md) {
                HStack(spacing: HSpacing.md) {
                    HSectionLabel(section.title)
                    HBadge("NO VOICE", tint: HPalette.statusInfo)
                }
                Text("This target links HudsonUI and HudsonShell only. It is used as a clean memory baseline for the reference scaffold.")
                    .font(HFont.ui(12))
                    .foregroundStyle(HPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 760, alignment: .leading)
            }

            ShellBaselineHeroCard()

            HCard(padding: HSpacing.md) {
                VStack(spacing: HSpacing.md) {
                    HListRow(
                        title: "Shell",
                        subtitle: "HAppShell with rail, inspector, content, and status slots",
                        icon: "macwindow",
                        iconTint: .cyan,
                        isSelected: selectedBaseline == "shell"
                    ) {
                        selectedBaseline = "shell"
                    } trailing: {
                        HBadge("CORE", tint: HPalette.statusInfo)
                    }
                    HListRow(
                        title: "Surface primitives",
                        subtitle: "Cards, fields, badges, rows, dividers, and empty states",
                        icon: "square.stack.3d.up",
                        iconTint: .blue,
                        isSelected: selectedBaseline == "primitives"
                    ) {
                        selectedBaseline = "primitives"
                    } trailing: {
                        HBadge("UI", tint: HPalette.muted)
                    }
                    HListRow(
                        title: "Measurement",
                        subtitle: "Compare shell-only and optional module targets",
                        icon: "gauge.with.dots.needle.67percent",
                        iconTint: .green,
                        isSelected: selectedBaseline == "measure"
                    ) {
                        selectedBaseline = "measure"
                    } trailing: {
                        HBadge("BASELINE", tint: HPalette.statusOk)
                    }
                }
            }

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 260), spacing: HSpacing.xl)],
                alignment: .leading,
                spacing: HSpacing.xl
            ) {
                BaselineCard(title: "Shell", value: "HAppShell", detail: "Chrome, status bar, inspector, and content slots.")
                BaselineCard(title: "Navigation", value: "HNavigationRail", detail: "Reference app scaffold without feature modules.")
                BaselineCard(title: "Surfaces", value: "HCard", detail: "Primitive UI surfaces and typography tokens.")
            }
        }
    }

    private var inspectorContent: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HKVRow("Section", value: section.title)
                    HKVRow("Shell", value: railExpanded ? "Expanded" : "Compact")
                    HKVRow("Modules", value: "None", valueColor: HPalette.statusInfo)
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HSectionLabel("Measure", tint: HPalette.muted)
                    Text("Compare this target against HudsonKitReference to isolate the cost of optional feature modules.")
                        .font(HFont.ui(12))
                        .foregroundStyle(HPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var statusBar: some View {
        HStack(spacing: HSpacing.xl) {
            HStatusDot(color: manifest.accent)
            Text("HUDSONKIT")
                .font(HFont.mono(10, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HPalette.muted)
            Text("shell-only reference")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)
            Spacer()
            HBadge(section.title.uppercased(), tint: manifest.accent)
        }
        .padding(.horizontal, HSpacing.xxl)
        .frame(height: HLayout.statusBarHeight)
    }
}

private struct BaselineCard: View {
    let title: String
    let value: String
    let detail: String

    var body: some View {
        HCard {
            VStack(alignment: .leading, spacing: HSpacing.lg) {
                HSectionLabel(title, tint: HPalette.statusInfo)
                Text(value)
                    .font(HFont.mono(13, weight: .semibold))
                    .foregroundStyle(HPalette.ink)
                Text(detail)
                    .font(HFont.ui(12))
                    .foregroundStyle(HPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ShellBaselineHeroCard: View {
    var body: some View {
        HCard(padding: 0) {
            ZStack(alignment: .topLeading) {
                HGridBackground(step: 24)
                    .opacity(0.75)

                VStack(alignment: .leading, spacing: HSpacing.xl) {
                    HStack(spacing: HSpacing.md) {
                        HBadge("SHELL", tint: HPalette.statusInfo, dot: true)
                        HBadge("NO MODULES", tint: HPalette.muted)
                    }

                    Text("Clean shell baseline")
                        .font(HFont.ui(24, weight: .semibold))
                        .foregroundStyle(HPalette.ink)

                    Text("A lightweight target for measuring HudsonUI and HudsonShell before optional feature modules are linked.")
                        .font(HFont.ui(13))
                        .foregroundStyle(HPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 560, alignment: .leading)
                }
                .padding(HSpacing.huge)
            }
            .frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: HRadius.card))
        }
    }
}
