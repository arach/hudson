import Foundation
import Testing
import HudsonConversation
@testable import HudsonConversationHost

// MARK: - Fakes

private actor FakeSession: HudConversationSession {
    nonisolated let events: AsyncThrowingStream<HudConversationEvent, Error>
    private let continuation: AsyncThrowingStream<HudConversationEvent, Error>.Continuation
    private(set) var sentAudio: [Data] = []
    private(set) var toolResults: [HudConversationToolResult] = []
    private(set) var finished = false
    private(set) var closedCount = 0
    private(set) var generation: UInt64 = 0
    var failSends = false
    var failToolSends = false

    init() {
        (events, continuation) = AsyncThrowingStream<HudConversationEvent, Error>.makeStream()
    }

    func emit(_ event: HudConversationEvent) { continuation.yield(event) }
    func setFailSends() { failSends = true }
    func setFailToolSends() { failToolSends = true }

    func send(audio: Data) throws {
        if failSends { throw HudConversationError.connectionFailed }
        sentAudio.append(audio)
    }
    func finishAudio() { finished = true }
    func appendInstruction(_ text: String) {}
    func interruptPlayback() -> UInt64 {
        generation += 1
        return generation
    }
    func send(toolResult: HudConversationToolResult) throws {
        if failToolSends { throw HudConversationError.connectionFailed }
        toolResults.append(toolResult)
    }
    func close() {
        closedCount += 1
        continuation.yield(.closed(nil))
        continuation.finish()
    }
}

private final class FakeAdapter: HudConversationAdapter, @unchecked Sendable {
    let descriptor = HudConversationProviderDescriptor(id: "fake", displayName: "Fake", adapterVersion: "0")
    let session: FakeSession
    let openGate: Gate?
    init(session: FakeSession, openGate: Gate? = nil) {
        self.session = session
        self.openGate = openGate
    }
    func models(configuration: HudConversationConfiguration) async throws -> [HudConversationModelDescriptor] { [] }
    func readiness(configuration: HudConversationConfiguration) async throws -> HudConversationReadiness {
        .init(status: .ready)
    }
    func open(configuration: HudConversationConfiguration,
              tools: [HudConversationToolDeclaration]) async throws -> any HudConversationSession {
        if let openGate { await openGate.wait() }
        return session
    }
}

private actor FakeInput: HudConversationAudioInput {
    private var continuation: AsyncStream<Data>.Continuation?
    private(set) var stopped = false
    private let initialChunks: [Data]
    init(initialChunks: [Data] = []) { self.initialChunks = initialChunks }

    func start(format: HudConversationAudioFormat) throws -> AsyncStream<Data> {
        let (stream, continuation) = AsyncStream<Data>.makeStream()
        self.continuation = continuation
        for chunk in initialChunks { continuation.yield(chunk) }
        return stream
    }
    func stop() {
        stopped = true
        continuation?.finish()
        continuation = nil
    }
}

private actor FakeOutput: HudConversationAudioOutput {
    private(set) var played: [HudConversationAudioChunk] = []
    private(set) var flushes: [UInt64] = []
    private(set) var stopped = false
    var startError: Error?
    var playError: Error?
    func setStartError(_ error: Error) { startError = error }
    func setPlayError(_ error: Error) { playError = error }

    func start() throws { if let startError { throw startError } }
    func play(_ chunk: HudConversationAudioChunk) throws {
        if let playError { throw playError }
        played.append(chunk)
    }
    func flush(to generation: UInt64) { flushes.append(generation) }
    func stop() { stopped = true }
}

actor Gate {
    private var opened = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if opened { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func open() {
        opened = true
        for waiter in waiters { waiter.resume() }
        waiters = []
    }
}

private func makeHost(
    session: FakeSession, adapter: FakeAdapter? = nil,
    dispatcher: HudConversationToolDispatcher = HudConversationToolDispatcher(),
    input: FakeInput = FakeInput(), output: FakeOutput = FakeOutput()
) -> HudConversationHostSession {
    HudConversationHostSession(
        adapter: adapter ?? FakeAdapter(session: session),
        configuration: .init(providerID: "fake", modelID: "fake-model"),
        dispatcher: dispatcher, tools: [],
        microphone: input, speaker: output)
}

// MARK: - Tests

@Test("A full run pumps microphone audio, plays speech, and tears down cleanly")
func fullLifecycle() async throws {
    let session = FakeSession()
    let input = FakeInput(initialChunks: [Data([1, 1])])
    let output = FakeOutput()
    let host = makeHost(session: session, input: input, output: output)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: "s1"))
    await session.emit(.assistantAudio(.init(data: Data([2, 2]), format: .pcm24k, generation: 0, sequence: 1)))
    // Wait until the mic chunk reached the session, then end it.
    while await session.sentAudio.isEmpty { try await Task.sleep(nanoseconds: 5_000_000) }
    await session.close()
    try await run.value
    #expect(await output.played.count == 1)
    #expect(await session.sentAudio == [Data([1, 1])])
    #expect(await input.stopped)
    #expect(await output.stopped)
}

@Test("A host session is single-use; a second run is rejected")
func singleUse() async throws {
    let session = FakeSession()
    let host = makeHost(session: session)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: nil))
    await session.close()
    try await run.value
    await #expect(throws: HudConversationError.self) { try await host.run() }
}

@Test("Stop during opening closes the session as soon as it exists")
func stopDuringOpening() async throws {
    let session = FakeSession()
    let gate = Gate()
    let adapter = FakeAdapter(session: session, openGate: gate)
    let input = FakeInput()
    let host = makeHost(session: session, adapter: adapter, input: input)
    let run = Task { try await host.run() }
    try await Task.sleep(nanoseconds: 20_000_000)
    let stopper = Task { await host.stop() }
    try await Task.sleep(nanoseconds: 20_000_000)
    await gate.open()
    try await run.value
    await stopper.value
    #expect(await session.closedCount >= 1)
    // Capture never started after the aborted open.
    #expect(await session.sentAudio.isEmpty)
}

@Test("A speaker that cannot start aborts the run and closes the session")
func speakerStartFailureCleansUp() async throws {
    let session = FakeSession()
    let output = FakeOutput()
    await output.setStartError(HudConversationError.invalidConfiguration("no device"))
    let input = FakeInput()
    let host = makeHost(session: session, input: input, output: output)
    await #expect(throws: HudConversationError.self) { try await host.run() }
    #expect(await session.closedCount >= 1)
    #expect(await input.stopped)
}

@Test("A failing microphone pump closes the session and surfaces the failure")
func pumpFailurePropagates() async throws {
    let session = FakeSession()
    await session.setFailSends()
    let input = FakeInput(initialChunks: [Data([1, 1])])
    let host = makeHost(session: session, input: input)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: nil))
    await #expect(throws: HudConversationError.connectionFailed) { try await run.value }
    #expect(await session.closedCount >= 1)
}

@Test("Playback failure ends the run instead of leaving a silent live session")
func playbackFailurePropagates() async throws {
    let session = FakeSession()
    let output = FakeOutput()
    await output.setPlayError(HudConversationError.invalidAudioChunk)
    let host = makeHost(session: session, output: output)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: nil))
    await session.emit(.assistantAudio(.init(data: Data([2, 2]), format: .pcm24k, generation: 0, sequence: 1)))
    await #expect(throws: HudConversationError.invalidAudioChunk) { try await run.value }
    #expect(await session.closedCount >= 1)
}

@Test("Barge-in flushes the speaker to the session generation and touches no tools")
func bargeIn() async throws {
    let session = FakeSession()
    let output = FakeOutput()
    let host = makeHost(session: session, output: output)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: nil))
    while await session.generation == 0 {
        await host.userInterrupted()
    }
    #expect(await output.flushes.contains(1))
    await session.emit(.interrupted(generation: 2))
    while await output.flushes.contains(2) == false { try await Task.sleep(nanoseconds: 5_000_000) }
    await session.close()
    try await run.value
}

@Test("Tool calls dispatch once, results return, and duplicates are ignored")
func toolDispatch() async throws {
    let session = FakeSession()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in Data(#"{"ok":true}"#.utf8) }
    let host = makeHost(session: session, dispatcher: dispatcher)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: nil))
    let call = HudConversationToolCall(id: "c1", name: "lookup", argumentsJSON: Data("{}".utf8))
    await session.emit(.toolCall(call))
    await session.emit(.toolCall(call))
    while await session.toolResults.isEmpty { try await Task.sleep(nanoseconds: 5_000_000) }
    try await Task.sleep(nanoseconds: 50_000_000)
    #expect(await session.toolResults.count == 1)
    #expect(await session.toolResults[0].output == .success(Data(#"{"ok":true}"#.utf8)))
    await session.close()
    try await run.value
}

@Test("Teardown cancels dispatch for calls still awaiting authorization")
func teardownCancelsPendingAuthorization() async throws {
    let session = FakeSession()
    let gate = Gate()
    let counter = EffectCounter()
    let dispatcher = HudConversationToolDispatcher(authorize: { _ in
        await gate.wait()
        return true
    })
    await dispatcher.register("lookup") { _ in
        await counter.increment()
        return Data()
    }
    let host = makeHost(session: session, dispatcher: dispatcher)
    let run = Task { try await host.run() }
    await session.emit(.ready(sessionID: nil))
    await session.emit(.toolCall(.init(id: "c1", name: "lookup", argumentsJSON: Data("{}".utf8))))
    try await Task.sleep(nanoseconds: 30_000_000)
    await session.close()
    try await run.value
    await gate.open()
    try await Task.sleep(nanoseconds: 30_000_000)
    // Authorization resolved after teardown; the effect must not run.
    #expect(await counter.value == 0)
}

private actor EffectCounter {
    private(set) var value = 0
    func increment() { value += 1 }
}

@Test("The speaker rejects malformed PCM before any state or engine work")
func speakerRejectsMalformedPCM() async throws {
    // Deliberately not started: the malformed-data rejection precedes every
    // other check, so no audio engine is touched in this headless test.
    let speaker = HudConversationSpeaker()
    await #expect(throws: HudConversationError.invalidAudioChunk) {
        try await speaker.play(.init(data: Data([1]), format: .pcm24k, generation: 0, sequence: 1))
    }
    await #expect(throws: HudConversationError.invalidAudioChunk) {
        try await speaker.play(.init(data: Data(), format: .pcm24k, generation: 0, sequence: 1))
    }
}

@Test("Tool-result transport failure closes the host run and surfaces the error")
func toolTransportFailurePropagates() async throws {
    let session = FakeSession()
    await session.setFailToolSends()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in Data("{}".utf8) }
    let input = FakeInput()
    let output = FakeOutput()
    let host = makeHost(session: session, dispatcher: dispatcher, input: input, output: output)
    let run = Task { try await host.run() }
    await session.emit(.toolCall(.init(id: "failure", name: "lookup", argumentsJSON: Data("{}".utf8))))
    await #expect(throws: HudConversationError.connectionFailed) { try await run.value }
    #expect(await session.closedCount >= 1)
    #expect(await input.stopped)
    #expect(await output.stopped)
}

@Test("Cancelling the run while consuming events closes resources and reports cancellation")
func runningCancellationPropagates() async throws {
    let session = FakeSession()
    let input = FakeInput(initialChunks: [Data([1, 1])])
    let output = FakeOutput()
    let host = makeHost(session: session, input: input, output: output)
    let run = Task { try await host.run() }
    for _ in 0..<200 {
        if await !session.sentAudio.isEmpty { break }
        try await Task.sleep(for: .milliseconds(5))
    }
    #expect(await !session.sentAudio.isEmpty)
    run.cancel()
    await #expect(throws: CancellationError.self) { try await run.value }
    #expect(await session.closedCount >= 1)
    #expect(await input.stopped)
    #expect(await output.stopped)
}
