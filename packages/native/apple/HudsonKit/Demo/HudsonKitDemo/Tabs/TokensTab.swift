import SwiftUI
import HudsonUI

struct TokensTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: HSpacing.xxxl) {
            paletteSection
            tintsSection
            statusSection
            typeScale
        }
    }

    private var paletteSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Palette")
            HCard {
                VStack(spacing: HSpacing.lg) {
                    swatch("bg",      HPalette.bg)
                    swatch("surface", HPalette.surface)
                    swatch("ink",     HPalette.ink)
                    swatch("muted",   HPalette.muted)
                    swatch("dim",     HPalette.dim)
                    swatch("border",  HPalette.border)
                    swatch("accent",  HPalette.accent)
                }
            }
        }
    }

    private var tintsSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Tints")
            HCard {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: HSpacing.md), count: 4), spacing: HSpacing.md) {
                    ForEach(HTint.allCases, id: \.self) { tint in
                        VStack(spacing: HSpacing.sm) {
                            RoundedRectangle(cornerRadius: HRadius.standard)
                                .fill(tint.color)
                                .frame(height: 32)
                            Text(tint.rawValue)
                                .font(HFont.mono(10))
                                .foregroundStyle(HPalette.muted)
                        }
                    }
                }
            }
        }
    }

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Status")
            HCard {
                HStack(spacing: HSpacing.xxl) {
                    statusItem("ok",    HPalette.statusOk,    pulses: true)
                    statusItem("warn",  HPalette.statusWarn,  pulses: false)
                    statusItem("error", HPalette.statusError, pulses: false)
                    statusItem("info",  HPalette.statusInfo,  pulses: false)
                }
            }
        }
    }

    private var typeScale: some View {
        VStack(alignment: .leading, spacing: HSpacing.xl) {
            HSectionLabel("Type")
            HCard {
                VStack(alignment: .leading, spacing: HSpacing.md) {
                    sample("xxs / 10",  HTextSize.xxs)
                    sample("xs / 11",   HTextSize.xs)
                    sample("sm / 12",   HTextSize.sm)
                    sample("base / 13", HTextSize.base)
                    sample("md / 14",   HTextSize.md)
                    sample("lg / 16",   HTextSize.lg)
                    sample("xl / 18",   HTextSize.xl)
                    sample("2xl / 22",  HTextSize.xxl)
                    sample("3xl / 28",  HTextSize.xxxl)
                }
            }
        }
    }

    private func swatch(_ name: String, _ color: Color) -> some View {
        HStack(spacing: HSpacing.xl) {
            RoundedRectangle(cornerRadius: HRadius.standard)
                .fill(color)
                .frame(width: 48, height: 24)
                .overlay(RoundedRectangle(cornerRadius: HRadius.standard).stroke(HHairline.subtle, lineWidth: 1))
            Text(name).font(HFont.mono(11)).foregroundStyle(HPalette.ink)
            Spacer()
        }
    }

    private func statusItem(_ name: String, _ color: Color, pulses: Bool) -> some View {
        HStack(spacing: HSpacing.md) {
            HStatusDot(color: color, pulses: pulses)
            Text(name)
                .font(HFont.mono(11, weight: .semibold))
                .foregroundStyle(HPalette.ink)
        }
    }

    private func sample(_ label: String, _ size: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: HSpacing.xl) {
            Text(label)
                .font(HFont.mono(10))
                .foregroundStyle(HPalette.dim)
                .frame(width: 88, alignment: .leading)
            Text("Hudson · the operational dashboard")
                .font(HFont.ui(size))
                .foregroundStyle(HPalette.ink)
        }
    }
}
