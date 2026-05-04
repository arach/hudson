import XCTest
@testable import HudLintCore

final class RuleTests: XCTestCase {
    private func scan(_ source: String) -> [Violation] {
        let scanner = LintScanner()
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("hudlint-\(UUID()).swift")
        try! source.write(to: tmp, atomically: true, encoding: .utf8)
        defer { try? FileManager.default.removeItem(at: tmp) }
        return scanner.scanFile(at: tmp.path, displayPath: tmp.lastPathComponent)
    }

    func testPaletteRuleFlagsHardcodedRGB() {
        let v = scan("let c = Color(red: 0.1, green: 0.2, blue: 0.3)\n")
        XCTAssertEqual(v.count, 1)
        XCTAssertEqual(v.first?.category, .palette)
    }

    func testPaletteRuleFlagsRawWhiteOpacity() {
        let v = scan("    .background(Color.white.opacity(0.05))\n")
        // Palette rule + opacity rule both fire.
        XCTAssertTrue(v.contains(where: { $0.category == .palette }))
        XCTAssertTrue(v.contains(where: { $0.category == .opacity }))
    }

    func testTypographyRuleFlagsHardcodedFontSize() {
        let v = scan(".font(Font.system(size: 14))\n")
        XCTAssertTrue(v.contains(where: { $0.category == .typography }))
    }

    func testSpacingRuleFlagsLiteralPadding() {
        let v = scan(".padding(.horizontal, 12)\n")
        XCTAssertEqual(v.first?.category, .spacing)
    }

    func testSpacingRuleAllowsTokenPadding() {
        let v = scan(".padding(.horizontal, HudSpacing.xl)\n")
        XCTAssertTrue(v.isEmpty)
    }

    func testGeometryRuleFlagsLiteralFrame() {
        let v = scan(".frame(width: 28, height: 28)\n")
        XCTAssertEqual(v.first?.category, .geometry)
    }

    func testGeometryRuleFlagsLiteralCornerRadius() {
        let v = scan(".cornerRadius(8)\n")
        XCTAssertEqual(v.first?.category, .geometry)
    }

    func testOpacityRuleFlagsLiteralOpacity() {
        let v = scan("HudPalette.statusInfo.opacity(0.45)\n")
        XCTAssertTrue(v.contains(where: { $0.category == .opacity }))
    }

    func testInlineDisableSuppressesNextLine() {
        let source = """
        // hudlint:disable next-line palette
        let c = Color(red: 0.1, green: 0.2, blue: 0.3)
        """
        XCTAssertTrue(scan(source).isEmpty)
    }

    func testInlineDisableScopesByCategory() {
        let source = """
        // hudlint:disable next-line opacity
        let c = Color(red: 0.1, green: 0.2, blue: 0.3)
        """
        // palette still fires because disable scoped to opacity only
        XCTAssertEqual(scan(source).first?.category, .palette)
    }

    func testInlineDisableAllSuppressesEverything() {
        let source = """
        // hudlint:disable next-line
        let c = Color(red: 0.1, green: 0.2, blue: 0.3)
        """
        XCTAssertTrue(scan(source).isEmpty)
    }

    func testCommentsAreNotLinted() {
        let v = scan("// example: Color(red: 1, green: 0, blue: 0) is bad\n")
        XCTAssertTrue(v.isEmpty)
    }
}

final class ConfigurationTests: XCTestCase {
    func testIgnorePatternMatchesNestedTokens() {
        let config = Configuration(ignorePatterns: ["Sources/HudsonUI/Tokens/**"])
        XCTAssertTrue(config.shouldIgnore("Sources/HudsonUI/Tokens/HudPalette.swift"))
        XCTAssertFalse(config.shouldIgnore("Sources/HudsonUI/Primitives/HudCard.swift"))
    }

    func testIgnorePatternStarMatchesExtension() {
        let config = Configuration(ignorePatterns: ["**/*.generated.swift"])
        XCTAssertTrue(config.shouldIgnore("Sources/Foo/Bar.generated.swift"))
        XCTAssertFalse(config.shouldIgnore("Sources/Foo/Bar.swift"))
    }
}
