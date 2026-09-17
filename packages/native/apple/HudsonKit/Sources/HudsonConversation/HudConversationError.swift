import Foundation

public enum HudConversationError: Error, Equatable, Sendable {
    case invalidConfiguration(String)
    /// Understood but not supported — for example a settings document from a
    /// newer format version. Distinct from malformed input so a settings
    /// surface can say "made by a newer version" rather than "broken file".
    case unsupported(String)
    case notReady(HudConversationReadiness)
    case connectionFailed
    case setupRejected(String)
    /// Provider-reported failure. The text is fixed adapter copy; raw provider
    /// payloads are not passed through to hosts or logs.
    case providerError(String)
    /// Input or commands before setup was acknowledged.
    case notStarted
    /// The session already ended; late writes are rejected, not queued.
    case sessionClosed
    /// Audio chunks must be complete little-endian PCM16 samples.
    case invalidAudioChunk
    /// A result was supplied for a call the provider never announced (or
    /// announced for a different delegation).
    case unknownToolCall(String)
    /// The host stopped consuming events and a control event would have been
    /// lost. The session fails instead of dropping tool or terminal events.
    case eventOverflow
    /// Graceful close was requested but the provider never confirmed within
    /// the bounded wait. Usage for the session is unknown.
    case closeUnconfirmed
    case discoveryFailed(String)
}
