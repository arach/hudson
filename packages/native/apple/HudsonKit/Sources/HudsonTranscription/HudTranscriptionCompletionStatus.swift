import Foundation

public enum HudTranscriptionCompletionStatus: String, Codable, Hashable, Sendable {
    case completed
    case cancelled
    case incompleteAudio
    case failed
    case remoteOutcomeUnknown
}
