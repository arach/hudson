import Foundation
import CryptoKit
import HudsonTranscription

/// Caller-fed session. A final utterance never implies that the entire session ended.
public actor HudGeminiLiveSession: HudTranscriptionLiveSession {
    public nonisolated let sessionID: HudTranscriptionSessionID
    public nonisolated let events: AsyncStream<HudTranscriptionLiveEvent>
    private let continuation: AsyncStream<HudTranscriptionLiveEvent>.Continuation
    private let connection: HudGeminiLiveConnection
    private let request: HudTranscriptionRequest
    private let configuration: HudTranscriptionConfiguration
    private var receiver: Task<Void, Never>?
    private var expiry: Task<Void, Never>?
    private var drain: Task<Void, Never>?
    private var terminal = false
    private var finishing = false
    private var writing = false
    private var sentBytes = 0
    private var nextChunk: UInt64 = 0
    private var eventSequence: UInt64 = 0
    private var utterance: UInt64 = 0
    private var revision: UInt64 = 0
    private var fragments = ""
    private var finalized: [String] = []
    private var digest = SHA256()
    private let drainTimeout: Duration

    private init(connection: HudGeminiLiveConnection, request: HudTranscriptionRequest,
                 configuration: HudTranscriptionConfiguration, drainTimeout: Duration) {
        self.connection = connection
        self.request = request
        self.configuration = configuration
        self.drainTimeout = drainTimeout
        sessionID = .init(rawValue: UUID().uuidString)
        let stream = AsyncStream<HudTranscriptionLiveEvent>.makeStream(bufferingPolicy: .bufferingNewest(256))
        events = stream.stream
        continuation = stream.continuation
    }

    public static func open(connection: HudGeminiLiveConnection, request: HudTranscriptionRequest,
                            configuration: HudTranscriptionConfiguration,
                            setupTimeout: Duration = .seconds(15), drainTimeout: Duration = .seconds(10)) async throws -> HudGeminiLiveSession {
        let watchdog = Task {
            do { try await Task.sleep(for: setupTimeout); await connection.cancel() }
            catch { }
        }
        defer { watchdog.cancel() }
        try await withTaskCancellationHandler {
            try await connection.start(model: configuration.modelID.rawValue, languages: request.features.languageHints,
                vocabulary: request.features.vocabularyHints, clean: request.features.style == .clean || request.features.smartFormatting)
            try Task.checkCancellation()
        } onCancel: { Task { await connection.cancel() } }
        let session = HudGeminiLiveSession(connection: connection, request: request, configuration: configuration, drainTimeout: drainTimeout)
        await session.run()
        return session
    }

    private func run() {
        continuation.onTermination = { @Sendable [weak self] _ in Task { await self?.cancel() } }
        receiver = Task { [weak self, connection] in
            do {
                while !Task.isCancelled {
                    let batch = try await connection.receive()
                    guard let self else { await connection.cancel(); return }
                    for event in batch { await self.consume(event) }
                    if await self.terminal { return }
                }
            } catch { await self?.connectionLost() }
        }
        let remaining = min(600, request.deadline?.timeIntervalSinceNow ?? 600)
        expiry = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(max(0, remaining))); await self?.timedOut() }
            catch { }
        }
    }

    public func send(_ chunk: HudTranscriptionPCMChunk) async throws {
        guard !terminal, !finishing else { throw HudTranscriptionError.lateWrite(terminal ? .sessionTerminal : .inputFinished) }
        guard !writing else { throw HudTranscriptionError.invalidRequest("Await the previous audio send before sending another chunk.") }
        guard chunk.sequence == nextChunk else { throw HudTranscriptionError.nonMonotonicChunkSequence(expected: nextChunk, received: chunk.sequence) }
        guard !chunk.bytes.isEmpty, chunk.bytes.count.isMultiple(of: 2), chunk.bytes.count <= HudGeminiLiveConnection.maximumChunkBytes else {
            throw HudTranscriptionError.chunkTooLarge(byteCount: chunk.bytes.count, maximum: HudGeminiLiveConnection.maximumChunkBytes)
        }
        guard sentBytes + chunk.bytes.count <= 600 * 32000 else { await timedOut(); throw HudTranscriptionError.incompleteAudio }
        writing = true
        defer { writing = false }
        // A failed write may still have reached the provider; retain uncertainty.
        sentBytes += chunk.bytes.count
        do {
            try await connection.sendPCM(chunk.bytes, sequence: chunk.sequence)
            guard !terminal else { throw HudTranscriptionError.sessionAlreadyTerminal }
            digest.update(data: chunk.bytes)
            nextChunk += 1
        } catch {
            await connectionLost()
            throw HudTranscriptionError.remoteOutcomeUnknown(providerRequestID: nil)
        }
    }

    public func finish() async throws {
        guard !terminal else { throw HudTranscriptionError.sessionAlreadyTerminal }
        guard !finishing else { return }
        guard !writing else { throw HudTranscriptionError.invalidRequest("Await the current audio send before finishing.") }
        finishing = true
        do { try await connection.finishInput() }
        catch { await connectionLost(); throw HudTranscriptionError.remoteOutcomeUnknown(providerRequestID: nil) }
        guard !terminal else { return }
        if sentBytes == 0 { await complete(); return }
        drain = Task { [weak self, drainTimeout] in
            do { try await Task.sleep(for: drainTimeout); await self?.timedOut() }
            catch { }
        }
    }

    public func cancel() async {
        await terminate(sentBytes == 0 ? .cancelled : .remoteOutcomeUnknown(providerRequestID: nil))
    }

    private func consume(_ event: HudGeminiLiveConnection.Event) async {
        guard !terminal else { return }
        switch event {
        case .partial(let text): await provisional(text)
        case .finalized(let text): await finalize(text)
        case .inputFragment(let text, let finished):
            fragments += text
            if finished { await finalize(fragments) } else { await provisional(fragments) }
        case .turnComplete:
            // Conversational input fragments can end with the provider turn boundary.
            if !fragments.isEmpty { await finalize(fragments) }
            if finishing { await complete() }
        case .goAway: await terminate(.failed(.incompleteAudio))
        case .interrupted: break // Assistant output interruption does not finalize user input.
        case .usage: break // No inferred billing or token counts.
        }
    }

    private var utteranceID: HudTranscriptionUtteranceID { .init(rawValue: "\(sessionID.rawValue)-\(utterance)") }

    private func provisional(_ text: String) async {
        revision += 1
        await emit(.provisional(.init(sequence: eventSequence, sessionID: sessionID, utteranceID: utteranceID, revision: revision, text: text)))
    }

    private func finalize(_ text: String) async {
        await emit(.finalizedUtterance(.init(sequence: eventSequence, sessionID: sessionID, utteranceID: utteranceID, text: text)))
        finalized.append(text)
        fragments = ""
        utterance += 1
        revision = 0
    }

    private func emit(_ event: HudTranscriptionLiveEvent) async {
        guard !terminal else { return }
        eventSequence += 1
        if case .dropped = continuation.yield(event) { await terminate(.failed(.incompleteAudio)) }
    }

    private func complete() async {
        guard revision == 0, fragments.isEmpty else { await terminate(.failed(.incompleteAudio)); return }
        let result = HudTranscriptionResult(transcript: finalized.joined(separator: " "), completion: .completed,
            provenance: .init(providerID: configuration.providerID, modelID: configuration.modelID, adapterVersion: "1",
                configurationFingerprint: configuration.secretFreeFingerprint,
                sourceDigest: digest.finalize().map { String(format: "%02x", $0) }.joined(),
                runID: request.operationID.rawValue, sessionID: sessionID.rawValue, timestamp: Date()))
        await terminate(.completed(result))
    }

    private func timedOut() async { await terminate(.failed(.incompleteAudio)) }
    private func connectionLost() async { await terminate(sentBytes == 0 ? .failed(.invalidRequest("The live transcription connection closed.")) : .remoteOutcomeUnknown(providerRequestID: nil)) }

    private func terminate(_ outcome: HudTranscriptionLiveTerminal) async {
        guard !terminal else { return }
        terminal = true
        receiver?.cancel()
        expiry?.cancel()
        drain?.cancel()
        receiver = nil
        expiry = nil
        drain = nil
        continuation.yield(.terminal(.init(sequence: eventSequence, sessionID: sessionID, outcome: outcome)))
        continuation.finish()
        await connection.cancel()
    }
}
