import Foundation

public struct HudTranscriptionResult: Codable, Hashable, Sendable {
    public var transcript: String
    public var segments: [HudTranscriptionSegment]?
    public var words: [HudTranscriptionWord]?
    public var speakers: [HudTranscriptionSpeaker]?
    public var language: String?
    public var completion: HudTranscriptionCompletionStatus
    public var provenance: HudTranscriptionProvenance
    public var usage: HudTranscriptionUsage?

    public init(
        transcript: String,
        segments: [HudTranscriptionSegment]? = nil,
        words: [HudTranscriptionWord]? = nil,
        speakers: [HudTranscriptionSpeaker]? = nil,
        language: String? = nil,
        completion: HudTranscriptionCompletionStatus,
        provenance: HudTranscriptionProvenance,
        usage: HudTranscriptionUsage? = nil
    ) {
        self.transcript = transcript
        self.segments = segments
        self.words = words
        self.speakers = speakers
        self.language = language
        self.completion = completion
        self.provenance = provenance
        self.usage = usage
    }
}
