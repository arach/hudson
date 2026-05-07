import CoreGraphics
import SwiftUI

/// Spacing scale — synthesized from the values that recur across Lattices'
/// `LatsDesignSystem` and Hudson's web chrome. Lattices uses inline literals
/// (`spacing: 4`, `12`, `14`, `28`); these constants give native callers the
/// same vocabulary and let consumers override per-app via HudAppManifest.
public enum HudSpacing {
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
public enum HudRadius {
    public static let tight:    CGFloat = 3
    public static let standard: CGFloat = 6
    public static let card:     CGFloat = 8
}

// MARK: - Layout

/// Chrome dimensions ported from `SHELL_THEME.layout` in
/// `packages/web/hudsonkit/src/lib/theme.ts`. Native shells (HudsonShell) read
/// from this so iOS/iPadOS chrome stays dimensionally consistent with the web
/// shell where it makes sense.
public enum HudLayout {
    public static let navHeight:        CGFloat = 48
    public static let panelWidth:       CGFloat = 280
    public static let panelTopOffset:   CGFloat = 48
    public static let statusBarHeight:  CGFloat = 28
    public static let panelBottomOffset: CGFloat = 28

    // Control row heights — used by HudField, HudButton, HudSettings rows.
    public static let buttonHeight:     CGFloat = 32
    public static let fieldHeight:      CGFloat = 36
    public static let rowHeightCompact: CGFloat = 28
    public static let rowHeightRegular: CGFloat = 44

    // Common content widths — page caps for legibility, modal widths.
    public static let readableWidth:    CGFloat = 720
    public static let dialogWidth:      CGFloat = 560
    public static let popoverWidth:     CGFloat = 380
    public static let popoverWidthCompact: CGFloat = 340
    public static let cliffWidth:       CGFloat = 760

    // Primitive defaults — sizes for self-sized primitives (QR codes, avatars, etc).
    public static let qrCodeDefault:    CGFloat = 200
    public static let qrViewfinderSize: CGFloat = 250
    public static let textDocumentPreviewHeight: CGFloat = 360
    public static let textDocumentModeButtonHeight: CGFloat = 24
    public static let textDocumentLineNumberWidth: CGFloat = 36
}

// MARK: - Deprecated Hudson* aliases

@available(*, deprecated, renamed: "HudSpacing")
public typealias HudsonSpacing = HudSpacing
@available(*, deprecated, renamed: "HudRadius")
public typealias HudsonRadius = HudRadius
@available(*, deprecated, renamed: "HudLayout")
public typealias HudsonLayout = HudLayout

// MARK: - Liquid bar geometry

public enum HudLiquidBarMetrics {
    public static let minHeight: CGFloat = 56
    public static let itemMinHeight: CGFloat = 44
    public static let maxWidth: CGFloat = HudLayout.dialogWidth
    public static let selectionAnimation = Animation.spring(response: 0.32, dampingFraction: 0.8)
}
