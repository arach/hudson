import SwiftUI
import HudsonVantageCompanion
import HudsonVantageCore

@main
struct VantageCompanionPreviewApp: App {
    @StateObject private var model = HudVantageHostAppModel(
        configuration: .hostApplication(
            workspaceID: "vantage-companion-preview",
            surfaceTitle: "Vantage Companion",
            surfaceSubtitle: "menu-bar companion preview",
            applicationSupportSubpath: "Hudson/VantageCompanionPreview",
            stateFileName: "preview-state.json",
            commandURL: URL(fileURLWithPath: "/tmp/hudson-vantage-companion-preview-control.jsonl"),
            responseURL: URL(fileURLWithPath: "/tmp/hudson-vantage-companion-preview.responses.jsonl"),
            restoresStateOnLaunch: false
        )
    )

    init() {
        HudVantageHostApplication.activateOnLaunch()
    }

    var body: some Scene {
        HudVantageHostScenes(model: model) {
            CompanionPreviewContent(model: model)
        }
    }
}

private struct CompanionPreviewContent: View {
    @ObservedObject var model: HudVantageHostAppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Vantage Companion Preview")
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
            HudVantageHostStatusCenter.post(
                HudVantageHostStatus(
                    workspaceID: model.configuration.workspaceID,
                    nodeCount: 6,
                    selectedCount: 2,
                    controlStatus: "Preview"
                )
            )
        }
    }
}
