import SwiftUI
import HudsonUI
import HudsonVantage

#if canImport(AppKit)
import AppKit
#endif

@main
struct TerminiCanvasApp: App {
    init() {
        #if canImport(AppKit)
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        #endif
    }

    var body: some Scene {
        WindowGroup("Termini Canvas") {
            HudVantageSurface(configuration: .terminiCanvasCaseStudy)
                .frame(minWidth: 980, minHeight: 680)
                .hudsonAppManifest(
                    HudAppManifest(
                        name: "Termini Canvas",
                        version: "0.1.0",
                        tint: .cyan,
                        targetLabel: "Terminal"
                    )
                )
        }
    }
}
