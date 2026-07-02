import SwiftUI
import HudsonUI

#if HUDSON_VANTAGE
import HudsonVantage
import HudsonVantageCore
#endif

struct VantageTab: View {
    #if HUDSON_VANTAGE
    @StateObject private var model: HudVantageHostAppModel

    init() {
        let demoSetupURL: URL = {
            let fm = FileManager.default
            let tmpDir = fm.temporaryDirectory.appendingPathComponent("hudsonkit-demo-vantage")
            try? fm.createDirectory(at: tmpDir, withIntermediateDirectories: true)

            let url = tmpDir.appendingPathComponent("demo-setup.json")

            // Minimal demo manifest with a few nodes so the canvas has visible content/tiles
            let manifest: [String: Any] = [
                "kind": "hudson.vantage.setup",
                "schemaVersion": 1,
                "workspaceID": "hudson-demo",
                "createIfMissing": true,
                "presentation": [
                    "title": "Vantage Demo",
                    "subtitle": "embedded in HudsonKitDemo"
                ],
                "nodes": [
                    [
                        "id": "demo-agent-1",
                        "runtimeKind": "mock",
                        "title": "codex.lead",
                        "x": 80, "y": 80, "width": 420, "height": 280
                    ],
                    [
                        "id": "demo-agent-2",
                        "runtimeKind": "mock",
                        "title": "worker-01",
                        "x": 540, "y": 100, "width": 360, "height": 240
                    ],
                    [
                        "id": "demo-term-logs",
                        "runtimeKind": "mock",
                        "title": "logs.tail",
                        "x": 80, "y": 400, "width": 820, "height": 200
                    ]
                ]
            ]

            if let data = try? JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted) {
                try? data.write(to: url)
            }
            return url
        }()

        let config = HudVantageConfiguration.hostApplication(
            workspaceID: "hudson-demo",
            surfaceTitle: "Vantage (Demo)",
            surfaceSubtitle: "spatial runtime canvas in HudsonKitDemo • try HudTiling in Primitives too",
            launchSetupURL: demoSetupURL,
            workingDirectoryURL: nil,
            restoresStateOnLaunch: false
        )

        _model = StateObject(wrappedValue: HudVantageHostAppModel(
            configuration: config,
            identity: HudVantageHostIdentity(
                appName: "HudsonKit Demo",
                tagline: "Vantage embedded for dogfooding",
                tint: .cyan,
                targetLabel: "Node",
                menuBarTitle: "Demo",
                menuBarSystemImage: "square.grid.2x2",
                windowTitle: "Vantage Demo"
            )
        ))
    }
    #endif

    var body: some View {
        #if HUDSON_VANTAGE
        // Use the surface directly for embedding inside the demo shell.
        // HostRootView brings its own large min frame + about sheet which
        // fights the demo's HudAppShell sidebar/inspector layout and causes
        // the left navigation rail + footer to misalign.
        HudVantageSurface(configuration: model.configuration)
            .hudsonAppManifest(
                HudAppManifest(
                    name: model.identity.appName,
                    tint: .cyan,
                    targetLabel: model.identity.targetLabel
                )
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .topTrailing) {
                VStack(alignment: .trailing, spacing: 4) {
                    HudBadge("VANTAGE SURFACE", tint: HudPalette.muted)
                    Text("Drag nodes • Pan/zoom canvas • Use control lane")
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                        .padding(.trailing, HudSpacing.sm)
                }
                .padding(.top, HudSpacing.lg)
                .padding(.trailing, HudSpacing.lg)
            }
        #else
        VStack(spacing: HudSpacing.xl) {
            HudEmptyState(
                title: "Vantage not available",
                subtitle: "Run with HUDSONKIT_WITH_TERMINAL=1 to enable the full Vantage canvas + terminals.",
                icon: "square.grid.2x2"
            )
            Text("HUDSONKIT_WITH_TERMINAL=1 swift run HudsonKitDemo")
                .font(HudFont.mono(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        #endif
    }
}
