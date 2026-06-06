import AppKit
import SwiftUI
import HudsonVantage

@main
struct HudsonApp: App {
    @NSApplicationDelegateAdaptor(HudsonAppDelegate.self) private var appDelegate

    @StateObject private var model: HudVantageHostAppModel

    init() {
        _model = StateObject(wrappedValue: Self.makeVantageModel())

        HudVantageHostApplication.activateOnLaunch()
    }

    var body: some Scene {
        Window("Hudson", id: "main") {
            HudVantageHostRootView(model: model)
                .hudVantageHostWindowBridge()
        }
        .defaultSize(width: 1180, height: 780)
        .commands {
            HudVantageHostCommands(model: model)
        }

        Settings {
            HudVantageHostSettingsView(model: model)
                .frame(width: 700, height: 480)
        }
    }

    @MainActor
    private static func makeVantageModel() -> HudVantageHostAppModel {
        HudVantageHostAppModel(
            configuration: .hostApplication(
                workspaceID: "hudson-vantage",
                launchSetupURL: HudsonAppResources.practiceSetupURL,
                workingDirectoryURL: HudsonAppResources.repositoryRoot
            ),
            identity: HudVantageHostIdentity(
                appName: "Hudson",
                tagline: "Native Hudson workspace host for Vantage, local services, and voice.",
                tint: .cyan,
                targetLabel: "Node",
                menuBarTitle: "Hudson",
                menuBarSystemImage: "square.grid.2x2",
                windowTitle: "Hudson"
            )
        )
    }
}

final class HudsonAppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        guard let window = sender.windows.first(where: { $0.isVisible }) ?? sender.windows.first else {
            return true
        }

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        return false
    }
}
