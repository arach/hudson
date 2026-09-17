import Foundation

/// Whether a model capability was confirmed against provider documentation or
/// a live check. Unknown is unverified, not unsupported.
public enum HudConversationCapabilitySupport: String, Codable, Hashable, Sendable {
    case supported, unsupported, unknown
}

public struct HudConversationModelDescriptor: Codable, Hashable, Sendable {
    public var id: HudConversationModelID
    public var displayName: String
    public var toolCalling: HudConversationCapabilitySupport
    public var configurableThinking: HudConversationCapabilitySupport
    /// Provider-documented caveats a settings surface should show verbatim
    /// (session limits, generated-audio billing, preview status).
    public var notes: String?
    /// True when the descriptor came from provider discovery rather than a
    /// saved identifier that is currently absent from the catalog.
    public var discovered: Bool

    public init(
        id: HudConversationModelID,
        displayName: String,
        toolCalling: HudConversationCapabilitySupport = .unknown,
        configurableThinking: HudConversationCapabilitySupport = .unknown,
        notes: String? = nil,
        discovered: Bool = true
    ) {
        self.id = id
        self.displayName = displayName
        self.toolCalling = toolCalling
        self.configurableThinking = configurableThinking
        self.notes = notes
        self.discovered = discovered
    }
}

public struct HudConversationProviderDescriptor: Codable, Hashable, Sendable {
    public var id: HudConversationProviderID
    public var displayName: String
    public var adapterVersion: String
    /// Documentation the adapter's wire contract was verified against.
    public var documentationURL: URL?
    /// The capture format this provider documents as its default; settings
    /// surfaces follow the provider instead of carrying a stale rate across a
    /// provider switch.
    public var preferredInputAudio: HudConversationAudioFormat

    public init(id: HudConversationProviderID, displayName: String, adapterVersion: String,
                documentationURL: URL? = nil,
                preferredInputAudio: HudConversationAudioFormat = .pcm16k) {
        self.id = id
        self.displayName = displayName
        self.adapterVersion = adapterVersion
        self.documentationURL = documentationURL
        self.preferredInputAudio = preferredInputAudio
    }
}

public enum HudConversationReadinessStatus: String, Codable, Hashable, Sendable {
    case unconfigured, needsCredential, ready, unavailable, failed
}

public struct HudConversationReadiness: Codable, Hashable, Sendable {
    public var status: HudConversationReadinessStatus
    public var reason: String?
    public init(status: HudConversationReadinessStatus, reason: String? = nil) {
        self.status = status
        self.reason = reason
    }
    public var isReady: Bool { status == .ready }
}
