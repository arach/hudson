import SwiftUI
import HudsonUI

struct TokensTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
            paletteSection
            tintsSection
            statusSection
            typeScale
        }
    }

    private var paletteSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Palette")
            HudCard {
                VStack(spacing: HudSpacing.lg) {
                    swatch("bg",      HudPalette.bg)
                    swatch("surface", HudPalette.surface)
                    swatch("ink",     HudPalette.ink)
                    swatch("muted",   HudPalette.muted)
                    swatch("dim",     HudPalette.dim)
                    swatch("border",  HudPalette.border)
                    swatch("accent",  HudPalette.accent)
                }
            }
        }
    }

    private var tintsSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Tints")
            HudCard {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: HudSpacing.md), count: 4), spacing: HudSpacing.md) {
                    ForEach(HudTint.allCases, id: \.self) { tint in
                        VStack(spacing: HudSpacing.sm) {
                            RoundedRectangle(cornerRadius: HudRadius.standard)
                                .fill(tint.color)
                                .frame(height: HudLayout.buttonHeight)
                            Text(tint.rawValue)
                                .font(HudFont.mono(HudTextSize.xxs))
                                .foregroundStyle(HudPalette.muted)
                        }
                    }
                }
            }
        }
    }

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Status")
            HudCard {
                HStack(spacing: HudSpacing.xxl) {
                    statusItem("ok",    HudPalette.statusOk,    pulses: true)
                    statusItem("warn",  HudPalette.statusWarn,  pulses: false)
                    statusItem("error", HudPalette.statusError, pulses: false)
                    statusItem("info",  HudPalette.statusInfo,  pulses: false)
                }
            }
        }
    }

    private var typeScale: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudSectionLabel("Type")
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    sample("xxs / 10",  HudTextSize.xxs)
                    sample("xs / 11",   HudTextSize.xs)
                    sample("sm / 12",   HudTextSize.sm)
                    sample("base / 13", HudTextSize.base)
                    sample("md / 14",   HudTextSize.md)
                    sample("lg / 16",   HudTextSize.lg)
                    sample("xl / 18",   HudTextSize.xl)
                    sample("2xl / 22",  HudTextSize.xxl)
                    sample("3xl / 28",  HudTextSize.xxxl)
                }
            }
        }
    }

    private func swatch(_ name: String, _ color: Color) -> some View {
        HStack(spacing: HudSpacing.xl) {
            RoundedRectangle(cornerRadius: HudRadius.standard)
                .fill(color)
                // Token swatch tile — chip aspect tuned for the tokens grid.
                // hudlint:disable next-line geometry
                .frame(width: 48, height: 24)
                .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: 1))
            Text(name).font(HudFont.mono(HudTextSize.xs)).foregroundStyle(HudPalette.ink)
            Spacer()
        }
    }

    private func statusItem(_ name: String, _ color: Color, pulses: Bool) -> some View {
        HStack(spacing: HudSpacing.md) {
            HudStatusDot(color: color, pulses: pulses)
            Text(name)
                .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
        }
    }

    private func sample(_ label: String, _ size: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: HudSpacing.xl) {
            Text(label)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
                // Token name label gutter — fixed width for column alignment.
                // hudlint:disable next-line geometry
                .frame(width: 88, alignment: .leading)
            Text("Hudson · the operational dashboard")
                .font(HudFont.ui(size))
                .foregroundStyle(HudPalette.ink)
        }
    }
}
