import Foundation

enum DemoResources {
    static var kitRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    /// Hudson monorepo root (the checkout that contains `Package.swift` and `.git`).
    static var repositoryRoot: URL {
        var candidate = kitRoot
        let fileManager = FileManager.default
        for _ in 0..<8 {
            if isRepositoryRoot(candidate, fileManager: fileManager) {
                return candidate
            }
            let parent = candidate.deletingLastPathComponent()
            if parent.path == candidate.path { break }
            candidate = parent
        }
        return kitRoot
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static var hudsonUIRoot: URL {
        kitRoot.appendingPathComponent("Sources/HudsonUI", isDirectory: true)
    }

    /// Default folder tree root — the Hudson checkout, not a kit subfolder.
    static var defaultExplorerRoot: URL {
        repositoryRoot
    }

    static var canvasPracticeSetupURL: URL {
        if let bundled = Bundle.main.url(
            forResource: "hudson-canvas-practice.setup",
            withExtension: "json",
            subdirectory: "Fixtures"
        ) {
            return bundled
        }
        return kitRoot
            .appendingPathComponent("Demo/HudsonKitDemo/Fixtures/hudson-canvas-practice.setup.json")
    }

    private static func isRepositoryRoot(_ url: URL, fileManager: FileManager) -> Bool {
        let packageManifest = url.appendingPathComponent("Package.swift")
        guard fileManager.fileExists(atPath: packageManifest.path) else { return false }
        guard let contents = try? String(contentsOf: packageManifest, encoding: .utf8) else {
            return fileManager.fileExists(atPath: url.appendingPathComponent(".git").path)
        }
        return contents.contains("name: \"Hudson\"")
    }
}