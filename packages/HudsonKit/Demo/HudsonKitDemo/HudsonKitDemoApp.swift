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
        WindowGroup("HudsonKit Demo") {
            ContentView()
                #if os(macOS)
                .frame(minWidth: 720, minHeight: 540)
                #endif
        }
    }
}
