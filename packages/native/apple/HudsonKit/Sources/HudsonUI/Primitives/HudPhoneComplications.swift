import SwiftUI

/// HUD-coordinated programmable slots for an iOS app shell. Five positions
/// (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`, `center`); each can
/// host a primary `Slot` plus an optional smaller `Secondary` chip attached
/// to its side.
///
/// Pages publish their complications via `View.hudComplications(_:)`. The
/// shell reads them from a `PreferenceKey` and dispatches to a chosen
/// `HudPhoneComplicationsStyle` renderer (`.tray`, `.scattered`, `.minimal`).
///
/// Domain (the five slots) is decoupled from rendering (which renderer the
/// shell picks). Swap the renderer to redistribute the same five actions —
/// the tray is one presentation, not the truth.
public struct HudPhoneComplications {
    public enum Position: Hashable, Sendable, CaseIterable {
        case topLeft, topRight, bottomLeft, bottomRight, center
    }

    public enum Role: Sendable, Equatable {
        case standard
        case accent
        case destructive
    }

    public struct Secondary {
        public let icon: String
        public let action: () -> Void

        public init(icon: String, action: @escaping () -> Void) {
            self.icon = icon
            self.action = action
        }
    }

    public struct Mode: Identifiable {
        public let id: String
        public let icon: String
        public let label: String
        public let action: () -> Void

        public init(id: String, icon: String, label: String, action: @escaping () -> Void) {
            self.id = id
            self.icon = icon
            self.label = label
            self.action = action
        }
    }

    public struct Slot {
        public let icon: String
        public var role: Role
        public var label: String?
        public var secondary: Secondary?
        public var longPressModes: [Mode]?
        public let action: () -> Void

        public init(
            icon: String,
            role: Role = .standard,
            label: String? = nil,
            secondary: Secondary? = nil,
            longPressModes: [Mode]? = nil,
            action: @escaping () -> Void
        ) {
            self.icon = icon
            self.role = role
            self.label = label
            self.secondary = secondary
            self.longPressModes = longPressModes
            self.action = action
        }
    }

    public let slots: [Position: Slot]

    public init(
        topLeft: Slot? = nil,
        topRight: Slot? = nil,
        bottomLeft: Slot? = nil,
        bottomRight: Slot? = nil,
        center: Slot? = nil
    ) {
        var dict: [Position: Slot] = [:]
        if let topLeft     { dict[.topLeft]     = topLeft }
        if let topRight    { dict[.topRight]    = topRight }
        if let bottomLeft  { dict[.bottomLeft]  = bottomLeft }
        if let bottomRight { dict[.bottomRight] = bottomRight }
        if let center      { dict[.center]      = center }
        self.slots = dict
    }

    public init(slots: [Position: Slot]) {
        self.slots = slots
    }

    public subscript(position: Position) -> Slot? {
        slots[position]
    }

    public static var empty: HudPhoneComplications { HudPhoneComplications() }
}

// MARK: - Equatable

extension HudPhoneComplications: Equatable {
    public static func == (lhs: Self, rhs: Self) -> Bool {
        guard lhs.slots.keys == rhs.slots.keys else { return false }
        return lhs.slots.allSatisfy { key, slot in
            guard let other = rhs.slots[key] else { return false }
            return slot.icon == other.icon
                && slot.role == other.role
                && slot.label == other.label
                && slot.secondary?.icon == other.secondary?.icon
                && (slot.longPressModes?.map(\.id)) == (other.longPressModes?.map(\.id))
        }
    }
}

// MARK: - Rendering style

public enum HudPhoneComplicationsStyle: Sendable {
    /// Bottom three slots grouped in a glass tray; top two attached to chrome.
    /// Default for `HudPhoneAppShell`. Talkie-derived shape.
    case tray
    /// All five slots as floating affordances at their corner positions.
    /// No grouping — for shells that want a sparser, more distributed chrome.
    case scattered
    /// Center only; other slots ignored. For focus modes / takeover flows.
    case minimal
}

// MARK: - Preference plumbing

/// Carries the active complications from a page up to the enclosing
/// `HudPhoneAppShell`. Last non-nil writer in the view tree wins so a
/// page can override its container's defaults.
public struct HudPhoneComplicationsKey: PreferenceKey {
    public static var defaultValue: HudPhoneComplications? { nil }

    public static func reduce(
        value: inout HudPhoneComplications?,
        nextValue: () -> HudPhoneComplications?
    ) {
        if let next = nextValue() {
            value = next
        }
    }
}

extension View {
    /// Publish this page's HUD complications to the enclosing shell. Shell
    /// reads the preference and dispatches to the chosen renderer.
    public func hudComplications(_ complications: HudPhoneComplications) -> some View {
        preference(key: HudPhoneComplicationsKey.self, value: complications)
    }
}
