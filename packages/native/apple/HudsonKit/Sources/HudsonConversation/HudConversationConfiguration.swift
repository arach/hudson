import Foundation
import CryptoKit

/// Mono PCM16 little-endian at a fixed sample rate. Providers advertise the
/// rates they accept; hosts must not assume input and output rates match.
public struct HudConversationAudioFormat: Codable, Hashable, Sendable {
    public var sampleRate: Int
    public init(sampleRate: Int) { self.sampleRate = sampleRate }

    public static let pcm16k = HudConversationAudioFormat(sampleRate: 16000)
    public static let pcm24k = HudConversationAudioFormat(sampleRate: 24000)
}

/// Reasoning level for models that support configurable background thinking.
/// Setting this on a model that does not support it is a configuration error,
/// not something an adapter may silently drop.
public enum HudConversationThinkingLevel: String, Codable, Hashable, Sendable {
    case low, medium, high
}

/// Secret-free provider/model selection for one conversational session.
public struct HudConversationConfiguration: Codable, Hashable, Sendable {
    public var providerID: HudConversationProviderID
    public var modelID: HudConversationModelID
    public var instructions: String?
    public var voice: String?
    public var inputAudio: HudConversationAudioFormat
    public var thinkingLevel: HudConversationThinkingLevel?
    public var credentialReference: HudConversationCredentialReference?
    public var credentialKind: HudConversationCredentialKind
    public var options: [String: String]

    public init(
        providerID: HudConversationProviderID,
        modelID: HudConversationModelID,
        instructions: String? = nil,
        voice: String? = nil,
        inputAudio: HudConversationAudioFormat = .pcm16k,
        thinkingLevel: HudConversationThinkingLevel? = nil,
        credentialReference: HudConversationCredentialReference? = nil,
        credentialKind: HudConversationCredentialKind = .apiKey,
        options: [String: String] = [:]
    ) {
        self.providerID = providerID
        self.modelID = modelID
        self.instructions = instructions
        self.voice = voice
        self.inputAudio = inputAudio
        self.thinkingLevel = thinkingLevel
        self.credentialReference = credentialReference
        self.credentialKind = credentialKind
        self.options = options
    }

    /// Versioned digest of the canonical configuration. Only the opaque
    /// credential reference participates; secret values never do.
    public var secretFreeFingerprint: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard let bytes = try? encoder.encode(self) else { return "sha256:invalid" }
        return "sha256:" + SHA256.hash(data: bytes).map {
            let hex = String($0, radix: 16)
            return hex.count == 1 ? "0" + hex : hex
        }.joined()
    }
}
