import SwiftUI

/// Tinted pill badge for status, category, or count. Uppercase mono text; the
/// `dot` flag adds a leading status circle.
public struct HBadge: View {
    public let text: String
    public var tint: Color
    public var dot: Bool

    public init(_ text: String, tint: Color = HPalette.muted, dot: Bool = false) {
        self.text = text
        self.tint = tint
        self.dot = dot
    }

    public var body: some View {
        HStack(spacing: HSpacing.xs) {
            if dot {
                Circle()
                    .fill(tint)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
            }
            Text(text)
                .font(HFont.mono(9, weight: .semibold))
                .tracking(0.8)
                .textCase(.uppercase)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, HSpacing.md)
        .padding(.vertical, 3)
        .background(RoundedRectangle(cornerRadius: HRadius.tight).fill(tint.opacity(0.16)))
        .overlay(RoundedRectangle(cornerRadius: HRadius.tight).stroke(tint.opacity(0.4), lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}
