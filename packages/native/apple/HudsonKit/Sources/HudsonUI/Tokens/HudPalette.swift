import SwiftUI

/// Hudson palette — native counterpart to the `--hud-*` semantic tokens defined
/// in `hudsonkit/theme` (`packages/web/hudsonkit/src/styles/bundle.css`).
///
/// Names mirror the web tokens so the same vocabulary works across web and native:
/// `bg`/`surface` for surfaces, `ink`/`muted`/`dim` for text, `border` for
/// hairlines, `accent` for the app's primary tint, `status*` for state colors.
public enum HudPalette {
    // Surfaces — `--hud-bg`, `--hud-surface`, `--hud-chrome`
    public static var bg: Color { Color(red: 10.0/255,  green: 10.0/255,  blue: 10.0/255) }
    public static var surface: Color { Color(red: 23.0/255,  green: 23.0/255,  blue: 23.0/255) }
    // Chrome — solid pane background (nav rail, inspector, drawers, takeover header).
    // Slightly darker than bg so panes recede behind canvas content. Solid (no opacity)
    // to preserve subpixel text rendering on macOS.
    public static var chrome: Color { Color(red: 6.0/255,   green: 6.0/255,   blue: 6.0/255) }

    // Text — `--hud-ink`, `--hud-muted`, `--hud-dim`
    public static var ink: Color { Color(red: 229.0/255, green: 229.0/255, blue: 229.0/255) }
    public static var muted: Color { Color(red: 163.0/255, green: 163.0/255, blue: 163.0/255) }
    public static var dim: Color { Color(red: 115.0/255, green: 115.0/255, blue: 115.0/255) }

    // Structure — `--hud-border`. Solid so 1pt strokes render crisply.
    public static var border: Color { Color(red: 39.0/255, green: 39.0/255, blue: 39.0/255) }

    // Accent — `--hud-accent` defaults to emerald-500; consumers override via HudAppManifest.
    public static var accent: Color { Color(red: 16.0/255,  green: 185.0/255, blue: 129.0/255) }
    public static var accentSoft: Color { Color(red: 16.0/255,  green: 185.0/255, blue: 129.0/255).opacity(0.08) }

    // Status — `--hud-status-{ok,warn,error,info}`. Match `StatusColor` in
    // `packages/web/hudsonkit/src/types/app.ts:38` (emerald/amber/red/neutral)
    // plus `info` (blue) which the web tokens carry.
    public static var statusOk: Color { Color(red: 34.0/255,  green: 197.0/255, blue: 94.0/255) }
    public static var statusWarn: Color { Color(red: 245.0/255, green: 158.0/255, blue: 11.0/255) }
    public static var statusError: Color { Color(red: 220.0/255, green: 38.0/255,  blue: 38.0/255) }
    public static var statusInfo: Color { Color(red: 59.0/255,  green: 130.0/255, blue: 246.0/255) }
}

// MARK: - Tints

/// Named tint slots an app can use for category coloring (categories, badges,
/// list-row icons, deck shortcuts). The default Hudson palette skews toward
/// emerald/blue/teal/cyan; `violet` and `pink` are available for apps that
/// adopt them deliberately.
public enum HudTint: String, CaseIterable, Sendable {
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

    public static func from(token: String?) -> HudTint {
        guard let token = token?.lowercased() else { return .blue }
        return HudTint(rawValue: token) ?? .blue
    }
}

// MARK: - Hairlines

/// Thin overlay strokes used for cards, insets, dividers. Two-tier scale —
/// `subtle` is barely-there structure, `standard` is for slightly more
/// emphasis (selected rows, top-bar bottom border). Solid colors so 1pt
/// rules stay crisp under subpixel rendering.
public enum HudHairline {
    public static var subtle: Color { Color(red: 24.0/255, green: 24.0/255, blue: 24.0/255) }
    public static var standard: Color { Color(red: 38.0/255, green: 38.0/255, blue: 38.0/255) }
}

// MARK: - Interaction surfaces

/// H-prefixed surface helpers for reusable native controls. These centralize
/// translucent interaction fills so primitives share the same hover, press, and
/// selection vocabulary instead of scattering raw `Color.white.opacity(...)`.
public enum HudSurface {
    public static var base: Color { HudPalette.bg }
    public static var raised: Color { HudPalette.surface }
    public static var chrome: Color { HudPalette.chrome }
    public static var inset: Color { Color.white.opacity(0.025) }
    public static var hover: Color { Color.white.opacity(0.045) }
    public static var press: Color { Color.white.opacity(0.065) }
    public static var control: Color { Color.white.opacity(0.05) }

    public static func controlHover(isHovering: Bool) -> Color {
        isHovering ? Color.white.opacity(0.08) : control
    }

    public static func tint(_ color: Color, opacity: Double = 0.14) -> Color {
        color.opacity(opacity)
    }

    public static func selected(_ color: Color) -> Color {
        color.opacity(0.10)
    }

    // Semantic tint helpers — replace per-call `color.opacity(0.X)` literals
    // with intent-named functions so primitives stay token-correct.
    public static func tintGhost(_ color: Color)   -> Color { color.opacity(0.08) }
    public static func tintFill(_ color: Color)    -> Color { color.opacity(0.14) }
    public static func tintAccent(_ color: Color)  -> Color { color.opacity(0.20) }
    public static func tintBorder(_ color: Color)  -> Color { color.opacity(0.32) }
    public static func tintMuted(_ color: Color)   -> Color { color.opacity(0.45) }
    public static func tintStrong(_ color: Color)  -> Color { color.opacity(0.60) }
    public static func tintFocus(_ color: Color)   -> Color { color.opacity(0.85) }

    /// Near-opaque backdrop for a transient status overlay, retaining a small
    /// amount of the underlying surface context.
    public static func statusOverlayBackdrop(_ color: Color) -> Color {
        color.opacity(0.92)
    }

    // Scrim helpers — replace `Color.black.opacity(0.X)` for sheets / overlays.
    public static var scrim: Color { Color.black.opacity(0.45) }
    public static var scrimHeavy: Color { Color.black.opacity(0.55) }
    public static var scrimDeep: Color { Color.black.opacity(0.65) }
}

/// Shared focus-ring values. Keep focus visibly blue/cyan and consistent across
/// buttons, rows, and fields without introducing platform-specific styles.
public enum HudFocus {
    public static var ring: Color { HudPalette.statusInfo.opacity(0.85) }
    public static var ringWidth: CGFloat { 1.5 }
}

// MARK: - Deprecated Hudson* aliases

@available(*, deprecated, renamed: "HudPalette")
public typealias HudsonPalette = HudPalette
@available(*, deprecated, renamed: "HudTint")
public typealias HudsonTint = HudTint
@available(*, deprecated, renamed: "HudHairline")
public typealias HudsonHairline = HudHairline

// MARK: - Elevated surface additions

public extension HudPalette {
    /// Solid elevated background used when accessibility Reduce Transparency is enabled.
    static var bgElevated: Color { HudSurface.raised }
}

public enum HudLiquidBarColors {
    public static var highlightTop: Color { Color.white.opacity(0.18) }
    public static var highlightBottom: Color { Color.white.opacity(0.04) }
}
