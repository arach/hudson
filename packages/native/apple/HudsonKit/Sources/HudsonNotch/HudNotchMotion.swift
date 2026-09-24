#if os(macOS)
import SwiftUI

/// The notch's motion: one black silhouette that grows out of the camera
/// housing, and content that follows the shape in and out.
///
/// Opening is a little underdamped so the card stretches past its size and
/// settles. Closing is tighter so the shape tucks back without wobbling
/// against the housing. Content always enters after the shape has started
/// and leaves while the shape shrinks over it.
public enum HudNotchMotion {
    /// The shape emerging from the housing, and the card opening.
    public static let open = Animation.spring(response: 0.46, dampingFraction: 0.68)
    /// The card folding back into the pill, and the pill into the housing.
    public static let close = Animation.spring(response: 0.36, dampingFraction: 0.9)
    /// Width and height changes while the state stays the same: hover
    /// reach, a live activity widening the pill, a taller card for a question.
    public static let resize = Animation.spring(response: 0.38, dampingFraction: 0.78)
    /// Width has its own, springier curve, so the shape stretches sideways
    /// past its size and settles while its height stays calm.
    public static let widthOpen = Animation.spring(response: 0.5, dampingFraction: 0.56)
    public static let widthResize = Animation.spring(response: 0.42, dampingFraction: 0.6)
    /// The width's curve for a change animated with `animation`.
    static func widthCurve(for animation: Animation?) -> Animation? {
        switch animation {
        case open: return widthOpen
        case resize: return widthResize
        default: return animation
        }
    }

    /// A small stretch when something new arrives while the card is open.
    public static let nudgeOut = Animation.spring(response: 0.16, dampingFraction: 0.7)
    public static let nudgeBack = Animation.spring(response: 0.42, dampingFraction: 0.5)

    /// Content arriving after the shape has begun to move.
    public static let contentIn = Animation.spring(response: 0.32, dampingFraction: 0.9).delay(0.09)
    /// Content leaving while the shape shrinks over it, so it reads as
    /// being drawn back into the housing rather than blinking out.
    public static let contentOut = Animation.easeOut(duration: 0.2)
    /// The pill's wing content returning once the card has folded.
    public static let pillIn = Animation.easeOut(duration: 0.2).delay(0.16)

    /// How long hiding waits for the shape to tuck in before the panel orders out.
    public static let retractSeconds: TimeInterval = 0.36
}

/// Fades, blurs, shrinks and lifts a view. 0 is fully shown, 1 fully hidden.
struct HudNotchReveal: ViewModifier {
    var amount: CGFloat
    var anchor: UnitPoint = .top
    var lift: CGFloat = 6
    /// Only fades, with no blur, scale or movement.
    var reduceMotion = false

    func body(content: Content) -> some View {
        if reduceMotion {
            content.opacity(1 - amount)
        } else {
            content
                .opacity(1 - amount)
                .blur(radius: 7 * amount)
                .scaleEffect(1 - 0.06 * amount, anchor: anchor)
                .offset(y: -lift * amount)
        }
    }
}

extension AnyTransition {
    /// Content that follows the silhouette: in late, out early.
    static func notchReveal(
        insertion: Animation = HudNotchMotion.contentIn,
        removal: Animation = HudNotchMotion.contentOut,
        anchor: UnitPoint = .top,
        reduceMotion: Bool
    ) -> AnyTransition {
        guard !reduceMotion else {
            return .opacity.animation(.easeInOut(duration: 0.14))
        }
        return .asymmetric(
            insertion: .modifier(
                active: HudNotchReveal(amount: 1, anchor: anchor),
                identity: HudNotchReveal(amount: 0, anchor: anchor)
            ).animation(insertion),
            removal: .modifier(
                active: HudNotchReveal(amount: 1, anchor: anchor, lift: 3),
                identity: HudNotchReveal(amount: 0, anchor: anchor, lift: 3)
            ).animation(removal)
        )
    }
}
#endif
