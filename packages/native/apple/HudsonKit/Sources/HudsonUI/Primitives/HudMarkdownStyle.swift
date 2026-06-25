import SwiftUI

// Typography + spacing skin for `HudMarkdownView`. The renderer stays one view;
// the *look* is data-driven through this struct so consumers can pick a
// treatment without forking the renderer.
//
// Two presets ship:
//   • `.mono`  — the original HudMarkdownView look (terminal-grade, all
//                monospaced, sizes derived from the call-site `contentSize`).
//                This is the default, so existing call sites are unchanged.
//   • `.agent` — UI-font body / headings / list text (sans), mono only for list
//                markers and code. Mirrors Scout's assistant-message renderer
//                closely enough to migrate onto HudMarkdownView.
//
// Colors are expressed as `ColorRole`s resolved against the active
// `@Environment(\.hudTheme)` palette at render time, so styles stay
// theme-compatible — a consumer recolors by injecting a theme, not by baking
// colors into the style.

public struct HudMarkdownStyle: Sendable {
    /// Palette slot a text role draws from. Resolved against the active theme.
    public enum ColorRole: Sendable, Equatable {
        case ink, muted, dim, accent

        public func color(in palette: HudThemePalette) -> Color {
            switch self {
            case .ink:    return palette.ink
            case .muted:  return palette.muted
            case .dim:    return palette.dim
            case .accent: return palette.accent
            }
        }
    }

    // Spacing
    public var blockSpacing: CGFloat
    public var listItemSpacing: CGFloat
    public var paragraphLineSpacing: CGFloat

    // Fonts. The `CGFloat` is the call-site `contentSize`; token-based styles may
    // ignore it. `headingFont` additionally receives the heading depth (1...6).
    public var bodyFont: @Sendable (CGFloat) -> Font
    public var headingFont: @Sendable (_ depth: Int, _ contentSize: CGFloat) -> Font
    public var listMarkerFont: @Sendable (CGFloat) -> Font
    public var blockquoteFont: @Sendable (CGFloat) -> Font
    public var tableHeaderFont: @Sendable (CGFloat) -> Font

    // Colors
    public var bodyColor: ColorRole
    public var headingColor: ColorRole
    public var listMarkerColor: ColorRole
    public var blockquoteColor: ColorRole
    public var tableHeaderColor: ColorRole
    public var tableCellColor: ColorRole

    // List marker gutter widths (ordered "12." needs more room than "•").
    public var orderedMarkerWidth: CGFloat
    public var unorderedMarkerWidth: CGFloat

    public init(
        blockSpacing: CGFloat,
        listItemSpacing: CGFloat,
        paragraphLineSpacing: CGFloat,
        bodyFont: @escaping @Sendable (CGFloat) -> Font,
        headingFont: @escaping @Sendable (Int, CGFloat) -> Font,
        listMarkerFont: @escaping @Sendable (CGFloat) -> Font,
        blockquoteFont: @escaping @Sendable (CGFloat) -> Font,
        tableHeaderFont: @escaping @Sendable (CGFloat) -> Font,
        bodyColor: ColorRole,
        headingColor: ColorRole,
        listMarkerColor: ColorRole,
        blockquoteColor: ColorRole,
        tableHeaderColor: ColorRole,
        tableCellColor: ColorRole,
        orderedMarkerWidth: CGFloat,
        unorderedMarkerWidth: CGFloat
    ) {
        self.blockSpacing = blockSpacing
        self.listItemSpacing = listItemSpacing
        self.paragraphLineSpacing = paragraphLineSpacing
        self.bodyFont = bodyFont
        self.headingFont = headingFont
        self.listMarkerFont = listMarkerFont
        self.blockquoteFont = blockquoteFont
        self.tableHeaderFont = tableHeaderFont
        self.bodyColor = bodyColor
        self.headingColor = headingColor
        self.listMarkerColor = listMarkerColor
        self.blockquoteColor = blockquoteColor
        self.tableHeaderColor = tableHeaderColor
        self.tableCellColor = tableCellColor
        self.orderedMarkerWidth = orderedMarkerWidth
        self.unorderedMarkerWidth = unorderedMarkerWidth
    }

    /// The original HudMarkdownView look: terminal-grade, all monospaced, sizes
    /// derived from `contentSize`. Default for every call site.
    public static let mono = HudMarkdownStyle(
        blockSpacing: 9,
        listItemSpacing: 5,
        paragraphLineSpacing: 2,
        bodyFont: { HudFont.mono($0) },
        headingFont: { depth, size in
            HudFont.mono(depth <= 1 ? size + 3 : (depth == 2 ? size + 1 : size), weight: .semibold)
        },
        listMarkerFont: { _ in HudFont.mono(11) },
        blockquoteFont: { HudFont.mono($0) },
        tableHeaderFont: { _ in HudFont.mono(11, weight: .semibold) },
        bodyColor: .ink,
        headingColor: .ink,
        listMarkerColor: .muted,
        blockquoteColor: .dim,
        tableHeaderColor: .dim,
        tableCellColor: .ink,
        orderedMarkerWidth: 20,
        unorderedMarkerWidth: 12
    )

    /// Assistant-message look: UI-font (sans) body / headings / list text, mono
    /// only for list markers and (via HudCodeBlock) code. Accent list markers.
    public static let agent = HudMarkdownStyle(
        blockSpacing: HudSpacing.md,
        listItemSpacing: HudSpacing.sm,
        paragraphLineSpacing: 2,
        bodyFont: { _ in HudFont.ui(HudTextSize.base) },
        headingFont: { depth, _ in
            HudFont.ui(depth <= 1 ? HudTextSize.lg : HudTextSize.md, weight: .semibold)
        },
        listMarkerFont: { _ in HudFont.mono(HudTextSize.sm, weight: .semibold) },
        blockquoteFont: { _ in HudFont.ui(HudTextSize.sm) },
        tableHeaderFont: { _ in HudFont.mono(HudTextSize.xs, weight: .semibold) },
        bodyColor: .ink,
        headingColor: .ink,
        listMarkerColor: .accent,
        blockquoteColor: .muted,
        tableHeaderColor: .dim,
        tableCellColor: .ink,
        orderedMarkerWidth: 24,
        unorderedMarkerWidth: 10
    )

    /// Alias for the default look.
    public static var `default`: HudMarkdownStyle { .mono }
}
