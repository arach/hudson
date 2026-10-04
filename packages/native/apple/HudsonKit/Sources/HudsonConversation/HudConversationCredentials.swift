import Foundation

/// Opaque pointer into host-owned secure storage. The secret value itself never
/// appears in configuration, persistence, logs, or fingerprints.
public struct HudConversationCredentialReference: Codable, Hashable, Sendable {
    public var identifier: String
    public init(identifier: String) { self.identifier = identifier }
}

/// What the referenced secret is. Auth readiness derived from a resolvable
/// credential is not proof of verified account access.
public enum HudConversationCredentialKind: String, Codable, Hashable, Sendable {
    /// Long-lived provider API key. Server/native processes only.
    case apiKey
    /// Short-lived token minted by a host backend (for example a Gemini Live
    /// ephemeral token). The only kind suitable for browser-adjacent hosts.
    case ephemeralToken
}

public protocol HudConversationCredentialResolver: Sendable {
    func credential(for reference: HudConversationCredentialReference) async throws -> Data
}
