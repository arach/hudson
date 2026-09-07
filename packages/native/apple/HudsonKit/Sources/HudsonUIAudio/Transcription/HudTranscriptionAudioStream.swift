import Foundation

/// Immutable mono Float32 PCM, copied by Swift's array value semantics.
/// `startTime` is the original source timeline position of the first sample.
/// Supply silence explicitly if needed; gaps are preserved rather than collapsed.
public struct HudTranscriptionAudioChunk: Equatable, Sendable {
    public let samples: [Float]
    public let sampleRate: Double
    public let startTime: TimeInterval
    public var duration: TimeInterval { Double(samples.count) / sampleRate }

    public init(samples: [Float], sampleRate: Double, startTime: TimeInterval) throws {
        guard sampleRate.isFinite, sampleRate >= 1, sampleRate <= 192_000,
              !samples.isEmpty, Double(samples.count) <= sampleRate,
              samples.allSatisfy(\.isFinite), startTime.isFinite, startTime >= 0,
              (startTime + Double(samples.count) / sampleRate).isFinite else {
            throw HudStreamingTranscriptionError.invalidAudioChunk
        }
        self.samples = samples
        self.sampleRate = sampleRate
        self.startTime = startTime
    }
}

/// A single-consumer bounded audio ingress supplied and finished by the caller.
/// Overflow is a terminal error, never a silent gap. `yield` does not suspend;
/// producers should pace file input or choose an appropriate capacity. Do not
/// allocate chunks or invoke this locking API directly in a realtime audio tap.
public final class HudTranscriptionAudioStream: @unchecked Sendable {
    private let lock = NSLock()
    private let stream: AsyncThrowingStream<HudTranscriptionAudioChunk, Error>
    private let continuation: AsyncThrowingStream<HudTranscriptionAudioChunk, Error>.Continuation
    private var closed = false
    private var consumed = false
    private var terminalError: Error?

    public init(bufferCapacity: Int = 32) throws {
        guard (1...256).contains(bufferCapacity) else {
            throw HudStreamingTranscriptionError.invalidBufferCapacity
        }
        let pair = AsyncThrowingStream<HudTranscriptionAudioChunk, Error>.makeStream(
            bufferingPolicy: .bufferingOldest(bufferCapacity)
        )
        stream = pair.stream
        continuation = pair.continuation
    }

    /// Enqueues one chunk, or stops the entire stream when its capacity is exceeded.
    public func yield(_ chunk: HudTranscriptionAudioChunk) throws {
        lock.lock()
        defer { lock.unlock() }
        guard !closed else { throw terminalError ?? HudStreamingTranscriptionError.streamClosed }
        switch continuation.yield(chunk) {
        case .enqueued: break
        case .dropped:
            closed = true
            terminalError = HudStreamingTranscriptionError.bufferOverflow
            continuation.finish(throwing: HudStreamingTranscriptionError.bufferOverflow)
            throw HudStreamingTranscriptionError.bufferOverflow
        case .terminated:
            closed = true
            throw HudStreamingTranscriptionError.streamClosed
        @unknown default:
            closed = true
            terminalError = HudStreamingTranscriptionError.streamClosed
            continuation.finish(throwing: HudStreamingTranscriptionError.streamClosed)
            throw HudStreamingTranscriptionError.streamClosed
        }
    }

    /// Ends input successfully; the transcriber drains and finalizes outstanding audio.
    public func finish() {
        lock.lock()
        defer { lock.unlock() }
        guard !closed else { return }
        closed = true
        continuation.finish()
    }

    /// Aborts input. Buffered chunks are not accepted as a successful transcript.
    public func finish(throwing error: Error) {
        lock.lock()
        defer { lock.unlock() }
        // An error may supersede successful EOF while buffered audio is draining.
        guard terminalError == nil else { return }
        closed = true
        terminalError = error
        continuation.finish(throwing: error)
    }

    /// Adapter entry point. Providers must claim once and check terminal errors
    /// before consuming each chunk and before reporting successful completion.
    public func consume() throws -> AsyncThrowingStream<HudTranscriptionAudioChunk, Error> {
        lock.lock()
        defer { lock.unlock() }
        guard !consumed else { throw HudStreamingTranscriptionError.streamAlreadyConsumed }
        consumed = true
        return stream
    }

    public func checkForFailure() throws {
        lock.lock()
        defer { lock.unlock() }
        if let terminalError { throw terminalError }
    }
}
