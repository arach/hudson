import Foundation
import HudsonTranscription
import Testing

@Suite("HudTranscription batch events")
struct HudTranscriptionBatchEventTests {
    @Test("accepted provider request ID is emitted before completion and preserved on the result")
    func providerAcceptanceIDPreservation() async throws {
        let adapter = FakeBatchAdapter(
            descriptor: TranscriptionFixtures.descriptor(id: "batch"),
            providerRequestID: "job-99"
        )
        let configuration = TranscriptionFixtures.configuration(providerID: "batch")
        let request = TranscriptionFixtures.fileRequest()
        let operation = try await adapter.submit(request, configuration: configuration)

        var events: [HudTranscriptionBatchEvent] = []
        for await event in operation.events {
            events.append(event)
        }

        #expect(events.count == 2)
        guard case .accepted(let providerRequestID) = events[0] else {
            Issue.record("expected accepted provider ID before completion")
            return
        }
        guard case .completed(let result) = events[1] else {
            Issue.record("expected completed result after accept")
            return
        }
        #expect(providerRequestID == "job-99")
        #expect(result.provenance.providerRequestID == "job-99")
        #expect(result.provenance.configurationFingerprint == configuration.secretFreeFingerprint)
        #expect(result.provenance.sourceDigest == "digest-1")
        #expect(result.provenance.modelID == configuration.modelID)
    }

    @Test("cancellation outcomes distinguish cancelled from remote outcome unknown")
    func cancellationOutcomesAreDistinct() async {
        let operation = MemoryBatchOperation(operationID: "op-cancel")
        let collected = collectStream(operation.events)
        await operation.yield(.accepted(providerRequestID: "job-pending"))
        await operation.yield(.cancellation(.requested))
        await operation.yield(.cancellation(.remoteOutcomeUnknown))
        await operation.finish()

        let events = await collected.value
        #expect(events == [
            .accepted(providerRequestID: "job-pending"),
            .cancellation(.requested),
            .cancellation(.remoteOutcomeUnknown),
        ])
        #expect(HudTranscriptionCancellationOutcome.cancelled != .remoteOutcomeUnknown)
        #expect(HudTranscriptionCancellationOutcome.requested != .cancelled)
    }
}
