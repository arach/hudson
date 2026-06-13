import SwiftUI
import HudsonCanvas

@main
struct CanvasApp: App {
    @StateObject private var model = HudCanvasHostAppModel(
        configuration: .hostApplication(
            workspaceID: "hudson-canvas",
            launchSetupURL: CanvasAppResources.practiceSetupURL,
            workingDirectoryURL: CanvasAppResources.repositoryRoot
        )
    )

    init() {
        HudCanvasHostApplication.activateOnLaunch()
    }

    var body: some Scene {
        HudCanvasHostScenes(model: model) {
            HudCanvasHostRootView(model: model)
        }
    }
}
