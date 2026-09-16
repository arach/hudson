import Foundation
import Testing
@testable import HudsonTranscriptionCloud

private actor LiveFixtureSocket: HudTranscriptionSocket {
    var sent: [Data] = []
    var incoming: [Data]
    var closed = false
    init(_ messages: [String]) { incoming = messages.map { Data($0.utf8) } }
    func send(_ data: Data) async throws { sent.append(data) }
    func receive() async throws -> Data {
        guard !incoming.isEmpty else { throw HudTranscriptionHTTPError.connectionFailed }
        return incoming.removeFirst()
    }
    func close() { closed = true }
}

@Test func dedicatedLiveKeepsUtteranceFinalSeparateFromSessionEnd() async throws {
    let socket = LiveFixtureSocket([#"{"setupComplete":{}}"#, #"{"serverContent":{"interimInputTranscription":{"text":"Hel"}}}"#, #"{"serverContent":{"inputTranscription":{"text":"Hello"},"turnComplete":true}}"#])
    let session = HudGeminiLiveConnection(socket: socket, mode: .dedicatedTranscription)
    try await session.start(model: "gemini-3.5-transcribe-live")
    try await session.sendPCM(Data([0, 0]), sequence: 0)
    #expect(try await session.receive() == [.partial("Hel")])
    #expect(try await session.receive() == [.finalized("Hello"), .turnComplete])
    try await session.sendPCM(Data([0, 0]), sequence: 1)
    try await session.finishInput()
    await #expect(throws: HudGeminiLiveConnection.Failure.invalidState) {
        try await session.sendPCM(Data([0, 0]), sequence: 2)
    }
    await session.cancel()
    #expect(await socket.closed)
}

@Test func conversationalInputUsesAudioAndDoesNotTreatOutputAsInput() async throws {
    let socket = LiveFixtureSocket([#"{"setupComplete":{}}"#, #"{"serverContent":{"inputTranscription":{"text":"user fragment","finished":false},"outputTranscription":{"text":"assistant answer"},"modelTurn":{"parts":[{"inlineData":{"data":"AA=="}}]}}}"#])
    let session = HudGeminiLiveConnection(socket: socket, mode: .conversationalInput)
    try await session.start(model: "gemini-3.8-live")
    let events = try await session.receive()
    #expect(events == [.inputFragment("user fragment", finished: false)])
    let sent = await socket.sent
    let setup = try #require(JSONSerialization.jsonObject(with: sent[0]) as? [String: Any])
    let config = try #require((setup["setup"] as? [String: Any])?["generationConfig"] as? [String: Any])
    #expect(config["responseModalities"] as? [String] == ["AUDIO"])
    await session.cancel()
}

@Test func liveRejectsOversizedAndOutOfOrderAudio() async throws {
    let socket = LiveFixtureSocket([#"{"setupComplete":{}}"#])
    let session = HudGeminiLiveConnection(socket: socket, mode: .dedicatedTranscription)
    try await session.start(model: "gemini-3.5-transcribe-live")
    await #expect(throws: HudGeminiLiveConnection.Failure.invalidChunk) {
        try await session.sendPCM(Data(repeating: 0, count: 6402), sequence: 0)
    }
    await #expect(throws: HudGeminiLiveConnection.Failure.invalidChunk) {
        try await session.sendPCM(Data([0, 0]), sequence: 1)
    }
    #expect(await socket.sent.count == 1)
    try await session.sendPCM(Data([0, 0]), sequence: 0)
    await session.cancel()
}
