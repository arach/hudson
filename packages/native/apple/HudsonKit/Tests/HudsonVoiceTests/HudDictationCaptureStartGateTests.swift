import Testing
@testable import HudsonVoice

@Suite("HudDictation capture start gate")
struct HudDictationCaptureStartGateTests {
    @Test("a pending start rejects duplicate begin calls")
    func rejectsDuplicateStarts() throws {
        var gate = HudDictationCaptureStartGate()

        let pendingGeneration = gate.begin()
        let generation = try #require(pendingGeneration)
        let duplicateGeneration = gate.begin()

        #expect(gate.isStarting)
        #expect(gate.isCurrent(generation))
        #expect(duplicateGeneration == nil)
    }

    @Test("cancelling invalidates delayed callbacks and permits a new start")
    func invalidatesCancelledStarts() throws {
        var gate = HudDictationCaptureStartGate()
        let pendingGeneration = gate.begin()
        let cancelled = try #require(pendingGeneration)
        let didCancel = gate.cancelIfStarting()
        let didFinishCancelled = gate.finish(cancelled)

        #expect(didCancel)
        #expect(!gate.isStarting)
        #expect(!gate.isCurrent(cancelled))
        #expect(!didFinishCancelled)

        let pendingReplacement = gate.begin()
        let replacement = try #require(pendingReplacement)
        let didFinishReplacement = gate.finish(replacement)
        #expect(replacement != cancelled)
        #expect(didFinishReplacement)
        #expect(!gate.isStarting)
    }

    @Test("finishing a current start is idempotent")
    func finishesOnlyCurrentGeneration() throws {
        var gate = HudDictationCaptureStartGate()
        let pendingGeneration = gate.begin()
        let generation = try #require(pendingGeneration)
        let firstFinish = gate.finish(generation)
        let secondFinish = gate.finish(generation)
        let didCancel = gate.cancelIfStarting()

        #expect(firstFinish)
        #expect(!secondFinish)
        #expect(!didCancel)
    }
}
