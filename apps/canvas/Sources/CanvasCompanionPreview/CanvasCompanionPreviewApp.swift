import SwiftUI
import HudsonCanvasCompanion
import HudsonCanvasCore

@main
struct CanvasCompanionPreviewApp: App {
    @StateObject private var model = HudCanvasHostAppModel(
        configuration: .hostApplication(
            workspaceID: "canvas-companion-preview",
            surfaceTitle: "Canvas Companion",
            surfaceSubtitle: "menu-bar companion preview",
            applicationSupportSubpath: "Hudson/CanvasCompanionPreview",
            stateFileName: "preview-state.json",
            commandURL: URL(fileURLWithPath: "/tmp/hudson-canvas-companion-preview-control.jsonl"),
            responseURL: URL(fileURLWithPath: "/tmp/hudson-canvas-companion-preview.responses.jsonl"),
            restoresStateOnLaunch: false
        )
    )

    init() {
        HudCanvasHostApplication.activateOnLaunch()
    }

    var body: some Scene {
        HudCanvasHostScenes(model: model) {
            CompanionPreviewContent(model: model)
        }
    }
}

private struct CompanionPreviewContent: View {
    @ObservedObject var model: HudCanvasHostAppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Canvas Companion Preview")
                .font(.system(size: 28, weight: .semibold, design: .rounded))
            Text("Use the menu-bar icon to iterate on companion chrome without building the canvas or terminal surface.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text(model.controlFilePath)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(28)
        .frame(minWidth: 520, minHeight: 280, alignment: .topLeading)
        .task {
            HudCanvasHostStatusCenter.post(
                HudCanvasHostStatus(
                    workspaceID: model.configuration.workspaceID,
                    nodeCount: 6,
                    selectedCount: 2,
                    controlStatus: "Preview"
                )
            )
        }
    }
}
