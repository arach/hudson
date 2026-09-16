import Foundation

/// In-flight batch job. Core never retries after accept or failure.
public protocol HudTranscriptionBatchOperation: Sendable {
    var operationID: HudTranscriptionOperationID { get }
    var events: AsyncStream<HudTranscriptionBatchEvent> { get }

    func cancel() async
}
