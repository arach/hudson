import SwiftUI

/// Semantic opacity scale for non-surface tinting (status dots, ghosted icons,
/// disabled-state shadows). Surface-tier overlays should still go through
/// HudSurface.* — those are the canonical hover/press/control fills.
///
/// Use this when expressing intent against a *colored* token (accent,
/// statusError, iconTint) rather than against white/black.
public enum HudOpacity {
    public static let ghost:     Double = 0.06   // barely-there overlay
    public static let subtle:    Double = 0.10   // soft tint fill
    public static let soft:      Double = 0.20   // tint border, secondary state
    public static let muted:     Double = 0.40   // disabled / dimmed
    public static let strong:    Double = 0.60   // standout chip, emphasis
    public static let emphatic:  Double = 0.85   // near-solid focus / overlay
}
