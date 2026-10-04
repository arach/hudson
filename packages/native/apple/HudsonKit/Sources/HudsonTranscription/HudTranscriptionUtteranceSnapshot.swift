import Foundation

public struct HudTranscriptionUtteranceSnapshot: Sendable, Equatable {
    public var utteranceID: HudTranscriptionUtteranceID
    public var revision: UInt64
    public var text: String
    public var isFinal: Bool
    public var start: TimeInterval?
    public var end: TimeInterval?
    public var confidence: Double?

    public init(
        utteranceID: HudTranscriptionUtteranceID,
        revision: UInt64,
        text: String,
        isFinal: Bool,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        confidence: Double? = nil
    ) {
        self.utteranceID = utteranceID
        self.revision = revision
        self.text = text
        self.isFinal = isFinal
        self.start = start
        self.end = end
        self.confidence = confidence
    }
}
