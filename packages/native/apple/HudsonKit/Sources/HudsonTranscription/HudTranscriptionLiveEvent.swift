import Foundation

public struct HudTranscriptionUtteranceRevision: Sendable, Equatable {
    public var sequence: UInt64
    public var sessionID: HudTranscriptionSessionID
    public var utteranceID: HudTranscriptionUtteranceID
    public var revision: UInt64
    public var text: String
    public var start: TimeInterval?
    public var end: TimeInterval?
    public var confidence: Double?

    public init(
        sequence: UInt64,
        sessionID: HudTranscriptionSessionID,
        utteranceID: HudTranscriptionUtteranceID,
        revision: UInt64,
        text: String,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        confidence: Double? = nil
    ) {
        self.sequence = sequence
        self.sessionID = sessionID
        self.utteranceID = utteranceID
        self.revision = revision
        self.text = text
        self.start = start
        self.end = end
        self.confidence = confidence
    }
}

public struct HudTranscriptionFinalizedUtterance: Sendable, Equatable {
    public var sequence: UInt64
    public var sessionID: HudTranscriptionSessionID
    public var utteranceID: HudTranscriptionUtteranceID
    public var text: String
    public var start: TimeInterval?
    public var end: TimeInterval?
    public var confidence: Double?

    public init(
        sequence: UInt64,
        sessionID: HudTranscriptionSessionID,
        utteranceID: HudTranscriptionUtteranceID,
        text: String,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        confidence: Double? = nil
    ) {
        self.sequence = sequence
        self.sessionID = sessionID
        self.utteranceID = utteranceID
        self.text = text
        self.start = start
        self.end = end
        self.confidence = confidence
    }
}

public enum HudTranscriptionLiveTerminal: Sendable, Equatable {
    case completed(HudTranscriptionResult)
    case cancelled
    case remoteOutcomeUnknown(providerRequestID: String?)
    case failed(HudTranscriptionError)
}

public struct HudTranscriptionLiveTerminalEvent: Sendable, Equatable {
    public var sequence: UInt64
    public var sessionID: HudTranscriptionSessionID
    public var outcome: HudTranscriptionLiveTerminal

    public init(
        sequence: UInt64,
        sessionID: HudTranscriptionSessionID,
        outcome: HudTranscriptionLiveTerminal
    ) {
        self.sequence = sequence
        self.sessionID = sessionID
        self.outcome = outcome
    }
}

public enum HudTranscriptionLiveEvent: Sendable, Equatable {
    case provisional(HudTranscriptionUtteranceRevision)
    case finalizedUtterance(HudTranscriptionFinalizedUtterance)
    case terminal(HudTranscriptionLiveTerminalEvent)

    public var sequence: UInt64 {
        switch self {
        case .provisional(let revision):
            return revision.sequence
        case .finalizedUtterance(let utterance):
            return utterance.sequence
        case .terminal(let event):
            return event.sequence
        }
    }

    public var sessionID: HudTranscriptionSessionID {
        switch self {
        case .provisional(let revision):
            return revision.sessionID
        case .finalizedUtterance(let utterance):
            return utterance.sessionID
        case .terminal(let event):
            return event.sessionID
        }
    }
}
