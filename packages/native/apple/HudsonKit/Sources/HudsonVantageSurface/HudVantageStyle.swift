import Foundation
import SwiftUI
import HudsonTerminal
import HudsonUI
import Termini

public enum HudVantageChromeStyle: String, CaseIterable, Codable, Identifiable, Sendable {
    case system
    case graphite
    case paper

    public var id: Self { self }

    public var label: String {
        switch self {
        case .system: "System"
        case .graphite: "Graphite"
        case .paper: "Paper"
        }
    }

    public func colorScheme(
        inheritedTheme: HudTheme,
        systemColorScheme: ColorScheme,
        followsSystemColorScheme: Bool
    ) -> ColorScheme {
        switch self {
        case .graphite:
            return .dark
        case .paper:
            return .light
        case .system:
            if followsSystemColorScheme {
                return systemColorScheme
            }
            return inheritedTheme == .lightDraft ? .light : .dark
        }
    }

    public func hudTheme(
        inheritedTheme: HudTheme,
        systemColorScheme: ColorScheme,
        followsSystemColorScheme: Bool
    ) -> HudTheme {
        switch self {
        case .graphite:
            return .default
        case .paper:
            return .lightDraft
        case .system:
            guard followsSystemColorScheme else { return inheritedTheme }
            return systemColorScheme == .dark ? .default : .lightDraft
        }
    }
}

public enum HudVantageTerminalThemeID: String, CaseIterable, Codable, Identifiable, Sendable {
    case adaptive
    case hudsonGraphite
    case hudsonPaper
    case jadeNight
    case blueprint

    public var id: Self { self }

    public var label: String {
        switch self {
        case .adaptive: "Adaptive"
        case .hudsonGraphite: "Hudson Graphite"
        case .hudsonPaper: "Hudson Paper"
        case .jadeNight: "Jade Night"
        case .blueprint: "Blueprint"
        }
    }

    public func theme(for colorScheme: ColorScheme) -> TerminiTerminalTheme {
        switch self {
        case .adaptive:
            return colorScheme == .dark ? .hudsonGraphite : .hudsonPaper
        case .hudsonGraphite:
            return .hudsonGraphite
        case .hudsonPaper:
            return .hudsonPaper
        case .jadeNight:
            return .jadeNight
        case .blueprint:
            return .blueprint
        }
    }
}

public enum HudVantageCanvasGridMode: String, CaseIterable, Codable, Identifiable, Sendable {
    case lines
    case dots
    case none

    public var id: Self { self }

    public var label: String {
        switch self {
        case .lines: "Lines"
        case .dots: "Dots"
        case .none: "None"
        }
    }
}

public struct HudVantageStyleProfile: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var chromeStyle: HudVantageChromeStyle
    public var terminalThemeID: HudVantageTerminalThemeID
    public var terminalFontFamily: String
    public var terminalFontSize: Double
    public var canvasGridMode: HudVantageCanvasGridMode
    public var canvasGridStep: Double
    public var canvasMinorOpacity: Double
    public var canvasMajorOpacity: Double
    public var focusPadding: Double

    public init(
        id: String,
        name: String,
        chromeStyle: HudVantageChromeStyle,
        terminalThemeID: HudVantageTerminalThemeID,
        terminalFontFamily: String = "SF Mono",
        terminalFontSize: Double = 12,
        canvasGridMode: HudVantageCanvasGridMode = .lines,
        canvasGridStep: Double = 20,
        canvasMinorOpacity: Double = 0.08,
        canvasMajorOpacity: Double = 0.16,
        focusPadding: Double = 18
    ) {
        self.id = id
        self.name = name
        self.chromeStyle = chromeStyle
        self.terminalThemeID = terminalThemeID
        self.terminalFontFamily = terminalFontFamily
        self.terminalFontSize = terminalFontSize
        self.canvasGridMode = canvasGridMode
        self.canvasGridStep = canvasGridStep
        self.canvasMinorOpacity = canvasMinorOpacity
        self.canvasMajorOpacity = canvasMajorOpacity
        self.focusPadding = focusPadding
    }

    public static let adaptive = HudVantageStyleProfile(
        id: "adaptive",
        name: "Adaptive",
        chromeStyle: .system,
        terminalThemeID: .adaptive,
        canvasGridMode: .lines,
        canvasGridStep: 20,
        canvasMinorOpacity: 0.075,
        canvasMajorOpacity: 0.15,
        focusPadding: 16
    )

    public static let graphite = HudVantageStyleProfile(
        id: "graphite",
        name: "Graphite",
        chromeStyle: .graphite,
        terminalThemeID: .hudsonGraphite,
        canvasGridMode: .lines,
        canvasGridStep: 20,
        canvasMinorOpacity: 0.08,
        canvasMajorOpacity: 0.16,
        focusPadding: 16
    )

    public static let jade = HudVantageStyleProfile(
        id: "jade",
        name: "Jade",
        chromeStyle: .graphite,
        terminalThemeID: .jadeNight,
        canvasGridMode: .dots,
        canvasGridStep: 18,
        canvasMinorOpacity: 0.12,
        canvasMajorOpacity: 0.2,
        focusPadding: 14
    )

    public static let blueprint = HudVantageStyleProfile(
        id: "blueprint",
        name: "Blueprint",
        chromeStyle: .paper,
        terminalThemeID: .blueprint,
        canvasGridMode: .lines,
        canvasGridStep: 24,
        canvasMinorOpacity: 0.1,
        canvasMajorOpacity: 0.2,
        focusPadding: 18
    )

    public static let presets: [HudVantageStyleProfile] = [
        .adaptive,
        .graphite,
        .jade,
        .blueprint
    ]

    public static func preset(id: String) -> HudVantageStyleProfile? {
        presets.first { $0.id == id }
    }

    public func terminalAppearance(for colorScheme: ColorScheme) -> HudTerminalAppearance {
        HudTerminalAppearance(
            theme: terminalThemeID.theme(for: colorScheme),
            fontSize: terminalFontSize,
            fontFamily: terminalFontFamily
        )
    }

    public func applyingTerminalOverride(
        _ override: HudVantageTerminalStyleOverride?
    ) -> HudVantageStyleProfile {
        guard let override else { return self }
        return override.applying(to: self)
    }
}

public struct HudVantageTerminalStyleOverride: Codable, Hashable, Sendable {
    public var terminalThemeID: HudVantageTerminalThemeID?
    public var terminalFontFamily: String?
    public var terminalFontSize: Double?

    public init(
        terminalThemeID: HudVantageTerminalThemeID? = nil,
        terminalFontFamily: String? = nil,
        terminalFontSize: Double? = nil
    ) {
        self.terminalThemeID = terminalThemeID
        self.terminalFontFamily = terminalFontFamily
        self.terminalFontSize = terminalFontSize
    }

    public static let empty = HudVantageTerminalStyleOverride()

    public var isEmpty: Bool {
        terminalThemeID == nil
            && terminalFontFamily == nil
            && terminalFontSize == nil
    }

    public func applying(to profile: HudVantageStyleProfile) -> HudVantageStyleProfile {
        var resolved = profile
        if let terminalThemeID {
            resolved.terminalThemeID = terminalThemeID
        }
        if let terminalFontFamily {
            resolved.terminalFontFamily = terminalFontFamily
        }
        if let terminalFontSize {
            resolved.terminalFontSize = terminalFontSize
        }
        return resolved
    }
}
