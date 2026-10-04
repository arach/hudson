import Foundation
import Testing
import HudsonConversation
@testable import HudsonConversationOpenAI

private func configuration(options: [String: String] = [:]) -> HudConversationConfiguration {
    .init(providerID: HudGPTLiveAdapter.providerID, modelID: "gpt-live-1",
          instructions: "Be brief.", voice: "alloy", inputAudio: .pcm24k,
          credentialReference: .init(identifier: "openai-key"), options: options)
}

private func makeSession(
    tools: [HudConversationToolDeclaration] = [],
    options: [String: String] = [:],
    setupTimeout: UInt64 = 2_000_000_000,
    closeTimeout: UInt64 = 200_000_000
) throws -> (FixtureSocket, HudGPTLiveSession) {
    let socket = FixtureSocket()
    let config = configuration(options: options)
    let delegation = try HudGPTLiveSession.delegationConfiguration(configuration: config, tools: tools)
    let session = HudGPTLiveSession(socket: socket, configuration: config, tools: tools,
                                    delegation: delegation,
                                    setupTimeout: setupTimeout, closeTimeout: closeTimeout)
    return (socket, session)
}

private func startedMessage(id: String = "live_1") -> [String: Any] {
    ["type": "session.started", "session": ["id": id]]
}

@Test("session.start carries model, single audio format, output voice, and merged tools")
func startHandshake() async throws {
    let tool = HudConversationToolDeclaration(name: "weather", description: "Weather lookup")
    let (socket, session) = try makeSession(tools: [tool], options: ["delegationModel": "gpt-5.2"])
    await socket.push(startedMessage())
    try await session.start()
    let start = await socket.sentMessages()[0]
    #expect(start["type"] as? String == "session.start")
    let body = start["session"] as? [String: Any]
    #expect(body?["model"] as? String == "gpt-live-1")
    let audio = body?["audio"] as? [String: Any]
    #expect((audio?["format"] as? [String: Any])?["rate"] as? Int == 24000)
    #expect(((audio?["output"] as? [String: Any])?["voice"] as? String) == "alloy")
    let delegation = body?["delegation"] as? [String: Any]
    #expect(delegation?["type"] as? String == "responses")
    let responses = delegation?["responses"] as? [String: Any]
    #expect(responses?["model"] as? String == "gpt-5.2")
    #expect((responses?["tools"] as? [[String: Any]])?.first?["name"] as? String == "weather")
    var iterator = session.events.makeAsyncIterator()
    #expect(try await iterator.next() == .ready(sessionID: "live_1"))
}

@Test("Declared tools without a backend model are rejected before any socket exists")
func toolsRequireBackendModel() {
    #expect(throws: HudConversationError.self) {
        _ = try HudGPTLiveSession.delegationConfiguration(
            configuration: configuration(),
            tools: [HudConversationToolDeclaration(name: "weather")])
    }
}

@Test("Authored delegation must parse, carry its backend model, and keep its own tools")
func authoredDelegationRules() throws {
    #expect(throws: HudConversationError.self) {
        _ = try HudGPTLiveSession.delegationConfiguration(
            configuration: configuration(options: ["delegation": "not json"]), tools: [])
    }
    #expect(throws: HudConversationError.self) {
        _ = try HudGPTLiveSession.delegationConfiguration(
            configuration: configuration(options: ["delegation": #"{"type":"responses","responses":{}}"#]),
            tools: [])
    }
    // Authored tools plus declared tools is a conflict, not an overwrite.
    #expect(throws: HudConversationError.self) {
        _ = try HudGPTLiveSession.delegationConfiguration(
            configuration: configuration(options: [
                "delegation": #"{"type":"responses","responses":{"model":"gpt-5.2","tools":[{"type":"web_search"}]}}"#,
            ]),
            tools: [HudConversationToolDeclaration(name: "weather")])
    }
    // Authored non-function tools survive untouched when no tools are declared.
    let kept = try HudGPTLiveSession.delegationConfiguration(
        configuration: configuration(options: [
            "delegation": #"{"type":"responses","responses":{"model":"gpt-5.2","tools":[{"type":"web_search"}]}}"#,
        ]), tools: [])
    let tools = ((kept?["responses"] as? [String: Any])?["tools"] as? [[String: Any]])
    #expect(tools?.first?["type"] as? String == "web_search")
}

@Test("Input and commands are rejected before session.started")
func notStartedRejection() async throws {
    let (_, session) = try makeSession()
    await #expect(throws: HudConversationError.notStarted) {
        try await session.send(audio: Data([0, 0]))
    }
    await #expect(throws: HudConversationError.notStarted) {
        try await session.appendInstruction("hello")
    }
}

@Test("Setup times out with a bounded window and a failed stream")
func setupTimeout() async throws {
    let (_, session) = try makeSession(setupTimeout: 100_000_000)
    await #expect(throws: HudConversationError.setupRejected("The provider did not acknowledge the session in time.")) {
        try await session.start()
    }
    var iterator = session.events.makeAsyncIterator()
    await #expect(throws: HudConversationError.self) { _ = try await iterator.next() }
}

@Test("Audio appends are base64 PCM16; odd-length chunks are rejected")
func audioAppend() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    try await session.send(audio: Data([1, 2, 3, 4]))
    await socket.waitForSent(count: 2)
    let append = await socket.sentMessages()[1]
    #expect(append["type"] as? String == "session.input_audio.append")
    #expect(append["audio"] as? String == Data([1, 2, 3, 4]).base64EncodedString())
    await #expect(throws: HudConversationError.invalidAudioChunk) {
        try await session.send(audio: Data([1]))
    }
}

@Test("Output audio carries generations; local barge-in invalidates queued speech only")
func outputAudioAndInterruption() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["type": "session.output_audio.delta", "delta": Data([9, 9]).base64EncodedString()])
    guard case .assistantAudio(let first)? = try await iterator.next() else {
        Issue.record("Expected audio"); return
    }
    #expect(first.generation == 0)
    #expect(first.format.sampleRate == 24000)
    let generation = await session.interruptPlayback()
    #expect(generation == 1)
    await socket.push(["type": "session.output_audio.delta", "delta": Data([8, 8]).base64EncodedString()])
    guard case .assistantAudio(let second)? = try await iterator.next() else {
        Issue.record("Expected audio"); return
    }
    #expect(second.generation == 1)
    // Nothing was sent to the provider for the local interruption.
    let types = await socket.sentMessages().compactMap { $0["type"] as? String }
    #expect(!types.contains { $0.contains("cancel") })
}

@Test("Instruction appends use content with an explicit null delegation id")
func instructionAppend() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    try await session.appendInstruction("Wrap up.")
    await socket.waitForSent(count: 2)
    let append = await socket.sentMessages()[1]
    #expect(append["type"] as? String == "session.instructions.append")
    #expect(append["content"] as? String == "Wrap up.")
    #expect(append["delegation_id"] is NSNull)
}

@Test("Responses delegation: all outputs return before one response.create, across rounds")
func responsesDelegationRounds() async throws {
    let tool = HudConversationToolDeclaration(name: "weather")
    let (socket, session) = try makeSession(tools: [tool], options: ["delegationModel": "gpt-5.2"])
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready

    func pushCall(_ callID: String, delegation: String) async {
        await socket.push(["type": "response.event", "delegation_id": delegation,
                           "event": ["type": "response.output_item.done",
                                     "item": ["type": "function_call", "call_id": callID,
                                              "name": "weather", "arguments": "{}"]]])
    }
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.created", "response": ["id": "r1"]]])
    await pushCall("c1", delegation: "d1")
    await pushCall("c2", delegation: "d1")
    _ = try await iterator.next() // delegationStarted
    guard case .toolCall(let firstCall)? = try await iterator.next() else { Issue.record("call"); return }
    #expect(firstCall.id == "c1")
    _ = try await iterator.next() // second toolCall

    // First result: output only. No continuation while c2 is outstanding.
    try await session.send(toolResult: .init(callID: "c1", name: "weather",
                                             output: .success(Data("{}".utf8)), delegationID: "d1"))
    await socket.waitForSent(count: 2)
    var types = await socket.sentMessages().compactMap { $0["type"] as? String }
    #expect(types.filter { $0 == "response.create" }.isEmpty)
    let itemCreate = await socket.sentMessages()[1]
    #expect(itemCreate["delegation_id"] == nil)

    // Boundary next; continuation still waits for c2.
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.completed", "response": ["id": "r1"]]])
    try await session.send(toolResult: .init(callID: "c2", name: "weather",
                                             output: .failure("No data."), delegationID: "d1"))
    await socket.waitForSent(count: 4)
    types = await socket.sentMessages().compactMap { $0["type"] as? String }
    #expect(types.filter { $0 == "response.create" }.count == 1)

    // Round two on the same delegation must continue again.
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.created", "response": ["id": "r2"]]])
    await pushCall("c3", delegation: "d1")
    guard case .toolCall(let thirdCall)? = try await iterator.next() else { Issue.record("call"); return }
    #expect(thirdCall.id == "c3")
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.completed", "response": ["id": "r2"]]])
    try await session.send(toolResult: .init(callID: "c3", name: "weather",
                                             output: .success(Data("{}".utf8)), delegationID: "d1"))
    await socket.waitForSent(count: 6)
    types = await socket.sentMessages().compactMap { $0["type"] as? String }
    #expect(types.filter { $0 == "response.create" }.count == 2)
}

@Test("A fast single result before the boundary continues only at the boundary")
func fastResultThenBoundary() async throws {
    let tool = HudConversationToolDeclaration(name: "weather")
    let (socket, session) = try makeSession(tools: [tool], options: ["delegationModel": "gpt-5.2"])
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.created", "response": ["id": "r1"]]])
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.output_item.done",
                                 "item": ["type": "function_call", "call_id": "c1",
                                          "name": "weather", "arguments": "{}"]]])
    _ = try await iterator.next() // delegationStarted
    _ = try await iterator.next() // toolCall
    try await session.send(toolResult: .init(callID: "c1", name: "weather",
                                             output: .success(Data("{}".utf8)), delegationID: "d1"))
    await socket.waitForSent(count: 2)
    var types = await socket.sentMessages().compactMap { $0["type"] as? String }
    #expect(!types.contains("response.create"))
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.completed", "response": ["id": "r1"]]])
    await socket.waitForSent(count: 3)
    types = await socket.sentMessages().compactMap { $0["type"] as? String }
    #expect(types.filter { $0 == "response.create" }.count == 1)
}

@Test("Duplicate created and duplicate calls are idempotent; unknown results are rejected")
func duplicateAndUnknownHandling() async throws {
    let tool = HudConversationToolDeclaration(name: "weather")
    let (socket, session) = try makeSession(tools: [tool], options: ["delegationModel": "gpt-5.2"])
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.created", "response": ["id": "r1"]]])
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.output_item.done",
                                 "item": ["type": "function_call", "call_id": "c1",
                                          "name": "weather", "arguments": "{}"]]])
    _ = try await iterator.next() // delegationStarted
    _ = try await iterator.next() // toolCall c1
    // Duplicate created for the same response must not reset pending calls.
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.created", "response": ["id": "r1"]]])
    // Duplicate call delivery must not re-announce.
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.output_item.done",
                                 "item": ["type": "function_call", "call_id": "c1",
                                          "name": "weather", "arguments": "{}"]]])
    try await session.send(toolResult: .init(callID: "c1", name: "weather",
                                             output: .success(Data("{}".utf8)), delegationID: "d1"))
    await #expect(throws: HudConversationError.unknownToolCall("c9")) {
        try await session.send(toolResult: .init(callID: "c9", name: "weather",
                                                 output: .success(Data("{}".utf8)), delegationID: "d1"))
    }
}

@Test("Client delegation announces an opaque ID and results return as commentary")
func clientDelegation() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["type": "session.delegation.created",
                       "delegation": ["id": "d7", "type": "task", "target": "client"]])
    #expect(try await iterator.next() == .delegationStarted(.init(id: "d7", target: .client)))
    try await session.send(toolResult: .init(callID: "d7", name: "commentary",
                                             output: .success(Data("Found it.".utf8)), delegationID: "d7"))
    await socket.waitForSent(count: 2)
    let commentary = await socket.sentMessages()[1]
    #expect(commentary["type"] as? String == "session.commentary.append")
    #expect(commentary["content"] as? String == "Found it.")
    #expect(commentary["delegation_id"] as? String == "d7")
}

@Test("Graceful close waits for session.closed and reports cumulative usage")
func closeGraceful() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    let closer = Task { await session.close() }
    await socket.waitForSent(count: 2)
    await socket.push(["type": "session.closed", "usage": ["voice_seconds": 12.5]])
    await closer.value
    #expect(try await iterator.next() == .closed(.init(detail: ["voice_seconds": 12.5])))
    #expect(try await iterator.next() == nil)
    #expect(await socket.wasClosed())
}

@Test("Close is idempotent and an unconfirmed close fails the stream, not silence")
func closeUnconfirmed() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    async let first: Void = session.close()
    async let second: Void = session.close()
    _ = await (first, second)
    let closeSends = await socket.sentMessages().filter { $0["type"] as? String == "session.close" }
    #expect(closeSends.count == 1)
    await #expect(throws: HudConversationError.closeUnconfirmed) { _ = try await iterator.next() }
}

@Test("Provider errors surface as fixed copy, never raw payload text")
func providerErrorSanitized() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    var iterator = session.events.makeAsyncIterator()
    _ = try await iterator.next() // ready
    await socket.push(["type": "error", "error": ["message": "secret internal detail"]])
    await #expect(throws: HudConversationError.providerError("The provider reported an error.")) {
        _ = try await iterator.next()
    }
}

@Test("Readiness reports credential state; browser-style credentials are refused")
func adapterReadiness() async throws {
    let adapter = HudGPTLiveAdapter(credentials: FixtureCredentials(value: nil))
    var config = configuration()
    #expect(try await adapter.readiness(configuration: config).status == .needsCredential)
    let withKey = HudGPTLiveAdapter(credentials: FixtureCredentials(value: "sk-test"))
    #expect(try await withKey.readiness(configuration: config).status == .ready)
    config.credentialKind = .ephemeralToken
    #expect(try await withKey.readiness(configuration: config).status == .unavailable)
    config.credentialKind = .apiKey
    config.inputAudio = .init(sampleRate: 8000)
    #expect(try await withKey.readiness(configuration: config).status == .unavailable)
}

@Test("Model discovery filters the account list and fails loudly on errors")
func modelDiscovery() async throws {
    let adapter = HudGPTLiveAdapter(
        credentials: FixtureCredentials(value: "sk-test"),
        http: { request in
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer sk-test")
            let body: [String: Any] = ["data": [["id": "gpt-live-1"], ["id": "gpt-live-transcribe"], ["id": "gpt-5.2"]]]
            return (try JSONSerialization.data(withJSONObject: body), 200)
        })
    let models = try await adapter.models(configuration: configuration())
    #expect(models.map(\.id.rawValue) == ["gpt-live-1"])
    let failing = HudGPTLiveAdapter(
        credentials: FixtureCredentials(value: "sk-test"),
        http: { _ in (Data(), 500) })
    await #expect(throws: HudConversationError.self) {
        _ = try await failing.models(configuration: configuration())
    }
}

@Test("Malformed GPT-Live function arguments never become an executable empty call")
func malformedWireArguments() async throws {
    let (socket, session) = try makeSession()
    await socket.push(startedMessage())
    try await session.start()
    var events = session.events.makeAsyncIterator()
    _ = try await events.next()
    await socket.push(["type": "response.event", "delegation_id": "d1",
                       "event": ["type": "response.created", "response": ["id": "r1"]]])
    _ = try await events.next()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("effect") { _ in
        Issue.record("Malformed arguments reached the handler")
        return Data()
    }
    for (index, arguments) in (["broken-json", NSNull(), ["wrong": "shape"]] as [Any]).enumerated() {
        await socket.push(["type": "response.event", "delegation_id": "d1",
                           "event": ["type": "response.output_item.done",
                                     "item": ["type": "function_call", "call_id": "bad-\(index)",
                                              "name": "effect", "arguments": arguments]]])
        guard case .toolCall(let call)? = try await events.next() else {
            Issue.record("Missing correlated tool call"); return
        }
        let result = await dispatcher.dispatch(call)
        #expect(result.output == .failure("Tool arguments were not a JSON object."))
    }
    await socket.push(["type": "session.closed"])
    await session.close()
}
