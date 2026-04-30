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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

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
            .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(background))
            .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(border, lineWidth: isFocused ? HFocus.ringWidth : 1))
            .contentShape(RoundedRectangle(cornerRadius: HudsonRadius.standard))
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
            return HSurface.selected(iconTint.color)
        }
        if isHovering && onTap != nil {
            return HSurface.hover
        }
        return HSurface.inset
    }

    private var border: Color {
        if isFocused {
            return HFocus.ring
        }
        if isSelected {
            return iconTint.color.opacity(0.45)
        }
        if isHovering && onTap != nil {
            return HudsonHairline.standard
        }
        return HudsonHairline.subtle
    }

    private var accessibilityLabel: String {
        if let subtitle {
            return "\(title), \(subtitle)"
        }
        return title
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
