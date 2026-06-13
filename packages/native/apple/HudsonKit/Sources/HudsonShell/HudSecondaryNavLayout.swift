import CoreGraphics

/// Geometry tokens for the thin, expandable settings secondary navigation column.
///
/// Mirrors the Talkie settings sidebar contract: a locked 52pt icon rail in
/// compact mode, and a 140–360pt labeled column when expanded.
public enum HudSecondaryNavLayout {
    public static let compactWidth: CGFloat = 52
    public static let minExpandedWidth: CGFloat = 140
    public static let defaultExpandedWidth: CGFloat = 160
    public static let maxExpandedWidth: CGFloat = 360
    public static let collapseWidth: CGFloat = 80

    public static let compactColumnWidth: (min: CGFloat, ideal: CGFloat, max: CGFloat) = (compactWidth, compactWidth, compactWidth)

    public static let headerHeight: CGFloat = 40
    public static let headerTopPadding: CGFloat = 10
    public static let headerBottomPadding: CGFloat = 8

    public static let rowHeight: CGFloat = 28
    public static let rowVerticalPadding: CGFloat = 4
    public static let rowIconSize: CGFloat = 11
    public static let compactRowIconSize: CGFloat = 10

    public static let leftAccentWidth: CGFloat = 3
    public static let compactAccentBarWidth: CGFloat = 16
    public static let compactAccentBarHeight: CGFloat = 2

    public static let edgeHandleWidth: CGFloat = 4
    public static let edgeHandleHeight: CGFloat = 28

    public static let sectionTopGap: CGFloat = 16
    public static let sectionItemSpacing: CGFloat = 2
}