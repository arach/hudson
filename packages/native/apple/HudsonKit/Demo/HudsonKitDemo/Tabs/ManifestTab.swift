import SwiftUI
import HudsonUI

struct ManifestTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                HudSectionLabel("Active manifest")
                HudCard {
                    VStack(spacing: HudSpacing.lg) {
                        HudKVRow("name",         value: manifest.name)
                        HudKVRow("version",      value: manifest.version)
                        HudKVRow("target label", value: manifest.targetLabel)
                        HudKVRow("accent",       value: "·····",
                                    valueColor: manifest.accent)
                    }
                }
            }

            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                HudSectionLabel("Manifest-driven primary")
                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.xl) {
                        Text("This button reads `manifest.accent` from the environment, so it rebrands when the variant changes — same primitive, different identity.")
                            .font(HudFont.ui(12))
                            .foregroundStyle(HudPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        AccentButton(label: "Pair \(manifest.targetLabel)", icon: "link")
                    }
                }
            }

            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                HudSectionLabel("\(manifest.targetLabel.uppercased()) summary")
                HudCard {
                    VStack(spacing: HudSpacing.md) {
                        HudListRow(
                            title: "alpha-\(manifest.targetLabel.lowercased())",
                            subtitle: "running · 4 sessions",
                            icon: "circle.grid.2x2.fill",
                            iconTint: .green,
                            isSelected: true
                        ) { } trailing: {
                            HudStatusDot(color: manifest.accent, pulses: true)
                        }
                        HudListRow(
                            title: "beta-\(manifest.targetLabel.lowercased())",
                            subtitle: "idle",
                            icon: "moon.zzz.fill",
                            iconTint: .blue
                        )
                    }
                }
            }
        }
    }
}

private struct AccentButton: View {
    let label: String
    let icon: String
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        Button {} label: {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(label).font(HudFont.mono(12, weight: .semibold)).tracking(0.5)
            }
            .foregroundStyle(manifest.accent)
            .padding(.horizontal, HudSpacing.xxl)
            .frame(height: 32)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(manifest.accentSoft))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(manifest.accent.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
