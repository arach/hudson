import SwiftUI

/// Device-pixel geometry. A line is only crisp when it covers whole device
/// pixels: `HudStrokeWidth.thin` (0.5pt) is one pixel on a 2x panel but a
/// half-covered, grey smear on a 1x display, and a 1pt `.stroke` centred on a
/// view's edge straddles two pixel rows at any scale. These read the display
/// scale from the environment so a rule is exactly one device pixel wherever
/// it lands.
public enum HudPixel {
    /// One device pixel, in points.
    public static func hairline(_ displayScale: CGFloat) -> CGFloat {
        1 / max(displayScale, 1)
    }

    /// `value` rounded to the nearest device pixel.
    public static func snap(_ value: CGFloat, _ displayScale: CGFloat) -> CGFloat {
        let scale = max(displayScale, 1)
        return (value * scale).rounded() / scale
    }
}

/// A rule exactly one device pixel thick. The crisp counterpart to
/// `HudDivider`, which is a fixed 1pt (two pixels on Retina).
public struct HudRule: View {
    public var color: Color?
    public var axis: Axis

    @Environment(\.hudTheme) private var theme
    @Environment(\.displayScale) private var displayScale

    public init(color: Color? = nil, axis: Axis = .horizontal) {
        self.color = color
        self.axis = axis
    }

    public var body: some View {
        let px = HudPixel.hairline(displayScale)
        Rectangle()
            .fill(color ?? theme.hairline.standard)
            .frame(
                width: axis == .vertical ? px : nil,
                height: axis == .horizontal ? px : nil
            )
            .accessibilityHidden(true)
    }
}

private struct HudPixelBorder: ViewModifier {
    let radius: CGFloat
    let color: Color?

    @Environment(\.hudTheme) private var theme
    @Environment(\.displayScale) private var displayScale

    func body(content: Content) -> some View {
        content.overlay {
            // strokeBorder insets the line, so it sits on whole pixels inside
            // the frame instead of straddling its edge.
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(color ?? theme.hairline.standard, lineWidth: HudPixel.hairline(displayScale))
        }
    }
}

extension View {
    /// A one-device-pixel border, inset inside the view's frame. Keep `radius`
    /// small (≤ 4): tight corners stay crisp at 1x, wide ones antialias into
    /// a soft ring.
    public func hudPixelBorder(radius: CGFloat = HudRadius.tight, color: Color? = nil) -> some View {
        modifier(HudPixelBorder(radius: radius, color: color))
    }
}
