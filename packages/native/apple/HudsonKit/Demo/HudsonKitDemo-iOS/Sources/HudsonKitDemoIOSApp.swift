import SwiftUI
import HudsonObservability

@main
struct HudsonKitDemoIOSApp: App {
    init() {
        HudLoggerSinks.install(HudLogStore.shared)
        HudLogger(category: "demo").info("HudsonKitDemoIOS booted", metadata: ["state": "ready"])
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
