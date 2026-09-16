import Foundation
import HudsonTranscription
import Testing

@Suite("HudTranscription registry")
struct HudTranscriptionRegistryTests {
    @Test("duplicate provider IDs are rejected")
    func duplicateRegistration() async throws {
        let registry = HudTranscriptionRegistry()
        let first = FakeTranscriptionAdapter(descriptor: TranscriptionFixtures.descriptor(id: "dup"))
        let second = FakeTranscriptionAdapter(descriptor: TranscriptionFixtures.descriptor(id: "dup"))
        try await registry.register(first)

        await #expect(throws: HudTranscriptionError.duplicateProviderID("dup")) {
            try await registry.register(second)
        }

        let other = FakeTranscriptionAdapter(descriptor: TranscriptionFixtures.descriptor(id: "other"))
        try await registry.register(other)
        #expect(await registry.registeredDescriptors().map(\.id.rawValue) == ["dup", "other"])
    }

    @Test("unknown saved configurations are retained without substitution")
    func retainsUnknownSavedConfigurations() async throws {
        let registry = HudTranscriptionRegistry()
        let unknown = TranscriptionFixtures.configuration(providerID: "missing", modelID: "saved-model")
        await registry.retainSaved(unknown)

        let registered = FakeTranscriptionAdapter(
            descriptor: TranscriptionFixtures.descriptor(id: "present"),
            listedModels: [TranscriptionFixtures.model(id: "present-model")]
        )
        try await registry.register(registered)

        let resolvedUnknown = await registry.resolve(unknown)
        guard case .unknownProvider(let kept) = resolvedUnknown else {
            Issue.record("expected unknown provider to be retained")
            return
        }
        #expect(kept.providerID.rawValue == "missing")
        #expect(kept.modelID.rawValue == "saved-model")

        let present = TranscriptionFixtures.configuration(providerID: "present", modelID: "absent-from-catalog")
        let resolvedModel = await registry.resolve(present)
        guard case .recognized(_, let keptPresent, let model, let readiness) = resolvedModel else {
            Issue.record("expected recognized adapter with unknown model")
            return
        }
        #expect(keptPresent.modelID.rawValue == "absent-from-catalog")
        #expect(model == nil)
        #expect(readiness.status == .unavailable)
        #expect(readiness.status != .ready)

        let candidates = await registry.candidates(for: TranscriptionFixtures.fileRequest())
        #expect(candidates.contains { candidate in
            candidate.configuration.modelID.rawValue == "saved-model" && !candidate.canRun
        })
        #expect(candidates.contains { candidate in
            candidate.configuration.modelID.rawValue == "absent-from-catalog" && !candidate.canRun
        })
    }
}
