import Foundation

/// A card that waits for a person: it shows for a peek, then folds into a
/// one-line chin that stays until the poster resolves it. Not history: the
/// chin is still the live ask, and a hover, a click or a key opens the card
/// again with a fresh peek.
///
/// Pure state on an injected clock, so it tests without a screen. The
/// `HudNotchHeld` presenter in HudsonNotch drives it on the notch.
public struct HudNotchHold: Equatable, Sendable {
    public enum Face: String, Sendable {
        /// The full card.
        case card
        /// Folded to its one-line chin, still waiting.
        case chin
        /// Answered or withdrawn. Terminal.
        case resolved
    }

    /// How long the card shows before it folds, while the pointer is away.
    public var peek: TimeInterval
    public private(set) var face: Face = .card
    /// When the card last opened, or the pointer last left it.
    public private(set) var openedAt: Date
    public private(set) var hovering = false

    public init(peek: TimeInterval = 12, now: Date = Date()) {
        self.peek = peek
        self.openedAt = now
    }

    /// When the card folds, if nothing happens before then. Nil while the
    /// pointer is over it, and on any face but the card.
    public var foldsAt: Date? {
        guard face == .card, !hovering else { return nil }
        return openedAt.addingTimeInterval(peek)
    }

    /// Folds the card once its peek has passed. True when the face changed.
    @discardableResult
    public mutating func tick(now: Date) -> Bool {
        guard let at = foldsAt, now >= at else { return false }
        face = .chin
        return true
    }

    /// Opens the chin back into the card (a click, a key) with a fresh peek.
    /// True when the face changed.
    @discardableResult
    public mutating func reopen(now: Date) -> Bool {
        guard face != .resolved else { return false }
        openedAt = now
        guard face == .chin else { return false }
        face = .card
        return true
    }

    /// The pointer entered or left the notch. Entering a chin opens the
    /// card; leaving starts the peek again from now.
    public mutating func hover(_ inside: Bool, now: Date) {
        guard face != .resolved else { return }
        hovering = inside
        if inside {
            if face == .chin { reopen(now: now) }
        } else {
            openedAt = now
        }
    }

    /// The ask was answered or withdrawn. Nothing changes it after this.
    public mutating func resolve() {
        face = .resolved
        hovering = false
    }
}
