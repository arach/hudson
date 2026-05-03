import SwiftUI

/// Hairline-bordered text input with mono content. Cross-platform — apps that
/// need iOS-specific keyboard config (numeric, email, etc.) can wrap this with
/// `.keyboardType(...)` at the call site.
public struct HudsonField: View {
    public let placeholder: String
    public var icon: String?
    public var accessibilityLabelText: String?
    @Binding public var text: String
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    public init(
        _ placeholder: String,
        text: Binding<String>,
        icon: String? = nil,
        accessibilityLabel: String? = nil
    ) {
        self.placeholder = placeholder
        self.icon = icon
        self.accessibilityLabelText = accessibilityLabel
        self._text = text
    }

    public var body: some View {
        HStack(spacing: HudsonSpacing.md) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isFocused ? HudsonPalette.statusInfo : HudsonPalette.dim)
            }

            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(HudsonFont.mono(12))
                .foregroundStyle(isEnabled ? HudsonPalette.ink : HudsonPalette.dim)
                .tint(HudsonPalette.accent)
                .focused($isFocused)
                .accessibilityLabel(accessibilityLabelText ?? placeholder)
        }
        .padding(.horizontal, HudsonSpacing.xl)
        .frame(height: 36)
        .background(RoundedRectangle(cornerRadius: HudsonRadius.standard).fill(background))
        .overlay(RoundedRectangle(cornerRadius: HudsonRadius.standard).stroke(border, lineWidth: isFocused ? HFocus.ringWidth : 1))
        .contentShape(RoundedRectangle(cornerRadius: HudsonRadius.standard))
        .opacity(isEnabled ? 1 : 0.45)
        .onHover { isHovering = $0 }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isHovering)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isFocused)
    }

    private var background: Color {
        if isFocused {
            return HSurface.controlHover(isHovering: true)
        }
        if isHovering && isEnabled {
            return HSurface.hover
        }
        return HSurface.chrome
    }

    private var border: Color {
        if isFocused {
            return HFocus.ring
        }
        if isHovering && isEnabled {
            return HudsonHairline.standard
        }
        return HudsonHairline.subtle
    }
}
