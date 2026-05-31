#if os(macOS)
import SwiftUI

/// Bridges AppKit menu-bar actions into SwiftUI window management.
public struct HudVantageHostWindowBridge: View {
    @Environment(\.openWindow) private var openWindow

    public init() {}

    public var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onReceive(NotificationCenter.default.publisher(for: .vantageHostShowMainWindow)) { _ in
                openWindow(id: "main")
                NSApp.activate(ignoringOtherApps: true)
            }
    }
}

extension View {
    public func hudVantageHostWindowBridge() -> some View {
        background(HudVantageHostWindowBridge())
    }
}
#endif
