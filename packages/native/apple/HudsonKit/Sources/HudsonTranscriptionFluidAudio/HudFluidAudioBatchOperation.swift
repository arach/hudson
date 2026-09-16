import Foundation
import HudsonTranscription

actor HudFluidAudioBatchOperation: HudTranscriptionBatchOperation {
    nonisolated let operationID: HudTranscriptionOperationID
    nonisolated let events: AsyncStream<HudTranscriptionBatchEvent>
    private let continuation: AsyncStream<HudTranscriptionBatchEvent>.Continuation
    private var task: Task<Void, Never>?
    private var terminal = false
    private var deadlineTask: Task<Void, Never>?

    private init(operationID: HudTranscriptionOperationID) {
        self.operationID = operationID
        let stream = AsyncStream<HudTranscriptionBatchEvent>.makeStream()
        events = stream.stream
        continuation = stream.continuation
    }

    static func start(operationID: HudTranscriptionOperationID, deadline: Date? = nil, work: @escaping @Sendable () async throws -> HudTranscriptionResult) async -> HudFluidAudioBatchOperation {
        let operation = HudFluidAudioBatchOperation(operationID: operationID)
        await operation.run(work, deadline: deadline)
        return operation
    }

    private func run(_ work: @escaping @Sendable () async throws -> HudTranscriptionResult, deadline: Date?) {
        if let deadline {
            deadlineTask = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(max(0, deadline.timeIntervalSinceNow))) }
                catch { return }
                await self?.expire()
            }
        }
        continuation.onTermination = { @Sendable [weak self] _ in Task { await self?.cancel() } }
        task = Task {
            do { let result = try await work(); finish(.completed(result)) }
            catch is CancellationError { finish(.failed(.cancelled)) }
            catch let error as HudTranscriptionError { finish(.failed(error)) }
            catch { finish(.failed(.invalidRequest("FluidAudio could not transcribe this recording."))) }
        }
    }

    private func expire() {
        task?.cancel()
        finish(.failed(.incompleteAudio))
    }

    func cancel() {
        task?.cancel()
        finish(.failed(.cancelled))
    }

    private func finish(_ event: HudTranscriptionBatchEvent) {
        guard !terminal else { return }
        terminal = true
        deadlineTask?.cancel()
        deadlineTask = nil
        continuation.yield(event)
        continuation.finish()
        task = nil
    }
}
