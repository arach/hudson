import SwiftUI
import HudsonUI

struct PrimitivesTab: View {
    @State private var fieldText: String = ""
    @State private var selectedRow: String? = "alpha"
    @State private var documentMode: HudTextDocumentMode = .preview
    @State private var document = HudTextDocumentDetector.makeDocument(
        id: "demo-document",
        title: "AgentProvider.swift",
        uri: "Sources/AgentProvider.swift",
        mediaType: "text/x-swift",
        value: """
        import SwiftUI
        import HudsonUI

        public struct AgentProvider: View {
            let title: String
            @State private var isConnected = true

            public var body: some View {
                HudCard {
                    Text(title)
                        .font(HudFont.mono(HudTextSize.base))
                }
            }
        }
        """
    )

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
            buttons
            fieldsAndBadges
            textDocuments
            listRows
            kvRows
            emptyState
            cardsSection
        }
    }

    private var buttons: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Buttons")
            HudCard {
                HStack(spacing: HudSpacing.xl) {
                    HudButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
                    HudButton("Secondary", icon: "gear",      style: .secondary)       {}
                    HudButton("Ghost",                          style: .ghost)          {}
                }
            }
        }
    }

    private var fieldsAndBadges: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Field & badges")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.xl) {
                    HudField("Search agents…", text: $fieldText)
                    HStack(spacing: HudSpacing.md) {
                        HudBadge("ONLINE",  tint: HudPalette.statusOk,    dot: true)
                        HudBadge("WARN",    tint: HudPalette.statusWarn,  dot: true)
                        HudBadge("ERROR",   tint: HudPalette.statusError, dot: true)
                        HudBadge("BETA",    tint: HudTint.violet.color)
                        HudBadge("12 RUNS", tint: HudPalette.muted)
                    }
                }
            }
        }
    }

    private var textDocuments: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Text documents")
            HudTextDocumentSurface(document: $document, mode: $documentMode)
                .frame(height: HudLayout.textDocumentPreviewHeight)
        }
    }

    private var listRows: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("List rows")
            HudCard(padding: HudSpacing.md) {
                VStack(spacing: HudSpacing.md) {
                    HudListRow(
                        title: "alpha.main.mini",
                        subtitle: "agent · idle · 3 flights",
                        icon: "circle.grid.2x2.fill",
                        iconTint: .green,
                        isSelected: selectedRow == "alpha"
                    ) { selectedRow = "alpha" } trailing: {
                        HudBadge("3", tint: HudPalette.muted)
                    }
                    HudListRow(
                        title: "beta.main.mini",
                        subtitle: "agent · running",
                        icon: "waveform.circle.fill",
                        iconTint: .cyan,
                        isSelected: selectedRow == "beta"
                    ) { selectedRow = "beta" } trailing: {
                        HudStatusDot(color: HudPalette.statusOk, pulses: true)
                    }
                    HudListRow(
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
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("KV rows · telemetry")
            HudCard {
                VStack(spacing: HudSpacing.lg) {
                    HudKVRow("cpu",    value: "32%")
                    HudKVRow("mem",    value: "68%")
                    HudKVRow("flights", value: "12")
                    HudKVRow("uptime", value: "4h 22m", valueColor: HudPalette.statusOk)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Empty state")
            HudEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start a session.",
                icon: "antenna.radiowaves.left.and.right"
            )
        }
    }

    private var cardsSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Cards & insets")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    Text("alpha.main.mini")
                        .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    HudInset {
                        VStack(spacing: HudSpacing.md) {
                            HudKVRow("status", value: "online", valueColor: HudPalette.statusOk)
                            HudKVRow("agent",  value: "claude")
                            HudKVRow("branch", value: "main")
                        }
                    }
                    HudDivider()
                    HStack {
                        Text("Last activity 22:14")
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                        Spacer()
                        HudBadge("LIVE", tint: HudPalette.statusOk, dot: true)
                    }
                }
            }
        }
    }
}
