import SwiftUI
import HudsonUI

struct TokensTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xxxl) {
            paletteSection
            tintsSection
            statusSection
            typeScale
        }
    }

    private var paletteSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Palette")
            HudsonCard {
                VStack(spacing: HudsonSpacing.lg) {
                    swatch("bg",      HudsonPalette.bg)
                    swatch("surface", HudsonPalette.surface)
                    swatch("ink",     HudsonPalette.ink)
                    swatch("muted",   HudsonPalette.muted)
                    swatch("dim",     HudsonPalette.dim)
                    swatch("border",  HudsonPalette.border)
                    swatch("accent",  HudsonPalette.accent)
                }
            }
        }
    }

    private var tintsSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Tints")
            HudsonCard {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: HudsonSpacing.md), count: 4), spacing: HudsonSpacing.md) {
                    ForEach(HudsonTint.allCases, id: \.self) { tint in
                        VStack(spacing: HudsonSpacing.sm) {
                            RoundedRectangle(cornerRadius: HudsonRadius.standard)
                                .fill(tint.color)
                                .frame(height: 32)
                            Text(tint.rawValue)
                                .font(HudsonFont.mono(10))
                                .foregroundStyle(HudsonPalette.muted)
                        }
                    }
                }
            }
        }
    }

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Status")
            HudsonCard {
                HStack(spacing: HudsonSpacing.xxl) {
                    statusItem("ok",    HudsonPalette.statusOk,    pulses: true)
                    statusItem("warn",  HudsonPalette.statusWarn,  pulses: false)
                    statusItem("error", HudsonPalette.statusError, pulses: false)
                    statusItem("info",  HudsonPalette.statusInfo,  pulses: false)
                }
            }
        }
    }

    private var typeScale: some View {
        VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
            HudsonSectionLabel("Type")
            HudsonCard {
                VStack(alignment: .leading, spacing: HudsonSpacing.md) {
                    sample("xxs / 10",  HudsonTextSize.xxs)
                    sample("xs / 11",   HudsonTextSize.xs)
                    sample("sm / 12",   HudsonTextSize.sm)
                    sample("base / 13", HudsonTextSize.base)
                    sample("md / 14",   HudsonTextSize.md)
                    sample("lg / 16",   HudsonTextSize.lg)
                    sample("xl / 18",   HudsonTextSize.xl)
                    sample("2xl / 22",  HudsonTextSize.xxl)
                    sample("3xl / 28",  HudsonTextSize.xxxl)
                }
            }
        }
    }

    private func swatch(_ name: String, _ color: Color) -> some View {
        HStack(spacing: HudsonSpacing.xl) {
            RoundedRectangle(cornerRadius: HudsonRadius.standard)
                .fill(color)
                .frame(width: 48, height: 24)
                .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(HudsonHairline.subtle, lineWidth: 1))
            Text(name).font(HudsonFont.mono(11)).foregroundStyle(HudsonPalette.ink)
            Spacer()
        }
    }

    private func statusItem(_ name: String, _ color: Color, pulses: Bool) -> some View {
        HStack(spacing: HudsonSpacing.md) {
            HudsonStatusDot(color: color, pulses: pulses)
            Text(name)
                .font(HudsonFont.mono(11, weight: .semibold))
                .foregroundStyle(HudsonPalette.ink)
        }
    }

    private func sample(_ label: String, _ size: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: HudsonSpacing.xl) {
            Text(label)
                .font(HudsonFont.mono(10))
                .foregroundStyle(HudsonPalette.dim)
                .frame(width: 88, alignment: .leading)
            Text("Hudson · the operational dashboard")
                .font(HudsonFont.ui(size))
                .foregroundStyle(HudsonPalette.ink)
        }
    }
}
