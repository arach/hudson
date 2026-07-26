import CoreGraphics
import Foundation

/// Pure resize math for `HudNavigationSidebar`'s label column.
///
/// The gesture layer (`HudSidebarEdgeHandle`) owns pointer plumbing and cursor
/// state; every width decision lives here so the contract in
/// `docs/proposals/unified-resizable-navigation-sidebar.md` can be tested
/// without simulating drags.
///
/// Two distinct clamps matter:
/// - **Preview** width may fall below `minLabelWidth` (down to zero) so the
///   drag can visually approach the collapse threshold.
/// - **Committed** width always lands inside `minLabelWidth...maxLabelWidth`,
///   so the value written back through the caller's binding is always usable
///   for re-expansion.
struct HudSidebarResizeGeometry: Equatable {

    /// Smallest width that may be committed to the caller's binding.
    let minLabelWidth: CGFloat
    /// Largest width for both preview and committed values.
    let maxLabelWidth: CGFloat
    /// Dragging left past this preview width collapses the sidebar.
    let collapseLabelWidth: CGFloat
    /// Horizontal travel required before a drag counts as a resize.
    let activationDistance: CGFloat

    /// Drag direction dominance required to reject vertical scrolling gestures.
    private static let horizontalDominance: CGFloat = 1.5
    /// Compact mode uses a shorter activation distance — the sidebar is already
    /// at its floor, so any deliberate rightward pull should expand it.
    private static let compactActivationFloor: CGFloat = 2

    init(
        minLabelWidth: CGFloat,
        maxLabelWidth: CGFloat,
        collapseLabelWidth: CGFloat,
        activationDistance: CGFloat
    ) {
        let low = max(0, minLabelWidth)
        self.minLabelWidth = low
        // A caller-inverted range would otherwise make `committedWidth` snap to
        // the maximum and strand the sidebar below its own minimum.
        self.maxLabelWidth = max(low, maxLabelWidth)
        self.collapseLabelWidth = max(0, collapseLabelWidth)
        self.activationDistance = max(0, activationDistance)
    }

    // MARK: Clamping

    /// Width safe to write through the caller's `labelWidth` binding.
    func committedWidth(_ width: CGFloat) -> CGFloat {
        min(maxLabelWidth, max(minLabelWidth, width))
    }

    /// Width safe to render mid-drag. Allowed below `minLabelWidth` so the
    /// preview edge can travel toward the collapse threshold.
    func previewWidth(_ width: CGFloat) -> CGFloat {
        min(maxLabelWidth, max(0, width))
    }

    // MARK: Activation

    func activationThreshold(isCompact: Bool) -> CGFloat {
        isCompact ? max(Self.compactActivationFloor, activationDistance * 0.5) : activationDistance
    }

    /// Whether the current drag has travelled far enough — and horizontally
    /// enough — to be treated as a resize rather than a click or a scroll.
    func isResizeActivated(
        isCompact: Bool,
        horizontalDelta: CGFloat,
        verticalDelta: CGFloat
    ) -> Bool {
        guard abs(horizontalDelta) >= activationThreshold(isCompact: isCompact) else { return false }
        guard abs(horizontalDelta) > abs(verticalDelta) * Self.horizontalDominance else { return false }
        // From compact, only a rightward pull means anything — there is no
        // narrower state to drag toward.
        if isCompact, horizontalDelta <= 0 { return false }
        return true
    }

    /// Whether a finished gesture that never activated should be treated as a
    /// click on the edge handle.
    func isClick(
        isCompact: Bool,
        horizontalDelta: CGFloat,
        verticalDelta: CGFloat
    ) -> Bool {
        let threshold = activationThreshold(isCompact: isCompact)
        return abs(horizontalDelta) < threshold && abs(verticalDelta) < threshold
    }

    // MARK: Drag geometry

    /// Width the label column should preview for the current drag offset.
    func proposedPreviewWidth(startWidth: CGFloat, horizontalDelta: CGFloat) -> CGFloat {
        previewWidth(startWidth + horizontalDelta)
    }

    /// Width a drag starts from. Compact drags start at zero so the label
    /// column grows out of the rail rather than jumping to its stored width.
    func dragStartWidth(isCompact: Bool, currentWidth: CGFloat) -> CGFloat {
        isCompact ? 0 : committedWidth(currentWidth)
    }

    // MARK: Outcome

    /// What a completed, activated drag should do to caller-owned state.
    enum Outcome: Equatable {
        /// Compact → expanded, at `labelWidth`.
        case expand(labelWidth: CGFloat)
        /// Expanded → compact. `restoreWidth` is the width to keep in the
        /// binding so the next expansion returns to a usable size.
        case collapse(restoreWidth: CGFloat)
        /// Stayed expanded at a new width.
        case resize(labelWidth: CGFloat)
    }

    func outcome(
        isCompact: Bool,
        startWidth: CGFloat,
        finalWidth: CGFloat,
        horizontalDelta: CGFloat
    ) -> Outcome {
        if isCompact {
            return .expand(labelWidth: committedWidth(max(finalWidth, minLabelWidth)))
        }
        if finalWidth <= collapseLabelWidth, horizontalDelta < 0 {
            return .collapse(restoreWidth: committedWidth(startWidth))
        }
        return .resize(labelWidth: committedWidth(finalWidth))
    }
}
