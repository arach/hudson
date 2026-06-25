#if os(macOS)
import AppKit
import Foundation

public struct HudOverlayKeyPress: Equatable, Sendable {
    public var keyCode: UInt16
    public var modifierRawValue: UInt

    public init(keyCode: UInt16, modifiers: NSEvent.ModifierFlags = []) {
        self.keyCode = keyCode
        self.modifierRawValue = modifiers.rawValue
    }

    public init(event: NSEvent) {
        self.init(keyCode: event.keyCode, modifiers: event.modifierFlags)
    }

    public var modifiers: NSEvent.ModifierFlags {
        get { NSEvent.ModifierFlags(rawValue: modifierRawValue) }
        set { modifierRawValue = newValue.rawValue }
    }
}

public enum HudOverlayKeyCode {
    public static var escape: UInt16 { 53 }
    public static var enter: UInt16 { 36 }
    public static var one: UInt16 { 18 }
    public static var two: UInt16 { 19 }
    public static var three: UInt16 { 20 }
    public static var four: UInt16 { 21 }
    public static var five: UInt16 { 23 }
    public static var f: UInt16 { 3 }
    public static var g: UInt16 { 5 }
    public static var i: UInt16 { 34 }
    public static var j: UInt16 { 38 }
    public static var k: UInt16 { 40 }
    public static var m: UInt16 { 46 }
    public static var slash: UInt16 { 44 }
    public static var leftBracket: UInt16 { 33 }
    public static var rightBracket: UInt16 { 30 }
    public static var leftArrow: UInt16 { 123 }
    public static var rightArrow: UInt16 { 124 }
    public static var downArrow: UInt16 { 125 }
    public static var upArrow: UInt16 { 126 }
}

public struct HudOverlayModifierMatch: Equatable, Sendable {
    public enum Kind: Sendable {
        case exact
        case contains
    }

    public var kind: Kind
    public var rawValue: UInt

    public static func exact(_ modifiers: NSEvent.ModifierFlags = []) -> HudOverlayModifierMatch {
        HudOverlayModifierMatch(kind: .exact, rawValue: normalizedRawValue(modifiers))
    }

    public static func contains(_ modifiers: NSEvent.ModifierFlags) -> HudOverlayModifierMatch {
        HudOverlayModifierMatch(kind: .contains, rawValue: normalizedRawValue(modifiers))
    }

    public func matches(_ press: HudOverlayKeyPress) -> Bool {
        let pressed = Self.normalizedRawValue(press.modifiers)
        switch kind {
        case .exact:
            return pressed == rawValue
        case .contains:
            return pressed & rawValue == rawValue
        }
    }

    private static func normalizedRawValue(_ modifiers: NSEvent.ModifierFlags) -> UInt {
        let relevant: NSEvent.ModifierFlags = [.command, .option, .control, .shift]
        return modifiers.intersection(relevant).rawValue
    }
}

public struct HudOverlayKeyCommand {
    public var keyCode: UInt16
    public var modifiers: HudOverlayModifierMatch
    public var action: @MainActor (HudOverlayKeyPress) -> Void

    public init(
        keyCode: UInt16,
        modifiers: HudOverlayModifierMatch = .exact(),
        action: @escaping @MainActor (HudOverlayKeyPress) -> Void
    ) {
        self.keyCode = keyCode
        self.modifiers = modifiers
        self.action = action
    }

    public func matches(_ press: HudOverlayKeyPress) -> Bool {
        press.keyCode == keyCode && modifiers.matches(press)
    }
}

@MainActor
public final class HudOverlayKeyRouter {
    public var commands: [HudOverlayKeyCommand]

    public init(commands: [HudOverlayKeyCommand] = []) {
        self.commands = commands
    }

    @discardableResult
    public func route(_ press: HudOverlayKeyPress) -> Bool {
        guard let command = commands.first(where: { $0.matches(press) }) else {
            return false
        }
        command.action(press)
        return true
    }

    @discardableResult
    public func route(_ event: NSEvent) -> Bool {
        route(HudOverlayKeyPress(event: event))
    }
}
#endif
