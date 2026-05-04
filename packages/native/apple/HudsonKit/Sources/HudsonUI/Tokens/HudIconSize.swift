import CoreGraphics

/// Icon container dimensions — recurring `.frame(width: N, height: N)` pairs
/// extracted from list rows, settings, voice/terminal panels, and demo
/// thumbnails.
///
/// Values reflect the patterns already in HudListRow / HudSettings / etc., so
/// this token is descriptive of current convention, not a new design choice.
public enum HudIconSize {
    public static let micro:  CGFloat = 18   // inline list-row glyphs
    public static let small:  CGFloat = 22   // chrome chips
    public static let medium: CGFloat = 28   // settings rows, secondary chips
    public static let large:  CGFloat = 32   // primary list-row icons, voice mic
    public static let xLarge: CGFloat = 40
    public static let huge:   CGFloat = 48
    public static let hero:   CGFloat = 64   // connect-flow target tile
    public static let heroXL: CGFloat = 72   // canvas target tile
}

/// Indicator dot dimensions — small badges, status dots, dot-row markers.
public enum HudDotSize {
    public static let micro:  CGFloat = 4
    public static let tiny:   CGFloat = 5
    public static let small:  CGFloat = 6
    public static let medium: CGFloat = 8
    public static let large:  CGFloat = 12
}

/// Stroke widths used for hairlines, separators, focus rings.
///
/// Pairs with HudHairline (color) so the call site reads `Rectangle()
/// .fill(HudHairline.subtle).frame(width: HudStrokeWidth.thin)`.
public enum HudStrokeWidth {
    public static let thin:     CGFloat = 0.5
    public static let standard: CGFloat = 1
    public static let bold:     CGFloat = 2
}
