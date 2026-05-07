import SwiftUI

public struct HudLiquidBar<Content: View>: View {
    public let tint: HudLiquidBarTint
    private let content: Content

    public init(
        tint: HudLiquidBarTint = .regular,
        @ViewBuilder content: () -> Content
    ) {
        self.tint = tint
        self.content = content()
    }

    public var body: some View {
        content
            .padding(.horizontal, HudSpacing.xxl)
            .padding(.vertical, HudSpacing.md)
            .frame(minHeight: HudLiquidBarMetrics.minHeight)
            .frame(maxWidth: HudLiquidBarMetrics.maxWidth)
            .hudLiquidBarMaterial(tint: tint)
            .padding(.horizontal, HudSpacing.lg)
            .padding(.bottom, HudSpacing.lg)
    }
}

public extension HudLiquidBar where Content == HudLiquidBarTabRow {
    init(
        tabs: [HudLiquidBarTab],
        selection: Binding<HudLiquidBarTab.ID>,
        tint: HudLiquidBarTint = .regular
    ) {
        self.init(tint: tint) {
            HudLiquidBarTabRow(tabs: tabs, selection: selection)
        }
    }
}

public extension HudLiquidBar where Content == HudLiquidBarActionRow {
    init(
        actions: [HudLiquidBarAction],
        tint: HudLiquidBarTint = .regular
    ) {
        self.init(tint: tint) {
            HudLiquidBarActionRow(actions: actions)
        }
    }
}
