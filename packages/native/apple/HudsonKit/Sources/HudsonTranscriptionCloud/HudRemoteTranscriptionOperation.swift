import Foundation
import HudsonTranscription

/// One submission, no implicit retries. Cancellation cannot promise remote rollback.
public actor HudRemoteTranscriptionOperation: HudTranscriptionBatchOperation {
    public nonisolated let operationID: HudTranscriptionOperationID
    public nonisolated let events: AsyncStream<HudTranscriptionBatchEvent>
    private let continuation: AsyncStream<HudTranscriptionBatchEvent>.Continuation
    private var task: Task<Void, Never>?
    private var terminal = false
    private var submitted = false
    private var providerRequestID: String?

    private init(operationID: HudTranscriptionOperationID) {
        self.operationID = operationID
        let pair = AsyncStream<HudTranscriptionBatchEvent>.makeStream()
        events = pair.stream
        continuation = pair.continuation
    }

    public static func start(operationID: HudTranscriptionOperationID, work: @escaping @Sendable (HudRemoteTranscriptionOperation) async throws -> HudTranscriptionResult) async -> HudRemoteTranscriptionOperation {
        let operation = HudRemoteTranscriptionOperation(operationID: operationID)
        await operation.run(work)
        return operation
    }

    private func run(_ work: @escaping @Sendable (HudRemoteTranscriptionOperation) async throws -> HudTranscriptionResult) {
        task = Task {
            do {
                let result = try await work(self)
                complete(result)
            } catch {
                fail(error)
            }
        }
        continuation.onTermination = { @Sendable [weak self] _ in
            Task { await self?.cancel() }
        }
    }

    public func willSubmit() throws {
        guard !terminal else { throw CancellationError() }
        submitted = true
    }

    public func accepted(_ requestID: String) {
        guard !terminal, providerRequestID == nil else { return }
        providerRequestID = requestID
        continuation.yield(.accepted(providerRequestID: requestID))
    }

    private func complete(_ result: HudTranscriptionResult) {
        guard !terminal else { return }
        if let id = result.provenance.providerRequestID { accepted(id) }
        terminal = true
        continuation.yield(.completed(result))
        continuation.finish()
        task = nil
    }

    private func fail(_ error: Error) {
        guard !terminal else { return }
        terminal = true
        if submitted, error is CancellationError || (error as? HudTranscriptionHTTPError) == .connectionFailed {
            continuation.yield(.failed(.remoteOutcomeUnknown(providerRequestID: providerRequestID)))
        } else if let error = error as? HudTranscriptionError {
            continuation.yield(.failed(error))
        } else if error is CancellationError {
            continuation.yield(.failed(.cancelled))
        } else {
            continuation.yield(.failed(.invalidRequest("The transcription provider could not complete this request.")))
        }
        continuation.finish()
        task = nil
    }

    public func cancel() {
        guard !terminal else { return }
        terminal = true
        task?.cancel()
        task = nil
        continuation.yield(.failed(submitted ? .remoteOutcomeUnknown(providerRequestID: providerRequestID) : .cancelled))
        continuation.finish()
    }
}
