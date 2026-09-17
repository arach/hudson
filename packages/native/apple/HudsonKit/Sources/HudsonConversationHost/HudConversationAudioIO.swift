import Foundation
import HudsonConversation

/// Capture abstraction so host wiring is lifecycle-testable with injected
/// devices instead of real microphones.
public protocol HudConversationAudioInput: Sendable {
    func start(format: HudConversationAudioFormat) async throws -> AsyncStream<Data>
    func stop() async
}

/// Playback abstraction with generation-aware flushing.
public protocol HudConversationAudioOutput: Sendable {
    func start() async throws
    func play(_ chunk: HudConversationAudioChunk) async throws
    func flush(to generation: UInt64) async
    func stop() async
}
