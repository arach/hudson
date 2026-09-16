import Foundation

public struct HudTranscriptionWord: Codable, Hashable, Sendable {
    public var text: String
    public var start: TimeInterval?
    public var end: TimeInterval?
    public var confidence: Double?
    public var speakerID: String?
    public var annotationOrigin: HudTranscriptionAnnotationOrigin

    public init(
        text: String,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        confidence: Double? = nil,
        speakerID: String? = nil,
        annotationOrigin: HudTranscriptionAnnotationOrigin = .native
    ) {
        self.text = text
        self.start = start
        self.end = end
        self.confidence = confidence
        self.speakerID = speakerID
        self.annotationOrigin = annotationOrigin
    }
}
