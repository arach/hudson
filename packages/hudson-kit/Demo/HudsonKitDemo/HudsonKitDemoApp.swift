import SwiftUI
import HudsonUI

#if canImport(AppKit)
import AppKit
#endif

@main
struct HudsonKitDemoApp: App {
    init() {
        #if canImport(AppKit)
        // SPM-built binaries run as `.accessory` by default — no Dock icon, no
        // window focus. Promote to a regular UI app so the demo window appears.
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        #endif
    }

    var body: some Scene {
        WindowGroup("hudson-kit Demo") {
            ContentView()
                .frame(minWidth: 720, minHeight: 540)
        }
    }
}
