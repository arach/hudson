import SwiftUI
import HudsonObservability

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
    public var instrumentationID: String?
    public var action: () -> Void
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    public init(
        _ title: String,
        icon: String? = nil,
        style: HudsonButtonStyle = .secondary,
        instrumentationID: String? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.style = style
        self.instrumentationID = instrumentationID
        self.action = action
    }

    public var body: some View {
        Button(action: instrumentedAction) {
            HStack(spacing: HudsonSpacing.md) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .semibold))
                }
                Text(title)
                    .font(HudsonFont.mono(12, weight: .semibold))
                    .tracking(0.5)
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, HudsonSpacing.xxl)
            .frame(minHeight: 32)
            .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(background))
            .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(border, lineWidth: isFocused ? HFocus.ringWidth : 1))
            .contentShape(RoundedRectangle(cornerRadius: HudsonRadius.standard))
            .opacity(isEnabled ? 1 : 0.45)
            .scaleEffect(isHovering && isEnabled ? 1.015 : 1)
        }
        .buttonStyle(.plain)
        .focusable(isEnabled)
        .focused($isFocused)
        .onHover { isHovering = $0 }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isHovering)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isFocused)
        .accessibilityLabel(title)
    }

    private func instrumentedAction() {
        guard let instrumentationID else {
            action()
            return
        }
        HTrace.ui.span("hudson.button.action", metadata: ["id": instrumentationID, "title": title]) {
            HLogger.ui.info("button.action", metadata: ["id": instrumentationID, "title": title])
            action()
        }
    }

    private var foreground: Color {
        switch style {
        case .primary(let tint): return isEnabled ? tint.color : HudsonPalette.dim
        case .secondary:         return isEnabled ? HudsonPalette.ink : HudsonPalette.dim
        case .ghost:             return isEnabled ? HudsonPalette.muted : HudsonPalette.dim
        }
    }

    private var background: Color {
        switch style {
        case .primary(let tint): return HSurface.tint(tint.color, opacity: isHovering && isEnabled ? 0.26 : 0.18)
        case .secondary:         return HSurface.controlHover(isHovering: isHovering && isEnabled)
        case .ghost:             return isHovering && isEnabled ? HSurface.hover : .clear
        }
    }

    private var border: Color {
        if isFocused {
            return HFocus.ring
        }
        switch style {
        case .primary(let tint): return tint.color.opacity(isHovering && isEnabled ? 0.72 : 0.5)
        case .secondary:         return isHovering && isEnabled ? HudsonPalette.statusInfo.opacity(0.45) : HudsonHairline.standard
        case .ghost:             return isHovering && isEnabled ? HudsonHairline.standard : HudsonHairline.subtle
        }
    }
}
