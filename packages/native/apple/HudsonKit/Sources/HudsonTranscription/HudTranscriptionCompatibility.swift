import Foundation

public enum HudTranscriptionCompatibilityStatus: String, Codable, Hashable, Sendable {
    case supported
    case unsupported
    case unverified
}

public struct HudTranscriptionCompatibility: Codable, Hashable, Sendable {
    public var status: HudTranscriptionCompatibilityStatus
    public var reasons: [HudTranscriptionCompatibilityReason]

    public init(status: HudTranscriptionCompatibilityStatus, reasons: [HudTranscriptionCompatibilityReason] = []) {
        self.status = status
        self.reasons = reasons
    }

    public static let supported = HudTranscriptionCompatibility(status: .supported)

    public static func unsupported(_ reasons: [HudTranscriptionCompatibilityReason]) -> HudTranscriptionCompatibility {
        HudTranscriptionCompatibility(status: .unsupported, reasons: reasons)
    }

    public static func unverified(_ reasons: [HudTranscriptionCompatibilityReason]) -> HudTranscriptionCompatibility {
        HudTranscriptionCompatibility(status: .unverified, reasons: reasons)
    }
}
