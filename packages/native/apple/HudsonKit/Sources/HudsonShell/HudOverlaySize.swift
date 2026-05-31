#if os(macOS)
import AppKit
import Foundation

public enum HudOverlaySize: Int, CaseIterable, Identifiable, Sendable {
    case compact = 0
    case medium = 1
    case large = 2

    public var id: Int { rawValue }

    public var label: String {
        switch self {
        case .compact: return "S"
        case .medium: return "M"
        case .large: return "L"
        }
    }

    public func contentSize(on screen: NSScreen? = NSScreen.main) -> NSSize {
        switch self {
        case .compact:
            return NSSize(width: 560, height: 520)
        case .medium:
            return NSSize(width: 1280, height: 920)
        case .large:
            let frame = screen?.visibleFrame
                ?? NSScreen.main?.visibleFrame
                ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
            return NSSize(width: frame.width, height: floor(frame.height / 2))
        }
    }

    public var isScreenAnchored: Bool {
        self == .large
    }

    /// Resolve the window frame for this size tier.
    ///
    /// Compact and medium preserve the current window center. Large docks to
    /// the top half of the active screen, which gives HUD-style apps a common
    /// "room" mode without app-specific frame math.
    public func frame(for window: NSWindow, on screen: NSScreen? = nil) -> NSRect {
        let resolvedScreen = screen ?? window.screen ?? NSScreen.main
        let content = contentSize(on: resolvedScreen)
        let frameSize = window.frameRect(forContentRect: NSRect(origin: .zero, size: content)).size

        if isScreenAnchored, let visible = resolvedScreen?.visibleFrame {
            return NSRect(
                x: visible.minX,
                y: visible.maxY - frameSize.height,
                width: frameSize.width,
                height: frameSize.height
            )
        }

        let current = window.frame
        return NSRect(
            x: current.midX - frameSize.width / 2,
            y: current.midY - frameSize.height / 2,
            width: frameSize.width,
            height: frameSize.height
        )
    }
}
#endif
