import Foundation

public enum HudTranscriptionTimingGranularity: String, Codable, Hashable, Sendable {
    case none
    case utterance
    case word
    case unknown
}

public enum HudTranscriptionSpeakerSupport: String, Codable, Hashable, Sendable {
    case none
    case labels
    case diarization
    case unknown
}

public struct HudTranscriptionModelLimits: Codable, Hashable, Sendable {
    public var maximumFileDuration: HudTranscriptionDurationLimit
    public var maximumSessionDuration: HudTranscriptionDurationLimit
    public var maximumSpeakers: HudTranscriptionCountLimit

    public init(
        maximumFileDuration: HudTranscriptionDurationLimit = .unknown,
        maximumSessionDuration: HudTranscriptionDurationLimit = .unknown,
        maximumSpeakers: HudTranscriptionCountLimit = .unknown
    ) {
        self.maximumFileDuration = maximumFileDuration
        self.maximumSessionDuration = maximumSessionDuration
        self.maximumSpeakers = maximumSpeakers
    }
}

public struct HudTranscriptionCapabilityEvidence: Codable, Hashable, Sendable {
    public var documentationURL: URL?
    public var verified: Bool
    public var notes: String?

    public init(documentationURL: URL? = nil, verified: Bool = false, notes: String? = nil) {
        self.documentationURL = documentationURL
        self.verified = verified
        self.notes = notes
    }
}

public struct HudTranscriptionFeatureConstraint: Codable, Hashable, Sendable {
    public var code: HudTranscriptionCompatibilityReasonCode
    public var message: String

    public init(code: HudTranscriptionCompatibilityReasonCode, message: String) {
        self.code = code
        self.message = message
    }
}

public struct HudTranscriptionModelDescriptor: Codable, Hashable, Sendable {
    public var id: HudTranscriptionModelID
    public var displayName: String
    public var supportsBatch: Bool
    public var supportsLive: Bool
    public var languages: [String]
    public var timing: HudTranscriptionTimingGranularity
    public var speakers: HudTranscriptionSpeakerSupport
    public var inputFormats: [String]
    public var limits: HudTranscriptionModelLimits
    public var constraints: [HudTranscriptionFeatureConstraint]
    public var evidence: HudTranscriptionCapabilityEvidence

    public init(
        id: HudTranscriptionModelID,
        displayName: String,
        supportsBatch: Bool,
        supportsLive: Bool,
        languages: [String] = [],
        timing: HudTranscriptionTimingGranularity = .unknown,
        speakers: HudTranscriptionSpeakerSupport = .unknown,
        inputFormats: [String] = [],
        limits: HudTranscriptionModelLimits = HudTranscriptionModelLimits(),
        constraints: [HudTranscriptionFeatureConstraint] = [],
        evidence: HudTranscriptionCapabilityEvidence = HudTranscriptionCapabilityEvidence()
    ) {
        self.id = id
        self.displayName = displayName
        self.supportsBatch = supportsBatch
        self.supportsLive = supportsLive
        self.languages = languages
        self.timing = timing
        self.speakers = speakers
        self.inputFormats = inputFormats
        self.limits = limits
        self.constraints = constraints
        self.evidence = evidence
    }
}
