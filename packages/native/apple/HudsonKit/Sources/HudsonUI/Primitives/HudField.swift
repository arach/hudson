import SwiftUI

/// Hairline-bordered text input with mono content. Cross-platform — apps that
/// need iOS-specific keyboard config (numeric, email, etc.) can wrap this with
/// `.keyboardType(...)` at the call site.
public struct HudField: View {
    public let placeholder: String
    public var icon: String?
    public var accessibilityLabelText: String?
    /// Increment to request focus without giving product code access to this
    /// field's private `FocusState`.
    public var focusSignal: Int
    @Binding public var text: String
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    /// Original initializer retained as an explicit overload for binary
    /// clients. It delegates to the focus-capable initializer with no signal.
    public init(
        _ placeholder: String,
        text: Binding<String>,
        icon: String? = nil,
        accessibilityLabel: String? = nil
    ) {
        self.init(
            placeholder,
            text: text,
            icon: icon,
            accessibilityLabel: accessibilityLabel,
            focusSignal: 0
        )
    }

    public init(
        _ placeholder: String,
        text: Binding<String>,
        icon: String? = nil,
        accessibilityLabel: String? = nil,
        focusSignal: Int
    ) {
        self.placeholder = placeholder
        self.icon = icon
        self.accessibilityLabelText = accessibilityLabel
        self.focusSignal = focusSignal
        self._text = text
    }

    public var body: some View {
        HStack(spacing: HudSpacing.md) {
            if let icon {
                Image(systemName: icon)
                    .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                    .foregroundStyle(isFocused ? HudPalette.statusInfo : HudPalette.dim)
            }

            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(HudFont.mono(HudTextSize.sm))
                .foregroundStyle(isEnabled ? HudPalette.ink : HudPalette.dim)
                .tint(HudPalette.accent)
                .focused($isFocused)
                .accessibilityLabel(accessibilityLabelText ?? placeholder)
        }
        .padding(.horizontal, HudSpacing.xl)
        .frame(height: HudLayout.fieldHeight)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(background))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(border, lineWidth: isFocused ? HudFocus.ringWidth : HudStrokeWidth.standard))
        .contentShape(RoundedRectangle(cornerRadius: HudRadius.standard))
        .opacity(isEnabled ? 1 : HudOpacity.muted)
        .onHover { isHovering = $0 }
        .onChange(of: focusSignal) { _, _ in
            guard isEnabled else { return }
            isFocused = true
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isHovering)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isFocused)
    }

    private var background: Color {
        if isFocused {
            return HudSurface.controlHover(isHovering: true)
        }
        if isHovering && isEnabled {
            return HudSurface.hover
        }
        return HudSurface.chrome
    }

    private var border: Color {
        if isFocused {
            return HudFocus.ring
        }
        if isHovering && isEnabled {
            return HudHairline.standard
        }
        return HudHairline.subtle
    }
}
