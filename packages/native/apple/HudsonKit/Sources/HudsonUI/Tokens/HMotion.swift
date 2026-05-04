import SwiftUI
import HudsonObservability

/// Shared motion helpers for HudsonKit chrome.
public enum HMotion {
    public static let chromeSpring = Animation.spring(response: 0.32, dampingFraction: 0.86)
    public static let chromeResize = Animation.easeOut(duration: 0.16)
    public static let drawerSpring = Animation.spring(response: 0.34, dampingFraction: 0.86)
    public static let overlaySpring = Animation.spring(response: 0.36, dampingFraction: 0.88)
    public static let quickFade = Animation.easeInOut(duration: 0.18)
    public static let quickScroll = Animation.easeOut(duration: 0.15)

    public static func ifAllowed(_ animation: Animation, reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : animation
    }
}
