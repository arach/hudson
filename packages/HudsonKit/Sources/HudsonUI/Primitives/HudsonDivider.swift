import SwiftUI

/// 1pt hairline divider for stacked content.
public struct HudsonDivider: View {
    public var color: Color

    public init(color: Color = HudsonHairline.subtle) {
        self.color = color
    }

    public var body: some View {
        Rectangle().fill(color).frame(height: 1)
    }
}

extension View {
    /// Apply a hairline border with rounded corners. Useful for one-off
    /// containers that don't warrant a full HudsonCard.
    public func hudsonHairlineBorder(
        radius: CGFloat = HudsonRadius.standard,
        color: Color = HudsonHairline.subtle
    ) -> some View {
        overlay(RoundedRectangle(cornerRadius: radius).stroke(color, lineWidth: 1))
    }
}
