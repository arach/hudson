import SwiftUI
import Testing
@testable import HudsonUI

@Suite("HudMessageBar")
struct HudMessageBarTests {

    @Test("compact bar stays inline at standard text sizes")
    func compactBarUsesInlineLayoutAtStandardSizes() {
        #expect(HudMessageBarLayoutPolicy.compactLayout(for: .large) == .inline)
        #expect(HudMessageBarLayoutPolicy.compactLayout(for: .xxxLarge) == .inline)
    }

    @Test("compact bar stacks at accessibility text sizes")
    func compactBarStacksAtAccessibilitySizes() {
        #expect(HudMessageBarLayoutPolicy.compactLayout(for: .accessibility1) == .stacked)
        #expect(HudMessageBarLayoutPolicy.compactLayout(for: .accessibility5) == .stacked)
    }

    @Test("expanded bar stays inline at standard text sizes")
    func expandedBarUsesInlineLayoutAtStandardSizes() {
        #expect(HudMessageBarLayoutPolicy.expandedLayout(for: .large) == .inline)
        #expect(HudMessageBarLayoutPolicy.expandedLayout(for: .xxxLarge) == .inline)
    }

    @Test("expanded bar stacks at accessibility text sizes")
    func expandedBarStacksAtAccessibilitySizes() {
        #expect(HudMessageBarLayoutPolicy.expandedLayout(for: .accessibility1) == .stacked)
        #expect(HudMessageBarLayoutPolicy.expandedLayout(for: .accessibility5) == .stacked)
    }

    @MainActor
    @Test("legacy and accessibility-aware initializers remain unambiguous")
    func initializerCompatibility() {
        let legacy = HudMessageBar(text: .constant("")) {}
        let accessibilityAware = HudMessageBar(
            text: .constant(""),
            inputAccessibilityLabel: "Capture a thought",
            inputAccessibilityIdentifier: "capture-input"
        ) {}

        _ = legacy
        _ = accessibilityAware
    }

    @Test("input accessibility label falls back to the visible placeholder")
    func inputAccessibilityLabelFallback() {
        #expect(
            HudMessageBar.resolvedInputAccessibilityLabel(
                nil,
                placeholder: "Capture a thought"
            ) == "Capture a thought"
        )
        #expect(
            HudMessageBar.resolvedInputAccessibilityLabel(
                "  ",
                placeholder: "Capture a thought"
            ) == "Capture a thought"
        )
        #expect(
            HudMessageBar.resolvedInputAccessibilityLabel(
                "New question",
                placeholder: "Capture a thought"
            ) == "New question"
        )
    }

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
