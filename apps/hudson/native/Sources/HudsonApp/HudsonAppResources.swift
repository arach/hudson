import Foundation

enum HudsonAppResources {
    static var packageRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static var repositoryRoot: URL {
        appRoot
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static var appRoot: URL {
        packageRoot.deletingLastPathComponent()
    }

    static var practiceSetupURL: URL {
        appRoot.appendingPathComponent("fixtures/hudson-vantage-practice.setup.json")
    }
}
