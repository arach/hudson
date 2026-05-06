import SwiftUI
import HudsonUI
import Termini

/// Hudson-native terminal presentation defaults.
///
/// This keeps terminal styling in Hudson's vocabulary while leaving the
/// renderer/backend boundary inside Termini.
public struct HudTerminalAppearance: Hashable, Sendable {
    public var theme: TerminiTerminalTheme
    public var fontSize: Double?
    public var fontFamily: String?

    public init(
        theme: TerminiTerminalTheme = .hudsonGraphite,
        fontSize: Double? = nil,
        fontFamily: String? = "SF Mono"
    ) {
        self.theme = theme
        self.fontSize = fontSize
        self.fontFamily = fontFamily
    }

    public static let `default` = HudTerminalAppearance()

    public var terminiAppearance: TerminiTerminalAppearance {
        TerminiTerminalAppearance(
            theme: theme,
            fontSize: fontSize,
            fontFamily: fontFamily.map { TerminiTerminalFontFamily(name: $0) }
        )
    }

    public var backgroundColor: Color {
        Color(
            red: Double(theme.background.red) / 255.0,
            green: Double(theme.background.green) / 255.0,
            blue: Double(theme.background.blue) / 255.0
        )
    }
}

public extension TerminiTerminalTheme {
    /// Dark Hudson terminal theme built from graphite surfaces plus cyan,
    /// teal, blue, and emerald accents.
    static let hudsonGraphite = TerminiTerminalTheme(
        id: "hudson-graphite",
        name: "Hudson Graphite",
        colorScheme: .dark,
        background: .init(hex: 0x0A0F14),
        foreground: .init(hex: 0xE6EDF3),
        cursor: .init(hex: 0x6CE5B1),
        selectionBackground: .init(hex: 0x12313A),
        selectionForeground: .init(hex: 0xF4FBFF),
        ansiPalette: [
            .init(hex: 0x101820),
            .init(hex: 0xEF6A6A),
            .init(hex: 0x6CE5B1),
            .init(hex: 0xF6C177),
            .init(hex: 0x5BC0EB),
            .init(hex: 0xD06A8A),
            .init(hex: 0x4FD1C5),
            .init(hex: 0xD8E2EC),
            .init(hex: 0x39505E),
            .init(hex: 0xFF8A8A),
            .init(hex: 0x92F0C7),
            .init(hex: 0xFFD79A),
            .init(hex: 0x8ED8F8),
            .init(hex: 0xEA8EAA),
            .init(hex: 0x8AE8DD),
            .init(hex: 0xFFFFFF),
        ]
    )
}
