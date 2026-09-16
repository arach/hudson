import Foundation

/// A documented numeric bound. Unknown is unverified, not unlimited.
public enum HudTranscriptionDurationLimit: Codable, Hashable, Sendable {
    case unknown
    case seconds(TimeInterval)

    public func comparison(with duration: TimeInterval) -> HudTranscriptionLimitComparison {
        switch self {
        case .unknown:
            return .unverified
        case .seconds(let limit):
            return duration > limit ? .exceeded : .within
        }
    }
}

public enum HudTranscriptionCountLimit: Codable, Hashable, Sendable {
    case unknown
    case value(Int)

    public func comparison(with count: Int) -> HudTranscriptionLimitComparison {
        switch self {
        case .unknown:
            return .unverified
        case .value(let limit):
            return count > limit ? .exceeded : .within
        }
    }
}

public enum HudTranscriptionLimitComparison: String, Sendable, Equatable {
    case within
    case exceeded
    case unverified
}
