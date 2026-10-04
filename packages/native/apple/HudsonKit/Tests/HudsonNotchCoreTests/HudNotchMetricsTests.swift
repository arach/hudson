import CoreGraphics
import Foundation
@testable import HudsonNotchCore
import XCTest

final class HudNotchMetricsTests: XCTestCase {
    func testDisplayModeResolvesRenderStyle() {
        XCTAssertEqual(HudNotchDisplayMode.automatic.resolvedStyle(isVirtual: false), .notch)
        XCTAssertEqual(HudNotchDisplayMode.automatic.resolvedStyle(isVirtual: true), .island)
        XCTAssertEqual(HudNotchDisplayMode.notch.resolvedStyle(isVirtual: true), .notch)
        XCTAssertEqual(HudNotchDisplayMode.island.resolvedStyle(isVirtual: false), .island)
    }

    func testShellWidthExpandsAroundStableNotchGap() {
        let config = HudNotchConfiguration(restPokeOut: 10, hoverPokeOut: 30, activePokeOut: 50)
        XCTAssertEqual(HudNotchMetrics.shellWidth(notchWidth: 204, expanded: false, configuration: config), 244)
        XCTAssertEqual(HudNotchMetrics.shellWidth(notchWidth: 204, expanded: true, configuration: config), 324)
    }

    func testPanelFitsTheTallestCard() {
        let config = HudNotchConfiguration.default
        let size = HudNotchMetrics.panelSize(notchWidth: 180, notchHeight: 34, configuration: config)
        XCTAssertGreaterThan(size.width, 430)
        XCTAssertEqual(size.height, 34 + config.inputContentHeight + 36)
    }

    func testNormalizeKeepsInputCardAtLeastAsTallAsExpanded() {
        let config = HudNotchConfiguration(expandedContentHeight: 160, inputContentHeight: 90).normalized()
        XCTAssertEqual(config.inputContentHeight, 160)
        XCTAssertEqual(config.contentHeight(asksForInput: false), 160)
    }

    func testConfigurationDecodesMissingFieldsFromDefaults() throws {
        let saved = Data(#"{"displayMode":"island","restPokeOut":20}"#.utf8)
        let config = try JSONDecoder().decode(HudNotchConfiguration.self, from: saved)
        XCTAssertEqual(config.displayMode, .island)
        XCTAssertEqual(config.restPokeOut, 20)
        XCTAssertEqual(config.inputContentHeight, HudNotchConfiguration.default.inputContentHeight)
    }

    func testConfigurationWithoutAppearanceIsSolid() throws {
        let saved = Data(#"{"displayMode":"notch"}"#.utf8)
        let config = try JSONDecoder().decode(HudNotchConfiguration.self, from: saved)
        XCTAssertEqual(config.appearance, .solid)
        XCTAssertEqual(config.appearance.pill.fillOpacity, 1)
    }

    func testAppearanceDecodesPartialLooks() throws {
        let saved = Data(#"{"appearance":{"card":{"fillOpacity":0.4}}}"#.utf8)
        let config = try JSONDecoder().decode(HudNotchConfiguration.self, from: saved)
        XCTAssertEqual(config.appearance.card.fillOpacity, 0.4)
        XCTAssertEqual(config.appearance.card.borderOpacity, HudNotchLook().borderOpacity)
        XCTAssertEqual(config.appearance.pill, HudNotchAppearance.solid.pill)
    }

    func testAppearanceRoundTripsAndClamps() throws {
        var config = HudNotchConfiguration(appearance: .glass)
        config.appearance.card.fillOpacity = 1.6
        config.appearance.pill.shadowRadius = -4
        config.appearance.pill.borderWidth = 9
        let normalized = config.normalized()
        XCTAssertEqual(normalized.appearance.card.fillOpacity, 1)
        XCTAssertEqual(normalized.appearance.pill.shadowRadius, 0)
        XCTAssertEqual(normalized.appearance.pill.borderWidth, 3)

        let decoded = try JSONDecoder().decode(HudNotchConfiguration.self, from: JSONEncoder().encode(normalized))
        XCTAssertEqual(decoded, normalized)
    }
}
