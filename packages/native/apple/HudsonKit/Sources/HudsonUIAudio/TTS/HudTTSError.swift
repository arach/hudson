import Foundation

public enum HudTTSError: Error, LocalizedError, Sendable {
    case credentialsMissing(provider: HudTTSProviderID, key: String)
    case credentialsInvalid(provider: HudTTSProviderID, key: String)
    case networkUnavailable(provider: HudTTSProviderID, message: String)
    case providerRejectedRequest(provider: HudTTSProviderID, status: Int?, message: String)
    case synthesisFailed(provider: HudTTSProviderID, message: String)
    case playbackFailed(message: String)
    case unknownProvider(String)
    case emptyInput

    public var errorDescription: String? {
        switch self {
        case .credentialsMissing(let provider, let key):
            return "Missing \(provider.rawValue) credential: \(key)"
        case .credentialsInvalid(let provider, let key):
            return "Invalid \(provider.rawValue) credential: \(key)"
        case .networkUnavailable(_, let message),
             .synthesisFailed(_, let message),
             .playbackFailed(let message):
            return message
        case .providerRejectedRequest(_, _, let message):
            return message
        case .unknownProvider(let provider):
            return "Unknown TTS provider: \(provider)"
        case .emptyInput:
            return "No text was provided for speech synthesis."
        }
    }
}
