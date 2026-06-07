import Foundation
import HudsonUIPermissions

#if canImport(Speech)
@preconcurrency import Speech
#endif

public struct HudAudioTranscriptionUpdate: Equatable, Sendable {
    public var transcript: String
    public var isFinal: Bool

    public init(transcript: String, isFinal: Bool) {
        self.transcript = transcript
        self.isFinal = isFinal
    }
}

public struct HudAudioTranscriptionResult: Equatable, Sendable {
    public var transcript: String
    public var transcribedAt: Date

    public init(transcript: String, transcribedAt: Date = Date()) {
        self.transcript = transcript
        self.transcribedAt = transcribedAt
    }
}

public enum HudAudioTranscriptionError: Error, Equatable, LocalizedError, Sendable {
    case unsupportedPlatform
    case alreadyRunning
    case audioFileMissing
    case recognizerUnavailable
    case permissionDenied
    case permissionRestricted
    case permissionNotDetermined
    case permissionUnavailable
    case cancelled
    case emptyTranscript
    case recognitionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .unsupportedPlatform:
            return "Speech recognition is not available on this platform."
        case .alreadyRunning:
            return "A transcription is already running."
        case .audioFileMissing:
            return "The saved audio file could not be found."
        case .recognizerUnavailable:
            return "Speech recognition is not available on this device."
        case .permissionDenied:
            return "Speech recognition permission was denied."
        case .permissionRestricted:
            return "Speech recognition is restricted on this device."
        case .permissionNotDetermined:
            return "Speech recognition permission was not granted."
        case .permissionUnavailable:
            return "Speech recognition authorization is unavailable."
        case .cancelled:
            return "Transcription cancelled."
        case .emptyTranscript:
            return "No speech was detected in this audio."
        case .recognitionFailed(let message):
            return message
        }
    }

    static func permission(_ status: HudPermissionStatus) -> HudAudioTranscriptionError {
        switch status {
        case .denied:
            return .permissionDenied
        case .restricted:
            return .permissionRestricted
        case .notDetermined:
            return .permissionNotDetermined
        case .unavailable:
            return .permissionUnavailable
        case .granted, .limited:
            return .permissionUnavailable
        }
    }
}

@MainActor
public final class HudAudioFileTranscriber {
    public typealias UpdateHandler = @MainActor (HudAudioTranscriptionUpdate) -> Void

    private let locale: Locale
    #if canImport(Speech)
    private var recognitionTask: SFSpeechRecognitionTask?
    #endif
    private var continuation: CheckedContinuation<HudAudioTranscriptionResult, Error>?
    private var updateHandler: UpdateHandler?

    public init(locale: Locale = .autoupdatingCurrent) {
        self.locale = locale
    }

    deinit {
        #if canImport(Speech)
        recognitionTask?.cancel()
        #endif
    }

    public func cancel() {
        #if canImport(Speech)
        recognitionTask?.cancel()
        #endif
        resume(throwing: HudAudioTranscriptionError.cancelled, cancelTask: false)
    }

    public func transcribeFile(
        at url: URL,
        reportsPartialResults: Bool = true,
        onUpdate: UpdateHandler? = nil
    ) async throws -> HudAudioTranscriptionResult {
        #if canImport(Speech)
        guard recognitionTask == nil, continuation == nil else {
            throw HudAudioTranscriptionError.alreadyRunning
        }
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw HudAudioTranscriptionError.audioFileMissing
        }

        let permissionStatus = await HudPermissions.request(.speech)
        guard permissionStatus.isAuthorized else {
            throw HudAudioTranscriptionError.permission(permissionStatus)
        }
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            throw HudAudioTranscriptionError.recognizerUnavailable
        }

        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = reportsPartialResults
        if #available(iOS 16.0, macOS 13.0, *) {
            request.addsPunctuation = true
        }

        updateHandler = onUpdate

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                Task { @MainActor in
                    self?.handleRecognitionUpdate(result: result, error: error)
                }
            }
        }
        #else
        throw HudAudioTranscriptionError.unsupportedPlatform
        #endif
    }

    #if canImport(Speech)
    private func handleRecognitionUpdate(result: SFSpeechRecognitionResult?, error: Error?) {
        guard continuation != nil else { return }

        if let result {
            let transcript = result.bestTranscription.formattedString
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !transcript.isEmpty {
                updateHandler?(
                    HudAudioTranscriptionUpdate(
                        transcript: transcript,
                        isFinal: result.isFinal
                    )
                )
            }
            if result.isFinal {
                finish(transcript: transcript)
                return
            }
        }

        if let error {
            resume(throwing: HudAudioTranscriptionError.recognitionFailed(error.localizedDescription))
        }
    }

    private func finish(transcript: String) {
        let resolvedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !resolvedTranscript.isEmpty else {
            resume(throwing: HudAudioTranscriptionError.emptyTranscript)
            return
        }

        resume(
            returning: HudAudioTranscriptionResult(transcript: resolvedTranscript),
            cancelTask: false
        )
    }
    #endif

    private func resume(
        returning result: HudAudioTranscriptionResult,
        cancelTask: Bool = true
    ) {
        let continuation = continuation
        reset(cancelTask: cancelTask)
        continuation?.resume(returning: result)
    }

    private func resume(
        throwing error: Error,
        cancelTask: Bool = true
    ) {
        let continuation = continuation
        reset(cancelTask: cancelTask)
        continuation?.resume(throwing: error)
    }

    private func reset(cancelTask: Bool) {
        #if canImport(Speech)
        if cancelTask {
            recognitionTask?.cancel()
        }
        recognitionTask = nil
        #endif
        continuation = nil
        updateHandler = nil
    }
}
