import SwiftUI
import HudsonUI
import HudsonShell

enum ReferenceSection: String, CaseIterable, Identifiable {
    case welcome
    case configuration
    case runtime
    case voice

    var id: String { rawValue }

    var title: String {
        switch self {
        case .welcome: return "Welcome"
        case .configuration: return "Configuration"
        case .runtime: return "Runtime"
        case .voice: return "Voice"
        }
    }

    var icon: String {
        switch self {
        case .welcome: return "sparkles"
        case .configuration: return "slider.horizontal.3"
        case .runtime: return "gauge.with.dots.needle.67percent"
        case .voice: return "waveform"
        }
    }

    var navItem: HRailItem {
        HRailItem(id: rawValue, label: title, icon: icon)
    }
}

struct ReferenceRootView: View {
    @State private var section: ReferenceSection = .welcome
    @State private var railExpanded = true
    @State private var inspectorCollapsed = false

    private let manifest = HAppManifest(
        name: "Reference",
        version: "0.1.0",
        tint: .cyan,
        targetLabel: "App"
    )

    var body: some View {
        HAppShell {
            HNavigationRail(
                selection: Binding(
                    get: { section.rawValue },
                    set: { next in
                        if let value = ReferenceSection(rawValue: next) {
                            section = value
                        }
                    }
                ),
                items: ReferenceSection.allCases.map(\.navItem),
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
                sectionContent
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
            HSectionLabel("Scaffold")
            HBadge("URL PACKAGE", tint: HPalette.statusInfo, dot: true)
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .welcome:
            WelcomeReferenceScreen()
        case .configuration:
            ConfigurationReferenceScreen()
        case .runtime:
            RuntimeReferenceScreen()
        case .voice:
            VoiceReferenceScreen()
        }
    }

    private var inspectorContent: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HKVRow("Section", value: section.title)
                    HKVRow("Shell", value: railExpanded ? "Expanded" : "Compact")
                    HKVRow("Tint", value: "Cyan", valueColor: manifest.accent)
                }
            }

            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    HSectionLabel("Pattern", tint: HPalette.muted)
                    Text("Product apps own state and content. HudsonKit supplies shell, chrome, surfaces, and primitive controls.")
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

            Text("·")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.dim)

            Text("reference scaffold")
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.muted)

            Spacer()

            HButton(
                railExpanded ? "Collapse rail" : "Expand rail",
                icon: "sidebar.left",
                style: .ghost
            ) {
                railExpanded.toggle()
            }

            HBadge(section.title.uppercased(), tint: manifest.accent)
        }
        .padding(.horizontal, HSpacing.xxl)
        .frame(height: HLayout.statusBarHeight)
    }
}
