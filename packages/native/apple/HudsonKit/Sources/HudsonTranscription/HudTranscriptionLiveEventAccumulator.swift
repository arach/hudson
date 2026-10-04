import Foundation

/// Ordered live-session state machine. Adapters reuse this for sequence, replacement, and terminal rules.
public actor HudTranscriptionLiveEventAccumulator: HudTranscriptionLiveSession {
    public nonisolated let sessionID: HudTranscriptionSessionID
    public nonisolated let maximumChunkByteCount: Int
    public nonisolated let events: AsyncStream<HudTranscriptionLiveEvent>

    private let continuation: AsyncStream<HudTranscriptionLiveEvent>.Continuation
    private var phase: Phase = .receiving
    private var nextEventSequence: UInt64 = 0
    private var nextExpectedChunkSequence: UInt64 = 0
    private var acceptedChunkCountStorage: Int = 0
    private var utterances: [HudTranscriptionUtteranceID: UtteranceState] = [:]
    private var terminalOutcome: HudTranscriptionLiveTerminal?

    private enum Phase: Sendable {
        case receiving
        case finishing
        case terminal
    }

    private struct UtteranceState: Sendable {
        var revision: UInt64
        var text: String
        var isFinal: Bool
        var start: TimeInterval?
        var end: TimeInterval?
        var confidence: Double?
    }

    public init(sessionID: HudTranscriptionSessionID, maximumChunkByteCount: Int) {
        precondition(maximumChunkByteCount > 0, "maximumChunkByteCount must be positive")
        self.sessionID = sessionID
        self.maximumChunkByteCount = maximumChunkByteCount
        let stream = AsyncStream.makeStream(
            of: HudTranscriptionLiveEvent.self,
            bufferingPolicy: .unbounded
        )
        self.events = stream.stream
        self.continuation = stream.continuation
    }

    deinit {
        continuation.finish()
    }

    public var acceptedChunkCount: Int {
        acceptedChunkCountStorage
    }

    public var nextChunkSequence: UInt64 {
        nextExpectedChunkSequence
    }

    public var hasTerminated: Bool {
        phase == .terminal
    }

    public var terminal: HudTranscriptionLiveTerminal? {
        terminalOutcome
    }

    public func snapshot(for utteranceID: HudTranscriptionUtteranceID) -> HudTranscriptionUtteranceSnapshot? {
        guard let state = utterances[utteranceID] else {
            return nil
        }
        return HudTranscriptionUtteranceSnapshot(
            utteranceID: utteranceID,
            revision: state.revision,
            text: state.text,
            isFinal: state.isFinal,
            start: state.start,
            end: state.end,
            confidence: state.confidence
        )
    }

    public func send(_ chunk: HudTranscriptionPCMChunk) async throws {
        try accept(chunk)
    }

    public func finish() async throws {
        switch phase {
        case .terminal:
            throw HudTranscriptionError.lateWrite(.sessionTerminal)
        case .finishing:
            return
        case .receiving:
            phase = .finishing
        }
    }

    public func cancel() async {
        guard phase != .terminal else {
            return
        }
        emitTerminal(.cancelled)
    }

    public func terminate(_ outcome: HudTranscriptionLiveTerminal) throws {
        guard phase != .terminal else {
            throw HudTranscriptionError.sessionAlreadyTerminal
        }
        emitTerminal(outcome)
    }

    public func emitProvisional(
        utteranceID: HudTranscriptionUtteranceID,
        revision: UInt64,
        text: String,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        confidence: Double? = nil
    ) throws {
        try ensureWritableForUtterance()
        if let state = utterances[utteranceID] {
            if state.isFinal {
                throw HudTranscriptionError.lateWrite(.utteranceFinalized)
            }
            if revision < state.revision {
                throw HudTranscriptionError.nonMonotonicUtteranceRevision(
                    expectedMinimum: state.revision,
                    received: revision
                )
            }
        }
        utterances[utteranceID] = UtteranceState(
            revision: revision,
            text: text,
            isFinal: false,
            start: start,
            end: end,
            confidence: confidence
        )
        let event = HudTranscriptionUtteranceRevision(
            sequence: takeSequence(),
            sessionID: sessionID,
            utteranceID: utteranceID,
            revision: revision,
            text: text,
            start: start,
            end: end,
            confidence: confidence
        )
        continuation.yield(.provisional(event))
    }

    public func emitFinalUtterance(
        utteranceID: HudTranscriptionUtteranceID,
        text: String,
        start: TimeInterval? = nil,
        end: TimeInterval? = nil,
        confidence: Double? = nil
    ) throws {
        try ensureWritableForUtterance()
        if utterances[utteranceID]?.isFinal == true {
            throw HudTranscriptionError.lateWrite(.utteranceFinalized)
        }
        let revision = utterances[utteranceID]?.revision ?? 0
        utterances[utteranceID] = UtteranceState(
            revision: revision,
            text: text,
            isFinal: true,
            start: start,
            end: end,
            confidence: confidence
        )
        let event = HudTranscriptionFinalizedUtterance(
            sequence: takeSequence(),
            sessionID: sessionID,
            utteranceID: utteranceID,
            text: text,
            start: start,
            end: end,
            confidence: confidence
        )
        continuation.yield(.finalizedUtterance(event))
    }

    private func accept(_ chunk: HudTranscriptionPCMChunk) throws {
        switch phase {
        case .terminal:
            throw HudTranscriptionError.lateWrite(.sessionTerminal)
        case .finishing:
            throw HudTranscriptionError.lateWrite(.inputFinished)
        case .receiving:
            break
        }

        if chunk.bytes.count > maximumChunkByteCount {
            throw HudTranscriptionError.chunkTooLarge(
                byteCount: chunk.bytes.count,
                maximum: maximumChunkByteCount
            )
        }
        if chunk.sequence != nextExpectedChunkSequence {
            throw HudTranscriptionError.nonMonotonicChunkSequence(
                expected: nextExpectedChunkSequence,
                received: chunk.sequence
            )
        }

        nextExpectedChunkSequence += 1
        acceptedChunkCountStorage += 1
    }

    private func ensureWritableForUtterance() throws {
        if phase == .terminal {
            throw HudTranscriptionError.lateWrite(.sessionTerminal)
        }
    }

    private func emitTerminal(_ outcome: HudTranscriptionLiveTerminal) {
        phase = .terminal
        terminalOutcome = outcome
        let event = HudTranscriptionLiveTerminalEvent(
            sequence: takeSequence(),
            sessionID: sessionID,
            outcome: outcome
        )
        continuation.yield(.terminal(event))
        continuation.finish()
    }

    private func takeSequence() -> UInt64 {
        let sequence = nextEventSequence
        nextEventSequence += 1
        return sequence
    }
}
