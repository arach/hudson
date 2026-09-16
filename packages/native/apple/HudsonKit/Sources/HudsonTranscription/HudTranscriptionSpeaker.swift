import Foundation

public struct HudTranscriptionSpeaker: Codable, Hashable, Sendable {
    public var id: String
    public var label: String?
    public var annotationOrigin: HudTranscriptionAnnotationOrigin

    public init(
        id: String,
        label: String? = nil,
        annotationOrigin: HudTranscriptionAnnotationOrigin = .native
    ) {
        self.id = id
        self.label = label
        self.annotationOrigin = annotationOrigin
    }
}
