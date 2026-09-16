import Foundation
import HudsonTranscription
import Testing

@Suite("HudTranscription live event accumulator")
struct HudTranscriptionLiveEventAccumulatorTests {
    @Test("provisional revisions replace in place and finals stay distinct from terminal")
    func partialReplacementAndFinalization() async throws {
        let accumulator = HudTranscriptionLiveEventAccumulator(
            sessionID: "session-1",
            maximumChunkByteCount: 32
        )
        let collected = collectStream(accumulator.events)

        try await accumulator.emitProvisional(utteranceID: "u1", revision: 1, text: "hel")
        try await accumulator.emitProvisional(utteranceID: "u1", revision: 2, text: "hello")
        let provisional = try #require(await accumulator.snapshot(for: "u1"))
        #expect(provisional.text == "hello")
        #expect(provisional.revision == 2)
        #expect(!provisional.isFinal)
        #expect(await accumulator.hasTerminated == false)

        try await accumulator.emitFinalUtterance(utteranceID: "u1", text: "hello.")
        let finalized = try #require(await accumulator.snapshot(for: "u1"))
        #expect(finalized.text == "hello.")
        #expect(finalized.isFinal)
        #expect(await accumulator.hasTerminated == false)

        await #expect(throws: HudTranscriptionError.lateWrite(.utteranceFinalized)) {
            try await accumulator.emitProvisional(utteranceID: "u1", revision: 3, text: "nope")
        }

        try await accumulator.terminate(.cancelled)
        let events = await collected.value
        #expect(events.map(\.sequence) == [0, 1, 2, 3])
        guard case .provisional(let first) = events[0] else {
            Issue.record("expected first provisional")
            return
        }
        guard case .provisional(let second) = events[1] else {
            Issue.record("expected replacement provisional")
            return
        }
        guard case .finalizedUtterance(let utterance) = events[2] else {
            Issue.record("expected finalized utterance before terminal")
            return
        }
        guard case .terminal = events[3] else {
            Issue.record("expected distinct terminal event")
            return
        }
        #expect(first.utteranceID.rawValue == "u1")
        #expect(second.text == "hello")
        #expect(utterance.text == "hello.")
        #expect(events[0].sessionID.rawValue == "session-1")
    }

    @Test("cancel rejects late writes and does not emit a second terminal")
    func cancellationRejectsLateEvents() async throws {
        let accumulator = HudTranscriptionLiveEventAccumulator(
            sessionID: "session-cancel",
            maximumChunkByteCount: 8
        )
        let collected = collectStream(accumulator.events)
        try await accumulator.send(HudTranscriptionPCMChunk(sequence: 0, bytes: Data([0x01, 0x02])))
        await accumulator.cancel()

        await #expect(throws: HudTranscriptionError.lateWrite(.sessionTerminal)) {
            try await accumulator.send(HudTranscriptionPCMChunk(sequence: 1, bytes: Data([0x03])))
        }
        await #expect(throws: HudTranscriptionError.lateWrite(.sessionTerminal)) {
            try await accumulator.emitProvisional(utteranceID: "u1", revision: 1, text: "late")
        }
        await accumulator.cancel()

        let events = await collected.value
        let terminals = events.filter { event in
            if case .terminal = event { return true }
            return false
        }
        #expect(terminals.count == 1)
        guard case .terminal(let terminal) = terminals[0] else {
            Issue.record("expected cancelled terminal")
            return
        }
        #expect(terminal.outcome == .cancelled)
        #expect(HudTranscriptionCancellationOutcome.cancelled != .remoteOutcomeUnknown)
    }

    @Test("oversize or gapped PCM chunks are rejected without consuming sequence")
    func boundedPCMRejection() async throws {
        let accumulator = HudTranscriptionLiveEventAccumulator(
            sessionID: "session-pcm",
            maximumChunkByteCount: 8
        )

        await #expect(throws: HudTranscriptionError.chunkTooLarge(byteCount: 9, maximum: 8)) {
            try await accumulator.send(HudTranscriptionPCMChunk(sequence: 0, bytes: Data(repeating: 1, count: 9)))
        }
        #expect(await accumulator.acceptedChunkCount == 0)
        #expect(await accumulator.nextChunkSequence == 0)

        try await accumulator.send(HudTranscriptionPCMChunk(sequence: 0, bytes: Data(repeating: 1, count: 8)))
        #expect(await accumulator.acceptedChunkCount == 1)
        #expect(await accumulator.nextChunkSequence == 1)

        await #expect(throws: HudTranscriptionError.nonMonotonicChunkSequence(expected: 1, received: 2)) {
            try await accumulator.send(HudTranscriptionPCMChunk(sequence: 2, bytes: Data([0x01])))
        }
        #expect(await accumulator.acceptedChunkCount == 1)
        #expect(await accumulator.nextChunkSequence == 1)

        try await accumulator.finish()
        await #expect(throws: HudTranscriptionError.lateWrite(.inputFinished)) {
            try await accumulator.send(HudTranscriptionPCMChunk(sequence: 1, bytes: Data([0x01])))
        }
        #expect(await accumulator.acceptedChunkCount == 1)
    }

    @Test("a session emits exactly one terminal event")
    func exactlyOneTerminal() async throws {
        let accumulator = HudTranscriptionLiveEventAccumulator(
            sessionID: "session-terminal",
            maximumChunkByteCount: 4
        )
        let collected = collectStream(accumulator.events)
        let result = TranscriptionFixtures.result()
        try await accumulator.terminate(.completed(result))

        await #expect(throws: HudTranscriptionError.sessionAlreadyTerminal) {
            try await accumulator.terminate(.cancelled)
        }
        await accumulator.cancel()
        await #expect(throws: HudTranscriptionError.lateWrite(.sessionTerminal)) {
            try await accumulator.finish()
        }

        let events = await collected.value
        #expect(events.count == 1)
        guard case .terminal(let terminal) = events[0] else {
            Issue.record("expected a single terminal result")
            return
        }
        guard case .completed(let completed) = terminal.outcome else {
            Issue.record("expected completed terminal")
            return
        }
        #expect(completed.transcript == "hello")
    }
}
