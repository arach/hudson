import Foundation
import SwiftUI
import HudsonUI

// MARK: - Deprecated compatibility shim
//
// Resizing is a behavior of `HudNavigationSidebar`, not a separate component.
// This type stays for one compatibility cycle as sugar over the same internal
// resize host (`HudSidebarResizeHost`) the canonical
// `HudNavigationSidebar.resizable(isCompact:labelWidth:)` modifier uses, so
// there is exactly one rendering path and one gesture implementation.
//
// Migration:
//
//     HudResizableNavigationSidebar(
//         selection: $section, entries: entries,
//         isCompact: $isCompact, labelWidth: $labelWidth,
//         railHeader: { ... }, labelHeader: { ... }
//     )
//
// becomes:
//
//     HudNavigationSidebar(
//         selection: $section, entries: entries, isCompact: isCompact,
//         railHeader: { ... }, labelHeader: { ... }
//     )
//     .resizable(isCompact: $isCompact, labelWidth: $labelWidth)

@available(*, deprecated, message: "Use HudNavigationSidebar(...).resizable(isCompact:labelWidth:) instead.")
public struct HudResizableNavigationSidebar<
    Selection: Hashable,
    RailHeader: View,
    LabelHeader: View,
    Footer: View
>: View {
    private let selection: Binding<Selection?>
    private let isCompact: Binding<Bool>
    private let labelWidth: Binding<CGFloat>

    private let entries: [HudSidebarEntry<Selection>]
    private let accent: Color?
    private let geometry: HudSidebarResizeGeometry
    private let leadingInset: CGFloat
    private let onResizePhaseChange: (Bool) -> Void
    private let railHeader: RailHeader
    private let labelHeader: LabelHeader
    private let footer: Footer

    public init(
        selection: Binding<Selection?>,
        entries: [HudSidebarEntry<Selection>],
        isCompact: Binding<Bool>,
        labelWidth: Binding<CGFloat>,
        accent: Color? = nil,
        minLabelWidth: CGFloat = 100,
        maxLabelWidth: CGFloat = 360,
        collapseLabelWidth: CGFloat = 44,
        activationDistance: CGFloat = 6,
        leadingInset: CGFloat = HudSidebarLayout.leadingInset,
        onResizePhaseChange: @escaping (Bool) -> Void = { _ in },
        @ViewBuilder railHeader: () -> RailHeader,
        @ViewBuilder labelHeader: () -> LabelHeader,
        @ViewBuilder footer: () -> Footer
    ) {
        self.selection = selection
        self.isCompact = isCompact
        self.labelWidth = labelWidth
        self.entries = entries
        self.accent = accent
        self.geometry = HudSidebarResizeGeometry(
            minLabelWidth: minLabelWidth,
            maxLabelWidth: maxLabelWidth,
            collapseLabelWidth: collapseLabelWidth,
            activationDistance: activationDistance
        )
        self.leadingInset = leadingInset
        self.onResizePhaseChange = onResizePhaseChange
        self.railHeader = railHeader()
        self.labelHeader = labelHeader()
        self.footer = footer()
    }

    public var body: some View {
        HudSidebarResizeHost(
            selection: selection,
            entries: entries,
            isCompact: isCompact,
            labelWidth: labelWidth,
            variant: .standard,
            accent: accent,
            geometry: geometry,
            leadingInset: leadingInset,
            onHeaderTap: nil,
            onResizePhaseChange: onResizePhaseChange,
            railHeader: railHeader,
            labelHeader: labelHeader,
            verticalTabs: nil,
            footer: footer
        )
    }
}

@available(*, deprecated, message: "Use HudNavigationSidebar(...).resizable(isCompact:labelWidth:) instead.")
extension HudResizableNavigationSidebar where Footer == EmptyView {
    public init(
        selection: Binding<Selection?>,
        entries: [HudSidebarEntry<Selection>],
        isCompact: Binding<Bool>,
        labelWidth: Binding<CGFloat>,
        accent: Color? = nil,
        minLabelWidth: CGFloat = 100,
        maxLabelWidth: CGFloat = 360,
        collapseLabelWidth: CGFloat = 44,
        activationDistance: CGFloat = 6,
        leadingInset: CGFloat = HudSidebarLayout.leadingInset,
        onResizePhaseChange: @escaping (Bool) -> Void = { _ in },
        @ViewBuilder railHeader: () -> RailHeader,
        @ViewBuilder labelHeader: () -> LabelHeader
    ) {
        self.init(
            selection: selection,
            entries: entries,
            isCompact: isCompact,
            labelWidth: labelWidth,
            accent: accent,
            minLabelWidth: minLabelWidth,
            maxLabelWidth: maxLabelWidth,
            collapseLabelWidth: collapseLabelWidth,
            activationDistance: activationDistance,
            leadingInset: leadingInset,
            onResizePhaseChange: onResizePhaseChange,
            railHeader: railHeader,
            labelHeader: labelHeader,
            footer: { EmptyView() }
        )
    }
}
