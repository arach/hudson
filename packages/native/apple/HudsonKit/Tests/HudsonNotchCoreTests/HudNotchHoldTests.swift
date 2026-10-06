import Foundation
@testable import HudsonNotchCore
import XCTest

final class HudNotchHoldTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000)
    private func at(_ s: TimeInterval) -> Date { t0.addingTimeInterval(s) }

    func testStartsAsCardAndFoldsAfterPeek() {
        var hold = HudNotchHold(peek: 12, now: t0)
        XCTAssertEqual(hold.face, .card)
        XCTAssertEqual(hold.foldsAt, at(12))
        XCTAssertTrue(hold.tick(now: at(12)))
        XCTAssertEqual(hold.face, .chin)
        XCTAssertNil(hold.foldsAt)
        XCTAssertFalse(hold.tick(now: at(60)))
    }

    func testNeverFoldsBeforePeek() {
        var hold = HudNotchHold(peek: 12, now: t0)
        XCTAssertFalse(hold.tick(now: at(0)))
        XCTAssertFalse(hold.tick(now: at(11.9)))
        XCTAssertEqual(hold.face, .card)
    }

    func testHoverHoldsItOpen() {
        var hold = HudNotchHold(peek: 12, now: t0)
        hold.hover(true, now: at(5))
        XCTAssertNil(hold.foldsAt)
        XCTAssertFalse(hold.tick(now: at(100)))
        XCTAssertEqual(hold.face, .card)
    }

    func testLeavingRestartsThePeek() {
        var hold = HudNotchHold(peek: 12, now: t0)
        hold.hover(true, now: at(5))
        hold.hover(false, now: at(30))
        XCTAssertEqual(hold.foldsAt, at(42))
        XCTAssertFalse(hold.tick(now: at(41)))
        XCTAssertTrue(hold.tick(now: at(42)))
    }

    func testReopenFromChin() {
        var hold = HudNotchHold(peek: 12, now: t0)
        hold.tick(now: at(12))
        XCTAssertTrue(hold.reopen(now: at(100)))
        XCTAssertEqual(hold.face, .card)
        XCTAssertEqual(hold.foldsAt, at(112))
        // Reopening the card restarts the clock but changes no face.
        XCTAssertFalse(hold.reopen(now: at(105)))
        XCTAssertEqual(hold.foldsAt, at(117))
    }

    func testHoveringAChinOpensIt() {
        var hold = HudNotchHold(peek: 12, now: t0)
        hold.tick(now: at(12))
        hold.hover(true, now: at(20))
        XCTAssertEqual(hold.face, .card)
        XCTAssertNil(hold.foldsAt)
    }

    func testResolvedIsTerminal() {
        var hold = HudNotchHold(peek: 12, now: t0)
        hold.resolve()
        XCTAssertEqual(hold.face, .resolved)
        XCTAssertNil(hold.foldsAt)
        XCTAssertFalse(hold.tick(now: at(100)))
        XCTAssertFalse(hold.reopen(now: at(100)))
        hold.hover(true, now: at(100))
        XCTAssertEqual(hold.face, .resolved)
        XCTAssertFalse(hold.hovering)
    }
}
