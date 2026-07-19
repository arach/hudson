import Testing
import HudsonUI
@testable import HudsonShell

@Suite("HudPhoneControlDeckState")
struct HudPhoneControlDeckStateTests {
    @Test("A pivot summons the resting deck")
    func pivotSummonsDeck() {
        #expect(
            HudPhoneControlDeckReducer.reduce(state: .resting, event: .pivotTapped) == .expanded
        )
    }

    @Test("Explicit dismissal and slot activation both collapse the deck")
    func dismissalAndActivationCollapseDeck() {
        #expect(
            HudPhoneControlDeckReducer.reduce(state: .expanded, event: .dismissed) == .resting
        )
        #expect(
            HudPhoneControlDeckReducer.reduce(state: .expanded, event: .slotActivated) == .resting
        )
    }

    @Test("Timeout only affects an expanded deck")
    func timeoutOnlyCollapsesExpandedDeck() {
        #expect(
            HudPhoneControlDeckReducer.reduce(state: .resting, event: .timedOut) == .resting
        )
        #expect(
            HudPhoneControlDeckReducer.reduce(state: .expanded, event: .timedOut) == .resting
        )
    }

    @Test("Removing a route's complications collapses an open deck")
    func emptyComplicationsCollapseDeck() {
        #expect(
            HudPhoneControlDeckReducer.reduce(
                state: .expanded,
                event: .complicationsChanged(isEmpty: true)
            ) == .resting
        )
        #expect(
            HudPhoneControlDeckReducer.reduce(
                state: .expanded,
                event: .complicationsChanged(isEmpty: false)
            ) == .expanded
        )
    }

    @Test("VoiceOver suppresses idle dismissal")
    func voiceOverSuppressesIdleDismissal() {
        let policy = HudPhoneControlDeckPolicy(idleTimeout: .seconds(9))
        #expect(
            HudPhoneControlDeckReducer.timeout(
                policy: policy,
                voiceOverEnabled: false,
                activeModePickerCount: 0
            ) == .seconds(9)
        )
        #expect(
            HudPhoneControlDeckReducer.timeout(
                policy: policy,
                voiceOverEnabled: true,
                activeModePickerCount: 0
            ) == nil
        )
    }

    @Test("An open mode picker pauses idle dismissal")
    func modePickerPausesIdleDismissal() {
        #expect(
            HudPhoneControlDeckReducer.timeout(
                policy: .standard,
                voiceOverEnabled: false,
                activeModePickerCount: 2
            ) == nil
        )
    }

    @Test("Reconfiguration cancels expanded shell chrome")
    @MainActor
    func reconfigurationNormalizesState() {
        let runtime = HudPhoneControlDeckRuntime(policy: .standard)
        runtime.pivotTapped()
        #expect(runtime.state == .expanded)

        runtime.reconfigure(policy: nil)
        #expect(runtime.state == .resting)
    }

    @Test("Mode picker activity is tracked independently by position")
    @MainActor
    func modePickerPositionsAreIndependent() {
        let runtime = HudPhoneControlDeckRuntime(policy: .standard)
        runtime.pivotTapped()

        runtime.setModePickerPresented(true, at: .topLeft)
        runtime.setModePickerPresented(true, at: .center)
        runtime.setModePickerPresented(false, at: .topLeft)

        #expect(runtime.activeModePickerPositions == [.center])
    }

    @Test("Minimal eligibility requires the center slot")
    func minimalEligibilityRequiresCenter() {
        let cornerOnly = HudPhoneComplications(
            topLeft: .init(icon: "gearshape", action: {})
        )
        let centered = HudPhoneComplications(
            center: .init(icon: "sparkles", action: {})
        )

        #expect(!HudPhoneControlDeckEligibility.hasRenderableComplications(cornerOnly, style: .minimal))
        #expect(HudPhoneControlDeckEligibility.hasRenderableComplications(centered, style: .minimal))
        #expect(HudPhoneControlDeckEligibility.hasRenderableComplications(cornerOnly, style: .scattered))
    }

    @Test("Bottom-lane eligibility follows rendered positions")
    func bottomLaneEligibilityFollowsStyle() {
        let topOnly = HudPhoneComplications(
            topRight: .init(icon: "gearshape", action: {})
        )
        let bottom = HudPhoneComplications(
            bottomRight: .init(icon: "keyboard", action: {})
        )

        #expect(!HudPhoneControlDeckEligibility.hasBottomComplications(topOnly, style: .scattered))
        #expect(HudPhoneControlDeckEligibility.hasBottomComplications(bottom, style: .scattered))
        #expect(!HudPhoneControlDeckEligibility.hasBottomComplications(bottom, style: .minimal))
    }
}
