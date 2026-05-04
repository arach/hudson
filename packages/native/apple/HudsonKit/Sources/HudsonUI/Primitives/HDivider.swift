import SwiftUI

/// 1pt hairline divider for stacked content.
public struct HDivider: View {
    public var color: Color
    public var axis: Axis

    public init(color: Color = HHairline.subtle, axis: Axis = .horizontal) {
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
    /// containers that don't warrant a full HCard.
    public func hudsonHairlineBorder(
        radius: CGFloat = HRadius.standard,
        color: Color = HHairline.subtle
    ) -> some View {
        overlay(RoundedRectangle(cornerRadius: radius).stroke(color, lineWidth: 1))
    }
}
