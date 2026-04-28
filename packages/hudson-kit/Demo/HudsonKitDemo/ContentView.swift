import SwiftUI
import HudsonUI

enum DemoTab: String, CaseIterable, Identifiable {
    case dashboard, tokens, primitives, manifest
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum DemoVariant: String, CaseIterable, Identifiable {
    case scout, lattices
    var id: String { rawValue }

    var manifest: HudsonAppManifest {
        switch self {
        case .scout:    return HudsonAppManifest(name: "Scout",    tint: .cyan,  targetLabel: "Agent")
        case .lattices: return HudsonAppManifest(name: "Lattices", tint: .green, targetLabel: "Machine")
        }
    }

    var label: String {
        switch self {
        case .scout:    return "Scout"
        case .lattices: return "Lattices"
        }
    }
}

struct ContentView: View {
    @State private var tab: DemoTab = .dashboard
    @State private var variant: DemoVariant = .lattices

    var body: some View {
        ZStack {
            HudsonPalette.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                DemoTopBar(tab: $tab, variant: $variant)
                HudsonDivider(color: HudsonHairline.standard)

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .hudsonAppManifest(variant.manifest)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .dashboard:
            DashboardTab()
        case .tokens, .primitives, .manifest:
            ScrollView {
                Group {
                    switch tab {
                    case .tokens:     TokensTab()
                    case .primitives: PrimitivesTab()
                    case .manifest:   ManifestTab()
                    case .dashboard:  EmptyView()
                    }
                }
                .padding(HudsonSpacing.xxl)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }
}

private struct DemoTopBar: View {
    @Binding var tab: DemoTab
    @Binding var variant: DemoVariant
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        HStack(spacing: HudsonSpacing.xl) {
            HStack(spacing: HudsonSpacing.lg) {
                HudsonStatusDot(color: manifest.accent, pulses: true)
                Text("HUDSON·KIT")
                    .font(HudsonFont.mono(11, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(HudsonPalette.ink)
            }

            Spacer()

            Picker("Variant", selection: $variant) {
                ForEach(DemoVariant.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .fixedSize()

            Picker("Tab", selection: $tab) {
                ForEach(DemoTab.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .fixedSize()
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: 44)
        .background(Color.black.opacity(0.25))
    }
}
