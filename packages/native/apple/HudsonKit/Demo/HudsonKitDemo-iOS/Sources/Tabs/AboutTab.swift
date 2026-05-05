import SwiftUI
import HudsonUI

struct AboutTab: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("HUDSON", tint: HudPalette.accent)
                        Text("Shared app shell")
                            .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                        kv("Version", "0.1.0 (Phase A)")
                        kv("Platform", "iOS 17+")
                        kv("Demo", "HudsonKitDemoIOS")
                    }
                }

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("PRINCIPLES")
                        principle("Curated, not configurable",
                                  "Hudson ships opinions. Apps pick from a strong catalog.")
                        principle("Domain ≠ Rendering",
                                  "Five HUD slots are the data model; renderers are pluggable.")
                        principle("iOS is first-class",
                                  "HudPhoneAppShell is part of the offering, not a demo concern.")
                    }
                }

                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.lg) {
                        HudSectionLabel("DEPLOYS ACROSS")
                        kv("Talkie",   "iOS · App Store")
                        kv("Scout",    "Cross-platform")
                        kv("Linea",    "iOS · early")
                        kv("Lattices", "iOS companion")
                    }
                }
            }
            .padding(HudSpacing.xxl)
        }
    }

    private func kv(_ key: String, _ value: String) -> some View {
        HStack {
            Text(key)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.dim)
            Spacer()
            Text(value)
                .font(HudFont.mono(HudTextSize.sm))
                .foregroundStyle(HudPalette.ink)
        }
    }

    private func principle(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            Text(body)
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }
}
