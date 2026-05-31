import SwiftUI

#if os(macOS)
/// Standard macOS scene bundle for a Vantage host: main window, menu-bar companion,
/// settings window, and canvas commands.
public struct HudVantageHostScenes<Content: View>: Scene {
    @ObservedObject private var model: HudVantageHostAppModel
    private let content: () -> Content

    public init(
        model: HudVantageHostAppModel,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.model = model
        self.content = content
    }

    public var body: some Scene {
        WindowGroup(model.identity.windowTitle, id: "main") {
            content()
                .hudVantageHostWindowBridge()
                .background {
                    HudVantageHostMenuBarCoordinator(model: model)
                }
        }
        .defaultSize(width: 1180, height: 780)
        .commands {
            HudVantageHostCommands(model: model)
        }

        Settings {
            HudVantageHostSettingsView(model: model)
        }
    }
}
#endif
