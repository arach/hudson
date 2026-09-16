import Foundation

public enum HudTranscriptionReadinessStatus: String, Codable, Hashable, Sendable {
    case unconfigured
    case needsCredential
    case needsDownload
    case preparing
    case ready
    case unavailable
    case failed
}

public struct HudTranscriptionReadiness: Codable, Hashable, Sendable {
    public var status: HudTranscriptionReadinessStatus
    public var reason: String?
    public var lastProbe: Date?

    public init(
        status: HudTranscriptionReadinessStatus,
        reason: String? = nil,
        lastProbe: Date? = nil
    ) {
        self.status = status
        self.reason = reason
        self.lastProbe = lastProbe
    }

    public var isReady: Bool {
        status == .ready
    }

    public static let ready = HudTranscriptionReadiness(status: .ready)

    public static func unavailable(_ reason: String, lastProbe: Date? = nil) -> HudTranscriptionReadiness {
        HudTranscriptionReadiness(status: .unavailable, reason: reason, lastProbe: lastProbe)
    }

    public static func failed(_ reason: String, lastProbe: Date? = nil) -> HudTranscriptionReadiness {
        HudTranscriptionReadiness(status: .failed, reason: reason, lastProbe: lastProbe)
    }
}
