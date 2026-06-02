import Testing
@testable import HudsonUIOnboarding

@Suite("HudOnboardingProgress")
struct HudOnboardingProgressTests {

    private let steps: [HudOnboardingStep] = [
        .init(id: "pair", title: "Pair", detail: "Pair host"),
        .init(id: "voice", title: "Voice", detail: "Enable mic", isRequired: false),
        .init(id: "terminal", title: "Terminal", detail: "Enable shell"),
    ]

    @Test("normalize selects the first open step")
    func normalizeSelectsFirstOpenStep() {
        var progress = HudOnboardingProgress()

        progress.normalize(for: steps)

        #expect(progress.currentStepID == "pair")
        #expect(progress.currentIndex(in: steps) == 0)
    }

    @Test("completion advances to the next open step")
    func completionAdvances() {
        var progress = HudOnboardingProgress()

        progress.completeCurrent(in: steps)

        #expect(progress.completedStepIDs == ["pair"])
        #expect(progress.currentStepID == "voice")
    }

    @Test("optional steps can be skipped")
    func optionalStepsCanSkip() {
        var progress = HudOnboardingProgress(currentStepID: "voice")

        progress.skipCurrent(in: steps)

        #expect(progress.skippedStepIDs == ["voice"])
        #expect(progress.completedStepIDs.isEmpty)
        #expect(progress.currentStepID == "pair")
    }

    @Test("required steps cannot be skipped")
    func requiredStepsCannotSkip() {
        var progress = HudOnboardingProgress(currentStepID: "pair")

        progress.skipCurrent(in: steps)

        #expect(progress.skippedStepIDs.isEmpty)
        #expect(progress.currentStepID == "pair")
    }

    @Test("completion treats skipped optional steps as closed")
    func completionAllowsSkippedOptionalSteps() {
        var progress = HudOnboardingProgress(
            completedStepIDs: ["pair", "terminal"],
            skippedStepIDs: ["voice"]
        )

        progress.normalize(for: steps)

        #expect(progress.isComplete(in: steps))
        #expect(progress.currentStepID == nil)
    }

    @Test("normalization drops stale ids")
    func normalizationDropsStaleIDs() {
        var progress = HudOnboardingProgress(
            currentStepID: "missing",
            completedStepIDs: ["pair", "old"],
            skippedStepIDs: ["gone"]
        )

        progress.normalize(for: steps)

        #expect(progress.completedStepIDs == ["pair"])
        #expect(progress.skippedStepIDs.isEmpty)
        #expect(progress.currentStepID == "voice")
    }

    @Test("reset clears completion and skips")
    func resetClearsState() {
        var progress = HudOnboardingProgress(
            currentStepID: "terminal",
            completedStepIDs: ["pair"],
            skippedStepIDs: ["voice"]
        )

        progress.reset(to: "pair")

        #expect(progress.currentStepID == "pair")
        #expect(progress.completedStepIDs.isEmpty)
        #expect(progress.skippedStepIDs.isEmpty)
    }
}
