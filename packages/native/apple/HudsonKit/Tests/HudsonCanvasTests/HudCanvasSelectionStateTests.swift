import XCTest
@testable import HudsonCanvas

final class HudCanvasSelectionStateTests: XCTestCase {
    func testReplaceSelectionUsesCandidatesOnly() {
        let selection = HudCanvasSelectionState(ids: ["a", "b"])
            .applying(["c"], mode: .replace)

        XCTAssertEqual(selection.ids, ["c"])
    }

    func testAddSelectionPreservesExistingIDs() {
        let selection = HudCanvasSelectionState(ids: ["a", "b"])
            .applying(["b", "c"], mode: .add)

        XCTAssertEqual(selection.ids, ["a", "b", "c"])
    }

    func testSubtractSelectionRemovesCandidates() {
        let selection = HudCanvasSelectionState(ids: ["a", "b", "c"])
            .applying(["b", "d"], mode: .subtract)

        XCTAssertEqual(selection.ids, ["a", "c"])
    }

    func testToggleSelectionFlipsCandidates() {
        let selection = HudCanvasSelectionState(ids: ["a", "b"])
            .applying(["b", "c"], mode: .toggle)

        XCTAssertEqual(selection.ids, ["a", "c"])
    }

    func testNormalizedSelectionModeAliases() {
        XCTAssertEqual(HudCanvasSelectionMode(normalized: "append"), .add)
        XCTAssertEqual(HudCanvasSelectionMode(normalized: "remove"), .subtract)
        XCTAssertEqual(HudCanvasSelectionMode(normalized: "toggle"), .toggle)
        XCTAssertEqual(HudCanvasSelectionMode(normalized: "bogus"), .replace)
        XCTAssertEqual(HudCanvasSelectionMode(normalized: nil), .replace)
    }
}
