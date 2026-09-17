import Foundation

/// Bounded event delivery shared by provider sessions. Audio chunks may be
/// evicted under backpressure (stale speech), but losing a control event —
/// tool calls, interruptions, terminal events — is a session failure, never a
/// silent drop.
public struct HudConversationEventGate: Sendable {
    public let stream: AsyncThrowingStream<HudConversationEvent, Error>
    private let continuation: AsyncThrowingStream<HudConversationEvent, Error>.Continuation

    public init(capacity: Int = 512) {
        (stream, continuation) = AsyncThrowingStream<HudConversationEvent, Error>
            .makeStream(bufferingPolicy: .bufferingNewest(capacity))
    }

    /// Returns false when a control event was evicted; the caller must fail
    /// the session with `HudConversationError.eventOverflow`.
    public func yield(_ event: HudConversationEvent) -> Bool {
        switch continuation.yield(event) {
        case .dropped(let lost):
            if case .assistantAudio = lost { return true }
            return false
        case .terminated:
            // A control event offered to a finished stream was not delivered.
            if case .assistantAudio = event { return true }
            return false
        default:
            return true
        }
    }

    public func finish(throwing error: Error? = nil) {
        if let error { continuation.finish(throwing: error) } else { continuation.finish() }
    }
}
