import Foundation
@testable import HudsonNotchCore
import XCTest

final class HudNotchDismissTests: XCTestCase {
    // MARK: Who dismissed

    func testOnlyHostIsProgrammatic() {
        for reason in HudNotchDismissal.allCases {
            XCTAssertEqual(reason.byPerson, reason != .host, "\(reason)")
        }
    }

    // MARK: Swipe

    func testFingersUpWithNaturalScrollingPutsAwayOnce() {
        var swipe = HudNotchSwipe(threshold: 30)
        XCTAssertFalse(swipe.feed(deltaY: -4, inverted: true, phase: .began))
        XCTAssertFalse(swipe.feed(deltaY: -12, inverted: true, phase: .changed))
        XCTAssertEqual(swipe.progress, 16.0 / 30.0, accuracy: 0.001)
        XCTAssertTrue(swipe.feed(deltaY: -20, inverted: true, phase: .changed))
        // The rest of the same gesture doesn't fire again.
        XCTAssertFalse(swipe.feed(deltaY: -40, inverted: true, phase: .changed))
    }

    func testFingersUpWithoutNaturalScrolling() {
        var swipe = HudNotchSwipe(threshold: 30)
        XCTAssertFalse(swipe.feed(deltaY: 10, inverted: false, phase: .began))
        XCTAssertTrue(swipe.feed(deltaY: 25, inverted: false, phase: .changed))
    }

    func testFingersDownNeverFires() {
        var swipe = HudNotchSwipe(threshold: 30)
        XCTAssertFalse(swipe.feed(deltaY: 20, inverted: true, phase: .began))
        XCTAssertFalse(swipe.feed(deltaY: 200, inverted: true, phase: .changed))
        XCTAssertEqual(swipe.travel, 0)
    }

    func testScrollingBackDownTakesTravelBack() {
        var swipe = HudNotchSwipe(threshold: 30)
        _ = swipe.feed(deltaY: -25, inverted: true, phase: .began)
        _ = swipe.feed(deltaY: 15, inverted: true, phase: .changed)
        XCTAssertEqual(swipe.travel, 10)
        XCTAssertFalse(swipe.feed(deltaY: -10, inverted: true, phase: .changed))
        XCTAssertTrue(swipe.feed(deltaY: -10, inverted: true, phase: .changed))
    }

    func testMomentumNeverCounts() {
        var swipe = HudNotchSwipe(threshold: 30)
        _ = swipe.feed(deltaY: -10, inverted: true, phase: .began)
        _ = swipe.feed(deltaY: 0, inverted: true, phase: .ended)
        XCTAssertFalse(swipe.feed(deltaY: -100, inverted: true, phase: .momentum))
        XCTAssertEqual(swipe.travel, 0)
    }

    func testANewGestureCanFireAgain() {
        var swipe = HudNotchSwipe(threshold: 30)
        XCTAssertTrue(swipe.feed(deltaY: -40, inverted: true, phase: .began))
        _ = swipe.feed(deltaY: 0, inverted: true, phase: .ended)
        XCTAssertFalse(swipe.fired)
        XCTAssertTrue(swipe.feed(deltaY: -40, inverted: true, phase: .began))
    }

    func testWheelClicksCountWhileTheyKeepComing() {
        var swipe = HudNotchSwipe(threshold: 30, wheelGap: 0.35)
        XCTAssertFalse(swipe.feed(deltaY: 12, inverted: false, phase: .wheel, at: 1.0))
        XCTAssertFalse(swipe.feed(deltaY: 12, inverted: false, phase: .wheel, at: 1.1))
        XCTAssertTrue(swipe.feed(deltaY: 12, inverted: false, phase: .wheel, at: 1.2))
    }

    func testAWheelPauseStartsOver() {
        var swipe = HudNotchSwipe(threshold: 30, wheelGap: 0.35)
        _ = swipe.feed(deltaY: 12, inverted: false, phase: .wheel, at: 1.0)
        _ = swipe.feed(deltaY: 12, inverted: false, phase: .wheel, at: 1.1)
        XCTAssertFalse(swipe.feed(deltaY: 12, inverted: false, phase: .wheel, at: 2.0))
        XCTAssertEqual(swipe.travel, 12)
    }

    // MARK: Putting an activity away

    func testPutAwayRemovesAndKeepsTheSameStateOff() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "w", title: "Writing it down", state: .working))
        XCTAssertEqual(stage.putAway(id: "w")?.id, "w")
        XCTAssertNil(stage.activity(id: "w"))

        let tick = stage.post(HudNotchActivity(id: "w", title: "Writing it down", detail: "5 s", state: .working))
        XCTAssertTrue(tick.isPutAway)
        XCTAssertFalse(tick.wantsAttention)
        XCTAssertNil(stage.activity(id: "w"))
        XCTAssertNil(stage.headline)
    }

    func testANewStateBringsItBack() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "w", title: "Writing it down", state: .working))
        stage.putAway(id: "w")
        let done = stage.post(HudNotchActivity(id: "w", title: "Written down", state: .done))
        XCTAssertFalse(done.isPutAway)
        XCTAssertTrue(done.wantsAttention)
        XCTAssertEqual(stage.activity(id: "w")?.state, .done)
        XCTAssertNil(stage.putAway["w"])
    }

    func testHostDismissForgetsThePutAway() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "q", title: "Which branch?", state: .waiting))
        stage.putAway(id: "q")
        XCTAssertEqual(stage.putAway["q"], .waiting)
        stage.dismiss(id: "q")
        XCTAssertNil(stage.putAway["q"])
        XCTAssertTrue(stage.post(HudNotchActivity(id: "q", title: "Which branch?", state: .waiting)).wantsAttention)
    }

    func testPutAwayOfAnUnknownIDDoesNothing() {
        var stage = HudNotchStage()
        XCTAssertNil(stage.putAway(id: "nope"))
        XCTAssertTrue(stage.putAway.isEmpty)
    }
}
