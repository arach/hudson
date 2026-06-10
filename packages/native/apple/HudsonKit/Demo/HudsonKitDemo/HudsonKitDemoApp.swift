import SwiftUI
import HudsonUI

#if canImport(AppKit)
import AppKit
#endif

@main
struct HudsonKitDemoApp: App {
    init() {
        #if canImport(AppKit)
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        #endif
    }

    var body: some Scene {
        WindowGroup("HudsonKit Lab") {
            ContentView()
                #if os(macOS)
                // Window minimums — width is HudLayout.readableWidth; height is window-specific.
                // hudlint:disable next-line geometry
                .frame(minWidth: HudLayout.readableWidth, minHeight: 540)
                #endif
        }
    }
}
