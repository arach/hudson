import SwiftUI

/// Tappable row with optional leading icon, two-line label/subtitle, and a
/// trailing slot. Selection state highlights with the icon's tint. Use as the
/// row primitive for dense lists, inboxes, target grids.
public struct HudsonListRow<Trailing: View>: View {
    public let title: String
    public var subtitle: String?
    public var icon: String?
    public var iconTint: HudsonTint
    public var isSelected: Bool
    public var onTap: (() -> Void)?
    @ViewBuilder public var trailing: () -> Trailing

    public init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        iconTint: HudsonTint = .blue,
        isSelected: Bool = false,
        onTap: (() -> Void)? = nil,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.iconTint = iconTint
        self.isSelected = isSelected
        self.onTap = onTap
        self.trailing = trailing
    }

    public var body: some View {
        Button(action: { onTap?() }) {
            HStack(spacing: HudsonSpacing.xl) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(iconTint.color)
                        .frame(width: 32, height: 32)
                        .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(iconTint.color.opacity(0.15)))
                        .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(iconTint.color.opacity(0.28), lineWidth: 1))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(HudsonFont.ui(13, weight: .medium))
                        .foregroundStyle(HudsonPalette.ink)
                    if let subtitle {
                        Text(subtitle)
                            .font(HudsonFont.mono(10))
                            .foregroundStyle(HudsonPalette.muted)
                    }
                }
                Spacer(minLength: 0)
                trailing()
            }
            .padding(.horizontal, HudsonSpacing.xl)
            .padding(.vertical, HudsonSpacing.lg)
            .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(isSelected ? iconTint.color.opacity(0.10) : Color.white.opacity(0.025)))
            .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(isSelected ? iconTint.color.opacity(0.45) : HudsonHairline.subtle, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(onTap == nil)
    }
}

extension HudsonListRow where Trailing == EmptyView {
    public init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        iconTint: HudsonTint = .blue,
        isSelected: Bool = false,
        onTap: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.iconTint = iconTint
        self.isSelected = isSelected
        self.onTap = onTap
        self.trailing = { EmptyView() }
    }
}
