import SwiftUI

/// Hudson typography — native counterpart to the `--hud-text-*`, `--hud-leading-*`,
/// `--hud-tracking-*`, `--hud-weight-*`, and `--hud-font-*` tokens defined in
/// `hudsonkit/theme`.
///
/// `HudFont.mono(_:weight:)` and `HudFont.ui(_:weight:)` are the primary
/// helpers — they pick up the system mono/sans designs to stay consistent with
/// the web font stack (`ui-monospace` / `system-ui`). Apps wanting custom faces
/// (JetBrains Mono, Hack Nerd, etc.) can override via HudAppManifest later.
public enum HudFont {
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
public enum HudTextSize {
    public static var micro: CGFloat { 9 }   // micro chevrons, mono single-char glyphs
    public static var xxs:   CGFloat { 10 }  // kickers, uppercase labels
    public static var xs:    CGFloat { 11 }  // metadata, timestamps
    public static var sm:    CGFloat { 12 }  // chrome body
    public static var base:  CGFloat { 13 }  // app body (default)
    public static var md:    CGFloat { 14 }  // prominent body
    public static var lgm:   CGFloat { 15 }  // hover-emphasis body (between md and lg)
    public static var lg:    CGFloat { 16 }  // card titles
    public static var xl:    CGFloat { 18 }  // section titles
    public static var xxl:   CGFloat { 22 }  // page titles
    public static var xxxl:  CGFloat { 28 }  // hero numbers / stats
    public static var hero:  CGFloat { 32 }  // splash / oversized hero
}

// MARK: - Leading

/// Line-height multipliers — `--hud-leading-{tight,snug,normal,relaxed}`.
public enum HudLeading {
    public static var tight:   CGFloat { 1.20 }
    public static var snug:    CGFloat { 1.35 }
    public static var normal:  CGFloat { 1.50 }
    public static var relaxed: CGFloat { 1.60 }
}

// MARK: - Tracking

/// Letter-spacing values — `--hud-tracking-{tight,normal,wide,wider,widest}`.
/// Web tokens are em-relative; native takes points and lets the call site
/// scale by font size where needed.
public enum HudTracking {
    public static var tight:   CGFloat { -0.4 }
    public static var normal:  CGFloat {  0.0 }
    public static var wide:    CGFloat {  0.5 }
    public static var wider:   CGFloat {  1.0 }
    public static var widest:  CGFloat {  1.5 }
}

// MARK: - Weight

/// Numeric weights mirroring `--hud-weight-{normal,medium,semibold,bold}`.
/// SwiftUI's `Font.Weight` enum is the usual call-site type; this keeps token
/// parity for code-gen and design-doc references.
public enum HudWeight {
    public static var normal:   Font.Weight { .regular }
    public static var medium:   Font.Weight { .medium }
    public static var semibold: Font.Weight { .semibold }
    public static var bold:     Font.Weight { .bold }
}

// MARK: - Deprecated Hudson* aliases

@available(*, deprecated, renamed: "HudFont")
public typealias HudsonFont = HudFont
@available(*, deprecated, renamed: "HudTextSize")
public typealias HudsonTextSize = HudTextSize
@available(*, deprecated, renamed: "HudLeading")
public typealias HudsonLeading = HudLeading
@available(*, deprecated, renamed: "HudTracking")
public typealias HudsonTracking = HudTracking
@available(*, deprecated, renamed: "HudWeight")
public typealias HudsonWeight = HudWeight
