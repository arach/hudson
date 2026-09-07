import SwiftUI

/// Tinted pill badge for status, category, or count. Uppercase mono text; the
/// `dot` flag adds a leading status circle.
public struct HudBadge: View {
    public let text: String
    public var tint: Color
    public var dot: Bool

    public init(_ text: String, tint: Color = HudPalette.muted, dot: Bool = false) {
        self.text = text
        self.tint = tint
        self.dot = dot
    }

    public var body: some View {
        HStack(spacing: HudSpacing.xs) {
            if dot {
                Circle()
                    .fill(tint)
                    .frame(width: HudDotSize.tiny, height: HudDotSize.tiny)
                    .accessibilityHidden(true)
            }
            Text(text)
                .font(HudFont.mono(HudTextSize.micro, weight: .semibold))
                .tracking(0.8)
                .textCase(.uppercase)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, HudSpacing.xxs)
        .background(RoundedRectangle(cornerRadius: HudRadius.tight).fill(HudSurface.tintFill(tint)))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.tight).stroke(HudSurface.tintBorder(tint), lineWidth: HudStrokeWidth.standard))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}
