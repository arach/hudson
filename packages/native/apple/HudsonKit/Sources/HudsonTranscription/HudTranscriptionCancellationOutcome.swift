import Foundation

public enum HudTranscriptionCancellationOutcome: String, Codable, Hashable, Sendable {
    case requested
    case cancelled
    case remoteOutcomeUnknown
}
