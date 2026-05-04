import SwiftUI

/// Section container for settings screens. Uppercase tracked label sits above
/// a surface-filled card with a hairline stroke. Pairs with `HudSettingsRow`
/// for the row content and `HudSettingsQuickNav` (iOS) for jump-scrolling.
///
/// Distinct from `HudListRow` in vocabulary: settings rows are calm and static,
/// list rows are dense and interactive. Reach for `HudSettingsSection`/`Row`
/// in settings, preferences, and inspectors; `HudListRow` for inboxes, target
/// grids, and selection lists.
public struct HudSettingsSection<Content: View>: View {
    public let title: String
    public var labelTint: Color
    @ViewBuilder public var content: () -> Content

    public init(
        _ title: String,
        labelTint: Color = HudPalette.dim,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.labelTint = labelTint
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel(title, tint: labelTint)
                .padding(.horizontal, HudSpacing.xl)

            VStack(spacing: 0) {
                content()
            }
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudPalette.surface))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: 0.5))
        }
        .id(title)
    }
}

/// Calm, static settings row with leading icon, title/subtitle, optional
/// trailing badge (any view), and chevron. Tappable via `onTap`; renders as a
/// plain non-button when `onTap` is nil so the row is purely informational.
public struct HudSettingsRow<Badge: View>: View {
    public let icon: String
    public var iconColor: Color
    public let title: String
    public var subtitle: String?
    public var onTap: (() -> Void)?
    @ViewBuilder public var badge: () -> Badge

    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        title: String,
        subtitle: String? = nil,
        onTap: (() -> Void)? = nil,
        @ViewBuilder badge: @escaping () -> Badge
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.subtitle = subtitle
        self.onTap = onTap
        self.badge = badge
    }

    public var body: some View {
        let content = HStack(spacing: HudSpacing.xl) {
            HudSettingsLeadingIcon(systemName: icon, color: iconColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(HudFont.ui(HudTextSize.md, weight: .regular))
                    .foregroundStyle(HudPalette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(HudFont.ui(HudTextSize.xs, weight: .light))
                        .foregroundStyle(HudPalette.muted)
                }
            }

            Spacer(minLength: 0)
            badge()

            if onTap != nil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .light))
                    .foregroundStyle(HudPalette.dim.opacity(0.6))
            }
        }
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.lg)

        if let onTap {
            Button(action: onTap) { content }
                .buttonStyle(.plain)
                .contentShape(Rectangle())
        } else {
            content
        }
    }
}

extension HudSettingsRow where Badge == EmptyView {
    public init(
        icon: String,
        iconColor: Color = HudPalette.muted,
        title: String,
        subtitle: String? = nil,
        onTap: (() -> Void)? = nil
    ) {
        self.init(
            icon: icon,
            iconColor: iconColor,
            title: title,
            subtitle: subtitle,
            onTap: onTap,
            badge: { EmptyView() }
        )
    }
}

/// Flat leading icon for `HudSettingsRow`. 28×28 frame, no background — calmer
/// than `HudListRow`'s tinted-background icon, matching the static-settings tone.
public struct HudSettingsLeadingIcon: View {
    public let systemName: String
    public var color: Color
    public var fontSize: CGFloat
    public var weight: Font.Weight

    public init(
        systemName: String,
        color: Color = HudPalette.muted,
        fontSize: CGFloat = 14,
        weight: Font.Weight = .light
    ) {
        self.systemName = systemName
        self.color = color
        self.fontSize = fontSize
        self.weight = weight
    }

    public var body: some View {
        Image(systemName: systemName)
            .font(.system(size: fontSize, weight: weight))
            .foregroundStyle(color)
            .frame(width: 28, height: 28)
    }
}
