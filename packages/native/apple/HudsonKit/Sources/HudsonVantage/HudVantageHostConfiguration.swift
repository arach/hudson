import Foundation

public extension HudVantageConfiguration {
    /// Default wiring for a standalone macOS Vantage host app.
    ///
    /// Persists workspace state under Application Support and exposes the
    /// JSONL control lane at well-known `/tmp` paths unless overridden.
    static func hostApplication(
        workspaceID: String = "vantage",
        surfaceTitle: String? = nil,
        surfaceSubtitle: String = "spatial runtime canvas for tmux, terminals, and artifacts",
        applicationSupportSubpath: String = "Hudson/Vantage",
        stateFileName: String = "workspace-state.json",
        commandURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-control.jsonl"),
        responseURL: URL = URL(fileURLWithPath: "/tmp/hudson-vantage-control.responses.jsonl"),
        launchSetupURL: URL? = nil,
        workingDirectoryURL: URL? = nil,
        restoresStateOnLaunch: Bool = true,
        followsSystemColorScheme: Bool = true
    ) -> HudVantageConfiguration {
        let title = surfaceTitle ?? "Vantage"
        let supportRoot = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first?
            .appendingPathComponent(applicationSupportSubpath, isDirectory: true)

        let stateURL = supportRoot?
            .appendingPathComponent(stateFileName)
            ?? URL(fileURLWithPath: "/tmp/hudson-vantage-state.json")

        if let supportRoot {
            try? FileManager.default.createDirectory(at: supportRoot, withIntermediateDirectories: true)
        }

        return HudVantageConfiguration(
            workspaceID: workspaceID,
            surfaceTitle: title,
            surfaceSubtitle: surfaceSubtitle,
            commandURL: commandURL,
            responseURL: responseURL,
            stateURL: stateURL,
            launchSetupURL: launchSetupURL,
            workingDirectoryURL: workingDirectoryURL,
            followsSystemColorScheme: followsSystemColorScheme,
            restoresStateOnLaunch: restoresStateOnLaunch
        )
    }
}
