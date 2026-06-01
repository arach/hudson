import SwiftUI

// MARK: - HudSidebarMotion
//
// Animation tokens for the sidebar expand/compact transition.
//
// The design contract: the label-column WIDTH animates (via `progress`),
// not any position of the rail or its icons. The spring here applies to
// the label-width frame modifier. Selection-indicator sliding uses
// `HudSidebarMotionStyle.selectionSlide` (per-style axis).

public enum HudSidebarMotion {

    // MARK: Expand/compact transitions

    /// Default animation for the label-column width transition.
    /// Kept deliberately quick so toolbar/sidebar toggles feel immediate while
    /// rail icons remain locked to the leading edge.
    public static let expandCollapse: Animation = .easeOut(duration: 0.14)

    // MARK: Label / underlay opacity modes

    /// Controls how label opacity and the expanded-mode underlay behave during the transition.
    ///
    /// - `smoothFade`: opacities track `progress` continuously — the cleanest visual.
    /// - `quietTransition`: labels and underlay snap OFF immediately on transition start,
    ///   compact accent bars snap ON only when fully settled. Useful for isolating
    ///   the column-width animation in design review.
    /// - `snapEverything`: fully discrete — no cross-fades, no intermediate states.
    public enum MotionMode: Sendable {
        case smoothFade
        case quietTransition
        case snapEverything
    }
}

// MARK: - Environment

private struct HudSidebarMotionModeKey: EnvironmentKey {
    static let defaultValue: HudSidebarMotion.MotionMode = .quietTransition
}

extension EnvironmentValues {
    /// The motion mode applied to descendant `HudNavigationSidebar` instances.
    /// Defaults to `.quietTransition`. Override per-view with
    /// `.hudsonSidebarMotionMode(_:)` so design tools can switch modes
    /// without touching process-global state.
    public var hudsonSidebarMotionMode: HudSidebarMotion.MotionMode {
        get { self[HudSidebarMotionModeKey.self] }
        set { self[HudSidebarMotionModeKey.self] = newValue }
    }
}

extension View {
    /// Set the sidebar motion mode for this view's subtree.
    public func hudsonSidebarMotionMode(_ mode: HudSidebarMotion.MotionMode) -> some View {
        environment(\.hudsonSidebarMotionMode, mode)
    }
}
