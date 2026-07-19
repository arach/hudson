import XCTest

final class HudInspectorSettingsUITests: XCTestCase {
    @MainActor
    func testDefaultShellAppearanceOverridesLightSystemScheme() {
        assertResolvedSystemScheme("DARK")
    }

    @MainActor
    func testSystemShellAppearanceInheritsLightSystemScheme() {
        assertResolvedSystemScheme("LIGHT", extraArguments: ["--appearance-system"])
    }

    @MainActor
    func testInactiveRailChipActivatesFromMinimumTapTargetEdge() {
        continueAfterFailure = false

        let app = XCUIApplication()
        app.launchArguments = [
            "--page", "settings",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US",
        ]
        app.launch()

        XCTAssertTrue(app.staticTexts["INSPECTOR · WORKSPACE"].waitForExistence(timeout: 8))

        let canvasTab = app.buttons["Canvas"]
        XCTAssertTrue(canvasTab.waitForExistence(timeout: 5))

        // The rail starts at the leading screen edge. x=36 is outside the old
        // 28pt rail but inside the minimum 44pt chip target. Use a raw screen
        // coordinate so XCTest cannot fall back to accessibility activation.
        let appFrame = app.frame
        app.coordinate(withNormalizedOffset: CGVector(
            dx: 36 / appFrame.width,
            dy: canvasTab.frame.midY / appFrame.height
        )).tap()

        XCTAssertTrue(app.staticTexts["INSPECTOR · CANVAS"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Renderer"].waitForExistence(timeout: 3))
    }

    @MainActor
    private func assertResolvedSystemScheme(
        _ expected: String,
        extraArguments: [String] = []
    ) {
        let app = XCUIApplication()
        app.launchArguments = [
            "--page", "shell",
            "-AppleInterfaceStyle", "Light",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US",
        ] + extraArguments
        app.launch()

        let resolvedScheme = app.staticTexts["hudson.shell.resolved-system-scheme"]
        XCTAssertTrue(resolvedScheme.waitForExistence(timeout: 8))
        XCTAssertEqual(resolvedScheme.label, "Resolved system scheme · \(expected)")
    }
}
