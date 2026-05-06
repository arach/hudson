import SwiftUI

/// Material treatment for HudLiquidBar. Names intentionally mirror SwiftUI's
/// Liquid Glass variants where Hudson can map them directly on iOS 26+.
public enum HudLiquidBarTint: Sendable {
    case regular
    case tinted(Color)
    case clear
}
