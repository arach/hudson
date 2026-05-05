import SwiftUI

/// Tappable row with optional leading icon, two-line label/subtitle, and a
/// trailing slot. Selection state highlights with the icon's tint. Use as the
/// row primitive for dense lists, inboxes, target grids.
public struct HudListRow<Trailing: View>: View {
    public let title: String
    public var subtitle: String?
    public var icon: String?
    public var iconTint: HudTint
    public var isSelected: Bool
    public var onTap: (() -> Void)?
    @ViewBuilder public var trailing: () -> Trailing
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    public init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        iconTint: HudTint = .blue,
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
            HStack(spacing: HudSpacing.xl) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(iconTint.color)
                        .frame(width: 32, height: 32)
                        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(iconTint.color.opacity(0.15)))
                        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(iconTint.color.opacity(0.28), lineWidth: 1))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(HudFont.ui(13, weight: .medium))
                        .foregroundStyle(HudPalette.ink)
                    if let subtitle {
                        Text(subtitle)
                            .font(HudFont.mono(10))
                            .foregroundStyle(HudPalette.muted)
                    }
                }
                Spacer(minLength: 0)
                trailing()
            }
            .padding(.horizontal, HudSpacing.xl)
            .padding(.vertical, HudSpacing.lg)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(background))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(border, lineWidth: isFocused ? HudFocus.ringWidth : 1))
            .contentShape(RoundedRectangle(cornerRadius: HudRadius.standard))
            .opacity(onTap == nil ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .focusable(onTap != nil)
        .focused($isFocused)
        .onHover { isHovering = $0 }
        .disabled(onTap == nil)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isHovering)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isSelected)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isFocused)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var background: Color {
        if isSelected {
            return HudSurface.selected(iconTint.color)
        }
        if isHovering && onTap != nil {
            return HudSurface.hover
        }
        return HudSurface.inset
    }

    private var border: Color {
        if isFocused {
            return HudFocus.ring
        }
        if isSelected {
            return iconTint.color.opacity(0.45)
        }
        if isHovering && onTap != nil {
            return HudHairline.standard
        }
        return HudHairline.subtle
    }

    private var accessibilityLabel: String {
        if let subtitle {
            return "\(title), \(subtitle)"
        }
        return title
    }
}

extension HudListRow where Trailing == EmptyView {
    public init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        iconTint: HudTint = .blue,
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
