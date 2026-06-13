import SwiftUI
import HudsonCanvasCore

public struct HudCanvasHostCommands: Commands {
    @ObservedObject private var model: HudCanvasHostAppModel

    public init(model: HudCanvasHostAppModel) {
        self.model = model
    }

    public var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("About \(model.appName)") {
                model.showsAbout = true
            }
        }

        CommandMenu("Workspace") {
            Button("Save Workspace") {
                model.send(.saveWorkspace)
            }
            .keyboardShortcut("s", modifiers: [.command])

            Divider()

            Button("Reveal Control File") {
                model.revealControlFile()
            }
            Button("Copy Control Paths") {
                model.copyControlPaths()
            }
        }

        CommandMenu("Canvas") {
            Button("Command Palette…") {
                model.send(.showCommandPalette)
            }
            .keyboardShortcut("k", modifiers: [.command])

            Button("Search Nodes…") {
                model.send(.openLens)
            }
            .keyboardShortcut("f", modifiers: [.command, .shift])

            Divider()

            Button("Fit Viewport") {
                model.send(.fitViewport)
            }
            .keyboardShortcut("0", modifiers: [.command])

            Button("Reset Viewport") {
                model.send(.resetViewport)
            }
            .keyboardShortcut("0", modifiers: [.command, .shift])

            Button("Layout by Tag") {
                model.send(.layoutByTag)
            }

            Button("Clear Selection") {
                model.send(.clearSelection)
            }
            .keyboardShortcut(.escape, modifiers: [])
        }

        CommandMenu("Appearance") {
            Button("Canvas Appearance…") {
                model.send(.showAppearanceSettings)
            }
        }
    }
}
