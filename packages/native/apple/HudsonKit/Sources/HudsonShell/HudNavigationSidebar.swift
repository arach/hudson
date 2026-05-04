import SwiftUI
import HudsonUI
import HudsonObservability

// MARK: - HudSidebarItem

/// One selectable row in the sidebar. `id` is the type-safe selection key.
/// `selectedIcon` is the SF Symbol name to use when this item is active —
/// typically the `.fill` variant of `icon`.
public struct HudSidebarItem<Selection: Hashable>: Identifiable, Equatable {
    public let id: Selection
    public let title: String
    public let icon: String
    public let selectedIcon: String?
    public let tooltipLabel: String?

    public init(
        id: Selection,
        title: String,
        icon: String,
        selectedIcon: String? = nil,
        tooltipLabel: String? = nil
    ) {
        self.id = id
        self.title = title
        self.icon = icon
        self.selectedIcon = selectedIcon
        self.tooltipLabel = tooltipLabel
    }

    public static func == (lhs: HudSidebarItem, rhs: HudSidebarItem) -> Bool {
        lhs.id == rhs.id
    }
}

extension HudSidebarItem: Sendable where Selection: Sendable {}

// MARK: - HudSidebarEntry

/// An entry in the sidebar — either a selectable item or a section header.
public enum HudSidebarEntry<Selection: Hashable>: Identifiable {
    case item(HudSidebarItem<Selection>)
    case section(id: String, title: String)

    public var id: String {
        switch self {
        case .item(let item):       return "item-\(item.id.hashValue)"
        case .section(let id, _):  return "section-\(id)"
        }
    }
}

// MARK: - HudNavigationSidebar

/// Two-column navigation sidebar for `HudAppShell`'s leading slot.
///
/// The key structural property: icons live in a fixed-width rail column that
/// never animates. Labels live in a parallel column whose WIDTH animates from
/// `labelWidth → 0` as `progress` goes from 0 (expanded) to 1 (compact).
/// Because icon x-positions depend only on the fixed rail column, they cannot
/// bounce during the transition.
///
/// Brand accent defaults to `manifest.accent` from `@Environment(\.hudsonAppManifest)`.
/// Pass an explicit `accent` to override per call-site.
///
/// Motion respects `@Environment(\.accessibilityReduceMotion)` — all animations
/// are skipped when reduced motion is on.
public struct HudNavigationSidebar<
    Selection: Hashable,
    RailHeader: View,
    LabelHeader: View,
    Footer: View
>: View {

    @Binding public var selection: Selection?
    public let entries: [HudSidebarEntry<Selection>]
    public let progress: Double
    public let accent: Color?           // nil = use manifest.accent
    public let labelWidth: CGFloat      // expanded label-column width; defaults to HudSidebarLayout.labelWidth
    public let railHeader: RailHeader
    public let labelHeader: LabelHeader
    public let footer: Footer

    @Environment(\.hudsonAppManifest) private var manifest
    @Environment(\.hudsonSidebarStyle) private var style
    @Environment(\.hudsonSidebarMotionMode) private var motionMode
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        selection: Binding<Selection?>,
        entries: [HudSidebarEntry<Selection>],
        progress: Double,
        accent: Color? = nil,
        labelWidth: CGFloat = HudSidebarLayout.labelWidth,
        @ViewBuilder railHeader: () -> RailHeader,
        @ViewBuilder labelHeader: () -> LabelHeader,
        @ViewBuilder footer: () -> Footer
    ) {
        self._selection = selection
        self.entries = entries
        self.progress = progress
        self.accent = accent
        self.labelWidth = labelWidth
        self.railHeader = railHeader()
        self.labelHeader = labelHeader()
        self.footer = footer()
    }

    // MARK: Resolved accent

    private var resolvedAccent: Color { accent ?? manifest.accent }

    // MARK: Motion helpers

    private var labelsSettled: Bool { progress < 0.001 }
    private var compactSettled: Bool { progress > 0.999 }

    /// Opacity for label-column content.
    private var labelOpacity: Double {
        switch motionMode {
        case .smoothFade:                        return 1 - progress
        case .quietTransition, .snapEverything:  return labelsSettled ? 1 : 0
        }
    }

    /// Opacity for the expanded-mode selection underlay.
    private var underlayOpacity: Double {
        switch motionMode {
        case .smoothFade:                        return max(0, 1 - progress * 2)
        case .quietTransition, .snapEverything:  return labelsSettled ? 1 : 0
        }
    }

    /// Opacity for the compact-mode bottom accent bar.
    private var compactBarOpacity: Double {
        switch motionMode {
        case .smoothFade:                        return progress
        case .quietTransition, .snapEverything:  return compactSettled ? 1 : 0
        }
    }

    // MARK: Body

    public var body: some View {
        let isLiquid = (style.surface == .liquidGlass)
        let glass = style.liquidGlass
        let inset: CGFloat = isLiquid ? glass.inset : 0
        let radius: CGFloat = isLiquid ? glass.cornerRadius : 0
        let strokeColor: Color = glass.accent ?? Color.white.opacity(0.08)
        let strokeOpacity: Double = glass.accent == nil ? 1.0 : 0.45
        let intrinsic = HudSidebarLayout.intrinsicWidth(progress: progress, labelWidth: labelWidth)

        return VStack(spacing: 0) {
            sidebarBody
            Spacer(minLength: 0)
            footerBlock
        }
        // Self-size to intrinsic width so the whole sidebar narrows as `progress` goes 0→1.
        // The donor relied on a NavigationSplitView column to clip; standalone hosts need
        // the sidebar to own its width. Hosts that want different sizing can wrap in their
        // own `.frame(width:)`.
        .frame(width: intrinsic, alignment: .leading)
        .frame(maxHeight: .infinity)
        // In .liquidGlass mode, push the surface in by `inset` so its rounded edge floats
        // against the window background. .padding lives OUTSIDE .frame so the inner
        // content keeps its rail/label geometry; only the outer (host-facing) bounds grow.
        .padding(inset)
        .background {
            if isLiquid {
                #if os(macOS)
                HudVisualEffectView(material: .sidebar, blendingMode: .behindWindow)
                    .opacity(glass.translucency)
                    .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .strokeBorder(strokeColor.opacity(strokeOpacity), lineWidth: 0.5)
                    )
                    .padding(inset)
                    .allowsHitTesting(false)
                #else
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(.regularMaterial)
                    .opacity(glass.translucency)
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .strokeBorder(strokeColor.opacity(strokeOpacity), lineWidth: 0.5)
                    )
                    .padding(inset)
                    .allowsHitTesting(false)
                #endif
            } else {
                SidebarSurface(style: style.surface)
            }
        }
        .overlay(alignment: .trailing) {
            if !isLiquid {
                SidebarTrailingRule(style: style.surface)
            }
        }
    }

    // MARK: Main body (header + rows)

    private var sidebarBody: some View {
        ZStack(alignment: .topLeading) {
            selectionUnderlay
            HStack(alignment: .top, spacing: 0) {
                railColumn
                labelColumn
            }
            compactAccentBar
        }
    }

    // MARK: Footer

    /// Footer slot. Spans the sidebar's full intrinsic width so consumers can
    /// fit picker controls, account chips, etc. when expanded — and naturally
    /// clips to rail width when compact (the parent's outer frame does the clip).
    /// Consumers wanting a rail-only icon can constrain themselves with
    /// `.frame(width: HudSidebarLayout.railWidth, alignment: .leading)`.
    @ViewBuilder
    private var footerBlock: some View {
        if Footer.self != EmptyView.self {
            VStack(spacing: 0) {
                HudDivider(color: HudHairline.subtle)
                footer
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, HudSpacing.xs)
            }
        }
    }

    // MARK: Rail column

    private var railColumn: some View {
        VStack(spacing: 0) {
            railHeader
                .frame(width: HudSidebarLayout.railWidth, height: HudSidebarLayout.headerHeight)
                .padding(.top, HudSidebarLayout.headerTopPadding)
                .padding(.bottom, HudSidebarLayout.headerBottomPadding)

            ForEach(entries) { entry in
                railCell(for: entry)
            }
        }
        .frame(width: HudSidebarLayout.railWidth)
    }

    @ViewBuilder
    private func railCell(for entry: HudSidebarEntry<Selection>) -> some View {
        switch entry {
        case .item(let item):
            HudSidebarRailIcon(
                item: item,
                isSelected: selection == item.id,
                accent: resolvedAccent,
                progress: progress,
                compactBarOpacity: compactBarOpacity,
                style: style,
                reduceMotion: reduceMotion,
                onTap: {
                    selectItem(item)
                }
            )
            .frame(width: HudSidebarLayout.railWidth, height: HudSidebarLayout.rowHeight)

        case .section:
            // Empty rail cell — same height as the label column's section header
            // so the two columns stay y-aligned.
            Color.clear
                .frame(
                    width: HudSidebarLayout.railWidth,
                    height: HudSidebarLayout.sectionTopGap + HudSidebarLayout.sectionHeaderHeight
                )
        }
    }

    // MARK: Label column

    private var labelColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            labelHeader
                .frame(height: HudSidebarLayout.headerHeight, alignment: .leading)
                .padding(.top, HudSidebarLayout.headerTopPadding)
                .padding(.bottom, HudSidebarLayout.headerBottomPadding)
                .padding(.leading, HudSidebarLayout.labelLeading)

            ForEach(entries) { entry in
                labelCell(for: entry)
            }
        }
        // Width animates from labelWidth → 0. Text inside is fixed-size and
        // clipped from the right — labels never reflow, icons never move.
        .frame(width: max(0, labelWidth * (1 - progress)), alignment: .leading)
        .clipped()
        .opacity(labelOpacity)
        .animation(nil, value: labelsSettled)
        .allowsHitTesting(labelsSettled)
    }

    @ViewBuilder
    private func labelCell(for entry: HudSidebarEntry<Selection>) -> some View {
        switch entry {
        case .item(let item):
            let isSelected = selection == item.id
            Text(item.title)
                .font(HudFont.ui(HudTextSize.base, weight: isSelected ? .semibold : .medium))
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .foregroundStyle(isSelected ? HudPalette.ink : HudPalette.muted)
                .padding(.leading, HudSidebarLayout.labelLeading)
                .frame(height: HudSidebarLayout.rowHeight, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture { selectItem(item) }

        case .section(_, let title):
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: HudSidebarLayout.sectionTopGap)
                Text(title.uppercased())
                    .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                    .tracking(HudTracking.wider)
                    .foregroundStyle(HudPalette.dim)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(.leading, HudSidebarLayout.labelLeading)
                    .frame(height: HudSidebarLayout.sectionHeaderHeight, alignment: .bottomLeading)
            }
        }
    }

    // MARK: Selection underlay

    @ViewBuilder
    private var selectionUnderlay: some View {
        if let y = selectionY {
            SidebarSelectionUnderlay(style: style.indicator, accent: resolvedAccent)
                .opacity(underlayOpacity)
                .animation(nil, value: labelsSettled)
                .offset(y: y)
                // Slide animation respects reduce-motion.
                .animation(
                    reduceMotion ? nil : style.motion.selectionSlide,
                    value: y
                )
                .allowsHitTesting(false)
        }
    }

    // MARK: Compact accent bar

    @ViewBuilder
    private var compactAccentBar: some View {
        if let y = selectionY {
            SidebarCompactAccent(style: style.indicator, accent: resolvedAccent)
                .offset(y: y)
                .opacity(compactBarOpacity)
                .animation(
                    reduceMotion ? nil : style.motion.selectionSlide,
                    value: y
                )
                .animation(nil, value: compactSettled)
                .allowsHitTesting(false)
        }
    }

    // MARK: Geometry helpers

    /// Y-offset of the selected row, measured from the top of the sidebar body.
    /// Computed from the entries array — no GeometryReader needed.
    private var selectionY: CGFloat? {
        guard let selection else { return nil }
        var y: CGFloat = HudSidebarLayout.headerTopPadding
                       + HudSidebarLayout.headerHeight
                       + HudSidebarLayout.headerBottomPadding
        for entry in entries {
            switch entry {
            case .item(let item):
                if item.id == selection { return y }
                y += HudSidebarLayout.rowHeight
            case .section:
                y += HudSidebarLayout.sectionTopGap + HudSidebarLayout.sectionHeaderHeight
            }
        }
        return nil
    }

    // MARK: Selection with instrumentation

    private func selectItem(_ item: HudSidebarItem<Selection>) {
        let metadata = selectionMetadata(for: item)
        HudInstrumentation.ui.event("Sidebar.select", metadata: metadata)
        HudInstrumentation.ui.span("Sidebar.select.apply", metadata: metadata) {
            selection = item.id
        }
    }

    private func selectionMetadata(for item: HudSidebarItem<Selection>) -> [String: String] {
        [
            "changed":    "\(selection != item.id)",
            "compact":    "\(progress > 0.5)",
            "itemCount":  "\(entries.count)",
            "progress":   String(format: "%.2f", progress),
        ]
    }
}

// MARK: - Convenience init (no footer)

extension HudNavigationSidebar where Footer == EmptyView {
    public init(
        selection: Binding<Selection?>,
        entries: [HudSidebarEntry<Selection>],
        progress: Double,
        accent: Color? = nil,
        labelWidth: CGFloat = HudSidebarLayout.labelWidth,
        @ViewBuilder railHeader: () -> RailHeader,
        @ViewBuilder labelHeader: () -> LabelHeader
    ) {
        self.init(
            selection: selection,
            entries: entries,
            progress: progress,
            accent: accent,
            labelWidth: labelWidth,
            railHeader: railHeader,
            labelHeader: labelHeader,
            footer: { EmptyView() }
        )
    }
}

// MARK: - Convenience init (isCompact: Bool — friendlier for the common case)
//
// `progress: Double` is the advanced contract for design-tool scrubbing and
// continuous animation control. Most consumers want a simple boolean and let
// the caller wrap the toggle in `withAnimation(...)`.

extension HudNavigationSidebar {
    /// Convenience init taking `isCompact: Bool`. `false` = expanded (progress 0),
    /// `true` = compact (progress 1). Wrap the toggle in
    /// `withAnimation(HudMotion.chromeSpring)` at the call site to animate.
    public init(
        selection: Binding<Selection?>,
        entries: [HudSidebarEntry<Selection>],
        isCompact: Bool,
        accent: Color? = nil,
        labelWidth: CGFloat = HudSidebarLayout.labelWidth,
        @ViewBuilder railHeader: () -> RailHeader,
        @ViewBuilder labelHeader: () -> LabelHeader,
        @ViewBuilder footer: () -> Footer
    ) {
        self.init(
            selection: selection,
            entries: entries,
            progress: isCompact ? 1.0 : 0.0,
            accent: accent,
            labelWidth: labelWidth,
            railHeader: railHeader,
            labelHeader: labelHeader,
            footer: footer
        )
    }
}

extension HudNavigationSidebar where Footer == EmptyView {
    /// `isCompact: Bool` convenience init with no footer slot.
    public init(
        selection: Binding<Selection?>,
        entries: [HudSidebarEntry<Selection>],
        isCompact: Bool,
        accent: Color? = nil,
        labelWidth: CGFloat = HudSidebarLayout.labelWidth,
        @ViewBuilder railHeader: () -> RailHeader,
        @ViewBuilder labelHeader: () -> LabelHeader
    ) {
        self.init(
            selection: selection,
            entries: entries,
            progress: isCompact ? 1.0 : 0.0,
            accent: accent,
            labelWidth: labelWidth,
            railHeader: railHeader,
            labelHeader: labelHeader,
            footer: { EmptyView() }
        )
    }
}

// MARK: - Surface background

/// Background plane for the sidebar. Mirrors the donor's per-style logic
/// but uses `HudPalette.chrome` as the base surface so it stays
/// consistent with the rail and inspector.
private struct SidebarSurface: View {
    let style: HudSidebarSurfaceStyle

    var body: some View {
        switch style {
        case .base:
            // Subtle top-to-bottom gradient over chrome so the sidebar reads
            // slightly brighter near the window title bar.
            ZStack {
                HudPalette.chrome
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.045),
                        Color.white.opacity(0.020),
                    ],
                    startPoint: .top, endPoint: .bottom
                )
            }
            .allowsHitTesting(false)

        case .glass:
            ZStack {
                Rectangle().fill(.ultraThinMaterial).opacity(0.55)
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.040),
                        Color.white.opacity(0.018),
                        Color.black.opacity(0.060),
                    ],
                    startPoint: .top, endPoint: .bottom
                )
            }
            .allowsHitTesting(false)

        case .editorial:
            // Flat, slightly lighter than chrome — "print" surface.
            HudPalette.surface
                .opacity(0.6)
                .allowsHitTesting(false)

        case .liquidGlass:
            // Rendered directly in HudNavigationSidebar.body so the inset/round
            // floating treatment can size against the outer bounds.
            EmptyView()
        }
    }
}

// MARK: - Trailing separator

/// One-pixel right-edge rule that separates the sidebar from content.
/// Matches `HudHairline.standard` in base/editorial modes; gradient for glass.
private struct SidebarTrailingRule: View {
    let style: HudSidebarSurfaceStyle

    var body: some View {
        switch style {
        case .glass:
            LinearGradient(
                colors: [
                    Color.white.opacity(0.02),
                    Color.white.opacity(0.10),
                    Color.white.opacity(0.02),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .frame(width: 0.5)

        case .base, .editorial:
            Rectangle()
                .fill(HudHairline.standard)
                .frame(width: 0.5)

        case .liquidGlass:
            // No trailing rule — the rounded floating surface defines its own edge.
            EmptyView()
        }
    }
}

// MARK: - Expanded selection underlay

/// Accent-tinted fill drawn behind the selected row in expanded mode.
/// Fades out as progress → 1 (compact). The compact-mode accent bar takes
/// over when fully compact.
private struct SidebarSelectionUnderlay: View {
    let style: HudSidebarIndicatorStyle
    let accent: Color

    var body: some View {
        switch style {
        case .base:
            RoundedRectangle(cornerRadius: HudSidebarLayout.selectionCornerRadius)
                .fill(accent.opacity(0.14))
                .frame(height: HudSidebarLayout.rowHeight - HudSidebarLayout.selectionVerticalInset * 2)
                .padding(.horizontal, HudSidebarLayout.selectionHorizontalInset)
                .padding(.vertical, HudSidebarLayout.selectionVerticalInset)

        case .glass:
            ZStack {
                RoundedRectangle(cornerRadius: HudSidebarLayout.selectionCornerRadius + 2)
                    .fill(accent.opacity(0.22))
                    .blur(radius: 8)
                    .padding(.horizontal, max(0, HudSidebarLayout.selectionHorizontalInset - 2))
                    .padding(.vertical, max(0, HudSidebarLayout.selectionVerticalInset - 1))

                RoundedRectangle(cornerRadius: HudSidebarLayout.selectionCornerRadius)
                    .fill(
                        LinearGradient(
                            colors: [accent.opacity(0.22), accent.opacity(0.10)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: HudSidebarLayout.selectionCornerRadius)
                            .strokeBorder(accent.opacity(0.35), lineWidth: 0.5)
                    )
                    .padding(.horizontal, HudSidebarLayout.selectionHorizontalInset)
                    .padding(.vertical, HudSidebarLayout.selectionVerticalInset)
            }
            .frame(height: HudSidebarLayout.rowHeight)

        case .editorial:
            // 2pt leading stripe — same shape visible in both expanded and compact modes
            // so the indicator is continuous through the transition.
            HStack(spacing: 0) {
                Rectangle()
                    .fill(accent)
                    .frame(width: 2)
                    .padding(.vertical, HudSpacing.xs)
                Spacer(minLength: 0)
            }
            .frame(height: HudSidebarLayout.rowHeight)

        case .kinetic:
            // Slightly more vivid fill; the kinetic feel comes from the spring
            // configured in HudSidebarMotionStyle.kinetic.
            RoundedRectangle(cornerRadius: HudSidebarLayout.selectionCornerRadius)
                .fill(accent.opacity(0.18))
                .frame(height: HudSidebarLayout.rowHeight - HudSidebarLayout.selectionVerticalInset * 2)
                .padding(.horizontal, HudSidebarLayout.selectionHorizontalInset)
                .padding(.vertical, HudSidebarLayout.selectionVerticalInset)
        }
    }
}

// MARK: - Compact accent bar

/// Bottom accent indicator for compact (icon-only) mode.
/// Positioned by the parent via `offset(y:)` so it slides between rows.
private struct SidebarCompactAccent: View {
    let style: HudSidebarIndicatorStyle
    let accent: Color

    var body: some View {
        switch style {
        case .base, .kinetic:
            // Centered bottom bar under the icon.
            RoundedRectangle(cornerRadius: 1)
                .fill(accent)
                .frame(
                    width: HudSidebarLayout.compactAccentBarWidth,
                    height: HudSidebarLayout.compactAccentBarHeight
                )
                .frame(width: HudSidebarLayout.railWidth, alignment: .center)
                .frame(height: HudSidebarLayout.rowHeight, alignment: .bottom)

        case .glass:
            // Glowing vertical rod at the leading edge — floats in the rail.
            ZStack {
                Capsule()
                    .fill(accent.opacity(0.55))
                    .frame(width: 6, height: 18)
                    .blur(radius: 4)
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [accent.opacity(0.95), accent.opacity(0.65)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .frame(width: 2, height: 16)
            }
            .frame(width: HudSidebarLayout.railWidth, alignment: .leading)
            .frame(height: HudSidebarLayout.rowHeight, alignment: .center)
            .padding(.leading, HudSpacing.xxs)

        case .editorial:
            // Leading 2pt stripe — same shape as the expanded underlay for
            // visual continuity through the transition.
            HStack(spacing: 0) {
                Rectangle()
                    .fill(accent)
                    .frame(width: 2)
                    .padding(.vertical, HudSpacing.xs)
                Spacer(minLength: 0)
            }
            .frame(width: HudSidebarLayout.railWidth, height: HudSidebarLayout.rowHeight)
        }
    }
}
