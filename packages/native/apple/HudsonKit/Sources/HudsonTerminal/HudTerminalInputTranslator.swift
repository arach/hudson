import Foundation

enum HudTerminalModifierState {
    case inactive, armed, locked

    var isActive: Bool { self != .inactive }
    var consumesAfterUse: Bool { self == .armed }
}

enum HudTerminalInputTranslator {
    static func normalize(_ text: String) -> String {
        text.replacingOccurrences(of: "\r\n", with: "\r")
            .replacingOccurrences(of: "\n", with: "\r")
    }

    static func controlModifiedInput(for text: String) -> String? {
        guard text.count == 1, let scalar = text.unicodeScalars.first else { return nil }
        let value: UInt32?
        switch scalar {
        case "a"..."z": value = scalar.value - 96
        case "A"..."Z": value = scalar.value - 64
        case "@":  value = 0
        case "[":  value = 27
        case "\\": value = 28
        case "]":  value = 29
        case "^":  value = 30
        case "_":  value = 31
        case "?":  value = 127
        case " ":  value = 0
        default:   value = nil
        }
        guard let value, let controlScalar = UnicodeScalar(value) else { return nil }
        return String(controlScalar)
    }

    static func shiftModifiedInput(for text: String) -> String? {
        guard text.count == 1 else { return nil }
        return text.uppercased()
    }

    static func resolvedInput(
        for text: String,
        controlModifierState: HudTerminalModifierState,
        shiftModifierState: HudTerminalModifierState = .inactive
    ) -> (payload: String, consumedControl: Bool, consumedShift: Bool)? {
        let normalized = normalize(text)
        guard !normalized.isEmpty else { return nil }

        var payload = normalized
        var consumedControl = false
        var consumedShift = false

        if shiftModifierState.isActive, let shifted = shiftModifiedInput(for: payload) {
            payload = shifted
            consumedShift = true
        }
        if controlModifierState.isActive, let control = controlModifiedInput(for: payload) {
            payload = control
            consumedControl = true
        }
        return (payload, consumedControl, consumedShift)
    }
}
