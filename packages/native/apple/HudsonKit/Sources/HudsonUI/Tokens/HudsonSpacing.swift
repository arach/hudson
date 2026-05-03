import CoreGraphics

/// Spacing scale — synthesized from the values that recur across Lattices'
/// `LatsDesignSystem` and Hudson's web chrome. Lattices uses inline literals
/// (`spacing: 4`, `12`, `14`, `28`); these constants give native callers the
/// same vocabulary and let consumers override per-app via HudsonAppManifest.
public enum HudsonSpacing {
    public static let xxs: CGFloat = 2
    public static let xs:  CGFloat = 4
    public static let sm:  CGFloat = 6
    public static let md:  CGFloat = 8
    public static let lg:  CGFloat = 10
    public static let xl:  CGFloat = 12
    public static let xxl: CGFloat = 14
    public static let xxxl: CGFloat = 20
    public static let huge: CGFloat = 28
}

// MARK: - Radius

/// Corner-radius scale matching the `--hud-radius` web default and Lattices'
/// 3/6/8 hierarchy: `tight` for badges, `standard` for inset rows and small
/// controls, `card` for surface containers.
public enum HudsonRadius {
    public static let tight:    CGFloat = 3
    public static let standard: CGFloat = 6
    public static let card:     CGFloat = 8
}

// MARK: - Layout

/// Chrome dimensions ported from `SHELL_THEME.layout` in
/// `packages/web/hudsonkit/src/lib/theme.ts`. Native shells (HudsonShell) read
/// from this so iOS/iPadOS chrome stays dimensionally consistent with the web
/// shell where it makes sense.
public enum HudsonLayout {
    public static let navHeight:        CGFloat = 48
    public static let panelWidth:       CGFloat = 280
    public static let panelTopOffset:   CGFloat = 48
    public static let statusBarHeight:  CGFloat = 28
    public static let panelBottomOffset: CGFloat = 28
}

// MARK: - H-prefixed aliases

public typealias HSpacing = HudsonSpacing
public typealias HRadius = HudsonRadius
public typealias HLayout = HudsonLayout
