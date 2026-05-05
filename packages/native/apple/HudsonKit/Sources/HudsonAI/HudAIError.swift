import Foundation

public enum HudAIError: Error, LocalizedError, Sendable {
    case credentialsMissing(provider: HudAIProviderID, key: String)
    case credentialsInvalid(provider: HudAIProviderID, key: String)
    case networkUnavailable(provider: HudAIProviderID, message: String)
    case providerRejectedRequest(provider: HudAIProviderID, status: Int?, requestID: String?, message: String)
    case rateLimited(provider: HudAIProviderID, status: Int?, requestID: String?, message: String)
    case overloaded(provider: HudAIProviderID, status: Int?, requestID: String?, message: String)
    case timeout(provider: HudAIProviderID, message: String)
    case cancelled(provider: HudAIProviderID)
    case pairingChannelUnavailable(message: String)
    case toolInputDecodeFailed(provider: HudAIProviderID, toolCallID: String, toolName: String, message: String)
    case unsupportedFeature(provider: HudAIProviderID, feature: String)
    case unknownProvider(String)
    case providerProtocolError(provider: HudAIProviderID, requestID: String?, message: String)

    public var errorDescription: String? {
        switch self {
        case .credentialsMissing(let provider, let key):
            return "Missing \(provider.rawValue) credential: \(key)"
        case .credentialsInvalid(let provider, let key):
            return "Invalid \(provider.rawValue) credential: \(key)"
        case .networkUnavailable(_, let message), .timeout(_, let message), .pairingChannelUnavailable(let message):
            return message
        case .providerRejectedRequest(_, _, _, let message), .rateLimited(_, _, _, let message), .overloaded(_, _, _, let message):
            return message
        case .cancelled(let provider):
            return "\(provider.rawValue) request was cancelled"
        case .toolInputDecodeFailed(_, let toolCallID, let toolName, let message):
            return "Tool input decode failed for \(toolName) (\(toolCallID)): \(message)"
        case .unsupportedFeature(let provider, let feature):
            return "\(provider.rawValue) does not support \(feature)"
        case .unknownProvider(let provider):
            return "Unknown AI provider: \(provider)"
        case .providerProtocolError(_, _, let message):
            return message
        }
    }

    public var isRetryable: Bool {
        switch self {
        case .networkUnavailable, .rateLimited, .overloaded, .timeout:
            return true
        default:
            return false
        }
    }

    public var httpStatus: Int? {
        switch self {
        case .providerRejectedRequest(_, let status, _, _), .rateLimited(_, let status, _, _), .overloaded(_, let status, _, _):
            return status
        default:
            return nil
        }
    }

    public var providerRequestID: String? {
        switch self {
        case .providerRejectedRequest(_, _, let requestID, _), .rateLimited(_, _, let requestID, _), .overloaded(_, _, let requestID, _), .providerProtocolError(_, let requestID, _):
            return requestID
        default:
            return nil
        }
    }
}
