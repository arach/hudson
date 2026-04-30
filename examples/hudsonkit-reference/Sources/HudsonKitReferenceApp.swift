import SwiftUI
import HudsonUI

#if canImport(AppKit)
import AppKit
#endif

@main
struct HudsonKitReferenceApp: App {
    init() {
        #if canImport(AppKit)
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        #endif
    }

    var body: some Scene {
        WindowGroup("HudsonKit Reference") {
            ReferenceRootView()
                #if os(macOS)
                .frame(minWidth: 920, minHeight: 640)
                #endif
        }
    }
}
