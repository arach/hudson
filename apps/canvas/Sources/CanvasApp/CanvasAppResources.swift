import Foundation

enum CanvasAppResources {
    static var packageRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static var repositoryRoot: URL {
        packageRoot
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static var practiceSetupURL: URL {
        packageRoot.appendingPathComponent("fixtures/hudson-canvas-practice.setup.json")
    }
}
