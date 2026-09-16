import Foundation
import CryptoKit
import HudsonTranscription

/// Bounded caller-fed dictation. Each preview revises the full current utterance;
/// the final inference processes all accepted samples with a fresh decoder.
actor HudFluidAudioLiveSession: HudTranscriptionLiveSession {
    typealias Inference = @Sendable ([Float]) async throws -> HudTranscriptionResult
    nonisolated let sessionID = HudTranscriptionSessionID(rawValue: UUID().uuidString)
    nonisolated let events: AsyncStream<HudTranscriptionLiveEvent>
    private let continuation: AsyncStream<HudTranscriptionLiveEvent>.Continuation
    private var inference: Inference?
    private var samples: [Float] = []
    private var digest = SHA256()
    private var nextChunk: UInt64 = 0
    private var eventSequence: UInt64 = 0
    private var revision: UInt64 = 0
    private var lastPreviewSamples = 0
    private var writing = false
    private var finishing = false
    private var terminal = false
    private var inferenceTask: Task<HudTranscriptionResult, any Error>?
    private var expiry: Task<Void, Never>?
    static let maximumSeconds = 120
    static let maximumChunkBytes = 6400

    private init(inference: @escaping Inference) {
        self.inference = inference
        let stream = AsyncStream<HudTranscriptionLiveEvent>.makeStream(bufferingPolicy: .bufferingNewest(64))
        events = stream.stream
        continuation = stream.continuation
    }

    static func open(deadline: Date?, inference: @escaping Inference) async -> HudFluidAudioLiveSession {
        let session = HudFluidAudioLiveSession(inference: inference)
        await session.run(deadline: deadline)
        return session
    }

    private func run(deadline: Date?) {
        continuation.onTermination = { @Sendable [weak self] _ in Task { await self?.cancel() } }
        let remaining = min(Double(Self.maximumSeconds), deadline?.timeIntervalSinceNow ?? Double(Self.maximumSeconds))
        expiry = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(max(0, remaining))); await self?.terminate(.failed(.incompleteAudio)) }
            catch { }
        }
    }

    func send(_ chunk: HudTranscriptionPCMChunk) async throws {
        guard !terminal, !finishing else { throw HudTranscriptionError.lateWrite(terminal ? .sessionTerminal : .inputFinished) }
        guard !writing else { throw HudTranscriptionError.invalidRequest("Await the previous audio send before sending another chunk.") }
        guard chunk.sequence == nextChunk else { throw HudTranscriptionError.nonMonotonicChunkSequence(expected: nextChunk, received: chunk.sequence) }
        guard chunk.bytes.count <= Self.maximumChunkBytes else { throw HudTranscriptionError.chunkTooLarge(byteCount: chunk.bytes.count, maximum: Self.maximumChunkBytes) }
        guard !chunk.bytes.isEmpty, chunk.bytes.count.isMultiple(of: 2) else { throw HudTranscriptionError.invalidRequest("Provide complete PCM16 audio samples.") }
        guard samples.count + chunk.bytes.count / 2 <= Self.maximumSeconds * 16000 else {
            terminate(.failed(.incompleteAudio)); throw HudTranscriptionError.incompleteAudio
        }
        writing = true
        defer { writing = false }
        let bytes = [UInt8](chunk.bytes)
        for index in stride(from: 0, to: bytes.count, by: 2) {
            let value = Int16(bitPattern: UInt16(bytes[index]) | UInt16(bytes[index + 1]) << 8)
            samples.append(Float(value) / 32768)
        }
        digest.update(data: chunk.bytes)
        nextChunk += 1
        if samples.count - lastPreviewSamples >= 32000 {
            do {
                let preview = try await infer()
                guard !terminal else { throw HudTranscriptionError.sessionAlreadyTerminal }
                lastPreviewSamples = samples.count
                revision += 1
                emit(.provisional(.init(sequence: eventSequence, sessionID: sessionID, utteranceID: .init(rawValue: sessionID.rawValue), revision: revision, text: preview.transcript)))
            } catch {
                if !terminal { terminate(.failed(.incompleteAudio)) }
                throw error
            }
        }
    }

    func finish() async throws {
        guard !terminal else { throw HudTranscriptionError.sessionAlreadyTerminal }
        guard !finishing else { return }
        guard !writing else { throw HudTranscriptionError.invalidRequest("Await the current audio send before finishing.") }
        finishing = true
        do {
            var result = try await infer()
            guard !terminal else { throw HudTranscriptionError.sessionAlreadyTerminal }
            result.provenance.sourceDigest = digest.finalize().map { String(format: "%02x", $0) }.joined()
            result.provenance.sessionID = sessionID.rawValue
            emit(.finalizedUtterance(.init(sequence: eventSequence, sessionID: sessionID,
                utteranceID: .init(rawValue: sessionID.rawValue), text: result.transcript)))
            terminate(.completed(result))
        } catch {
            if !terminal { terminate(error is CancellationError ? .cancelled : .failed(.incompleteAudio)) }
            throw error
        }
    }

    private func infer() async throws -> HudTranscriptionResult {
        let snapshot = samples
        guard let inference else { throw HudTranscriptionError.sessionAlreadyTerminal }
        let task = Task { [inference] in try await inference(snapshot) }
        inferenceTask = task
        defer { inferenceTask = nil }
        return try await withTaskCancellationHandler {
            let result = try await task.value
            try Task.checkCancellation()
            return result
        } onCancel: { task.cancel() }
    }

    func cancel() { terminate(.cancelled) }

    private func emit(_ event: HudTranscriptionLiveEvent) {
        guard !terminal else { return }
        eventSequence += 1
        if case .dropped = continuation.yield(event) { terminate(.failed(.incompleteAudio)) }
    }

    private func terminate(_ outcome: HudTranscriptionLiveTerminal) {
        guard !terminal else { return }
        terminal = true
        // Release session ownership now; an in-flight task retains its captured
        // closure (and model lease) until native inference actually returns.
        inference = nil
        inferenceTask?.cancel()
        expiry?.cancel()
        expiry = nil
        samples.removeAll()
        continuation.yield(.terminal(.init(sequence: eventSequence, sessionID: sessionID, outcome: outcome)))
        continuation.finish()
    }
}
