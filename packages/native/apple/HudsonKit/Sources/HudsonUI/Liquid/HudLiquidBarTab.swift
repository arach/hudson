import SwiftUI

public struct HudLiquidBarTab: Identifiable, Sendable {
    public let id: String
    public let icon: String
    public let title: String?

    public init(id: String, icon: String, title: String? = nil) {
        self.id = id
        self.icon = icon
        self.title = title
    }
}

public struct HudLiquidBarTabRow: View {
    public let tabs: [HudLiquidBarTab]
    @Binding public var selection: HudLiquidBarTab.ID

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(tabs: [HudLiquidBarTab], selection: Binding<HudLiquidBarTab.ID>) {
        self.tabs = tabs
        self._selection = selection
    }

    public var body: some View {
        HStack(spacing: HudSpacing.sm) {
            ForEach(tabs) { tab in
                tabButton(tab)
            }
        }
    }

    public func select(_ tab: HudLiquidBarTab) {
        guard selection != tab.id else { return }
        HudLiquidBarHaptics.softImpact()
        selection = tab.id
    }

    @ViewBuilder
    private func tabButton(_ tab: HudLiquidBarTab) -> some View {
        let isSelected = selection == tab.id
        Button {
            withAnimation(reduceMotion ? nil : HudLiquidBarMetrics.selectionAnimation) {
                select(tab)
            }
        } label: {
            VStack(spacing: HudSpacing.xs) {
                Image(systemName: tab.icon)
                    .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                if let title = tab.title {
                    Text(title)
                        .font(HudFont.mono(HudTextSize.xxs, weight: .medium))
                        .lineLimit(1)
                }
            }
            .foregroundStyle(isSelected ? HudPalette.ink : HudPalette.muted)
            .frame(minWidth: HudIconSize.hero)
            .frame(minHeight: HudLiquidBarMetrics.itemMinHeight)
            .padding(.horizontal, HudSpacing.md)
            .background {
                if isSelected {
                    Capsule()
                        .fill(HudSurface.selected(HudPalette.accent))
                        .overlay(Capsule().stroke(HudSurface.tintBorder(HudPalette.accent), lineWidth: HudStrokeWidth.thin))
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title ?? tab.icon)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
