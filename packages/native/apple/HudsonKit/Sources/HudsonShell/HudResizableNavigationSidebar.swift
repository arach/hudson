import Foundation
import SwiftUI
import HudsonUI

#if os(macOS)
import AppKit
#endif

/// Talkie-derived host for `HudNavigationSidebar` with a resizable label column.
///
/// The sidebar still uses Hudson's fixed rail + animated label-column contract:
/// icons never move. This wrapper owns the missing shell behavior around it:
/// an edge handle, preview-then-commit resize in expanded mode,
/// drag-left-to-collapse, and drag-right-to-expand from compact mode.
public struct HudResizableNavigationSidebar<
    Selection: Hashable,
    RailHeader: View,
    LabelHeader: View,
    Footer: View
>: View {
    @Binding private var selection: Selection?
    @Binding private var isCompact: Bool
    @Binding private var labelWidth: CGFloat

    private let entries: [HudSidebarEntry<Selection>]
    private let accent: Color?
    private let minLabelWidth: CGFloat
    private let maxLabelWidth: CGFloat
    private let collapseLabelWidth: CGFloat
    private let activationDistance: CGFloat
    private let leadingInset: CGFloat
    private let onResizePhaseChange: (Bool) -> Void
    private let railHeader: RailHeader
    private let labelHeader: LabelHeader
    private let footer: Footer

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dragPreviewLabelWidth: CGFloat?
    @State private var isDragging = false

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
        self._selection = selection
        self._isCompact = isCompact
        self._labelWidth = labelWidth
        self.entries = entries
        self.accent = accent
        self.minLabelWidth = minLabelWidth
        self.maxLabelWidth = maxLabelWidth
        self.collapseLabelWidth = collapseLabelWidth
        self.activationDistance = activationDistance
        self.leadingInset = leadingInset
        self.onResizePhaseChange = onResizePhaseChange
        self.railHeader = railHeader()
        self.labelHeader = labelHeader()
        self.footer = footer()
    }

    public var body: some View {
        navigationSidebar
            .padding(.leading, leadingInset)
            .frame(width: layoutWidth, alignment: .leading)
            .overlay(alignment: .trailing) {
                edgeHandle
                    .alignmentGuide(.trailing) { dimensions in
                        dimensions[.trailing] - dimensions.width / 2
                    }
            }
            .overlay(alignment: .trailing) {
                resizePreviewEdge
            }
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(activeAccent.opacity(isDragging && dragPreviewLabelWidth == nil ? 0.42 : 0))
                    .frame(width: HudStrokeWidth.standard)
                    .allowsHitTesting(false)
                    .animation(HudMotion.ifAllowed(.easeOut(duration: 0.12), reduceMotion: reduceMotion), value: isDragging)
            }
            .transaction { transaction in
                if isDragging {
                    transaction.animation = nil
                    transaction.disablesAnimations = true
                }
            }
            .onChange(of: isDragging) { _, dragging in
                onResizePhaseChange(dragging)
                if !dragging {
                    dragPreviewLabelWidth = nil
                }
            }
            .onChange(of: isCompact) { _, _ in
                if !isDragging {
                    dragPreviewLabelWidth = nil
                }
            }
    }

    private var navigationSidebar: some View {
        HudNavigationSidebar(
            selection: $selection,
            entries: entries,
            progress: progress,
            accent: accent,
            labelWidth: effectiveLabelWidth,
            onHeaderTap: toggleCompact,
            railHeader: { railHeader },
            labelHeader: { labelHeader },
            footer: { footer }
        )
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private var edgeHandle: some View {
        HudSidebarEdgeHandle(
            isCompact: isCompact,
            activationDistance: activationDistance,
            currentWidth: effectiveLabelWidth,
            minWidth: minLabelWidth,
            maxWidth: maxLabelWidth,
            collapseWidth: collapseLabelWidth,
            visualOffset: resizePreviewOffset ?? 0,
            reduceMotion: reduceMotion,
            accent: activeAccent,
            accessibilityLabel: "Resize navigation sidebar",
            isDragging: $isDragging,
            onToggle: toggleCompact,
            onResize: { width in
                dragPreviewLabelWidth = clampedPreviewWidth(width)
            },
            onResizeEnded: { width in
                labelWidth = clampedCommittedWidth(width)
            },
            onCollapse: { restoreWidth in
                labelWidth = clampedCommittedWidth(restoreWidth)
                setCompact(true)
            },
            onExpand: { width in
                labelWidth = clampedCommittedWidth(max(width, minLabelWidth))
                setCompact(false)
            }
        )
    }

    private var effectiveLabelWidth: CGFloat {
        clampedCommittedWidth(labelWidth)
    }

    private var progress: Double {
        isCompact ? 1.0 : 0.0
    }

    private var layoutWidth: CGFloat {
        leadingInset + HudSidebarLayout.intrinsicWidth(progress: progress, labelWidth: effectiveLabelWidth)
    }

    private var resizePreviewOffset: CGFloat? {
        guard let dragPreviewLabelWidth else { return nil }
        let previewWidth = leadingInset + HudSidebarLayout.railWidth + clampedPreviewWidth(dragPreviewLabelWidth)
        return previewWidth - layoutWidth
    }

    @ViewBuilder
    private var resizePreviewEdge: some View {
        if let resizePreviewOffset {
            Rectangle()
                .fill(HudSurface.tintStrong(activeAccent))
                .frame(width: HudStrokeWidth.standard)
                .offset(x: resizePreviewOffset)
                .allowsHitTesting(false)
        }
    }

    private var activeAccent: Color {
        accent ?? .accentColor
    }

    private func toggleCompact() {
        setCompact(!isCompact)
    }

    private func setCompact(_ compact: Bool) {
        if reduceMotion {
            isCompact = compact
        } else {
            withAnimation(HudSidebarMotion.expandCollapse) {
                isCompact = compact
            }
        }
    }

    private func clampedCommittedWidth(_ width: CGFloat) -> CGFloat {
        min(maxLabelWidth, max(minLabelWidth, width))
    }

    private func clampedPreviewWidth(_ width: CGFloat) -> CGFloat {
        min(maxLabelWidth, max(0, width))
    }
}

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
