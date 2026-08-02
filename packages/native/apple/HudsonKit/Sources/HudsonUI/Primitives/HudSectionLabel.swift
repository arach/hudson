import SwiftUI

/// Uppercase tracked-out section header. Defaults to muted chrome text so
/// dense app surfaces do not accumulate unnecessary status color; consumers
/// can pass any tint when a section needs emphasis.
public struct HudSectionLabel: View {
    public let text: String
    public var tint: Color

    public init(_ text: String, tint: Color = HudPalette.muted) {
        self.text = text
        self.tint = tint
    }

    public var body: some View {
        Text(text.uppercased())
            .hudFont(.micro, face: .mono, weight: .bold)
            .tracking(2.0)
            .foregroundStyle(tint)
            .accessibilityLabel(text)
    }
}
