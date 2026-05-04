import SwiftUI
import HudsonUI

struct ManifestTab: View {
    @Environment(\.hudsonAppManifest) private var manifest

    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.xxxl) {
            VStack(alignment: .leading, spacing: HSpacing.xl) {
                HSectionLabel("Active manifest")
                HCard {
                    VStack(spacing: HSpacing.lg) {
                        HKVRow("name",         value: manifest.name)
                        HKVRow("version",      value: manifest.version)
                        HKVRow("target label", value: manifest.targetLabel)
                        HKVRow("accent",       value: "·····",
                                    valueColor: manifest.accent)
                    }
                }
            }

            VStack(alignment: .leading, spacing: HSpacing.xl) {
                HSectionLabel("Manifest-driven primary")
                HCard {
                    VStack(alignment: .leading, spacing: HSpacing.xl) {
                        Text("This button reads `manifest.accent` from the environment, so it rebrands when the variant changes — same primitive, different identity.")
                            .font(HFont.ui(12))
                            .foregroundStyle(HPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)

                        AccentButton(label: "Pair \(manifest.targetLabel)", icon: "link")
                    }
                }
            }

            VStack(alignment: .leading, spacing: HSpacing.xl) {
                HSectionLabel("\(manifest.targetLabel.uppercased()) summary")
                HCard {
                    VStack(spacing: HSpacing.md) {
                        HListRow(
                            title: "alpha-\(manifest.targetLabel.lowercased())",
                            subtitle: "running · 4 sessions",
                            icon: "circle.grid.2x2.fill",
                            iconTint: .green,
                            isSelected: true
                        ) { } trailing: {
                            HStatusDot(color: manifest.accent, pulses: true)
                        }
                        HListRow(
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
            HStack(spacing: HSpacing.md) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(label).font(HFont.mono(12, weight: .semibold)).tracking(0.5)
            }
            .foregroundStyle(manifest.accent)
            .padding(.horizontal, HSpacing.xxl)
            .frame(height: 32)
            .background(RoundedRectangle(cornerRadius: HRadius.standard).fill(manifest.accentSoft))
            .overlay(RoundedRectangle(cornerRadius: HRadius.standard).stroke(manifest.accent.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
