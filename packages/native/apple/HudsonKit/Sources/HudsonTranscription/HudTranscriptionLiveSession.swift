import Foundation

public protocol HudTranscriptionLiveSession: Sendable {
    var sessionID: HudTranscriptionSessionID { get }
    var events: AsyncStream<HudTranscriptionLiveEvent> { get }

    /// Awaited so the adapter can apply backpressure. Must not silently drop chunks.
    func send(_ chunk: HudTranscriptionPCMChunk) async throws
    func finish() async throws
    func cancel() async
}
