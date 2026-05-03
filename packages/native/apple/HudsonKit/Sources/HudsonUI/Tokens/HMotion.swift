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

/// Compatibility wrapper for the pre-observability HudsonKit instrumentation API.
public enum HInstrumentation {
    public typealias Span = HSpan

    private static let instrumentation = HudsonObservability.HInstrumentation.ui

    public static func event(_ name: StaticString, metadata: [String: String] = [:]) {
        instrumentation.event(name, metadata: metadata)
    }

    @discardableResult
    public static func span<T>(
        _ name: StaticString,
        metadata: [String: String] = [:],
        _ operation: () throws -> T
    ) rethrows -> T {
        try instrumentation.span(name, metadata: metadata, operation)
    }

    @discardableResult
    public static func span<T>(
        _ name: StaticString,
        metadata: [String: String] = [:],
        _ operation: () async throws -> T
    ) async rethrows -> T {
        try await instrumentation.span(name, metadata: metadata, operation)
    }

    public static func beginSpan(_ name: StaticString, metadata: [String: String] = [:]) -> Span {
        instrumentation.beginSpan(name, metadata: metadata)
    }

    public static func metric(
        _ name: String,
        _ value: Double = 1,
        unit: HMetricUnit = .count,
        metadata: [String: String] = [:]
    ) {
        instrumentation.metric(name, value, unit: unit, metadata: metadata)
    }
}
