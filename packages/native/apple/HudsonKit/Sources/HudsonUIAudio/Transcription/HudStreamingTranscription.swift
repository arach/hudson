import Foundation

/// A range on the caller's audio timeline, in seconds. Never a wall-clock date.
public struct HudTranscriptTimeRange: Equatable, Sendable {
    public let start: TimeInterval
    public let duration: TimeInterval
    public var end: TimeInterval { start + duration }

    public init(start: TimeInterval, duration: TimeInterval) throws {
        guard start.isFinite, start >= 0, duration.isFinite, duration >= 0,
              (start + duration).isFinite else {
            throw HudStreamingTranscriptionError.invalidTimeRange
        }
        self.start = start
        self.duration = duration
    }
}

/// A provider's text run with its original timing, when supplied.
/// A run may cover several words or punctuation; callers must not infer word times.
public struct HudTranscriptSpan: Equatable, Sendable {
    public let text: String
    public let range: HudTranscriptTimeRange?

    public init(text: String, range: HudTranscriptTimeRange?) {
        self.text = text
        self.range = range
    }
}

/// One complete revision of the current recognition segment, not an append delta.
/// Each partial replaces the pending segment. A final replaces it and commits the
/// segment; subsequent updates belong to the next segment. Providers adapting to
/// this contract must normalize their own revision events accordingly.
public struct HudTranscriptUpdate: Equatable, Sendable {
    public let range: HudTranscriptTimeRange
    public let text: String
    public let spans: [HudTranscriptSpan]
    public let isFinal: Bool

    public init(range: HudTranscriptTimeRange, text: String, spans: [HudTranscriptSpan], isFinal: Bool) {
        self.range = range
        self.text = text
        self.spans = spans
        self.isFinal = isFinal
    }
}

/// Optional caller-owned transcript assembly. The transcriber retains no history.
/// Discard the pending segment after cancellation; only finals are committed.
public struct HudTranscriptAccumulator: Equatable, Sendable {
    public private(set) var finalSegments: [HudTranscriptUpdate] = []
    public private(set) var pendingSegment: HudTranscriptUpdate?

    public init() {}

    public var text: String {
        finalSegments.map(\.text).joined() + (pendingSegment?.text ?? "")
    }

    public mutating func apply(_ update: HudTranscriptUpdate) {
        if update.isFinal {
            finalSegments.append(update)
            pendingSegment = nil
        } else {
            pendingSegment = update
        }
    }

    public mutating func discardPending() {
        pendingSegment = nil
    }
}

/// Downloads are opt-in. Recognition itself remains on device in the Apple backend.
public enum HudTranscriptionModelDownloadPolicy: Sendable {
    case requireInstalled
    case downloadIfNeeded
}

/// Resolved locale and required mono Float32 input sample rate.
/// The caller converts its audio to this rate before constructing chunks.
public struct HudTranscriptionPreparation: Equatable, Sendable {
    public let localeIdentifier: String
    public let sampleRate: Double

    public init(localeIdentifier: String, sampleRate: Double) {
        self.localeIdentifier = localeIdentifier
        self.sampleRate = sampleRate
    }
}

/// Provider-neutral, one-session-at-a-time streaming transcription seam.
/// Prepare before each session. Consume updates promptly; throwing from the
/// handler aborts the session. Finishing audio drains and finalizes results;
/// failure or cancellation throws and does not finalize pending text.
public protocol HudStreamingTranscriber: Sendable {
    func prepare(
        localeIdentifier: String,
        downloadPolicy: HudTranscriptionModelDownloadPolicy
    ) async throws -> HudTranscriptionPreparation

    func transcribe(
        audio: HudTranscriptionAudioStream,
        onUpdate: @escaping @Sendable (HudTranscriptUpdate) async throws -> Void
    ) async throws

    func cancel() async
}

/// Errors in Hudson's stream contract. Provider and caller errors propagate intact.
public enum HudStreamingTranscriptionError: Error, Equatable, LocalizedError, Sendable {
    case invalidTimeRange
    case invalidAudioChunk
    case invalidBufferCapacity
    case bufferOverflow
    case streamClosed
    case streamAlreadyConsumed
    case alreadyRunning
    case notPrepared
    case unavailable
    case unsupportedLocale(String)
    case modelNotInstalled(String)
    case unsupportedAudioFormat
    case unexpectedSampleRate(expected: Double, actual: Double)
    case disorderedAudio
    case invalidResultTiming

    public var errorDescription: String? {
        switch self {
        case .invalidTimeRange: return "Audio time ranges must be finite and nonnegative."
        case .invalidAudioChunk: return "Audio must contain finite mono samples at a valid rate, with at most one second per chunk."
        case .invalidBufferCapacity: return "Audio buffer capacity must be between 1 and 256 chunks."
        case .bufferOverflow: return "Transcription audio exceeded its bounded queue; the session was stopped without silently dropping audio."
        case .streamClosed: return "The transcription audio stream is closed."
        case .streamAlreadyConsumed: return "A transcription audio stream can be consumed only once."
        case .alreadyRunning: return "Transcription is already preparing or running."
        case .notPrepared: return "Prepare the transcriber before starting a session."
        case .unavailable: return "On-device SpeechTranscriber is unavailable on this device."
        case .unsupportedLocale(let locale): return "On-device transcription does not support \(locale)."
        case .modelNotInstalled(let locale): return "The on-device speech model for \(locale) is not installed."
        case .unsupportedAudioFormat: return "No compatible speech analysis audio format is available."
        case .unexpectedSampleRate(let expected, let actual): return "Expected audio at \(expected) Hz, received \(actual) Hz."
        case .disorderedAudio: return "Audio chunks must not overlap or move backwards on the source timeline."
        case .invalidResultTiming: return "Speech recognition returned an invalid source audio time range."
        }
    }
}
