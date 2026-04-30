import SwiftUI

/// Hudson typography — native counterpart to the `--hud-text-*`, `--hud-leading-*`,
/// `--hud-tracking-*`, `--hud-weight-*`, and `--hud-font-*` tokens defined in
/// `hudsonkit/theme`.
///
/// `HudsonFont.mono(_:weight:)` and `HudsonFont.ui(_:weight:)` are the primary
/// helpers — they pick up the system mono/sans designs to stay consistent with
/// the web font stack (`ui-monospace` / `system-ui`). Apps wanting custom faces
/// (JetBrains Mono, Hack Nerd, etc.) can override via HudsonAppManifest later.
public enum HudsonFont {
    public static func mono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

    public static func ui(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    public static func serif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
}

// MARK: - Size scale

/// Type size scale — `--hud-text-{xxs,xs,sm,base,md,lg,xl,2xl,3xl}`.
public enum HudsonTextSize {
    public static let xxs:   CGFloat = 10  // kickers, uppercase labels
    public static let xs:    CGFloat = 11  // metadata, timestamps
    public static let sm:    CGFloat = 12  // chrome body
    public static let base:  CGFloat = 13  // app body (default)
    public static let md:    CGFloat = 14  // prominent body
    public static let lg:    CGFloat = 16  // card titles
    public static let xl:    CGFloat = 18  // section titles
    public static let xxl:   CGFloat = 22  // page titles
    public static let xxxl:  CGFloat = 28  // hero numbers / stats
}

// MARK: - Leading

/// Line-height multipliers — `--hud-leading-{tight,snug,normal,relaxed}`.
public enum HudsonLeading {
    public static let tight:   CGFloat = 1.20
    public static let snug:    CGFloat = 1.35
    public static let normal:  CGFloat = 1.50
    public static let relaxed: CGFloat = 1.60
}

// MARK: - Tracking

/// Letter-spacing values — `--hud-tracking-{tight,normal,wide,wider,widest}`.
/// Web tokens are em-relative; native takes points and lets the call site
/// scale by font size where needed.
public enum HudsonTracking {
    public static let tight:   CGFloat = -0.4
    public static let normal:  CGFloat =  0.0
    public static let wide:    CGFloat =  0.5
    public static let wider:   CGFloat =  1.0
    public static let widest:  CGFloat =  1.5
}

// MARK: - Weight

/// Numeric weights mirroring `--hud-weight-{normal,medium,semibold,bold}`.
/// SwiftUI's `Font.Weight` enum is the usual call-site type; this keeps token
/// parity for code-gen and design-doc references.
public enum HudsonWeight {
    public static let normal:   Font.Weight = .regular
    public static let medium:   Font.Weight = .medium
    public static let semibold: Font.Weight = .semibold
    public static let bold:     Font.Weight = .bold
}

// MARK: - H-prefixed aliases

public typealias HFont = HudsonFont
public typealias HTextSize = HudsonTextSize
public typealias HLeading = HudsonLeading
public typealias HTracking = HudsonTracking
public typealias HWeight = HudsonWeight
