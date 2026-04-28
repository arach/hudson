import SwiftUI
import HudsonUI

enum DemoTab: String, CaseIterable, Identifiable {
    case tokens, primitives, manifest
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
        case .scout:    return "Scout · cyan"
        case .lattices: return "Lattices · emerald"
        }
    }
}

struct ContentView: View {
    @State private var tab: DemoTab = .primitives
    @State private var variant: DemoVariant = .scout

    var body: some View {
        ZStack {
            HudsonPalette.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                TopBar(tab: $tab, variant: $variant)
                HudsonDivider(color: HudsonHairline.standard)

                ScrollView {
                    Group {
                        switch tab {
                        case .tokens:     TokensTab()
                        case .primitives: PrimitivesTab()
                        case .manifest:   ManifestTab()
                        }
                    }
                    .padding(HudsonSpacing.xxl)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
        }
        .hudsonAppManifest(variant.manifest)
        .preferredColorScheme(.dark)
    }
}

private struct TopBar: View {
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
                Text("·").foregroundStyle(HudsonPalette.dim)
                Text(manifest.name)
                    .font(HudsonFont.mono(11))
                    .tracking(1)
                    .foregroundStyle(HudsonPalette.muted)
            }

            Spacer()

            Picker("Variant", selection: $variant) {
                ForEach(DemoVariant.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(width: 280)

            Picker("Tab", selection: $tab) {
                ForEach(DemoTab.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(width: 260)
        }
        .padding(.horizontal, HudsonSpacing.xxl)
        .frame(height: 44)
        .background(Color.black.opacity(0.25))
    }
}
