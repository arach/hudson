import SwiftUI
import HudsonUI

struct PrimitivesTab: View {
    @State private var fieldText: String = ""
    @State private var selectedRow: String? = "alpha"

    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.xxxl) {
            buttons
            fieldsAndBadges
            listRows
            kvRows
            emptyState
            cardsSection
        }
    }

    private var buttons: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Buttons")
            HCard {
                HStack(spacing: HSpacing.xl) {
                    HButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
                    HButton("Secondary", icon: "gear",      style: .secondary)       {}
                    HButton("Ghost",                          style: .ghost)          {}
                }
            }
        }
    }

    private var fieldsAndBadges: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Field & badges")
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.xl) {
                    HField("Search agents…", text: $fieldText)
                    HStack(spacing: HSpacing.md) {
                        HBadge("ONLINE",  tint: HPalette.statusOk,    dot: true)
                        HBadge("WARN",    tint: HPalette.statusWarn,  dot: true)
                        HBadge("ERROR",   tint: HPalette.statusError, dot: true)
                        HBadge("BETA",    tint: HTint.violet.color)
                        HBadge("12 RUNS", tint: HPalette.muted)
                    }
                }
            }
        }
    }

    private var listRows: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("List rows")
            HCard(padding: HSpacing.md) {
                VStack(spacing: HSpacing.md) {
                    HListRow(
                        title: "alpha.main.mini",
                        subtitle: "agent · idle · 3 flights",
                        icon: "circle.grid.2x2.fill",
                        iconTint: .green,
                        isSelected: selectedRow == "alpha"
                    ) { selectedRow = "alpha" } trailing: {
                        HBadge("3", tint: HPalette.muted)
                    }
                    HListRow(
                        title: "beta.main.mini",
                        subtitle: "agent · running",
                        icon: "waveform.circle.fill",
                        iconTint: .cyan,
                        isSelected: selectedRow == "beta"
                    ) { selectedRow = "beta" } trailing: {
                        HStatusDot(color: HPalette.statusOk, pulses: true)
                    }
                    HListRow(
                        title: "gamma.main.mini",
                        subtitle: "agent · offline",
                        icon: "exclamationmark.triangle.fill",
                        iconTint: .amber,
                        isSelected: selectedRow == "gamma"
                    ) { selectedRow = "gamma" }
                }
            }
        }
    }

    private var kvRows: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("KV rows · telemetry")
            HCard {
                VStack(spacing: HSpacing.lg) {
                    HKVRow("cpu",    value: "32%")
                    HKVRow("mem",    value: "68%")
                    HKVRow("flights", value: "12")
                    HKVRow("uptime", value: "4h 22m", valueColor: HPalette.statusOk)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Empty state")
            HEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start a session.",
                icon: "antenna.radiowaves.left.and.right"
            )
        }
    }

    private var cardsSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Cards & insets")
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.lg) {
                    Text("alpha.main.mini")
                        .font(HFont.mono(13, weight: .semibold))
                        .foregroundStyle(HPalette.ink)
                    HInset {
                        VStack(spacing: HSpacing.md) {
                            HKVRow("status", value: "online", valueColor: HPalette.statusOk)
                            HKVRow("agent",  value: "claude")
                            HKVRow("branch", value: "main")
                        }
                    }
                    HDivider()
                    HStack {
                        Text("Last activity 22:14")
                            .font(HFont.mono(10))
                            .foregroundStyle(HPalette.dim)
                        Spacer()
                        HBadge("LIVE", tint: HPalette.statusOk, dot: true)
                    }
                }
            }
        }
    }
}
