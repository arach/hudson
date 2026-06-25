import SwiftUI
import HudsonObservability

/// Shared motion helpers for HudsonKit chrome.
public enum HudMotion {
    public static var chromeSpring: Animation { Animation.spring(response: 0.32, dampingFraction: 0.86) }
    public static var chromeResize: Animation { Animation.easeOut(duration: 0.16) }
    public static var drawerSpring: Animation { Animation.spring(response: 0.34, dampingFraction: 0.86) }
    public static var overlaySpring: Animation { Animation.spring(response: 0.36, dampingFraction: 0.88) }
    public static var quickFade: Animation { Animation.easeInOut(duration: 0.18) }
    public static var quickScroll: Animation { Animation.easeOut(duration: 0.15) }

    public static func ifAllowed(_ animation: Animation, reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : animation
    }
}
