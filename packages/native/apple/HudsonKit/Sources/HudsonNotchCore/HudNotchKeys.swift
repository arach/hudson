import CoreGraphics
import Foundation

/// Names for keys as the notch draws them on keycaps: modifier glyphs in
/// Apple's order, named keys by key code, anything else by its character.
/// Foundation only, so a host can record a shortcut and test it without a
/// screen.
public enum HudNotchKeys {
    /// The cap for the Escape key.
    public static let escape = "esc"

    /// Apple's order for modifiers: ⌃ ⌥ ⇧ ⌘.
    public static let modifierOrder = ["⌃", "⌥", "⇧", "⌘"]

    public static func isModifier(_ key: String) -> Bool {
        modifierOrder.contains(key)
    }

    /// The modifiers among `keys`, in Apple's order, each once.
    public static func ordered(_ keys: [String]) -> [String] {
        modifierOrder.filter { keys.contains($0) }
    }

    /// Modifier glyphs for the flags that are down, in Apple's order.
    public static func modifiers(control: Bool, option: Bool, shift: Bool, command: Bool) -> [String] {
        zip(modifierOrder, [control, option, shift, command]).filter(\.1).map(\.0)
    }

    private static let named: [UInt16: String] = [
        53: escape, 49: "Space", 36: "↩", 76: "⌤", 51: "⌫", 117: "⌦", 48: "⇥",
        126: "↑", 125: "↓", 123: "←", 124: "→", 115: "↖", 119: "↘", 116: "⇞", 121: "⇟",
        122: "F1", 120: "F2", 99: "F3", 118: "F4", 96: "F5", 97: "F6", 98: "F7", 100: "F8",
        101: "F9", 109: "F10", 103: "F11", 111: "F12", 105: "F13", 107: "F14", 113: "F15",
        106: "F16", 64: "F17", 79: "F18", 80: "F19",
    ]

    /// The cap for a key press: a named key by its code, otherwise its
    /// character (as typed without modifiers) upper-cased. Nil when there is
    /// nothing to draw, such as a bare modifier.
    public static func name(keyCode: UInt16, characters: String?) -> String? {
        if let name = named[keyCode] { return name }
        guard let c = characters?.trimmingCharacters(in: .whitespacesAndNewlines), !c.isEmpty else { return nil }
        return c.uppercased()
    }
}

extension HudNotchMetrics {
    /// The panel room a host scene needs: its width with the side padding,
    /// and the shell, its content and room for the shadow.
    public static func sceneRoom(
        width: CGFloat,
        contentHeight: CGFloat,
        notchHeight: CGFloat,
        configuration: HudNotchConfiguration = .default
    ) -> CGSize {
        CGSize(
            width: width + configuration.panelSidePadding * 2,
            height: max(notchHeight, configuration.shellHeight) + max(0, contentHeight) + 36
        )
    }
}
