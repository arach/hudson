#if os(macOS)
import AppKit
import HudsonNotchCore
import SwiftUI

/// Presents a card that waits for a person (`HudNotchHold`): the card for
/// its peek, then its one-line chin until the poster resolves it. Hovering
/// the chin, clicking it, or `reopen()` (a key the host routes) opens the
/// card again.
///
/// The poster builds both scenes; this wraps them. Each scene's own
/// `onHover` and the chin's `onTap` still run, after the hold has heard
/// them. Call `refresh()` when the content changes and `withdraw()` once
/// it's answered.
@MainActor
public final class HudNotchHeld {
    public private(set) var hold: HudNotchHold
    public var face: HudNotchHold.Face { hold.face }
    /// The card folded, opened again, or resolved.
    public var onFaceChange: (@MainActor (HudNotchHold.Face) -> Void)?

    private let peek: TimeInterval
    private let present: @MainActor (HudNotchScene?) -> Void
    private let card: @MainActor () -> HudNotchScene
    private let chin: @MainActor () -> HudNotchScene
    private var fold: Task<Void, Never>?

    public init(
        peek: TimeInterval = 12,
        present: @escaping @MainActor (HudNotchScene?) -> Void,
        card: @escaping @MainActor () -> HudNotchScene,
        chin: @escaping @MainActor () -> HudNotchScene
    ) {
        self.peek = peek
        self.present = present
        self.card = card
        self.chin = chin
        hold = HudNotchHold(peek: peek)
        hold.resolve()  // nothing posted yet
    }

    public convenience init(
        controller: HudNotchController,
        peek: TimeInterval = 12,
        card: @escaping @MainActor () -> HudNotchScene,
        chin: @escaping @MainActor () -> HudNotchScene
    ) {
        self.init(peek: peek, present: { [weak controller] in controller?.present($0) }, card: card, chin: chin)
    }

    /// A fresh hold: shows the card and starts its peek.
    public func post() {
        hold = HudNotchHold(peek: peek)
        changed()
    }

    /// Shows the current face again, for content that changed.
    public func refresh() {
        guard hold.face != .resolved else { return }
        present(scene())
    }

    /// Opens the chin back into the card.
    public func reopen() {
        let was = hold.face
        hold.reopen(now: Date())
        if hold.face != was { changed() } else { schedule() }
    }

    /// Answered or withdrawn: takes the scene away.
    public func withdraw() {
        guard hold.face != .resolved else { return }
        hold.resolve()
        fold?.cancel()
        present(nil)
        onFaceChange?(.resolved)
    }

    // MARK: Private

    private func changed() {
        present(scene())
        schedule()
        onFaceChange?(hold.face)
    }

    private func scene() -> HudNotchScene {
        var s = hold.face == .card ? card() : chin()
        let own = s.onHover
        s.onHover = { [weak self] inside in
            self?.hovered(inside)
            own?(inside)
        }
        if hold.face == .chin {
            let tap = s.onTap
            s.onTap = { [weak self] in
                self?.reopen()
                tap?()
            }
        }
        return s
    }

    private func hovered(_ inside: Bool) {
        let was = hold.face
        hold.hover(inside, now: Date())
        if hold.face != was { changed() } else { schedule() }
    }

    private func schedule() {
        fold?.cancel()
        guard let at = hold.foldsAt else { return }
        let wait = max(0, at.timeIntervalSinceNow)
        fold = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled, let self else { return }
            if self.hold.tick(now: Date()) { self.changed() } else { self.schedule() }
        }
    }
}
#endif
