import SwiftUI
import HudsonUI

/// Gallery of every public Hudson primitive shown in real context, with the
/// matching call-site snippet underneath. This tab is built strictly against
/// HudLint — every value comes from a token (HudSpacing, HudIconSize,
/// HudPalette, HudTextSize, HudRadius, HudStrokeWidth, HudOpacity, HudSurface).
struct PrimitivesTab: View {
    @State private var fieldText: String = ""
    @State private var fieldQuery: String = "alpha"
    @State private var selectedRow: String? = "alpha"
    @State private var qrInputText: String = ""

    private let scrollAnchors: [HudSettingsQuickNav.Item] = [
        .init(icon: "square",                label: "Buttons",  anchor: "Buttons"),
        .init(icon: "circle.fill",           label: "Status",   anchor: "Status"),
        .init(icon: "tag",                   label: "Badges",   anchor: "Badges"),
        .init(icon: "textformat",            label: "Field",    anchor: "Field"),
        .init(icon: "qrcode",                label: "QR",       anchor: "QR code"),
        .init(icon: "list.bullet",           label: "List",     anchor: "List rows"),
        .init(icon: "tablecells",            label: "KV",       anchor: "KV rows"),
        .init(icon: "rectangle.stack",       label: "Cards",    anchor: "Cards & insets"),
        .init(icon: "tray",                  label: "Empty",    anchor: "Empty state"),
        .init(icon: "minus",                 label: "Dividers", anchor: "Dividers"),
    ]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                    intro
                    sectionButtons
                    sectionStatusDots
                    sectionBadges
                    sectionField
                    sectionQRCode
                    sectionListRows
                    sectionKVRows
                    sectionCards
                    sectionEmptyState
                    sectionDividers
                }
                .padding(.horizontal, HudSpacing.xl)
                .padding(.top, HudSpacing.lg)
                .padding(.bottom, HudSpacing.huge)
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                HudSettingsQuickNav(items: scrollAnchors, proxy: proxy)
                    .padding(.vertical, HudSpacing.md)
                    .background(HudPalette.bg.opacity(HudOpacity.emphatic))
            }
        }
    }

    // MARK: Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Hudson primitives")
            Text("Every public primitive composed against tokens. HudLint enforces the kit + this tab — no hardcoded colors, sizes, or font literals slip in.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }

    // MARK: Sections

    private var sectionButtons: some View {
        gallerySection("Buttons", snippet: """
            HudButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
            HudButton("Secondary", icon: "gear",      style: .secondary)       {}
            HudButton("Ghost",                          style: .ghost)          {}
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
                HudButton("Secondary", icon: "gear",      style: .secondary)       {}
                HudButton("Ghost",                          style: .ghost)          {}
            }
        }
    }

    private var sectionStatusDots: some View {
        gallerySection("Status", snippet: """
            HudStatusDot(color: HudPalette.statusOk, pulses: true)
            HudStatusDot(color: HudPalette.statusWarn)
            HudStatusDot(color: HudPalette.statusError, size: HudDotSize.large)
            """) {
            HStack(spacing: HudSpacing.xxl) {
                HudStatusDot(color: HudPalette.statusOk, pulses: true, label: "online")
                HudStatusDot(color: HudPalette.statusWarn, label: "warning")
                HudStatusDot(color: HudPalette.statusError, size: HudDotSize.large, label: "error")
                HudStatusDot(color: HudPalette.statusInfo, size: HudDotSize.medium, label: "info")
            }
        }
    }

    private var sectionBadges: some View {
        gallerySection("Badges", snippet: """
            HudBadge("ONLINE", tint: HudPalette.statusOk,   dot: true)
            HudBadge("WARN",   tint: HudPalette.statusWarn, dot: true)
            HudBadge("ERROR",  tint: HudPalette.statusError, dot: true)
            HudBadge("BETA",   tint: HudTint.violet.color)
            """) {
            HStack(spacing: HudSpacing.sm) {
                HudBadge("ONLINE", tint: HudPalette.statusOk,    dot: true)
                HudBadge("WARN",   tint: HudPalette.statusWarn,  dot: true)
                HudBadge("ERROR",  tint: HudPalette.statusError, dot: true)
                HudBadge("BETA",   tint: HudTint.violet.color)
            }
        }
    }

    private var sectionField: some View {
        gallerySection("Field", snippet: """
            HudField("Search agents…", text: $fieldText, icon: "magnifyingglass")
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudField("Search agents…", text: $fieldText, icon: "magnifyingglass")
                HudField("Plain field",     text: $fieldQuery)
            }
        }
    }

    private var sectionQRCode: some View {
        gallerySection("QR code", snippet: """
            HudQRCode("https://hudson.dev/pair?token=...")
            HudQRCode(text, foreground: HudPalette.accent, background: HudPalette.bg)
            HudQRCode("important", errorCorrection: .high)
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.xl) {
                    HudQRCode("https://hudson.dev/pair?token=demo")
                    HudQRCode(
                        "https://hudson.dev/pair?token=demo",
                        foreground: HudPalette.accent,
                        background: HudPalette.bg
                    )
                }
                HudField(
                    "Encode anything…",
                    text: $qrInputText,
                    icon: "qrcode"
                )
                HudQRCode(qrInputText.isEmpty ? "https://hudson.dev" : qrInputText)
            }
        }
    }

    private var sectionListRows: some View {
        gallerySection("List rows", snippet: """
            HudListRow(
                title: "alpha.main.mini",
                subtitle: "agent · idle · 3 flights",
                icon: "circle.grid.2x2.fill",
                iconTint: .green,
                isSelected: selectedRow == "alpha"
            ) { selectedRow = "alpha" } trailing: {
                HudBadge("3", tint: HudPalette.muted)
            }
            """) {
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

    private var sectionKVRows: some View {
        gallerySection("KV rows", snippet: """
            HudKVRow("cpu",     value: "32%")
            HudKVRow("uptime",  value: "4h 22m", valueColor: HudPalette.statusOk)
            """) {
            HudCard {
                VStack(spacing: HudSpacing.lg) {
                    HudKVRow("cpu",     value: "32%")
                    HudKVRow("mem",     value: "68%")
                    HudKVRow("flights", value: "12")
                    HudKVRow("uptime",  value: "4h 22m", valueColor: HudPalette.statusOk)
                }
            }
        }
    }

    private var sectionCards: some View {
        gallerySection("Cards & insets", snippet: """
            HudCard {
                Text("alpha.main.mini")
                HudInset { HudKVRow("status", value: "online") }
                HudDivider()
            }
            """) {
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

    private var sectionEmptyState: some View {
        gallerySection("Empty state", snippet: """
            HudEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start.",
                icon: "antenna.radiowaves.left.and.right"
            )
            """) {
            HudEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start a session.",
                icon: "antenna.radiowaves.left.and.right"
            )
        }
    }

    private var sectionDividers: some View {
        gallerySection("Dividers", snippet: """
            HudDivider()
            HudDivider(color: HudHairline.standard)
            """) {
            VStack(spacing: HudSpacing.lg) {
                HudDivider()
                HudDivider(color: HudHairline.standard)
            }
        }
    }

    // MARK: Section chrome

    @ViewBuilder
    private func gallerySection<Demo: View>(
        _ title: String,
        snippet: String,
        @ViewBuilder demo: () -> Demo
    ) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel(title)
            demo()
            HudInset {
                Text(snippet)
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
        .id(title)
    }
}
