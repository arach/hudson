import Foundation
import Testing
import HudsonConversation
@testable import HudsonConversationGemini

private func configuration(model: String = "gemini-3.8-live",
                           thinking: HudConversationThinkingLevel? = nil,
                           kind: HudConversationCredentialKind = .apiKey) -> HudConversationConfiguration {
    .init(providerID: HudGeminiConversationAdapter.providerID, modelID: .init(rawValue: model),
          instructions: "Be brief.", voice: "Kore", inputAudio: .pcm16k, thinkingLevel: thinking,
          credentialReference: .init(identifier: "gemini-key"), credentialKind: kind)
}

private func makeSession(
    model: String = "gemini-3.8-live",
    thinking: HudConversationThinkingLevel? = nil,
    tools: [HudConversationToolDeclaration] = [],
    setupTimeout: UInt64 = 2_000_000_000
) -> (FixtureSocket, HudGeminiConversationSession) {
    let socket = FixtureSocket()
    let session = HudGeminiConversationSession(
        socket: socket, configuration: configuration(model: model, thinking: thinking),
        tools: tools, setupTimeout: setupTimeout)
    return (socket, session)
}

@Test("Setup declares model, audio modality, transcripts, and explicit tool behavior")
func setupMessage() async throws {
    let tools = [
        HudConversationToolDeclaration(name: "lights_on", behavior: .nonBlocking),
        HudConversationToolDeclaration(name: "lights_off", behavior: .blocking),
    ]
    let (socket, session) = makeSession(tools: tools)
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    let setup = await socket.sentMessages()[0]["setup"] as? [String: Any]
    #expect(setup?["model"] as? String == "models/gemini-3.8-live")
    let generation = setup?["generationConfig"] as? [String: Any]
    #expect(generation?["responseModalities"] as? [String] == ["AUDIO"])
    #expect(generation?["thinkingConfig"] == nil)
    #expect(setup?["inputAudioTranscription"] != nil)
    #expect(setup?["outputAudioTranscription"] != nil)
    // The provider default is NON_BLOCKING; both behaviors serialize explicitly.
    let declarations = ((setup?["tools"] as? [[String: Any]])?.first?["functionDeclarations"]
        as? [[String: Any]]) ?? []
    #expect(declarations.first { $0["name"] as? String == "lights_on" }?["behavior"] as? String == "NON_BLOCKING")
    #expect(declarations.first { $0["name"] as? String == "lights_off" }?["behavior"] as? String == "BLOCKING")
    var iterator = session.events.makeAsyncIterator()
    #expect(try await iterator.next() == .ready(sessionID: nil))
}

@Test("Extended thinking serializes its level and refuses blocking declarations")
func extendedThinkingRules() async throws {
    let (socket, session) = makeSession(model: "gemini-3.8-live-extended-thinking", thinking: .high)
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    let generation = (await socket.sentMessages()[0]["setup"] as? [String: Any])?["generationConfig"] as? [String: Any]
    #expect((generation?["thinkingConfig"] as? [String: Any])?["thinkingLevel"] as? String == "HIGH")

    let (_, blockingSession) = makeSession(
        model: "gemini-3.8-live-extended-thinking",
        tools: [HudConversationToolDeclaration(name: "lights_off", behavior: .blocking)])
    await #expect(throws: HudConversationError.self) { try await blockingSession.start() }

    let (_, baseThinking) = makeSession(model: "gemini-3.8-live", thinking: .low)
    await #expect(throws: HudConversationError.self) { try await baseThinking.start() }
}

@Test("Adapter rejects incompatible authored configuration instead of dropping it")
func adapterValidation() async throws {
    let adapter = HudGeminiConversationAdapter(credentials: FixtureCredentials(value: "key"))
    await #expect(throws: HudConversationError.self) {
        _ = try await adapter.open(configuration: configuration(thinking: .low), tools: [])
    }
    await #expect(throws: HudConversationError.self) {
        _ = try await adapter.open(
            configuration: configuration(model: "gemini-3.8-live-extended-thinking"),
            tools: [HudConversationToolDeclaration(name: "x", behavior: .blocking)])
    }
}

@Test("API keys ride the handshake header; ephemeral tokens use the constrained endpoint header")
func credentialTransports() async throws {
    let requests = RequestBox()
    let socket = FixtureSocket()
    await socket.push(["setupComplete": [:] as [String: Any]])
    let adapter = HudGeminiConversationAdapter(
        credentials: FixtureCredentials(value: "secret-value"),
        socketFactory: { request in
            await requests.append(request)
            return socket
        })
    _ = try await adapter.open(configuration: configuration(), tools: [])
    let apiKeyRequest = await requests.all[0]
    #expect(apiKeyRequest.url?.absoluteString.contains("BidiGenerateContent") == true)
    #expect(apiKeyRequest.url?.query?.contains("secret-value") != true)
    #expect(apiKeyRequest.value(forHTTPHeaderField: "x-goog-api-key") == "secret-value")

    let tokenSocket = FixtureSocket()
    await tokenSocket.push(["setupComplete": [:] as [String: Any]])
    let tokenAdapter = HudGeminiConversationAdapter(
        credentials: FixtureCredentials(value: "ephemeral-token"),
        socketFactory: { request in
            await requests.append(request)
            return tokenSocket
        })
    _ = try await tokenAdapter.open(configuration: configuration(kind: .ephemeralToken), tools: [])
    let tokenRequest = await requests.all[1]
    #expect(tokenRequest.url?.absoluteString.contains("BidiGenerateContentConstrained") == true)
    #expect(tokenRequest.url?.query?.contains("ephemeral-token") != true)
    #expect(tokenRequest.value(forHTTPHeaderField: "Authorization") == "Token ephemeral-token")
}

@Test("Audio input frames carry the configured rate; end of input is explicit")
func audioInput() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    try await session.send(audio: Data([1, 2]))
    try await session.finishAudio()
    await socket.waitForSent(count: 3)
    let audio = (await socket.sentMessages()[1]["realtimeInput"] as? [String: Any])?["audio"] as? [String: Any]
    #expect(audio?["mimeType"] as? String == "audio/pcm;rate=16000")
    #expect(audio?["data"] as? String == Data([1, 2]).base64EncodedString())
    let end = await socket.sentMessages()[2]["realtimeInput"] as? [String: Any]
    #expect(end?["audioStreamEnd"] as? Bool == true)
}

@Test("Barge-in flushes generations; utterance end never clears background work")
func interruptionAndBackgroundWork() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["serverContent": ["modelTurn": ["parts": [[
        "inlineData": ["mimeType": "audio/pcm;rate=24000", "data": Data([7, 7]).base64EncodedString()],
    ]]]]])
    guard case .assistantAudio(let chunk)? = try await iterator.next() else { Issue.record("audio"); return }
    #expect(chunk.format.sampleRate == 24000)
    #expect(chunk.generation == 0)
    await socket.push(["serverContent": ["interrupted": true]])
    #expect(try await iterator.next() == .interrupted(generation: 1))
    // turnComplete ends the utterance only; interactionStatus is authoritative
    // for background work, in either wire placement.
    await socket.push(["serverContent": ["turnComplete": true, "interactionStatus": "IN_PROGRESS"]])
    #expect(try await iterator.next() == .interactionStatus(.inProgress))
    #expect(try await iterator.next() == .turnComplete)
    await socket.push(["interactionStatus": "IDLE"])
    #expect(try await iterator.next() == .interactionStatus(.idle))
    // The read loop keeps consuming tool traffic after turnComplete.
    await socket.push(["toolCall": ["functionCalls": [["id": "f1", "name": "lights_on", "args": [:] as [String: Any]]]]])
    guard case .toolCall(let call)? = try await iterator.next() else { Issue.record("call"); return }
    #expect(call.id == "f1")
}

@Test("Tool results echo IDs; scheduling serializes on base and is refused on extended thinking")
func toolResults() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["toolCall": ["functionCalls": [["id": "f1", "name": "lights_on", "args": [:] as [String: Any]]]]])
    _ = try await iterator.next() // toolCall
    try await session.send(toolResult: .init(callID: "f1", name: "lights_on",
                                             output: .success(Data(#"{"result":"ok"}"#.utf8)),
                                             scheduling: .interrupt))
    await socket.waitForSent(count: 2)
    let response = ((await socket.sentMessages()[1]["toolResponse"] as? [String: Any])?[
        "functionResponses"] as? [[String: Any]])?.first
    #expect(response?["id"] as? String == "f1")
    #expect(response?["name"] as? String == "lights_on")
    let payload = response?["response"] as? [String: Any]
    #expect(payload?["result"] as? String == "ok")
    #expect(payload?["scheduling"] as? String == "INTERRUPT")

    let (extendedSocket, extended) = makeSession(model: "gemini-3.8-live-extended-thinking")
    await extendedSocket.push(["setupComplete": [:] as [String: Any]])
    try await extended.start()
    await extendedSocket.push(["toolCall": ["functionCalls": [["id": "f2", "name": "lookup", "args": [:] as [String: Any]]]]])
    var extendedIterator = extended.events.makeAsyncIterator()
    _ = try await extendedIterator.next() // ready
    _ = try await extendedIterator.next() // toolCall
    await #expect(throws: HudConversationError.self) {
        try await extended.send(toolResult: .init(callID: "f2", name: "lookup",
                                                  output: .success(Data("{}".utf8)), scheduling: .silent))
    }
    // The invalid result did not consume the pending call.
    try await extended.send(toolResult: .init(callID: "f2", name: "lookup",
                                              output: .success(Data("{}".utf8))))
}

@Test("Cancelled and duplicate calls cannot produce fresh results")
func cancellationAndDuplicates() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["toolCall": ["functionCalls": [["id": "f1", "name": "lights_on", "args": [:] as [String: Any]]]]])
    _ = try await iterator.next() // toolCall
    await socket.push(["toolCallCancellation": ["ids": ["f1"]]])
    #expect(try await iterator.next() == .toolCallsCancelled(["f1"]))
    await #expect(throws: HudConversationError.unknownToolCall("f1")) {
        try await session.send(toolResult: .init(callID: "f1", name: "lights_on",
                                                 output: .success(Data("{}".utf8))))
    }
    // A repeated announcement of the same call is not re-dispatched.
    await socket.push(["toolCall": ["functionCalls": [["id": "f1", "name": "lights_on", "args": [:] as [String: Any]]]]])
    await socket.push(["serverContent": ["turnComplete": true]])
    #expect(try await iterator.next() == .turnComplete)
    // Wrong name for a pending call is rejected without consuming it.
    await socket.push(["toolCall": ["functionCalls": [["id": "f3", "name": "lights_on", "args": [:] as [String: Any]]]]])
    _ = try await iterator.next()
    await #expect(throws: HudConversationError.unknownToolCall("f3")) {
        try await session.send(toolResult: .init(callID: "f3", name: "other",
                                                 output: .success(Data("{}".utf8))))
    }
    try await session.send(toolResult: .init(callID: "f3", name: "lights_on",
                                             output: .success(Data("{}".utf8))))
}

@Test("goAway and provider errors end the stream with fixed copy")
func terminalMessages() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["goAway": [:] as [String: Any]])
    await #expect(throws: HudConversationError.providerError("The provider is ending the session.")) {
        _ = try await iterator.next()
    }
}

@Test("Close emits one terminal event and closes the transport")
func closeLifecycle() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    async let first: Void = session.close()
    async let second: Void = session.close()
    _ = await (first, second)
    #expect(try await iterator.next() == .closed(nil))
    #expect(try await iterator.next() == nil)
    #expect(await socket.wasClosed())
}

@Test("Setup timeout is bounded and fails the stream")
func setupTimeout() async throws {
    let (_, session) = makeSession(setupTimeout: 100_000_000)
    await #expect(throws: HudConversationError.self) { try await session.start() }
}

@Test("Discovery follows pagination, deduplicates, and claims only documented capabilities")
func discoveryPagination() async throws {
    let pages = RequestBox()
    let adapter = HudGeminiConversationAdapter(
        credentials: FixtureCredentials(value: "key"),
        http: { request in
            await pages.append(request)
            let token = request.url?.query?.contains("pageToken=page2") == true
            let secondPage: [String: Any] = ["models": [
                ["name": "models/gemini-3.8-live", "supportedGenerationMethods": ["bidiGenerateContent"]],
                ["name": "models/gemini-next-live-preview", "supportedGenerationMethods": ["bidiGenerateContent"]],
            ]]
            let firstPage: [String: Any] = [
                "models": [["name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]]],
                "nextPageToken": "page2",
            ]
            return (try JSONSerialization.data(withJSONObject: token ? secondPage : firstPage), 200)
        })
    let models = try await adapter.models(configuration: configuration())
    #expect(await pages.all.count == 2)
    #expect(models.map(\.id.rawValue) == ["gemini-3.8-live", "gemini-next-live-preview"])
    #expect(models[0].toolCalling == .supported)
    // Discovery alone does not establish capabilities for unfamiliar models.
    #expect(models[1].toolCalling == .unknown)
    #expect(models[1].configurableThinking == .unknown)
    #expect(models[1].notes == nil)

    await #expect(throws: HudConversationError.self) {
        _ = try await adapter.models(configuration: configuration(kind: .ephemeralToken))
    }
}

private actor RequestBox {
    private(set) var all: [URLRequest] = []
    func append(_ request: URLRequest) { all.append(request) }
}

@Test("Malformed Gemini tool arguments never become an executable empty call")
func malformedWireArguments() async throws {
    let (socket, session) = makeSession()
    await socket.push(["setupComplete": [:] as [String: Any]])
    try await session.start()
    var events = session.events.makeAsyncIterator()
    _ = try await events.next()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("effect") { _ in
        Issue.record("Malformed arguments reached the handler")
        return Data()
    }
    for (index, arguments) in (["bad", NSNull(), [1, 2]] as [Any]).enumerated() {
        await socket.push(["toolCall": ["functionCalls": [["id": "bad-\(index)", "name": "effect", "args": arguments]]]])
        guard case .toolCall(let call)? = try await events.next() else {
            Issue.record("Missing correlated tool call"); return
        }
        let result = await dispatcher.dispatch(call)
        #expect(result.output == .failure("Tool arguments were not a JSON object."))
    }
    await session.close()
}
