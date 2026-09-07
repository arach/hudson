import Foundation

/// Configuration for an embeddable Hudson Canvas.
///
/// A Canvas is a spatial operating surface for live runtimes and artifacts.
/// Hosts provide product naming, control-plane paths, and an optional working
/// directory while Hudson owns the canvas interaction model.
public struct HudCanvasConfiguration: Sendable {
    public var workspaceID: String
    public var surfaceTitle: String
    public var surfaceSubtitle: String
    public var commandURL: URL
    public var responseURL: URL
    public var stateURL: URL
    public var launchSetupURL: URL?
    public var workingDirectoryURL: URL?
    public var followsSystemColorScheme: Bool
    public var restoresStateOnLaunch: Bool

    public init(
        workspaceID: String = "canvas",
        surfaceTitle: String = "Canvas",
        surfaceSubtitle: String = "native Hudson runtime surface",
        commandURL: URL = URL(fileURLWithPath: "/tmp/hudson-canvas-control.jsonl"),
        responseURL: URL = URL(fileURLWithPath: "/tmp/hudson-canvas-control.responses.jsonl"),
        stateURL: URL = URL(fileURLWithPath: "/tmp/hudson-canvas-state.json"),
        launchSetupURL: URL? = nil,
        workingDirectoryURL: URL? = nil,
        followsSystemColorScheme: Bool = true,
        restoresStateOnLaunch: Bool = false
    ) {
        self.workspaceID = Self.slugify(workspaceID, fallback: "canvas")
        self.surfaceTitle = surfaceTitle
        self.surfaceSubtitle = surfaceSubtitle
        self.commandURL = commandURL
        self.responseURL = responseURL
        self.stateURL = stateURL
        self.launchSetupURL = launchSetupURL
        self.workingDirectoryURL = workingDirectoryURL
        self.followsSystemColorScheme = followsSystemColorScheme
        self.restoresStateOnLaunch = restoresStateOnLaunch
    }

    private static func slugify(_ input: String, fallback: String) -> String {
        let normalized = input
            .lowercased()
            .map { character -> Character in
                if character.isLetter || character.isNumber || character == "-" || character == "_" {
                    return character
                }
                return "-"
            }

        let slug = String(normalized)
            .split(separator: "-")
            .joined(separator: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: "-_"))

        return slug.isEmpty ? fallback : slug
    }
}
