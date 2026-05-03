import SwiftUI

/// 1pt hairline divider for stacked content.
public struct HudsonDivider: View {
    public var color: Color
    public var axis: Axis

    public init(color: Color = HudsonHairline.subtle, axis: Axis = .horizontal) {
        self.color = color
        self.axis = axis
    }

    public var body: some View {
        Rectangle()
            .fill(color)
            .frame(
                width: axis == .vertical ? 1 : nil,
                height: axis == .horizontal ? 1 : nil
            )
            .accessibilityHidden(true)
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
