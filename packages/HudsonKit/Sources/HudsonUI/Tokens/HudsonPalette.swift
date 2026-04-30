import SwiftUI

/// Hudson palette — native counterpart to the `--hud-*` semantic tokens defined
/// in `hudsonkit/theme` (`packages/hudson-sdk/src/styles/bundle.css`).
///
/// Names mirror the web tokens so the same vocabulary works across web and native:
/// `bg`/`surface` for surfaces, `ink`/`muted`/`dim` for text, `border` for
/// hairlines, `accent` for the app's primary tint, `status*` for state colors.
public enum HudsonPalette {
    // Surfaces — `--hud-bg`, `--hud-surface`, `--hud-chrome`
    public static let bg      = Color(red: 10.0/255,  green: 10.0/255,  blue: 10.0/255)
    public static let surface = Color(red: 23.0/255,  green: 23.0/255,  blue: 23.0/255)
    // Chrome — solid pane background (nav rail, inspector, drawers, takeover header).
    // Slightly darker than bg so panes recede behind canvas content. Solid (no opacity)
    // to preserve subpixel text rendering on macOS.
    public static let chrome  = Color(red: 6.0/255,   green: 6.0/255,   blue: 6.0/255)

    // Text — `--hud-ink`, `--hud-muted`, `--hud-dim`
    public static let ink   = Color(red: 229.0/255, green: 229.0/255, blue: 229.0/255)
    public static let muted = Color(red: 163.0/255, green: 163.0/255, blue: 163.0/255)
    public static let dim   = Color(red: 115.0/255, green: 115.0/255, blue: 115.0/255)

    // Structure — `--hud-border`. Solid so 1pt strokes render crisply.
    public static let border = Color(red: 39.0/255, green: 39.0/255, blue: 39.0/255)

    // Accent — `--hud-accent` defaults to emerald-500; consumers override via HudsonAppManifest.
    public static let accent     = Color(red: 16.0/255,  green: 185.0/255, blue: 129.0/255)
    public static let accentSoft = Color(red: 16.0/255,  green: 185.0/255, blue: 129.0/255).opacity(0.08)

    // Status — `--hud-status-{ok,warn,error,info}`. Match `StatusColor` in
    // `packages/hudson-sdk/src/types/app.ts:38` (emerald/amber/red/neutral)
    // plus `info` (blue) which the web tokens carry.
    public static let statusOk    = Color(red: 34.0/255,  green: 197.0/255, blue: 94.0/255)
    public static let statusWarn  = Color(red: 245.0/255, green: 158.0/255, blue: 11.0/255)
    public static let statusError = Color(red: 220.0/255, green: 38.0/255,  blue: 38.0/255)
    public static let statusInfo  = Color(red: 59.0/255,  green: 130.0/255, blue: 246.0/255)
}

// MARK: - Tints

/// Named tint slots an app can use for category coloring (categories, badges,
/// list-row icons, deck shortcuts). The default Hudson palette skews toward
/// emerald/blue/teal/cyan; `violet` and `pink` are available for apps that
/// adopt them deliberately.
public enum HudsonTint: String, CaseIterable, Sendable {
    case red, amber, green, teal, blue, cyan, violet, pink

    public var color: Color {
        switch self {
        case .red:    return Color(red: 0.95, green: 0.40, blue: 0.42)
        case .amber:  return Color(red: 0.96, green: 0.74, blue: 0.36)
        case .green:  return Color(red: 0.43, green: 0.86, blue: 0.55)
        case .teal:   return Color(red: 0.43, green: 0.83, blue: 0.84)
        case .blue:   return Color(red: 0.49, green: 0.71, blue: 0.97)
        case .cyan:   return Color(red: 0.42, green: 0.85, blue: 0.95)
        case .violet: return Color(red: 0.74, green: 0.59, blue: 0.99)
        case .pink:   return Color(red: 0.97, green: 0.58, blue: 0.81)
        }
    }

    public static func from(token: String?) -> HudsonTint {
        guard let token = token?.lowercased() else { return .blue }
        return HudsonTint(rawValue: token) ?? .blue
    }
}

// MARK: - Hairlines

/// Thin overlay strokes used for cards, insets, dividers. Two-tier scale —
/// `subtle` is barely-there structure, `standard` is for slightly more
/// emphasis (selected rows, top-bar bottom border). Solid colors so 1pt
/// rules stay crisp under subpixel rendering.
public enum HudsonHairline {
    public static let subtle   = Color(red: 24.0/255, green: 24.0/255, blue: 24.0/255)
    public static let standard = Color(red: 38.0/255, green: 38.0/255, blue: 38.0/255)
}
