import Foundation
import Testing
import HudsonTranscription
@testable import HudsonTranscriptionCloud

private actor SessionSocket: HudTranscriptionSocket {
    var queue: [Data] = []
    var waiting: CheckedContinuation<Data, any Error>?
    var closed = false
    let completes: Bool
    init(completes: Bool = true) { self.completes = completes }
    func send(_ data: Data) async throws {
        guard !closed else { throw HudTranscriptionHTTPError.connectionFailed }
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        if object["setup"] != nil { push(#"{"setupComplete":{}}"#) }
        if let input = object["realtimeInput"] as? [String: Any] {
            if input["audio"] != nil {
                push(#"{"serverContent":{"interimInputTranscription":{"text":"Hel"}}}"#)
                push(#"{"serverContent":{"inputTranscription":{"text":"Hello."}}}"#)
            }
            if input["audioStreamEnd"] != nil, completes { push(#"{"serverContent":{"turnComplete":true}}"#) }
        }
    }
    func push(_ json: String) {
        let data = Data(json.utf8)
        if let waiting { self.waiting = nil; waiting.resume(returning: data) }
        else { queue.append(data) }
    }
    func receive() async throws -> Data {
        if !queue.isEmpty { return queue.removeFirst() }
        if closed { throw HudTranscriptionHTTPError.connectionFailed }
        return try await withCheckedThrowingContinuation { waiting = $0 }
    }
    func close() {
        closed = true
        waiting?.resume(throwing: HudTranscriptionHTTPError.connectionFailed)
        waiting = nil
    }
}

private func session(_ socket: SessionSocket) async throws -> HudGeminiLiveSession {
    let request = HudTranscriptionRequest(operationID: "live-fixture", source: .init(id: "source", kind: "dictation"), audio: .pcm(.init(sampleRate: 16000, channelCount: 1, bitsPerSample: 16)))
    let config = HudTranscriptionConfiguration(providerID: "gemini-live-transcription", modelID: "gemini-3.5-transcribe-live")
    return try await HudGeminiLiveSession.open(connection: .init(socket: socket, mode: .dedicatedTranscription), request: request, configuration: config, drainTimeout: .milliseconds(30))
}

@Test func liveFinalUtteranceDoesNotCloseSessionAndFinishHasOneTerminal() async throws {
    let socket = SessionSocket()
    let live = try await session(socket)
    var iterator = live.events.makeAsyncIterator()
    try await live.send(.init(sequence: 0, bytes: Data([0, 0])))
    guard case .provisional(let partial) = await iterator.next(), case .finalizedUtterance(let final) = await iterator.next() else { Issue.record("Missing utterance events"); await live.cancel(); return }
    #expect(partial.utteranceID == final.utteranceID)
    #expect(partial.sequence < final.sequence)
    #expect(await socket.closed == false)
    try await live.finish()
    guard case .terminal(let terminal) = await iterator.next(), case .completed(let result) = terminal.outcome else { Issue.record("Missing completed session"); return }
    #expect(result.transcript == "Hello.")
    #expect(result.provenance.sourceDigest.count == 64)
    #expect(terminal.sequence > final.sequence)
    #expect(await iterator.next() == nil)
    await #expect(throws: HudTranscriptionError.lateWrite(.sessionTerminal)) { try await live.send(.init(sequence: 1, bytes: Data([0, 0]))) }
    await live.cancel()
}

@Test func liveDrainTimeoutDoesNotPromoteFinalUtteranceToSessionSuccess() async throws {
    let socket = SessionSocket(completes: false)
    let live = try await session(socket)
    try await live.send(.init(sequence: 0, bytes: Data([0, 0])))
    try await live.finish()
    var terminal: HudTranscriptionLiveTerminal?
    for await event in live.events { if case .terminal(let value) = event { terminal = value.outcome } }
    #expect(terminal == .failed(.incompleteAudio))
    #expect(await socket.closed)
}

@Test func liveCancellationAfterAudioReportsRemoteUncertainty() async throws {
    let socket = SessionSocket()
    let live = try await session(socket)
    try await live.send(.init(sequence: 0, bytes: Data([0, 0])))
    await live.cancel()
    var terminals: [HudTranscriptionLiveTerminal] = []
    for await event in live.events { if case .terminal(let value) = event { terminals.append(value.outcome) } }
    #expect(terminals == [.remoteOutcomeUnknown(providerRequestID: nil)])
    #expect(await socket.closed)
}
