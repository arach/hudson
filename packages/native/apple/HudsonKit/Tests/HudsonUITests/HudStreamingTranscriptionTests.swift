import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudStreamingTranscription")
struct HudStreamingTranscriptionTests {
    @Test("PCM validates timing and bounds without changing the source samples")
    func audioValidation() throws {
        var original: [Float] = [0.1, -0.2, 0.3]
        let chunk = try HudTranscriptionAudioChunk(samples: original, sampleRate: 16_000, startTime: 42)
        original[0] = 0.9
        #expect(chunk.samples[0] == 0.1)
        #expect(chunk.startTime == 42)
        #expect(chunk.duration == 3.0 / 16_000)
        for rate in [0.0, -1, .nan, .infinity, 192_001] {
            #expect(throws: HudStreamingTranscriptionError.invalidAudioChunk) {
                try HudTranscriptionAudioChunk(samples: [0], sampleRate: rate, startTime: 0)
            }
        }
        for samples: [Float] in [[], [.nan], [.infinity], [0, 0, 0]] {
            #expect(throws: HudStreamingTranscriptionError.invalidAudioChunk) {
                try HudTranscriptionAudioChunk(samples: samples, sampleRate: 2, startTime: 0)
            }
        }
        #expect(throws: HudStreamingTranscriptionError.invalidAudioChunk) {
            try HudTranscriptionAudioChunk(samples: [0], sampleRate: 16_000, startTime: -1)
        }
    }

    @Test("Time ranges reject invalid values and preserve legitimate silence")
    func ranges() throws {
        let range = try HudTranscriptTimeRange(start: 12.25, duration: 0)
        #expect(range.end == 12.25)
        for (start, duration) in [(-1.0, 1.0), (0, -1), (.nan, 1), (0, .infinity), (.greatestFiniteMagnitude, .greatestFiniteMagnitude)] {
            #expect(throws: HudStreamingTranscriptionError.invalidTimeRange) {
                try HudTranscriptTimeRange(start: start, duration: duration)
            }
        }
    }

    @Test("Audio queue drains in order and preserves nonzero origins and gaps")
    func drain() async throws {
        let source = try HudTranscriptionAudioStream(bufferCapacity: 2)
        let first = try HudTranscriptionAudioChunk(samples: [0.5], sampleRate: 10, startTime: 7)
        let second = try HudTranscriptionAudioChunk(samples: [-0.5], sampleRate: 10, startTime: 10)
        try source.yield(first)
        try source.yield(second)
        source.finish()
        var chunks: [HudTranscriptionAudioChunk] = []
        for try await chunk in try source.consume() { chunks.append(chunk) }
        #expect(chunks == [first, second])
        try source.checkForFailure()
        #expect(throws: HudStreamingTranscriptionError.streamClosed) { try source.yield(first) }
        #expect(throws: HudStreamingTranscriptionError.streamAlreadyConsumed) { try source.consume() }
    }

    @Test("Overflow fails the session rather than silently accepting a gap")
    func overflow() async throws {
        let source = try HudTranscriptionAudioStream(bufferCapacity: 1)
        let chunk = try HudTranscriptionAudioChunk(samples: [0], sampleRate: 10, startTime: 0)
        try source.yield(chunk)
        #expect(throws: HudStreamingTranscriptionError.bufferOverflow) { try source.yield(chunk) }
        #expect(throws: HudStreamingTranscriptionError.bufferOverflow) { try source.checkForFailure() }
        var failed = false
        do {
            for try await _ in try source.consume() {}
        } catch HudStreamingTranscriptionError.bufferOverflow { failed = true }
        #expect(failed)
    }

    @Test("Producer failure survives EOF and later attempts to close")
    func failureAfterEOF() throws {
        let source = try HudTranscriptionAudioStream()
        source.finish()
        source.finish(throwing: FixtureError.transportLost)
        source.finish()
        #expect(throws: FixtureError.transportLost) { try source.checkForFailure() }
        #expect(throws: FixtureError.transportLost) {
            try source.yield(HudTranscriptionAudioChunk(samples: [0], sampleRate: 10, startTime: 0))
        }
    }

    @Test("Invalid queue capacity fails before allocation")
    func capacity() {
        for size in [-1, 0, 257, Int.max] {
            #expect(throws: HudStreamingTranscriptionError.invalidBufferCapacity) {
                try HudTranscriptionAudioStream(bufferCapacity: size)
            }
        }
    }

    @Test("Provisional revisions replace text; finals commit original timing")
    func revisions() throws {
        let range = try HudTranscriptTimeRange(start: 7, duration: 2)
        var transcript = HudTranscriptAccumulator()
        transcript.apply(HudTranscriptUpdate(range: range, text: "A care", spans: [], isFinal: false))
        transcript.apply(HudTranscriptUpdate(range: range, text: "A careful reader. ", spans: [], isFinal: false))
        #expect(transcript.text == "A careful reader. ")
        #expect(transcript.finalSegments.isEmpty)
        let spans = [HudTranscriptSpan(text: "A careful", range: range), HudTranscriptSpan(text: " reader. ", range: nil)]
        let final = HudTranscriptUpdate(range: range, text: "A careful reader. ", spans: spans, isFinal: true)
        transcript.apply(final)
        #expect(transcript.pendingSegment == nil)
        #expect(transcript.finalSegments == [final])
        #expect(transcript.finalSegments[0].spans[1].range == nil)
        transcript.apply(HudTranscriptUpdate(range: try HudTranscriptTimeRange(start: 9, duration: 1), text: "Next", spans: [], isFinal: false))
        transcript.discardPending()
        #expect(transcript.text == "A careful reader. ")
    }

    @Test("Empty provisional revision retracts provisional text")
    func emptyRevision() throws {
        let range = try HudTranscriptTimeRange(start: 0, duration: 1)
        var transcript = HudTranscriptAccumulator()
        transcript.apply(HudTranscriptUpdate(range: range, text: "guess", spans: [], isFinal: false))
        transcript.apply(HudTranscriptUpdate(range: range, text: "", spans: [], isFinal: false))
        #expect(transcript.text.isEmpty)
        #expect(transcript.finalSegments.isEmpty)
    }

    private enum FixtureError: Error, Equatable { case transportLost }

    @Test("A finalization watermark commits unchanged earlier provisional text")
    func implicitFinalization() throws {
        var revisions = HudTranscriptRevisionNormalizer()
        let first = HudTranscriptUpdate(range: try .init(start: 7, duration: 1), text: "First. ", spans: [], isFinal: false)
        _ = try revisions.receive(first, finalizedThrough: nil)
        let second = HudTranscriptUpdate(range: try .init(start: 8, duration: 1), text: "Second.", spans: [], isFinal: false)
        let updates = try revisions.receive(second, finalizedThrough: 8)
        #expect(updates.map(\.text) == ["First. ", "Second."])
        #expect(updates.map(\.isFinal) == [true, false])
        #expect(revisions.finish().map(\.text) == ["Second."])
        #expect(revisions.finish().isEmpty)
    }

    @Test("Same-origin final revision replaces the whole older hypothesis")
    func prefixFinalization() throws {
        var revisions = HudTranscriptRevisionNormalizer()
        let firstSpan = HudTranscriptSpan(text: "First. ", range: try .init(start: 7, duration: 1))
        let secondSpan = HudTranscriptSpan(text: "Second.", range: try .init(start: 8, duration: 1))
        _ = try revisions.receive(HudTranscriptUpdate(
            range: try .init(start: 7, duration: 2), text: "First. Second.",
            spans: [firstSpan, secondSpan], isFinal: false
        ), finalizedThrough: nil)
        let updates = try revisions.receive(HudTranscriptUpdate(
            range: try .init(start: 7, duration: 1), text: "First. ", spans: [firstSpan], isFinal: true
        ), finalizedThrough: 8)
        #expect(updates.map(\.text) == ["First. "])
        #expect(updates.map(\.isFinal) == [true])
        #expect(revisions.finish().isEmpty)
    }

    @Test("Disjoint provisional updates survive until successful completion")
    func disjointProvisionalResults() throws {
        var revisions = HudTranscriptRevisionNormalizer()
        _ = try revisions.receive(HudTranscriptUpdate(range: try .init(start: 7, duration: 1), text: "First. ", spans: [], isFinal: false), finalizedThrough: nil)
        let updates = try revisions.receive(HudTranscriptUpdate(range: try .init(start: 10, duration: 1), text: "Second.", spans: [], isFinal: false), finalizedThrough: nil)
        #expect(updates.last?.text == "First. Second.")
        let finals = revisions.finish()
        #expect(finals.map(\.range.start) == [7, 10])
        #expect(finals.allSatisfy { $0.isFinal })
    }

    @Test("Coarse provisional timing does not prevent a shorter final revision")
    func unsplittableRevision() throws {
        var revisions = HudTranscriptRevisionNormalizer()
        let range = try HudTranscriptTimeRange(start: 7, duration: 2)
        _ = try revisions.receive(HudTranscriptUpdate(range: range, text: "one two", spans: [.init(text: "one two", range: range)], isFinal: false), finalizedThrough: nil)
        let updates = try revisions.receive(HudTranscriptUpdate(range: try .init(start: 7, duration: 1), text: "one", spans: [], isFinal: true), finalizedThrough: 8)
        #expect(updates.map(\.text) == ["one"])
        #expect(updates.first?.isFinal == true)
        #expect(revisions.finish().isEmpty)
    }

    @Test("Later-origin revisions preserve only independently timed earlier spans")
    func overlappingRevision() throws {
        var revisions = HudTranscriptRevisionNormalizer()
        let firstSpan = HudTranscriptSpan(text: "First. ", range: try .init(start: 7, duration: 1))
        let secondSpan = HudTranscriptSpan(text: "Second?", range: try .init(start: 8, duration: 1))
        _ = try revisions.receive(HudTranscriptUpdate(range: try .init(start: 7, duration: 2), text: "First. Second?", spans: [firstSpan, secondSpan], isFinal: false), finalizedThrough: nil)
        let updates = try revisions.receive(HudTranscriptUpdate(range: try .init(start: 8, duration: 1), text: "Second.", spans: [], isFinal: true), finalizedThrough: 9)
        #expect(updates.map(\.text) == ["First. ", "Second."])
        #expect(updates.first?.spans == [firstSpan])
    }

    #if canImport(Speech) && compiler(>=6.2)
    @Test("Apple engine requires explicit preparation and idle cancellation is safe")
    func explicitPreparation() async throws {
        let engine: any HudStreamingTranscriber = HudAppleStreamingTranscriber()
        await engine.cancel()
        let source = try HudTranscriptionAudioStream()
        source.finish()
        do {
            try await engine.transcribe(audio: source) { _ in
                Issue.record("An unprepared engine must not emit results")
            }
            Issue.record("An unprepared engine must fail")
        } catch HudStreamingTranscriptionError.notPrepared {}
        await engine.cancel()
    }
    #endif
}
