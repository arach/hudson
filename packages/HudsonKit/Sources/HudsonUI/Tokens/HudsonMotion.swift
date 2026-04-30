import SwiftUI
import os

/// Shared motion and signpost helpers for HudsonKit chrome.
public enum HudsonMotion {
    public static let chromeSpring = Animation.spring(response: 0.32, dampingFraction: 0.86)
    public static let drawerSpring = Animation.spring(response: 0.34, dampingFraction: 0.86)
    public static let overlaySpring = Animation.spring(response: 0.36, dampingFraction: 0.88)
    public static let quickFade = Animation.easeInOut(duration: 0.18)
    public static let quickScroll = Animation.easeOut(duration: 0.15)

    public static func ifAllowed(_ animation: Animation, reduceMotion: Bool) -> Animation? {
        reduceMotion ? nil : animation
    }
}

public enum HudsonInstrumentation {
    private static let log = OSLog(subsystem: "dev.hudson.kit", category: .pointsOfInterest)

    public static func event(_ name: StaticString) {
        os_signpost(.event, log: log, name: name)
    }
}
