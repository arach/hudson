import SwiftUI

// MARK: - HSidebarMotion
//
// Animation tokens for the sidebar expand/compact transition.
//
// The design contract: the label-column WIDTH animates (via `progress`),
// not any position of the rail or its icons. The spring here applies to
// the label-width frame modifier. Selection-indicator sliding uses
// `HSidebarMotionStyle.selectionSlide` (per-style axis).

public enum HSidebarMotion {

    // MARK: Expand/compact transitions

    /// Default animation for the label-column width transition.
    /// Tuned for a settled, no-overshoot feel — labels disappear cleanly,
    /// rail icons never move.
    public static let expandCollapse: Animation = .spring(response: 0.42, dampingFraction: 0.86)

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

private struct HSidebarMotionModeKey: EnvironmentKey {
    static let defaultValue: HSidebarMotion.MotionMode = .quietTransition
}

extension EnvironmentValues {
    /// The motion mode applied to descendant `HNavigationSidebar` instances.
    /// Defaults to `.quietTransition`. Override per-view with
    /// `.hudsonSidebarMotionMode(_:)` so design tools can switch modes
    /// without touching process-global state.
    public var hudsonSidebarMotionMode: HSidebarMotion.MotionMode {
        get { self[HSidebarMotionModeKey.self] }
        set { self[HSidebarMotionModeKey.self] = newValue }
    }
}

extension View {
    /// Set the sidebar motion mode for this view's subtree.
    public func hudsonSidebarMotionMode(_ mode: HSidebarMotion.MotionMode) -> some View {
        environment(\.hudsonSidebarMotionMode, mode)
    }
}
