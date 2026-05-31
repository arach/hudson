import Foundation

public enum HudVantageSelectionMode: String, Codable, CaseIterable, Sendable {
    case replace
    case add
    case subtract
    case toggle

    public init(normalized value: String?) {
        switch value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "add", "append":
            self = .add
        case "remove", "subtract":
            self = .subtract
        case "toggle":
            self = .toggle
        default:
            self = .replace
        }
    }
}

public struct HudVantageSelectionState<ID: Hashable & Sendable>: Equatable, Sendable {
    public var ids: Set<ID>

    public init(ids: Set<ID> = []) {
        self.ids = ids
    }

    public func applying(
        _ candidates: Set<ID>,
        mode: HudVantageSelectionMode
    ) -> Self {
        var next = self
        next.apply(candidates, mode: mode)
        return next
    }

    public mutating func apply(
        _ candidates: Set<ID>,
        mode: HudVantageSelectionMode
    ) {
        switch mode {
        case .replace:
            ids = candidates
        case .add:
            ids.formUnion(candidates)
        case .subtract:
            ids.subtract(candidates)
        case .toggle:
            for id in candidates {
                if ids.contains(id) {
                    ids.remove(id)
                } else {
                    ids.insert(id)
                }
            }
        }
    }
}
