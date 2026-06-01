#if HUDSON_TERMINAL
import SwiftUI
import HudsonUI
import Termini

/// Theme Playground — live Termini Ghostty surface up top, theme picker
/// and ANSI swatch grid below. Themes swap live and re-render the buffer
/// using the new palette.
struct TerminalTab: View {
    @State private var selectedTheme: TerminiTerminalTheme = .midnightBloom
    @State private var controller = TerminiTerminalController()
    @State private var demoTick: Int = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                ghosttySurface
                themePicker
                swatchGrid
                metaCard
            }
            .padding(HudSpacing.xxl)
        }
        .onAppear { restartDemo() }
    }

    private var ghosttySurface: some View {
        TerminiTerminalView(
            controller: controller,
            showsSystemKeyboard: false,
            appearance: TerminiTerminalAppearance(theme: selectedTheme)
        )
        .id(demoTick)
        // Live terminal preview surface height — preview-specific aspect.
        // hudlint:disable next-line geometry
        .frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .stroke(HudHairline.standard, lineWidth: 0.5)
        )
    }

    private func restartDemo() {
        controller = TerminiTerminalController()
        demoTick += 1
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 200_000_000)
            controller.processRemoteOutput(Data(demoOutput().utf8))
        }
    }

    private func demoOutput() -> String {
        let esc = "\u{1B}["
        var s = ""
        s += "\(esc)1;36mTermini\(esc)0m \(esc)2m· iOS live\(esc)0m\r\n"
        s += "\(esc)2m─────────────────────────\(esc)0m\r\n"
        s += "\r\n"
        s += "\(esc)1mANSI palette\(esc)0m\r\n"
        for i in 0..<8 { s += "\(esc)4\(i)m   \(esc)0m" }
        s += "\r\n"
        for i in 0..<8 { s += "\(esc)10\(i)m   \(esc)0m" }
        s += "\r\n\r\n"
        s += "\(esc)32m✓\(esc)0m  \(esc)1mhud\(esc)0m  \(esc)2m· theme synced\(esc)0m\r\n"
        s += "\(esc)33m●\(esc)0m  \(esc)1mghostty\(esc)0m  \(esc)2m· renderer ready\(esc)0m\r\n"
        s += "\(esc)36m▸\(esc)0m  \(esc)1mtermini\(esc)0m  \(esc)2m· live surface\(esc)0m\r\n"
        s += "\r\n"
        s += "\(esc)2m$\(esc)0m \(esc)36mls\(esc)0m themes/\r\n"
        s += "  \(esc)34mmidnight-bloom\(esc)0m  \(esc)31member-glow\(esc)0m  \(esc)32mjade-night\(esc)0m\r\n"
        s += "  \(esc)33mpaper-lantern\(esc)0m  \(esc)35mblueprint\(esc)0m\r\n"
        return s
    }

    private var terminalPreview: some View {
        VStack(alignment: .leading, spacing: 4) {
            previewLine([("Termini", .ansi(6, bold: true)), (" · iOS preview", .dim)])
            previewLine([("─────────────────────────", .dim)])
            previewLine([("", .fg)])
            previewLine([("ANSI palette", .fg(bold: true))])
            HStack(spacing: 0) {
                ForEach(0..<8, id: \.self) { idx in
                    paletteCell(selectedTheme.ansiPalette[idx])
                }
            }
            HStack(spacing: 0) {
                ForEach(8..<16, id: \.self) { idx in
                    paletteCell(selectedTheme.ansiPalette[idx])
                }
            }
            previewLine([("", .fg)])
            previewLine([("✓ ", .ansi(2)), ("hud", .fg(bold: true)), (" · theme synced", .dim)])
            previewLine([("● ", .ansi(3)), ("ghostty", .fg(bold: true)), (" · renderer ready", .dim)])
            previewLine([("▸ ", .ansi(6)), ("termini", .fg(bold: true)), (" · presets loaded", .dim)])
            previewLine([("", .fg)])
            previewLine([("$ ", .dim), ("ls", .ansi(6)), (" themes/", .fg)])
            previewLine([("  midnight-bloom  ", .ansi(4)), ("ember-glow  ", .ansi(1)), ("jade-night", .ansi(2))])
            previewLine([("  paper-lantern  ", .ansi(3)), ("blueprint", .ansi(5))])
            previewLine([("$ ", .dim), ("█", .cursor)])
        }
        .padding(HudSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color(selectedTheme.background))
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.card)
                .stroke(HudHairline.standard, lineWidth: 0.5)
        )
    }

    private enum Tone {
        case fg(bold: Bool = false)
        case dim
        case cursor
        case ansi(Int, bold: Bool = false)
        static var fg: Tone { .fg(bold: false) }
    }

    @ViewBuilder
    private func previewLine(_ segments: [(String, Tone)]) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, seg in
                Text(seg.0.isEmpty ? " " : seg.0)
                    .font(HudFont.mono(HudTextSize.xs, weight: weight(for: seg.1)))
                    .foregroundStyle(toneColor(seg.1))
            }
            Spacer(minLength: 0)
        }
    }

    private func paletteCell(_ c: TerminiTerminalColor) -> some View {
        Rectangle()
            .fill(color(c))
            // Mono character cell preview — tied to monospace font metrics.
            // hudlint:disable next-line geometry
            .frame(width: 14, height: 12)
    }

    private var themePicker: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("THEME", tint: HudPalette.accent)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: HudSpacing.md) {
                        ForEach(TerminiTerminalTheme.presets) { theme in
                            themeChip(theme)
                        }
                    }
                }
                Text(selectedTheme.name)
                    .font(HudFont.mono(HudTextSize.lg, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text(selectedTheme.colorScheme == .dark ? "Dark scheme · 16-color ANSI palette" : "Light scheme · 16-color ANSI palette")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(HudPalette.muted)
            }
        }
    }

    private func themeChip(_ theme: TerminiTerminalTheme) -> some View {
        Button {
            selectedTheme = theme
        } label: {
            VStack(spacing: HudSpacing.sm) {
                themeSwatch(theme)
                Text(theme.name)
                    .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                    .foregroundStyle(theme.id == selectedTheme.id ? HudPalette.ink : HudPalette.muted)
            }
        }
        .buttonStyle(.plain)
    }

    private func themeSwatch(_ theme: TerminiTerminalTheme) -> some View {
        let isSelected = theme.id == selectedTheme.id
        return ZStack {
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .fill(color(theme.background))
            VStack(spacing: 2) {
                HStack(spacing: 2) {
                    Circle().fill(color(theme.ansiPalette[1])).frame(width: HudDotSize.small, height: HudDotSize.small)
                    Circle().fill(color(theme.ansiPalette[2])).frame(width: HudDotSize.small, height: HudDotSize.small)
                    Circle().fill(color(theme.ansiPalette[4])).frame(width: HudDotSize.small, height: HudDotSize.small)
                }
                HStack(spacing: 2) {
                    Circle().fill(color(theme.ansiPalette[3])).frame(width: HudDotSize.small, height: HudDotSize.small)
                    Circle().fill(color(theme.ansiPalette[5])).frame(width: HudDotSize.small, height: HudDotSize.small)
                    Circle().fill(color(theme.ansiPalette[6])).frame(width: HudDotSize.small, height: HudDotSize.small)
                }
            }
        }
        // Theme swatch tile size — preview-specific aspect, not a global token.
        // hudlint:disable next-line geometry
        .frame(width: 56, height: 40)
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .stroke(isSelected ? HudPalette.accent : HudHairline.subtle,
                        lineWidth: isSelected ? 1.5 : 0.5)
        )
    }

    private var swatchGrid: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("ANSI PALETTE")
                let columns = Array(repeating: GridItem(.flexible(), spacing: HudSpacing.sm), count: 8)
                LazyVGrid(columns: columns, spacing: HudSpacing.sm) {
                    ForEach(0..<16, id: \.self) { idx in
                        VStack(spacing: HudSpacing.xs) {
                            RoundedRectangle(cornerRadius: HudRadius.tight + 1)
                                .fill(color(selectedTheme.ansiPalette[idx]))
                                .frame(height: HudIconSize.medium)
                                .overlay(RoundedRectangle(cornerRadius: HudRadius.tight + 1).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
                            Text("\(idx)")
                                .font(HudFont.mono(HudTextSize.xxs))
                                .foregroundStyle(HudPalette.dim)
                        }
                    }
                }
            }
        }
    }

    private var metaCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("TERMINI")
                kv("Renderer", "GhosttyKit (live surface pending iOS fix)")
                kv("Themes", "\(TerminiTerminalTheme.presets.count) curated presets")
                kv("Mode", "SwiftUI preview · curation only")
            }
        }
    }

    private func kv(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k)
                .font(HudFont.mono(HudTextSize.xs))
                .foregroundStyle(HudPalette.dim)
            Spacer()
            Text(v)
                .font(HudFont.mono(HudTextSize.sm))
                .foregroundStyle(HudPalette.ink)
        }
    }

    /// Bridges a Termini terminal color (raw RGB bytes) into SwiftUI Color.
    /// Not a design literal — the values come from theme data.
    // hudlint:disable next-line palette
    private func color(_ c: TerminiTerminalColor) -> Color { Color(red: Double(c.red) / 255.0, green: Double(c.green) / 255.0, blue: Double(c.blue) / 255.0) }

    private func toneColor(_ tone: Tone) -> Color {
        switch tone {
        case .fg:        return color(selectedTheme.foreground)
        case .dim:       return color(selectedTheme.foreground).opacity(HudOpacity.muted)
        case .cursor:    return color(selectedTheme.cursor)
        case .ansi(let i, _): return color(selectedTheme.ansiPalette[i])
        }
    }

    private func weight(for tone: Tone) -> Font.Weight {
        switch tone {
        case .fg(let bold), .ansi(_, let bold): return bold ? .semibold : .regular
        default: return .regular
        }
    }
}
#else
import SwiftUI
import HudsonUI

struct TerminalTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel("Terminal")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    Text("Termini is not built into this binary.")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                    Text("The default iOS demo keeps terminal rendering out of the fast shell loop.")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                }
            }
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.top, HudSpacing.xl)
    }
}
#endif
