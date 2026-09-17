import Foundation

/// One open two-way spoken session.
///
/// Interruption comes in three distinct effects that are never conflated:
/// 1. Local playback stop — `interruptPlayback()` bumps the playback
///    generation so hosts drop queued speech. It sends nothing to the provider.
/// 2. Provider speech interruption — reported by the provider as
///    `.interrupted`, or steered with `appendInstruction(_:)` where supported.
/// 3. Delegated backend work — never cancelled implicitly by either of the
///    above. The host cancels its own tool effects through its own state, and
///    the provider withdraws calls via `.toolCallsCancelled`.
public protocol HudConversationSession: Actor {
    /// Bounded event stream. Finishes after `.closed` or throws on failure.
    nonisolated var events: AsyncThrowingStream<HudConversationEvent, Error> { get }

    /// Append one chunk of user PCM16 audio in the configured input format.
    func send(audio: Data) async throws

    /// Signal the end of user audio where the provider distinguishes it.
    func finishAudio() async throws

    /// Append steering instructions mid-session where the provider supports
    /// it. Steering can interrupt current speech; it does not cancel backend work.
    func appendInstruction(_ text: String) async throws

    /// Local barge-in: invalidate all queued assistant audio. Returns the new
    /// playback generation. Does not contact the provider and does not cancel
    /// tools or delegated work.
    func interruptPlayback() async -> UInt64

    /// Return a host tool result to the provider, echoing the provider call ID.
    func send(toolResult: HudConversationToolResult) async throws

    /// Graceful close. The event stream finishes after the provider confirms
    /// (or after a bounded timeout when it cannot).
    func close() async
}

public protocol HudConversationAdapter: Sendable {
    var descriptor: HudConversationProviderDescriptor { get }

    /// Provider-discovered models for this configuration. Requires a resolvable
    /// credential for providers whose catalogs are authenticated; throws
    /// `HudConversationError.discoveryFailed` instead of guessing identifiers.
    func models(configuration: HudConversationConfiguration) async throws -> [HudConversationModelDescriptor]

    /// Passive check: configuration shape and credential presence. Ready does
    /// not prove verified account access to the model.
    func readiness(configuration: HudConversationConfiguration) async throws -> HudConversationReadiness

    /// Open a session with the host's tool declarations.
    func open(configuration: HudConversationConfiguration,
              tools: [HudConversationToolDeclaration]) async throws -> any HudConversationSession
}
