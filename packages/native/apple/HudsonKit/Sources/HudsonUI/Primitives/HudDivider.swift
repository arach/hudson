import SwiftUI

/// 1pt hairline divider for stacked content. `HudRule` is the one-device-pixel
/// version.
public struct HudDivider: View {
    public var color: Color
    public var axis: Axis

    public init(color: Color = HudHairline.subtle, axis: Axis = .horizontal) {
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
    /// containers that don't warrant a full HudCard.
    public func hudsonHairlineBorder(
        radius: CGFloat = HudRadius.standard,
        color: Color = HudHairline.subtle
    ) -> some View {
        // strokeBorder, not stroke: a centred 1pt stroke straddles the frame
        // edge and lands as two half-lit pixel rows.
        overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(color, lineWidth: 1))
    }
}
