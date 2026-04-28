import SwiftUI

public enum HudsonButtonStyle {
    case primary(HudsonTint)
    case secondary
    case ghost
}

/// Mono-titled button with three variants. `primary(tint)` is the call-to-action
/// (filled tint background); `secondary` is the default (faint surface, hairline
/// border); `ghost` is borderless for chrome-internal actions.
public struct HudsonButton: View {
    public let title: String
    public var icon: String?
    public var style: HudsonButtonStyle
    public var action: () -> Void

    public init(
        _ title: String,
        icon: String? = nil,
        style: HudsonButtonStyle = .secondary,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.style = style
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: HudsonSpacing.md) {
                if let icon { Image(systemName: icon).font(.system(size: 12, weight: .semibold)) }
                Text(title).font(HudsonFont.mono(12, weight: .semibold)).tracking(0.5)
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, HudsonSpacing.xxl)
            .frame(height: 32)
            .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(background))
            .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var foreground: Color {
        switch style {
        case .primary(let tint): return tint.color
        case .secondary:         return HudsonPalette.ink
        case .ghost:             return HudsonPalette.muted
        }
    }

    private var background: Color {
        switch style {
        case .primary(let tint): return tint.color.opacity(0.18)
        case .secondary:         return Color.white.opacity(0.05)
        case .ghost:             return .clear
        }
    }

    private var border: Color {
        switch style {
        case .primary(let tint): return tint.color.opacity(0.5)
        case .secondary:         return HudsonHairline.standard
        case .ghost:             return HudsonHairline.subtle
        }
    }
}
