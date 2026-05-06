import Foundation

#if canImport(UIKit)
import UIKit
#endif

#if canImport(AppKit)
import AppKit
#endif

/// Value type representing one shareable thing. Apps construct an array of
/// these and hand them to `.hudShare(isPresented:items:)` or `HudShareLink`
/// without caring whether the platform turns them into `UIActivityViewController`
/// items or `NSSharingServicePicker` items.
public enum HudShareItem: Sendable {
    case text(String)
    case url(URL)
    case file(URL)

    /// Convert to the platform-native `Any` payload expected by
    /// `UIActivityViewController` (iOS) and `NSSharingServicePicker` (macOS).
    /// Both APIs accept the same `[Any]` shape — `String` / `URL` flow through
    /// untouched.
    public var platformValue: Any {
        switch self {
        case .text(let value): return value
        case .url(let value):  return value
        case .file(let value): return value
        }
    }
}

public extension Array where Element == HudShareItem {
    /// Flatten to the `[Any]` shape consumed by both share APIs.
    var platformValues: [Any] {
        map(\.platformValue)
    }
}
