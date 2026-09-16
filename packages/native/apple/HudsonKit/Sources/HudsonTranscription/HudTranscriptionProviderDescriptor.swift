import Foundation

public enum HudTranscriptionModelDiscovery: String, Codable, Hashable, Sendable {
    case upstreamCatalog
    case adapterMetadata
}

public enum HudTranscriptionConfigurationFieldKind: String, Codable, Hashable, Sendable {
    case endpoint
    case region
    case model
    case credentialReference
    case localModelLocation
    case text
}

public struct HudTranscriptionConfigurationField: Codable, Hashable, Sendable {
    public var key: String
    public var displayName: String
    public var kind: HudTranscriptionConfigurationFieldKind
    public var required: Bool

    public init(
        key: String,
        displayName: String,
        kind: HudTranscriptionConfigurationFieldKind,
        required: Bool
    ) {
        self.key = key
        self.displayName = displayName
        self.kind = kind
        self.required = required
    }
}

public struct HudTranscriptionProviderDescriptor: Codable, Hashable, Sendable {
    public var id: HudTranscriptionProviderID
    public var displayName: String
    public var adapterVersion: String
    public var maintainer: HudTranscriptionMaintainer
    public var origin: HudTranscriptionOrigin
    public var platforms: [HudTranscriptionPlatform]
    public var configurationSchema: [HudTranscriptionConfigurationField]
    public var modelDiscovery: HudTranscriptionModelDiscovery

    public init(
        id: HudTranscriptionProviderID,
        displayName: String,
        adapterVersion: String,
        maintainer: HudTranscriptionMaintainer,
        origin: HudTranscriptionOrigin,
        platforms: [HudTranscriptionPlatform],
        configurationSchema: [HudTranscriptionConfigurationField] = [],
        modelDiscovery: HudTranscriptionModelDiscovery
    ) {
        self.id = id
        self.displayName = displayName
        self.adapterVersion = adapterVersion
        self.maintainer = maintainer
        self.origin = origin
        self.platforms = platforms
        self.configurationSchema = configurationSchema
        self.modelDiscovery = modelDiscovery
    }
}
