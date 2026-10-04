import Foundation
@testable import HudsonNotchCore
import XCTest

final class HudNotchStageTests: XCTestCase {
    func testNewActivityWantsAttention() {
        var stage = HudNotchStage()
        let change = stage.post(HudNotchActivity(id: "a", title: "Build", state: .working))
        XCTAssertTrue(change.wantsAttention)
        XCTAssertTrue(change.isNew)
        XCTAssertEqual(stage.focused?.id, "a")
    }

    func testProgressUpdatesStayQuiet() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "a", title: "Build", state: .working, progress: 0.1))
        let change = stage.post(HudNotchActivity(id: "a", title: "Build", detail: "step 2", state: .working, progress: 0.5))
        XCTAssertFalse(change.wantsAttention)
        XCTAssertEqual(stage.activities.count, 1)
        XCTAssertEqual(stage.activity(id: "a")?.progress, 0.5)
    }

    func testStateChangeWantsAttentionAndMovesToFront() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "a", title: "Build", state: .working))
        stage.post(HudNotchActivity(id: "b", title: "Test", state: .working))
        let change = stage.post(HudNotchActivity(id: "a", title: "Build", state: .failed))
        XCTAssertTrue(change.wantsAttention)
        XCTAssertTrue(change.stateChanged)
        XCTAssertEqual(stage.activities.first?.id, "a")
    }

    func testHeadlinePrefersOldestWaiting() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "w1", title: "First", state: .waiting))
        stage.post(HudNotchActivity(id: "w2", title: "Second", state: .waiting))
        stage.post(HudNotchActivity(id: "run", title: "Run", state: .working))
        XCTAssertEqual(stage.headline?.id, "w1")
        XCTAssertEqual(stage.waiting.map(\.id), ["w1", "w2"])
    }

    func testAnswerStopsAsking() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "q", title: "Keep?", state: .waiting,
                                    choices: [HudNotchChoice(id: "k", title: "Keep")]))
        let answered = stage.answer(HudNotchReply(id: "q", choice: "k"))
        XCTAssertEqual(answered?.state, .working)
        XCTAssertEqual(answered?.detail, "You chose Keep")
        XCTAssertFalse(answered?.asksForInput ?? true)
        XCTAssertNil(stage.answer(HudNotchReply(id: "q", choice: "k")), "a second answer is ignored")
    }

    func testCapacityEvictsSettledNeverOngoing() {
        var stage = HudNotchStage(capacity: 2)
        stage.post(HudNotchActivity(id: "run", title: "Run", state: .working))
        stage.post(HudNotchActivity(id: "d1", title: "Done 1", state: .done))
        stage.post(HudNotchActivity(id: "d2", title: "Done 2", state: .done))
        XCTAssertEqual(Set(stage.activities.map(\.id)), ["run", "d2"])
    }

    func testDismissAndClearSettled() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "a", title: "A", state: .done))
        stage.post(HudNotchActivity(id: "b", title: "B", state: .working))
        XCTAssertEqual(stage.dismiss(id: "b")?.id, "b")
        XCTAssertNil(stage.dismiss(id: "b"))
        stage.clearSettled()
        XCTAssertTrue(stage.activities.isEmpty)
        XCTAssertNil(stage.focused)
    }

    func testFocusNextCycles() {
        var stage = HudNotchStage()
        stage.post(HudNotchActivity(id: "a", title: "A"))
        stage.post(HudNotchActivity(id: "b", title: "B"))
        XCTAssertEqual(stage.focused?.id, "b")
        stage.focusNext()
        XCTAssertEqual(stage.focused?.id, "a")
        stage.focusNext()
        XCTAssertEqual(stage.focused?.id, "b")
    }
}
