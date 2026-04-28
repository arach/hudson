import SwiftUI
import HudsonUI

struct ManifestTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xxxl) {
            VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                HudsonSectionLabel("Active manifest")
                HudsonCard {
                    VStack(spacing: HudsonSpacing.lg) {
                        HudsonKVRow("name",         value: manifest.name)
                        HudsonKVRow("version",      value: manifest.version)
                        HudsonKVRow("target label", value: manifest.targetLabel)
                        HudsonKVRow("accent",       value: "·····",
                                    valueColor: manifest.accent)
                    }
                }
            }

            VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                HudsonSectionLabel("Manifest-driven primary")
                HudsonCard {
                    VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                        Text("This button reads `manifest.accent` from the environment, so it rebrands when the variant changes — same primitive, different identity.")
                            .font(HudsonFont.ui(12))
                            .foregroundStyle(HudsonPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        AccentButton(label: "Pair \(manifest.targetLabel)", icon: "link")
                    }
                }
            }

            VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                HudsonSectionLabel("\(manifest.targetLabel.uppercased()) summary")
                HudsonCard {
                    VStack(spacing: HudsonSpacing.md) {
                        HudsonListRow(
                            title: "alpha-\(manifest.targetLabel.lowercased())",
                            subtitle: "running · 4 sessions",
                            icon: "circle.grid.2x2.fill",
                            iconTint: .green,
                            isSelected: true
                        ) { } trailing: {
                            HudsonStatusDot(color: manifest.accent, pulses: true)
                        }
                        HudsonListRow(
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
            HStack(spacing: HudsonSpacing.md) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(label).font(HudsonFont.mono(12, weight: .semibold)).tracking(0.5)
            }
            .foregroundStyle(manifest.accent)
            .padding(.horizontal, HudsonSpacing.xxl)
            .frame(height: 32)
            .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(manifest.accentSoft))
            .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(manifest.accent.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
