import CoreGraphics
import Foundation
@testable import HudsonNotchCore
import XCTest

final class HudNotchKeysTests: XCTestCase {
    func testModifiersComeInApplesOrder() {
        XCTAssertEqual(HudNotchKeys.ordered(["⌘", "⇧", "⌃"]), ["⌃", "⇧", "⌘"])
        XCTAssertEqual(HudNotchKeys.ordered(["⌘", "⌘", "M"]), ["⌘"])
        XCTAssertEqual(HudNotchKeys.modifiers(control: false, option: true, shift: true, command: true), ["⌥", "⇧", "⌘"])
        XCTAssertEqual(HudNotchKeys.modifiers(control: false, option: false, shift: false, command: false), [])
    }

    func testNamedKeysWinOverCharacters() {
        XCTAssertEqual(HudNotchKeys.name(keyCode: 53, characters: "\u{1b}"), HudNotchKeys.escape)
        XCTAssertEqual(HudNotchKeys.name(keyCode: 49, characters: " "), "Space")
        XCTAssertEqual(HudNotchKeys.name(keyCode: 122, characters: nil), "F1")
        XCTAssertEqual(HudNotchKeys.name(keyCode: 126, characters: nil), "↑")
    }

    func testCharactersAreUpperCasedAndBareModifiersHaveNoCap() {
        XCTAssertEqual(HudNotchKeys.name(keyCode: 46, characters: "m"), "M")
        XCTAssertEqual(HudNotchKeys.name(keyCode: 55, characters: ""), nil)
        XCTAssertEqual(HudNotchKeys.name(keyCode: 56, characters: nil), nil)
        XCTAssertTrue(HudNotchKeys.isModifier("⌘"))
        XCTAssertFalse(HudNotchKeys.isModifier("M"))
    }

    func testSceneRoomFitsTheSceneItsShadowAndTheShell() {
        let config = HudNotchConfiguration(shellHeight: 34, panelSidePadding: 42)
        let room = HudNotchMetrics.sceneRoom(width: 430, contentHeight: 150, notchHeight: 32, configuration: config)
        XCTAssertEqual(room.width, 514)
        XCTAssertEqual(room.height, 34 + 150 + 36)
        let wingsOnly = HudNotchMetrics.sceneRoom(width: 300, contentHeight: -4, notchHeight: 38, configuration: config)
        XCTAssertEqual(wingsOnly.height, 38 + 36)
    }
}
