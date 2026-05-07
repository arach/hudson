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

    public static func hudsonDefault(
        for colorScheme: ColorScheme,
        fontSize: Double? = nil,
        fontFamily: String? = "SF Mono"
    ) -> HudTerminalAppearance {
        HudTerminalAppearance(
            theme: colorScheme == .dark ? .hudsonGraphite : .hudsonPaper,
            fontSize: fontSize,
            fontFamily: fontFamily
        )
    }

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

    /// Light Hudson terminal theme for windows running in light mode.
    static let hudsonPaper = TerminiTerminalTheme(
        id: "hudson-paper",
        name: "Hudson Paper",
        colorScheme: .light,
        background: .init(hex: 0xFAFAFA),
        foreground: .init(hex: 0x1F2937),
        cursor: .init(hex: 0x0891B2),
        selectionBackground: .init(hex: 0xCFEFF6),
        selectionForeground: .init(hex: 0x0F172A),
        ansiPalette: [
            .init(hex: 0x1F2937),
            .init(hex: 0xC2410C),
            .init(hex: 0x15803D),
            .init(hex: 0xA16207),
            .init(hex: 0x2563EB),
            .init(hex: 0x0F766E),
            .init(hex: 0x0891B2),
            .init(hex: 0xE5E7EB),
            .init(hex: 0x64748B),
            .init(hex: 0xEA580C),
            .init(hex: 0x16A34A),
            .init(hex: 0xCA8A04),
            .init(hex: 0x3B82F6),
            .init(hex: 0x14B8A6),
            .init(hex: 0x06B6D4),
            .init(hex: 0xFFFFFF),
        ]
    )
}
