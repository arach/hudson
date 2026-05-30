import SwiftUI

/// Two-layer selection state for dense HUD rows.
///
/// `cursoredId` tracks keyboard focus, while `engagedId` tracks committed
/// expansion. Keeping them separate lets a row stay expanded while the keyboard
/// cursor moves elsewhere.
@MainActor
public final class HudEngageState: ObservableObject {
    @Published public private(set) var cursoredId: String?
    @Published public private(set) var engagedId: String?

    public init(initial: String? = nil) {
        self.cursoredId = initial
        self.engagedId = initial
    }

    public func cursor(_ id: String?) {
        cursoredId = id
    }

    public func isCursored(_ id: String) -> Bool {
        cursoredId == id
    }

    public func toggle(_ id: String) {
        engagedId = engagedId == id ? nil : id
        cursoredId = id
    }

    public func select(_ id: String?) {
        engagedId = id
        cursoredId = id
    }

    public func unengage() {
        engagedId = nil
    }

    public func clear() {
        engagedId = nil
        cursoredId = nil
    }

    public func isEngaged(_ id: String) -> Bool {
        engagedId == id
    }

    public func isSelected(_ id: String) -> Bool {
        isEngaged(id)
    }

    public var selectedId: String? {
        engagedId
    }
}
