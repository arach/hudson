import Foundation

/// How something left the notch. Every way the person puts a scene or a card
/// away is one of the first four; `host` is the app taking it away itself.
///
/// The person has four ways, and they all do the same thing: the shape tucks
/// back into the housing.
/// - `closeButton`: the small × that shows on the trailing wing while the
///   pointer is over the notch.
/// - `swipe`: a scroll up over the notch (two fingers up on a trackpad), the
///   "put it away" gesture.
/// - `escape`: Escape while the notch has the keyboard.
/// - `menu`: right-click, Dismiss.
public enum HudNotchDismissal: String, CaseIterable, Codable, Equatable, Sendable {
    case closeButton
    case swipe
    case escape
    case menu
    /// The host took it away (`dismissScene()` with no reason).
    case host

    /// The person asked for it: hosts should keep it away until something new
    /// happens, not show it again on the next state tick.
    public var byPerson: Bool { self != .host }
}

/// Turns scroll events over the notch into one "put it away" swipe.
///
/// Travel counts in the direction the fingers move, so it reads the same with
/// natural scrolling on or off. It fires once per gesture, after `threshold`
/// points of upward travel; scrolling back down takes travel back. Momentum
/// after the fingers lift never counts, so a fling can't put away whatever
/// shows up next. A mouse wheel has no gesture phases: its clicks count while
/// they keep coming, and a pause starts over.
public struct HudNotchSwipe: Equatable, Sendable {
    public enum Phase: Equatable, Sendable {
        /// Fingers touched down.
        case began
        /// Fingers moving.
        case changed
        /// Fingers lifted, or the gesture was cancelled.
        case ended
        /// The scroll coasting after the fingers lifted.
        case momentum
        /// A mouse wheel click: no phases at all.
        case wheel
    }

    /// Upward travel, in points, that puts the scene away.
    public var threshold: Double
    /// A wheel pause longer than this starts the count over.
    public var wheelGap: TimeInterval

    /// Upward travel so far in this gesture, never below zero.
    public private(set) var travel: Double = 0
    /// It already fired in this gesture.
    public private(set) var fired = false
    private var lastWheel: TimeInterval?

    public init(threshold: Double = 30, wheelGap: TimeInterval = 0.35) {
        self.threshold = threshold
        self.wheelGap = wheelGap
    }

    /// How far along the swipe is, 0…1, for a hint of motion while it builds.
    public var progress: Double { fired ? 1 : min(1, travel / threshold) }

    /// Feeds one scroll event. `deltaY` is the event's vertical delta (in
    /// points for a trackpad; hosts scale wheel lines up). `inverted` is
    /// natural scrolling. Returns true once, when the swipe completes.
    public mutating func feed(deltaY: Double, inverted: Bool, phase: Phase, at time: TimeInterval = 0) -> Bool {
        switch phase {
        case .began:
            reset()
            return accumulate(deltaY: deltaY, inverted: inverted)
        case .changed:
            return accumulate(deltaY: deltaY, inverted: inverted)
        case .ended:
            reset()
            return false
        case .momentum:
            return false
        case .wheel:
            if let lastWheel, time - lastWheel > wheelGap { reset() }
            lastWheel = time
            return accumulate(deltaY: deltaY, inverted: inverted)
        }
    }

    public mutating func reset() {
        travel = 0
        fired = false
        lastWheel = nil
    }

    private mutating func accumulate(deltaY: Double, inverted: Bool) -> Bool {
        guard !fired else { return false }
        // Natural scrolling reports fingers-up as a negative delta.
        let up = inverted ? -deltaY : deltaY
        travel = max(0, travel + up)
        guard travel >= threshold else { return false }
        fired = true
        return true
    }
}
