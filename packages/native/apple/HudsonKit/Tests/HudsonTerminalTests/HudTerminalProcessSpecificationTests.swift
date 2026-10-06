#if os(macOS)
import Foundation
import CoreText
import XCTest
@testable import HudsonTerminal

final class HudTerminalProcessSpecificationTests: XCTestCase {
    func testDefaultSpecKeepsLegacyWireShape() throws {
        let data = try JSONEncoder().encode(HudTerminalProcessSpecification())
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(Set(object.keys), ["executable", "arguments", "environment", "workingDirectory", "fontFamily", "fontSize", "version"])
    }

    func testLegacySpecDecodesWithoutOverrides() throws {
        let legacy = #"{"executable":"/bin/zsh","arguments":["-l"],"environment":{},"workingDirectory":"/tmp","fontFamily":"Menlo","fontSize":13,"version":1}"#
        let spec = try JSONDecoder().decode(HudTerminalProcessSpecification.self, from: Data(legacy.utf8))
        XCTAssertNil(spec.fontStyle)
        XCTAssertNil(spec.fontFilePaths)
    }

    func testNewSpecRoundTripsWithoutChangingWireVersion() throws {
        let spec = HudTerminalProcessSpecification(fontFamily: "SF Mono", fontSize: 13, fontStyle: "Light", fontFilePaths: HudTerminalSystemFonts.sfMonoFilePaths)
        XCTAssertEqual(try JSONDecoder().decode(HudTerminalProcessSpecification.self, from: JSONEncoder().encode(spec)), spec)
        XCTAssertEqual(spec.version, 1)
    }

    func testStyleCannotExtendConfigurationLine() {
        for style in ["Light", "Semi Bold", "W3"] {
            XCTAssertTrue(HudTerminalProcessSpecification.isValidFontStyle(style), style)
        }
        for style in ["", " Light", "Light ", "Light\nfont-family = X", "a=b", "\"Light\"", "Li\0ght", "Légère", String(repeating: "a", count: 65)] {
            XCTAssertFalse(HudTerminalProcessSpecification.isValidFontStyle(style), style)
        }
    }

    func testFontRegistrationRejectsNonSystemAndTraversalPaths() {
        for path in ["/Users/test/Fonts/custom.otf", "/System/Library/Fonts/../../../Users/test/Fonts/custom.otf", "/System/Library/Fonts/file.conf", "SF-Mono-Light.otf", "/System/Library/Fonts/a\0.ttf"] {
            XCTAssertFalse(HudTerminalSystemFonts.isAllowedFilePath(path), path)
        }
        XCTAssertFalse(HudTerminalSystemFonts.register(Array(repeating: "/System/Library/Fonts/a.ttf", count: 33)))
    }

    func testInstalledSFMonoLightRegistersInThisProcess() throws {
        guard HudTerminalSystemFonts.sfMonoFilePaths.contains(where: { $0.hasSuffix("/SF-Mono-Light.otf") }) else {
            throw XCTSkip("This macOS installation does not include Terminal's SF Mono Light font")
        }
        XCTAssertTrue(HudTerminalSystemFonts.registeredSFMono)
        let font = CTFontCreateWithName("SFMono-Light" as CFString, 13, nil)
        XCTAssertEqual(CTFontCopyPostScriptName(font) as String, "SFMono-Light")
        XCTAssertEqual(CTFontCopyFamilyName(font) as String, "SF Mono")
        // Re-registering an installed face remains a successful operation.
        XCTAssertTrue(HudTerminalSystemFonts.register(HudTerminalSystemFonts.sfMonoFilePaths))
    }
}
#endif
