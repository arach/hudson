import Foundation

public struct HudTranscriptionRequest: Codable, Hashable, Sendable {
    public var operationID: HudTranscriptionOperationID
    public var source: HudTranscriptionSourceIdentity
    public var audio: HudTranscriptionAudioInput
    public var features: HudTranscriptionRequestedFeatures
    public var duration: TimeInterval?
    public var deadline: Date?

    public init(
        operationID: HudTranscriptionOperationID,
        source: HudTranscriptionSourceIdentity,
        audio: HudTranscriptionAudioInput,
        features: HudTranscriptionRequestedFeatures = HudTranscriptionRequestedFeatures(),
        duration: TimeInterval? = nil,
        deadline: Date? = nil
    ) {
        self.operationID = operationID
        self.source = source
        self.audio = audio
        self.features = features
        self.duration = duration
        self.deadline = deadline
    }
}
