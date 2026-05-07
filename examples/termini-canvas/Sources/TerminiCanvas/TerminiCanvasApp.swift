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
            HudVantageSurface(configuration: .vantagePracticeSession)
                .frame(minWidth: 980, minHeight: 680)
                .hudsonAppManifest(
                    HudAppManifest(
                        name: "Vantage Practice",
                        version: "0.1.0",
                        tint: .cyan,
                        targetLabel: "Canvas"
                    )
                )
        }
    }
}

private extension HudVantageConfiguration {
    static var vantagePracticeSession: HudVantageConfiguration {
        let exampleRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let repositoryRoot = exampleRoot
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        return HudVantageConfiguration(
            workspaceID: "vantage-practice",
            surfaceTitle: "Vantage Practice",
            surfaceSubtitle: "agentic canvas with sessions, files, plan, and diff",
            commandURL: URL(fileURLWithPath: "/tmp/termini-canvas-control.jsonl"),
            responseURL: URL(fileURLWithPath: "/tmp/termini-canvas-control.responses.jsonl"),
            stateURL: URL(fileURLWithPath: "/tmp/hudson-vantage-practice-state.json"),
            launchSetupURL: exampleRoot.appendingPathComponent("examples/hudson-vantage-practice.setup.json"),
            workingDirectoryURL: repositoryRoot,
            restoresStateOnLaunch: true
        )
    }
}
