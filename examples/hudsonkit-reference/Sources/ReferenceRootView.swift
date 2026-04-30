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

    var navItem: HudsonNavRailItem {
        HudsonNavRailItem(id: rawValue, label: title, icon: icon)
    }
}

struct ReferenceRootView: View {
    @State private var section: ReferenceSection = .welcome
    @State private var railExpanded = true
    @State private var inspectorCollapsed = false

    private let manifest = HudsonAppManifest(
        name: "Reference",
        version: "0.1.0",
        tint: .cyan,
        targetLabel: "App"
    )

    var body: some View {
        HudsonAppShell {
            HudsonNavigationRail(
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
                sectionContent
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
            HudsonSectionLabel("Scaffold")
            HudsonBadge("URL PACKAGE", tint: HudsonPalette.statusInfo, dot: true)
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
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonKVRow("Section", value: section.title)
                    HudsonKVRow("Shell", value: railExpanded ? "Expanded" : "Compact")
                    HudsonKVRow("Tint", value: "Cyan", valueColor: manifest.accent)
                }
            }

            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    HudsonSectionLabel("Pattern", tint: HudsonPalette.muted)
                    Text("Product apps own state and content. HudsonKit supplies shell, chrome, surfaces, and primitive controls.")
                        .font(HudsonFont.ui(12))
                        .foregroundStyle(HudsonPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var statusBar: some View {
        HStack(spacing: HudsonSpacing.xl) {
            HudsonStatusDot(color: manifest.accent)
            Text("HUDSONKIT")
                .font(HudsonFont.mono(10, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HudsonPalette.muted)

            Text("·")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.dim)

            Text("reference scaffold")
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.muted)

            Spacer()

            HudsonButton(
                railExpanded ? "Collapse rail" : "Expand rail",
                icon: "sidebar.left",
                style: .ghost
            ) {
                railExpanded.toggle()
            }

            HudsonBadge(section.title.uppercased(), tint: manifest.accent)
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: HudsonLayout.statusBarHeight)
    }
}
