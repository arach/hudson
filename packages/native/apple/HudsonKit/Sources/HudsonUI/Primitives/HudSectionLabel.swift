import SwiftUI

/// Uppercase tracked-out section header. Defaults to amber per Lattices'
/// tactical-HUD convention; consumers can pass any tint to fit their palette.
public struct HudSectionLabel: View {
    public let text: String
    public var tint: Color

    public init(_ text: String, tint: Color = HudTint.amber.color) {
        self.text = text
        self.tint = tint
    }

    public var body: some View {
        Text(text.uppercased())
            .font(HudFont.mono(9, weight: .bold))
            .tracking(2.0)
            .foregroundStyle(tint)
            .accessibilityLabel(text)
    }
}
