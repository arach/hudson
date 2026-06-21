import SwiftUI

/// Runtime theme — the dynamic counterpart to the static `HudPalette` /
/// `HudHairline` / `HudRadius` / `HudFocus` / `HudSurface` enums. A theme
/// bundles every visual token the shell + primitives read at render time
/// so apps can swap themes per-app or per-window via SwiftUI's environment.
///
/// ```swift
/// // Apps inject themes wherever they want them in the view tree:
/// MyAppRoot()
///     .environment(\.hudTheme, .light)
///
/// // Primitives that opt-in read from the environment:
/// struct MyView: View {
///     @Environment(\.hudTheme) private var theme
///     var body: some View {
///         Rectangle().fill(theme.palette.surface)
///     }
/// }
/// ```
///
/// **Migration policy.** Existing static-token references (`HudPalette.bg`,
/// `HudHairline.standard`, etc.) keep working — they point at the same
/// values as `HudTheme.default`. Migrate primitives to `@Environment(\.hudTheme)`
/// when there's an opportunity (touching the file for another reason, or
/// when a consuming app needs runtime theming). No big-bang rewrite required.
public struct HudTheme: Sendable, Equatable {
    public var palette:  HudThemePalette
    public var hairline: HudThemeHairline
    public var radius:   HudThemeRadius
    public var focus:    HudThemeFocus

    public init(
        palette:  HudThemePalette,
        hairline: HudThemeHairline,
        radius:   HudThemeRadius,
        focus:    HudThemeFocus
    ) {
        self.palette  = palette
        self.hairline = hairline
        self.radius   = radius
        self.focus    = focus
    }

    /// The default Hudson theme — the dark surface aesthetic baked into
    /// `HudPalette` since day one. Mirrors the static enums exactly so
    /// uncustomized apps see no visual change.
    public static var `default`: HudTheme {
        HudTheme(
            palette:  .default,
            hairline: .default,
            radius:   .default,
            focus:    .default
        )
    }

    /// Light-theme stub. Light mode is on the roadmap; the values here are
    /// placeholders that approximate a light surface so apps can opt in
    /// early and feedback can shape the final values. Don't ship this as
    /// the user-facing light theme yet.
    public static var lightDraft: HudTheme {
        HudTheme(
            palette:  .lightDraft,
            hairline: .lightDraft,
            radius:   .default,
            focus:    .default
        )
    }
}

// MARK: - Sub-themes

public struct HudThemePalette: Sendable, Equatable {
    public var bg:           Color
    public var surface:      Color
    public var chrome:       Color
    public var ink:          Color
    public var muted:        Color
    public var dim:          Color
    public var border:       Color
    public var accent:       Color
    public var accentSoft:   Color
    public var statusOk:     Color
    public var statusWarn:   Color
    public var statusError:  Color
    public var statusInfo:   Color

    public init(
        bg: Color, surface: Color, chrome: Color,
        ink: Color, muted: Color, dim: Color,
        border: Color,
        accent: Color, accentSoft: Color,
        statusOk: Color, statusWarn: Color, statusError: Color, statusInfo: Color
    ) {
        self.bg = bg; self.surface = surface; self.chrome = chrome
        self.ink = ink; self.muted = muted; self.dim = dim
        self.border = border
        self.accent = accent; self.accentSoft = accentSoft
        self.statusOk = statusOk; self.statusWarn = statusWarn
        self.statusError = statusError; self.statusInfo = statusInfo
    }

    public static var `default`: HudThemePalette {
        HudThemePalette(
            bg:           HudPalette.bg,
            surface:      HudPalette.surface,
            chrome:       HudPalette.chrome,
            ink:          HudPalette.ink,
            muted:        HudPalette.muted,
            dim:          HudPalette.dim,
            border:       HudPalette.border,
            accent:       HudPalette.accent,
            accentSoft:   HudPalette.accentSoft,
            statusOk:     HudPalette.statusOk,
            statusWarn:   HudPalette.statusWarn,
            statusError:  HudPalette.statusError,
            statusInfo:   HudPalette.statusInfo
        )
    }

    /// Light-theme draft — calibrated against the same status hues but
    /// lifted onto a light surface stack. Intentionally rough.
    public static var lightDraft: HudThemePalette {
        HudThemePalette(
            bg:           Color(red: 250.0/255, green: 250.0/255, blue: 250.0/255),
            surface:      Color(red: 245.0/255, green: 245.0/255, blue: 245.0/255),
            chrome:       Color(red: 255.0/255, green: 255.0/255, blue: 255.0/255),
            ink:          Color(red: 23.0/255,  green: 23.0/255,  blue: 23.0/255),
            muted:        Color(red: 82.0/255,  green: 82.0/255,  blue: 82.0/255),
            dim:          Color(red: 130.0/255, green: 130.0/255, blue: 130.0/255),
            border:       Color(red: 219.0/255, green: 219.0/255, blue: 219.0/255),
            accent:       HudPalette.accent,
            accentSoft:   HudPalette.accent.opacity(0.10),
            statusOk:     HudPalette.statusOk,
            statusWarn:   HudPalette.statusWarn,
            statusError:  HudPalette.statusError,
            statusInfo:   HudPalette.statusInfo
        )
    }
}

public struct HudThemeHairline: Sendable, Equatable {
    public var subtle:   Color
    public var standard: Color

    public init(subtle: Color, standard: Color) {
        self.subtle = subtle
        self.standard = standard
    }

    public static var `default`: HudThemeHairline {
        HudThemeHairline(
            subtle:   HudHairline.subtle,
            standard: HudHairline.standard
        )
    }

    public static var lightDraft: HudThemeHairline {
        HudThemeHairline(
            subtle:   Color(red: 232.0/255, green: 232.0/255, blue: 232.0/255),
            standard: Color(red: 219.0/255, green: 219.0/255, blue: 219.0/255)
        )
    }
}

public struct HudThemeRadius: Sendable, Equatable {
    public var tight:    CGFloat
    public var standard: CGFloat
    public var card:     CGFloat

    public init(tight: CGFloat, standard: CGFloat, card: CGFloat) {
        self.tight = tight
        self.standard = standard
        self.card = card
    }

    public static var `default`: HudThemeRadius {
        HudThemeRadius(
            tight:    HudRadius.tight,
            standard: HudRadius.standard,
            card:     HudRadius.card
        )
    }
}

public struct HudThemeFocus: Sendable, Equatable {
    public var ring:      Color
    public var ringWidth: CGFloat

    public init(ring: Color, ringWidth: CGFloat) {
        self.ring = ring
        self.ringWidth = ringWidth
    }

    public static var `default`: HudThemeFocus {
        HudThemeFocus(
            ring:      HudFocus.ring,
            ringWidth: HudFocus.ringWidth
        )
    }
}

// MARK: - Environment plumbing

private struct HudThemeKey: EnvironmentKey {
    static let defaultValue: HudTheme = .default
}

extension EnvironmentValues {
    /// The active Hudson theme. Default is `HudTheme.default` (dark, matching
    /// the static `HudPalette` constants). Override per subtree with
    /// `.environment(\.hudTheme, customTheme)`.
    public var hudTheme: HudTheme {
        get { self[HudThemeKey.self] }
        set { self[HudThemeKey.self] = newValue }
    }
}

extension View {
    /// Convenience for setting the Hudson theme on a view subtree.
    ///
    /// ```swift
    /// MyAppRoot()
    ///     .hudTheme(.lightDraft)
    /// ```
    public func hudTheme(_ theme: HudTheme) -> some View {
        environment(\.hudTheme, theme)
    }
}
