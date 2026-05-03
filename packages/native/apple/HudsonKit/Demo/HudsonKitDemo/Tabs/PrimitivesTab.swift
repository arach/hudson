import SwiftUI
import HudsonUI

struct PrimitivesTab: View {
    @State private var fieldText: String = ""
    @State private var selectedRow: String? = "alpha"

    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xxxl) {
            buttons
            fieldsAndBadges
            listRows
            kvRows
            emptyState
            cardsSection
        }
    }

    private var buttons: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Buttons")
            HudsonCard {
                HStack(spacing: HudsonSpacing.xl) {
                    HudsonButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
                    HudsonButton("Secondary", icon: "gear",      style: .secondary)       {}
                    HudsonButton("Ghost",                          style: .ghost)          {}
                }
            }
        }
    }

    private var fieldsAndBadges: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Field & badges")
            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                    HudsonField("Search agents…", text: $fieldText)
                    HStack(spacing: HudsonSpacing.md) {
                        HudsonBadge("ONLINE",  tint: HudsonPalette.statusOk,    dot: true)
                        HudsonBadge("WARN",    tint: HudsonPalette.statusWarn,  dot: true)
                        HudsonBadge("ERROR",   tint: HudsonPalette.statusError, dot: true)
                        HudsonBadge("BETA",    tint: HudsonTint.violet.color)
                        HudsonBadge("12 RUNS", tint: HudsonPalette.muted)
                    }
                }
            }
        }
    }

    private var listRows: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("List rows")
            HudsonCard(padding: HudsonSpacing.md) {
                VStack(spacing: HudsonSpacing.md) {
                    HudsonListRow(
                        title: "alpha.main.mini",
                        subtitle: "agent · idle · 3 flights",
                        icon: "circle.grid.2x2.fill",
                        iconTint: .green,
                        isSelected: selectedRow == "alpha"
                    ) { selectedRow = "alpha" } trailing: {
                        HudsonBadge("3", tint: HudsonPalette.muted)
                    }
                    HudsonListRow(
                        title: "beta.main.mini",
                        subtitle: "agent · running",
                        icon: "waveform.circle.fill",
                        iconTint: .cyan,
                        isSelected: selectedRow == "beta"
                    ) { selectedRow = "beta" } trailing: {
                        HudsonStatusDot(color: HudsonPalette.statusOk, pulses: true)
                    }
                    HudsonListRow(
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
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("KV rows · telemetry")
            HudsonCard {
                VStack(spacing: HudsonSpacing.lg) {
                    HudsonKVRow("cpu",    value: "32%")
                    HudsonKVRow("mem",    value: "68%")
                    HudsonKVRow("flights", value: "12")
                    HudsonKVRow("uptime", value: "4h 22m", valueColor: HudsonPalette.statusOk)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Empty state")
            HudsonEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start a session.",
                icon: "antenna.radiowaves.left.and.right"
            )
        }
    }

    private var cardsSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Cards & insets")
            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.lg) {
                    Text("alpha.main.mini")
                        .font(HudsonFont.mono(13, weight: .semibold))
                        .foregroundStyle(HudsonPalette.ink)
                    HudsonInset {
                        VStack(spacing: HudsonSpacing.md) {
                            HudsonKVRow("status", value: "online", valueColor: HudsonPalette.statusOk)
                            HudsonKVRow("agent",  value: "claude")
                            HudsonKVRow("branch", value: "main")
                        }
                    }
                    HudsonDivider()
                    HStack {
                        Text("Last activity 22:14")
                            .font(HudsonFont.mono(10))
                            .foregroundStyle(HudsonPalette.dim)
                        Spacer()
                        HudsonBadge("LIVE", tint: HudsonPalette.statusOk, dot: true)
                    }
                }
            }
        }
    }
}
