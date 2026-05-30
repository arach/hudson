import SwiftUI
import HudsonVantage

@main
struct VantageCanvasApp: App {
    @StateObject private var model = HudVantageHostAppModel(
        configuration: .hostApplication(
            workspaceID: "hudson-vantage",
            launchSetupURL: VantageCanvasResources.practiceSetupURL,
            workingDirectoryURL: VantageCanvasResources.repositoryRoot
        )
    )

    init() {
        HudVantageHostApplication.activateOnLaunch()
    }

    var body: some Scene {
        HudVantageHostScenes(model: model) {
            HudVantageHostRootView(model: model)
        }
    }
}
