import Foundation

public struct HudTranscriptionCompatibilityReasonCode: RawRepresentable, Codable, Hashable, Sendable, ExpressibleByStringLiteral {
    public var rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public init(stringLiteral value: String) {
        self.rawValue = value
    }

    public static let durationExceeded = HudTranscriptionCompatibilityReasonCode(rawValue: "duration-exceeded")
    public static let featureCombination = HudTranscriptionCompatibilityReasonCode(rawValue: "feature-combination")
    public static let languageUnsupported = HudTranscriptionCompatibilityReasonCode(rawValue: "language-unsupported")
    public static let formatUnsupported = HudTranscriptionCompatibilityReasonCode(rawValue: "format-unsupported")
    public static let modeUnsupported = HudTranscriptionCompatibilityReasonCode(rawValue: "mode-unsupported")
    public static let limitUnverified = HudTranscriptionCompatibilityReasonCode(rawValue: "limit-unverified")
    public static let unknownProvider = HudTranscriptionCompatibilityReasonCode(rawValue: "unknown-provider")
    public static let unknownModel = HudTranscriptionCompatibilityReasonCode(rawValue: "unknown-model")
}

public struct HudTranscriptionCompatibilityReason: Codable, Hashable, Sendable {
    public var code: HudTranscriptionCompatibilityReasonCode
    public var message: String
    public var userExplanation: String

    public init(
        code: HudTranscriptionCompatibilityReasonCode,
        message: String,
        userExplanation: String
    ) {
        self.code = code
        self.message = message
        self.userExplanation = userExplanation
    }
}
