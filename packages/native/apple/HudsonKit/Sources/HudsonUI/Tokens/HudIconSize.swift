import CoreGraphics

/// Icon container dimensions — recurring `.frame(width: N, height: N)` pairs
/// extracted from list rows, settings, voice/terminal panels, and demo
/// thumbnails.
///
/// Values reflect the patterns already in HudListRow / HudSettings / etc., so
/// this token is descriptive of current convention, not a new design choice.
public enum HudIconSize {
    public static var micro:  CGFloat { 18 }   // inline list-row glyphs
    public static var small:  CGFloat { 22 }   // chrome chips
    public static var medium: CGFloat { 28 }   // settings rows, secondary chips
    public static var large:  CGFloat { 32 }   // primary list-row icons, voice mic
    public static var xLarge: CGFloat { 40 }
    public static var huge:   CGFloat { 48 }
    public static var hero:   CGFloat { 64 }   // connect-flow target tile
    public static var heroXL: CGFloat { 72 }   // canvas target tile
}

/// Indicator dot dimensions — small badges, status dots, dot-row markers.
public enum HudDotSize {
    public static var micro:  CGFloat { 4 }
    public static var tiny:   CGFloat { 5 }
    public static var small:  CGFloat { 6 }
    public static var medium: CGFloat { 8 }
    public static var large:  CGFloat { 12 }
}

/// Stroke widths used for hairlines, separators, focus rings.
///
/// Pairs with HudHairline (color) so the call site reads `Rectangle()
/// .fill(HudHairline.subtle).frame(width: HudStrokeWidth.thin)`.
public enum HudStrokeWidth {
    public static var thin:     CGFloat { 0.5 }
    public static var standard: CGFloat { 1 }
    public static var bold:     CGFloat { 2 }
}
