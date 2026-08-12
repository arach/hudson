import SwiftUI
import HudsonObservability

public enum HudButtonStyle {
    case primary(HudTint)
    case secondary
    case ghost
}

/// Mono-titled button with three variants. `primary(tint)` is the call-to-action
/// (filled tint background); `secondary` is the default (faint surface, hairline
/// border); `ghost` is borderless for chrome-internal actions.
public struct HudButton: View {
    public let title: String
    public var icon: String?
    public var style: HudButtonStyle
    public var instrumentationID: String?
    public var action: () -> Void
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.hudTheme) private var theme
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    public init(
        _ title: String,
        icon: String? = nil,
        style: HudButtonStyle = .secondary,
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
            HStack(spacing: HudSpacing.md) {
                if let icon {
                    Image(systemName: icon)
                        .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                }
                Text(title)
                    .hudFont(.xs, face: .mono, weight: .semibold)
                    .tracking(0)
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, HudSpacing.xl)
            .frame(minHeight: HudLayout.rowHeightCompact)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(background))
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .stroke(border, lineWidth: isFocused ? theme.focus.ringWidth : HudStrokeWidth.standard)
            )
            .contentShape(RoundedRectangle(cornerRadius: HudRadius.standard))
            .opacity(isEnabled ? 1 : HudOpacity.muted)
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
        HudTrace.ui.span("hudson.button.action", metadata: ["id": instrumentationID, "title": title]) {
            HudLogger.ui.info("button.action", metadata: ["id": instrumentationID, "title": title])
            action()
        }
    }

    private var foreground: Color {
        switch style {
        case .primary(let tint): return isEnabled ? tint.color : theme.palette.dim
        case .secondary:         return isEnabled ? theme.palette.ink : theme.palette.dim
        case .ghost:             return isEnabled ? theme.palette.muted : theme.palette.dim
        }
    }

    private var background: Color {
        switch style {
        case .primary(let tint):
            // Per-state primary fill; values calibrated below the global token scale.
            // hudlint:disable next-line opacity
            return HudSurface.tint(tint.color, opacity: isHovering && isEnabled ? 0.18 : 0.12)
        case .secondary:
            return theme.palette.ink.opacity(isHovering && isEnabled ? HudOpacity.subtle : HudOpacity.ghost)
        case .ghost:
            return isHovering && isEnabled ? theme.palette.ink.opacity(HudOpacity.ghost) : .clear
        }
    }

    private var border: Color {
        if isFocused {
            return theme.focus.ring
        }
        switch style {
        case .primary(let tint):
            return isHovering && isEnabled
                ? HudSurface.tintFocus(tint.color)
                : HudSurface.tintStrong(tint.color)
        case .secondary:
            return isHovering && isEnabled
                ? HudSurface.tintMuted(theme.palette.statusInfo)
                : theme.hairline.standard
        case .ghost:
            return isHovering && isEnabled ? theme.hairline.standard : theme.hairline.subtle
        }
    }
}
