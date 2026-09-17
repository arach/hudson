import Foundation

/// One chunk of assistant speech. `generation` identifies the playback stream
/// it belongs to: after an interruption the session bumps the generation, and
/// hosts must drop queued or arriving chunks from older generations instead of
/// playing stale speech.
public struct HudConversationAudioChunk: Sendable, Equatable {
    public var data: Data
    public var format: HudConversationAudioFormat
    public var generation: UInt64
    public var sequence: UInt64

    public init(data: Data, format: HudConversationAudioFormat, generation: UInt64, sequence: UInt64) {
        self.data = data
        self.format = format
        self.generation = generation
        self.sequence = sequence
    }
}

/// Whether the model is ready for input or still reasoning/executing tools in
/// the background. Independent of utterance boundaries: a completed utterance
/// must not clear in-progress background work.
public enum HudConversationInteractionStatus: String, Codable, Hashable, Sendable {
    case idle, inProgress
}

/// Delegated backend work announced by the provider. For client delegation the
/// payload is an opaque ID only — the host reconstructs the request from the
/// transcript and its own state, never from provider-supplied arguments.
public struct HudConversationDelegation: Codable, Hashable, Sendable {
    public enum Target: String, Codable, Hashable, Sendable { case responses, client }
    public var id: String
    public var target: Target
    public init(id: String, target: Target) {
        self.id = id
        self.target = target
    }
}

public struct HudConversationUsage: Codable, Hashable, Sendable {
    /// Cumulative provider-reported usage as of session close; do not sum with
    /// earlier per-update values.
    public var detail: [String: Double]
    public init(detail: [String: Double] = [:]) { self.detail = detail }
}

public enum HudConversationEvent: Sendable, Equatable {
    /// Setup acknowledged; audio and commands may flow. Carries the provider
    /// session ID when one was assigned.
    case ready(sessionID: String?)
    case userTranscriptDelta(String)
    case assistantTranscriptDelta(String)
    case assistantAudio(HudConversationAudioChunk)
    /// The provider interrupted its own speech (for example user barge-in).
    /// The associated value is the new playback generation; older audio is stale.
    case interrupted(generation: UInt64)
    /// End of the current assistant utterance. Not end of background work.
    case turnComplete
    case interactionStatus(HudConversationInteractionStatus)
    case toolCall(HudConversationToolCall)
    /// The provider withdrew these calls; suppress their pending results.
    case toolCallsCancelled([String])
    case delegationStarted(HudConversationDelegation)
    /// Terminal. Emitted exactly once on graceful close.
    case closed(HudConversationUsage?)
}
