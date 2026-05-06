import SwiftUI

public struct HudLiquidBarAction: Identifiable, Sendable {
    public let id: String
    public let icon: String
    public let title: String?
    public let role: ButtonRole?
    public let handler: @Sendable () -> Void

    public init(
        id: String,
        icon: String,
        title: String? = nil,
        role: ButtonRole? = nil,
        handler: @escaping @Sendable () -> Void
    ) {
        self.id = id
        self.icon = icon
        self.title = title
        self.role = role
        self.handler = handler
    }
}

public struct HudLiquidBarActionRow: View {
    public let actions: [HudLiquidBarAction]

    public init(actions: [HudLiquidBarAction]) {
        self.actions = actions
    }

    public var body: some View {
        HStack(spacing: HudSpacing.md) {
            ForEach(actions) { action in
                actionButton(action)
            }
        }
    }

    @ViewBuilder
    private func actionButton(_ action: HudLiquidBarAction) -> some View {
        Button(role: action.role) {
            HudLiquidBarHaptics.softImpact()
            action.handler()
        } label: {
            VStack(spacing: HudSpacing.xs) {
                Image(systemName: action.icon)
                    .font(HudFont.ui(HudTextSize.lg, weight: .semibold))
                if let title = action.title {
                    Text(title)
                        .font(HudFont.mono(HudTextSize.xxs, weight: .medium))
                        .lineLimit(1)
                }
            }
            .foregroundStyle(action.role == .destructive ? HudPalette.statusError : HudPalette.ink)
            .frame(minWidth: HudIconSize.hero)
            .frame(minHeight: HudLiquidBarMetrics.itemMinHeight)
            .padding(.horizontal, HudSpacing.md)
            .background(Capsule().fill(HudSurface.control))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.title ?? action.icon)
    }
}
