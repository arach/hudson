import SwiftUI
import HudsonCanvasCore

#if os(macOS)
/// Standard macOS scene bundle for a Canvas host: main window, menu-bar companion,
/// settings window, and canvas commands.
public struct HudCanvasHostScenes<Content: View>: Scene {
    @ObservedObject private var model: HudCanvasHostAppModel
    private let content: () -> Content

    public init(
        model: HudCanvasHostAppModel,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.model = model
        self.content = content
    }

    public var body: some Scene {
        WindowGroup(model.identity.windowTitle, id: "main") {
            content()
                .hudCanvasHostWindowBridge()
                .background {
                    HudCanvasHostMenuBarCoordinator(model: model)
                }
        }
        .defaultSize(width: 1180, height: 780)
        .commands {
            HudCanvasHostCommands(model: model)
        }

        Settings {
            HudCanvasHostSettingsView(model: model)
        }
    }
}
#endif
