import Foundation
import HudsonTranscription
// WhisperKit 0.18 predates strict Sendable annotations. The native instance is
// confined below and overlapping inference is rejected across actor reentrancy.
@preconcurrency import WhisperKit

/// Request sent across the adapter actor boundary into a loaded WhisperKit session.
public struct HudWhisperKitTranscribeRequest: Sendable {
    public var audioPath: String
    public var language: String?
    public var wordTimestamps: Bool

    public init(audioPath: String, language: String?, wordTimestamps: Bool) {
        self.audioPath = audioPath
        self.language = language
        self.wordTimestamps = wordTimestamps
    }
}

/// Native WhisperKit word timing copied out of the library types.
public struct HudWhisperKitNativeWord: Sendable {
    public var text: String
    public var start: TimeInterval
    public var end: TimeInterval
    public var confidence: Double?

    public init(text: String, start: TimeInterval, end: TimeInterval, confidence: Double?) {
        self.text = text
        self.start = start
        self.end = end
        self.confidence = confidence
    }
}

/// Native WhisperKit segment copied out of the library types.
public struct HudWhisperKitNativeSegment: Sendable {
    public var text: String
    public var start: TimeInterval
    public var end: TimeInterval
    public var words: [HudWhisperKitNativeWord]?

    public init(text: String, start: TimeInterval, end: TimeInterval, words: [HudWhisperKitNativeWord]?) {
        self.text = text
        self.start = start
        self.end = end
        self.words = words
    }
}

/// One WhisperKit transcription window. Explicit value so results cross actors.
public struct HudWhisperKitWindow: Sendable {
    public var text: String
    public var language: String?
    public var segments: [HudWhisperKitNativeSegment]

    public init(text: String, language: String?, segments: [HudWhisperKitNativeSegment]) {
        self.text = text
        self.language = language
        self.segments = segments
    }
}

/// Complete native transcription, independent of WhisperKit reference types.
public struct HudWhisperKitTranscript: Sendable {
    public var windows: [HudWhisperKitWindow]

    public init(windows: [HudWhisperKitWindow]) {
        self.windows = windows
    }
}

/// Loaded session handle. Production wraps a WhisperKit instance; tests inject a fixture.
public struct HudWhisperKitSessionHandle: Sendable {
    public let configFingerprint: String
    private let transcribe: @Sendable (HudWhisperKitTranscribeRequest) async throws -> HudWhisperKitTranscript

    public init(
        configFingerprint: String,
        transcribe: @escaping @Sendable (HudWhisperKitTranscribeRequest) async throws -> HudWhisperKitTranscript
    ) {
        self.configFingerprint = configFingerprint
        self.transcribe = transcribe
    }

    public func transcribe(_ request: HudWhisperKitTranscribeRequest) async throws -> HudWhisperKitTranscript {
        try await transcribe(request)
    }
}

/// Loads a local WhisperKit folder. Production uses `HudWhisperKitNativeRuntime`.
public protocol HudWhisperKitRuntime: Sendable {
    func load(modelFolder: URL) async throws -> HudWhisperKitSessionHandle
}

/// Actual WhisperKit load and file transcription. `download` is always false.
public struct HudWhisperKitNativeRuntime: HudWhisperKitRuntime {
    public init() {}

    public func load(modelFolder: URL) async throws -> HudWhisperKitSessionHandle {
        let session = try await HudWhisperKitNativeSession(modelFolder: modelFolder)
        return HudWhisperKitSessionHandle(configFingerprint: session.configFingerprint) { request in
            try await session.transcribe(request)
        }
    }
}

actor HudWhisperKitNativeSession {
    private let kit: WhisperKit
    private var isTranscribing = false
    nonisolated let configFingerprint: String

    init(modelFolder: URL) async throws {
        try Task.checkCancellation()
        let tokenizer = try await HudWhisperKitLocalTokenizer.load(from: modelFolder)
        try Task.checkCancellation()
        let kit = try await WhisperKit(
            modelFolder: modelFolder.path,
            verbose: false,
            load: false,
            download: false
        )
        // Supplying the tokenizer bypasses the SDK's local-then-network loader.
        kit.tokenizer = tokenizer
        try await kit.loadModels()
        // The SDK normally sets this while loading its tokenizer. Preserve that
        // decoding behavior when injecting ours. modelVariant is private-set and
        // used only by the SDK's load log in this path; provenance uses host config.
        guard let logitsSize = kit.textDecoder.logitsSize else {
            throw HudTranscriptionError.notReady(.failed("The local Whisper decoder has no vocabulary."))
        }
        kit.textDecoder.isModelMultilingual = logitsSize != 51864
        try Task.checkCancellation()
        guard kit.modelState == .loaded else {
            throw HudTranscriptionError.notReady(
                .failed("The local Whisper model did not finish loading.")
            )
        }
        self.kit = kit
        self.configFingerprint = HudWhisperKitLocalModels.configFingerprint(at: modelFolder)
    }

    func transcribe(_ request: HudWhisperKitTranscribeRequest) async throws -> HudWhisperKitTranscript {
        guard !isTranscribing else {
            throw HudTranscriptionError.invalidRequest("The local model is already transcribing.")
        }
        isTranscribing = true
        defer { isTranscribing = false }
        try Task.checkCancellation()
        let options = DecodingOptions(
            verbose: false,
            language: request.language,
            wordTimestamps: request.wordTimestamps
        )
        let results = try await kit.transcribe(audioPath: request.audioPath, decodeOptions: options)
        try Task.checkCancellation()
        return HudWhisperKitTranscript(windows: results.map { window in
            HudWhisperKitWindow(
                text: window.text,
                language: window.language.isEmpty ? nil : window.language,
                segments: window.segments.map { segment in
                    let words = segment.words?.map {
                        HudWhisperKitNativeWord(
                            text: $0.word,
                            start: TimeInterval($0.start),
                            end: TimeInterval($0.end),
                            confidence: Double($0.probability)
                        )
                    }
                    return HudWhisperKitNativeSegment(
                        text: segment.text,
                        start: TimeInterval(segment.start),
                        end: TimeInterval(segment.end),
                        words: words?.isEmpty == false ? words : nil
                    )
                }
            )
        })
    }
}
