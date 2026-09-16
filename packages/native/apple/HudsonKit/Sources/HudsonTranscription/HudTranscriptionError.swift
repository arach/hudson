import Foundation

public enum HudTranscriptionLateWriteReason: String, Codable, Hashable, Sendable {
    case sessionTerminal
    case inputFinished
    case utteranceFinalized
}

public enum HudTranscriptionError: Error, LocalizedError, Sendable, Equatable {
    case unsupportedMode(HudTranscriptionMode)
    case duplicateProviderID(HudTranscriptionProviderID)
    case unknownProvider(HudTranscriptionProviderID)
    case lateWrite(HudTranscriptionLateWriteReason)
    case chunkTooLarge(byteCount: Int, maximum: Int)
    case nonMonotonicChunkSequence(expected: UInt64, received: UInt64)
    case nonMonotonicUtteranceRevision(expectedMinimum: UInt64, received: UInt64)
    case sessionAlreadyTerminal
    case cancelled
    case remoteOutcomeUnknown(providerRequestID: String?)
    case incompleteAudio
    case invalidRequest(String)
    case notReady(HudTranscriptionReadiness)

    public var errorDescription: String? {
        switch self {
        case .unsupportedMode(let mode):
            return "Transcription \(mode.rawValue) is not supported by this adapter"
        case .duplicateProviderID(let id):
            return "Transcription provider already registered: \(id.rawValue)"
        case .unknownProvider(let id):
            return "Unknown transcription provider: \(id.rawValue)"
        case .lateWrite(let reason):
            return "Late transcription write: \(reason.rawValue)"
        case .chunkTooLarge(let byteCount, let maximum):
            return "PCM chunk of \(byteCount) bytes exceeds maximum \(maximum)"
        case .nonMonotonicChunkSequence(let expected, let received):
            return "PCM chunk sequence \(received) is not the next expected \(expected)"
        case .nonMonotonicUtteranceRevision(let expectedMinimum, let received):
            return "Utterance revision \(received) is below minimum \(expectedMinimum)"
        case .sessionAlreadyTerminal:
            return "Live transcription session already has a terminal event"
        case .cancelled:
            return "Transcription was cancelled"
        case .remoteOutcomeUnknown(let providerRequestID):
            if let providerRequestID {
                return "Remote transcription outcome unknown for \(providerRequestID)"
            }
            return "Remote transcription outcome unknown"
        case .incompleteAudio:
            return "Transcription audio was incomplete"
        case .invalidRequest(let message):
            return message
        case .notReady(let readiness):
            return readiness.reason ?? "Transcription adapter is not ready (\(readiness.status.rawValue))"
        }
    }
}
