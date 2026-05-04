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

    /// Process-wide motion mode. Mutable at runtime so design tools can switch
    /// without rebuilding. Defined here rather than on the generic
    /// `HNavigationSidebar` because Swift disallows stored static properties
    /// on generic types.
    public static var mode: MotionMode = .quietTransition
}
