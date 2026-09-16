import Foundation
import HudsonTranscription
import Testing

@Suite("HudTranscription compatibility")
struct HudTranscriptionCompatibilityTests {
    @Test("registry delegates whole-request compatibility to the adapter")
    func compatibilityDelegation() async throws {
        let reason = HudTranscriptionCompatibilityReason(
            code: .durationExceeded,
            message: "annotated audio exceeds documented limit",
            userExplanation: "This recording is longer than the selected engine allows."
        )
        let adapter = FakeTranscriptionAdapter(
            descriptor: TranscriptionFixtures.descriptor(id: "delegated"),
            compatibilityResult: .unsupported([reason])
        )
        let registry = HudTranscriptionRegistry()
        try await registry.register(adapter)

        let request = TranscriptionFixtures.fileRequest(
            duration: 2_700,
            features: HudTranscriptionRequestedFeatures(speakerLabels: true)
        )
        let configuration = TranscriptionFixtures.configuration(providerID: "delegated")
        let candidates = await registry.evaluate(request: request, configurations: [configuration])
        let candidate = try #require(candidates.first)

        #expect(adapter.compatibilityCalls.count == 1)
        #expect(adapter.compatibilityCalls.first?.0.duration == 2_700)
        #expect(candidate.compatibility.status == .unsupported)
        #expect(candidate.compatibility.reasons.first?.code == .durationExceeded)
        #expect(!candidate.canRun)
    }

    @Test("unverified compatibility is never treated as ready to run")
    func unverifiedIsNotReady() async throws {
        let adapter = FakeTranscriptionAdapter(
            descriptor: TranscriptionFixtures.descriptor(id: "unverified"),
            compatibilityResult: .unverified([
                HudTranscriptionCompatibilityReason(
                    code: .limitUnverified,
                    message: "session limit is unknown",
                    userExplanation: "This engine has not documented a session limit."
                ),
            ]),
            readinessResult: .ready
        )
        let registry = HudTranscriptionRegistry()
        try await registry.register(adapter)

        let candidates = await registry.evaluate(
            request: TranscriptionFixtures.pcmRequest(),
            configurations: [TranscriptionFixtures.configuration(providerID: "unverified")]
        )
        let candidate = try #require(candidates.first)
        #expect(candidate.readiness.status == .ready)
        #expect(candidate.compatibility.status == .unverified)
        #expect(!candidate.canRun)
    }

    @Test("optional live mode defaults to a typed unsupported error")
    func optionalLiveDefaultsToUnsupported() async {
        let adapter = FakeTranscriptionAdapter(descriptor: TranscriptionFixtures.descriptor())
        await #expect(throws: HudTranscriptionError.unsupportedMode(.live)) {
            try await adapter.openLive(
                TranscriptionFixtures.pcmRequest(),
                configuration: TranscriptionFixtures.configuration()
            )
        }
        await #expect(throws: HudTranscriptionError.unsupportedMode(.batch)) {
            try await adapter.submit(
                TranscriptionFixtures.fileRequest(),
                configuration: TranscriptionFixtures.configuration()
            )
        }
    }

    @Test("unknown duration limits compare as unverified, not unlimited")
    func unknownLimitsStayUnknown() {
        #expect(HudTranscriptionDurationLimit.unknown.comparison(with: 10_000) == .unverified)
        #expect(HudTranscriptionDurationLimit.seconds(60).comparison(with: 61) == .exceeded)
        #expect(HudTranscriptionDurationLimit.seconds(60).comparison(with: 60) == .within)
    }
}
