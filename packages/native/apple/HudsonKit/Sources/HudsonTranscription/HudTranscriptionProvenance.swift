import Foundation

public struct HudTranscriptionProvenance: Codable, Hashable, Sendable {
    public var providerID: HudTranscriptionProviderID
    public var modelID: HudTranscriptionModelID
    public var adapterVersion: String
    public var configurationFingerprint: String
    public var sourceDigest: String
    public var providerRequestID: String?
    public var runID: String
    public var sessionID: String?
    public var timestamp: Date
    public var annotationOrigin: HudTranscriptionAnnotationOrigin

    public init(
        providerID: HudTranscriptionProviderID,
        modelID: HudTranscriptionModelID,
        adapterVersion: String,
        configurationFingerprint: String,
        sourceDigest: String,
        providerRequestID: String? = nil,
        runID: String,
        sessionID: String? = nil,
        timestamp: Date,
        annotationOrigin: HudTranscriptionAnnotationOrigin = .native
    ) {
        self.providerID = providerID
        self.modelID = modelID
        self.adapterVersion = adapterVersion
        self.configurationFingerprint = configurationFingerprint
        self.sourceDigest = sourceDigest
        self.providerRequestID = providerRequestID
        self.runID = runID
        self.sessionID = sessionID
        self.timestamp = timestamp
        self.annotationOrigin = annotationOrigin
    }
}
