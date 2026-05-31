import CoreGraphics

// MARK: - HudSidebarLayout
//
// Geometry tokens for the two-column sidebar.
//
//   ┌──────┬───────────────────────────┐
//   │ rail │ label                     │
//   │  32  │   200 → 0  (animates)     │
//   └──────┴───────────────────────────┘
//
// Rail: fixed 32pt column, icons centered. Never animated.
// Label: variable-width column. Width animates from labelWidth → 0 via
//   `progress` (0 = expanded, 1 = compact). Text inside is fixed-size and
//   clipped from the right — icons cannot bounce because their x-position
//   depends on nothing that animates.
//
// All values sit on the 8pt grid via HudSpacing.

public enum HudSidebarLayout {

    // ── Columns ──────────────────────────────────────────────────────────────

    /// Fixed icon column at the leading edge. Icons center on x = railWidth/2.
    public static let railWidth: CGFloat = 32

    /// Maximum width of the animated label column when fully expanded.
    public static let labelWidth: CGFloat = 200

    /// Static breathing room between the host window edge and the rail.
    /// Applied by resizable sidebar hosts outside `HudNavigationSidebar` so
    /// the rail's internal icon geometry stays fixed while the whole sidebar
    /// sits comfortably away from the window edge.
    public static let leadingInset: CGFloat = 6

    // ── Cells ────────────────────────────────────────────────────────────────

    /// Height of a single nav row.
    public static let rowHeight: CGFloat = 30

    /// Height of the section-header label cell.
    public static let sectionHeaderHeight: CGFloat = 28

    /// Vertical gap inserted above a section header (breathing room between groups).
    public static let sectionTopGap: CGFloat = 8  // HudSpacing.md

    // ── Header ───────────────────────────────────────────────────────────────

    /// Height of the logo / wordmark header row.
    public static let headerHeight: CGFloat = 44

    /// Padding above the header — keeps the logo clear of the traffic-light cluster.
    public static let headerTopPadding: CGFloat = 18

    /// Padding below the header before the first nav row.
    public static let headerBottomPadding: CGFloat = 4  // HudSpacing.xs

    // ── Glyphs ───────────────────────────────────────────────────────────────

    /// SF Symbol point size for row icons.
    public static let iconSize: CGFloat = 15

    // ── Label inset ──────────────────────────────────────────────────────────

    /// Horizontal inset between the rail's trailing edge and the label text.
    public static let labelLeading: CGFloat = 4  // HudSpacing.xs

    // ── Selection underlay ───────────────────────────────────────────────────

    public static let selectionCornerRadius: CGFloat = 6      // HudRadius.standard
    public static let selectionHorizontalInset: CGFloat = 4   // HudSpacing.xs
    public static let selectionVerticalInset: CGFloat = 2     // HudSpacing.xxs

    // ── Compact accent bar ───────────────────────────────────────────────────

    /// Width and height of the bottom accent bar shown in compact (icon-only) mode.
    public static let compactAccentBarWidth: CGFloat = 16
    public static let compactAccentBarHeight: CGFloat = 2

    // ── Liquid-glass surface ─────────────────────────────────────────────────

    /// Inset applied around the surface when `surface == .liquidGlass`.
    /// Lets the rounded floating shape read against the window background.
    public static let liquidGlassInset: CGFloat = 6

    /// Continuous corner radius for the liquid-glass surface.
    public static let liquidGlassCornerRadius: CGFloat = 10

    // ── Convenience ──────────────────────────────────────────────────────────

    /// Full expanded width (rail + label columns).
    public static let totalWidth: CGFloat = railWidth + labelWidth

    /// Intrinsic width at a given progress (0 = expanded, 1 = compact).
    /// The host uses this to size its column slot; only the label column's
    /// width changes — the rail column stays fixed.
    /// Pass an explicit `labelWidth` when the sidebar instance overrides the default
    /// (e.g., user-resizable expanded width persisted via `@AppStorage`).
    public static func intrinsicWidth(progress: Double, labelWidth: CGFloat = HudSidebarLayout.labelWidth) -> CGFloat {
        railWidth + max(0, labelWidth * CGFloat(1 - progress))
    }
}
