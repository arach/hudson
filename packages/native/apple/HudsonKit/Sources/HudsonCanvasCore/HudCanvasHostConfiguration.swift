import Foundation

public extension HudCanvasConfiguration {
    /// Default wiring for a standalone macOS Canvas host app.
    ///
    /// Persists workspace state under Application Support and exposes the
    /// JSONL control lane at well-known `/tmp` paths unless overridden.
    static func hostApplication(
        workspaceID: String = "canvas",
        surfaceTitle: String? = nil,
        surfaceSubtitle: String = "spatial runtime canvas for tmux, terminals, and artifacts",
        applicationSupportSubpath: String = "Hudson/Canvas",
        stateFileName: String = "workspace-state.json",
        commandURL: URL = URL(fileURLWithPath: "/tmp/hudson-canvas-control.jsonl"),
        responseURL: URL = URL(fileURLWithPath: "/tmp/hudson-canvas-control.responses.jsonl"),
        launchSetupURL: URL? = nil,
        workingDirectoryURL: URL? = nil,
        restoresStateOnLaunch: Bool = true,
        followsSystemColorScheme: Bool = false,
        showsStatusFooter: Bool = true,
        embedChrome: HudCanvasEmbedChrome = .standalone
    ) -> HudCanvasConfiguration {
        let title = surfaceTitle ?? "Canvas"
        let supportRoot = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first?
            .appendingPathComponent(applicationSupportSubpath, isDirectory: true)

        let stateURL = supportRoot?
            .appendingPathComponent(stateFileName)
            ?? URL(fileURLWithPath: "/tmp/hudson-canvas-state.json")

        if let supportRoot {
            try? FileManager.default.createDirectory(at: supportRoot, withIntermediateDirectories: true)
        }

        return HudCanvasConfiguration(
            workspaceID: workspaceID,
            surfaceTitle: title,
            surfaceSubtitle: surfaceSubtitle,
            commandURL: commandURL,
            responseURL: responseURL,
            stateURL: stateURL,
            launchSetupURL: launchSetupURL,
            workingDirectoryURL: workingDirectoryURL,
            followsSystemColorScheme: followsSystemColorScheme,
            restoresStateOnLaunch: restoresStateOnLaunch,
            showsStatusFooter: showsStatusFooter,
            embedChrome: embedChrome
        )
    }
}
