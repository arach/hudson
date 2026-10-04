import Foundation

public struct HudTranscriptionSegment: Codable, Hashable, Sendable {
    public var text: String
    public var start: TimeInterval?
    public var end: TimeInterval?
    public var speakerID: String?
    public var confidence: Double?
    public var annotationOrigin: HudTranscriptionAnnotationOrigin

    public init(
        text: String,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        speakerID: String? = nil,
        confidence: Double? = nil,
        annotationOrigin: HudTranscriptionAnnotationOrigin = .native
    ) {
        self.text = text
        self.start = start
        self.end = end
        self.speakerID = speakerID
        self.confidence = confidence
        self.annotationOrigin = annotationOrigin
    }
}
