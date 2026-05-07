import XCTest
@testable import HudsonVantage

final class HudVantageSelectionStateTests: XCTestCase {
    func testReplaceSelectionUsesCandidatesOnly() {
        let selection = HudVantageSelectionState(ids: ["a", "b"])
            .applying(["c"], mode: .replace)

        XCTAssertEqual(selection.ids, ["c"])
    }

    func testAddSelectionPreservesExistingIDs() {
        let selection = HudVantageSelectionState(ids: ["a", "b"])
            .applying(["b", "c"], mode: .add)

        XCTAssertEqual(selection.ids, ["a", "b", "c"])
    }

    func testSubtractSelectionRemovesCandidates() {
        let selection = HudVantageSelectionState(ids: ["a", "b", "c"])
            .applying(["b", "d"], mode: .subtract)

        XCTAssertEqual(selection.ids, ["a", "c"])
    }

    func testToggleSelectionFlipsCandidates() {
        let selection = HudVantageSelectionState(ids: ["a", "b"])
            .applying(["b", "c"], mode: .toggle)

        XCTAssertEqual(selection.ids, ["a", "c"])
    }

    func testNormalizedSelectionModeAliases() {
        XCTAssertEqual(HudVantageSelectionMode(normalized: "append"), .add)
        XCTAssertEqual(HudVantageSelectionMode(normalized: "remove"), .subtract)
        XCTAssertEqual(HudVantageSelectionMode(normalized: "toggle"), .toggle)
        XCTAssertEqual(HudVantageSelectionMode(normalized: "bogus"), .replace)
        XCTAssertEqual(HudVantageSelectionMode(normalized: nil), .replace)
    }
}
