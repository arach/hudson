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
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
            }
            Text(text)
                .font(HudFont.mono(9, weight: .semibold))
                .tracking(0.8)
                .textCase(.uppercase)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, HudSpacing.md)
        .padding(.vertical, 3)
        .background(RoundedRectangle(cornerRadius: HudRadius.tight).fill(tint.opacity(0.16)))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.tight).stroke(tint.opacity(0.4), lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}
