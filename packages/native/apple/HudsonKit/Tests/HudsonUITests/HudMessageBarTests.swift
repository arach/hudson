import Testing
@testable import HudsonUI

@Suite("HudMessageBar")
struct HudMessageBarTests {

    @Test("suggestion selection starts inactive")
    func suggestionSelectionStartsInactive() {
        let selection = HudMessageBarSuggestionSelectionState()

        #expect(selection.displayedIndex == -1)
        #expect(selection.acceptedIndex(count: 3) == nil)
    }

    @Test("arrow movement activates the first visible suggestion")
    func arrowMovementActivatesFirstSuggestion() {
        var selection = HudMessageBarSuggestionSelectionState()

        let didMove = selection.move(1, count: 3)

        #expect(didMove)
        #expect(selection.displayedIndex == 0)
        #expect(selection.acceptedIndex(count: 3) == 0)
    }

    @Test("up movement activates the last visible suggestion")
    func upMovementActivatesLastSuggestion() {
        var selection = HudMessageBarSuggestionSelectionState()

        let didMove = selection.move(-1, count: 3)

        #expect(didMove)
        #expect(selection.displayedIndex == 2)
        #expect(selection.acceptedIndex(count: 3) == 2)
    }

    @Test("active suggestion movement wraps")
    func activeSuggestionMovementWraps() {
        var selection = HudMessageBarSuggestionSelectionState()

        selection.activate(at: 2, count: 3)
        let didMoveForward = selection.move(1, count: 3)

        #expect(didMoveForward)
        #expect(selection.acceptedIndex(count: 3) == 0)

        let didMoveBackward = selection.move(-1, count: 3)

        #expect(didMoveBackward)
        #expect(selection.acceptedIndex(count: 3) == 2)
    }

    @Test("reset clears active selection")
    func resetClearsActiveSelection() {
        var selection = HudMessageBarSuggestionSelectionState()

        selection.activate(at: 1, count: 3)
        selection.reset()

        #expect(selection.displayedIndex == -1)
        #expect(selection.acceptedIndex(count: 3) == nil)
    }
}
