import Foundation
import HudsonConversation

/// Complete host wiring for one spoken conversation: microphone in, assistant
/// speech out, local tools dispatched with host authorization, and distinct
/// barge-in effects. This is a working caller, usable as-is by a macOS or iOS
/// host that owns microphone permission and credential storage. Audio devices
/// are injectable so the full lifecycle is fixture-testable.
///
/// One instance runs one conversation, once. That scoping keeps the tool
/// dispatcher's call-ID history aligned with a single provider session; a new
/// conversation gets a new host session and dispatcher.
public actor HudConversationHostSession {
    public struct Transcripts: Sendable {
        public var onUserDelta: @Sendable (String) -> Void
        public var onAssistantDelta: @Sendable (String) -> Void
        public init(onUserDelta: @escaping @Sendable (String) -> Void = { _ in },
                    onAssistantDelta: @escaping @Sendable (String) -> Void = { _ in }) {
            self.onUserDelta = onUserDelta
            self.onAssistantDelta = onAssistantDelta
        }
    }

    private enum Phase { case idle, opening, running, finished }
    private struct StopSignal: Error {}

    private let adapter: any HudConversationAdapter
    private let configuration: HudConversationConfiguration
    private let dispatcher: HudConversationToolDispatcher
    private let tools: [HudConversationToolDeclaration]
    private let transcripts: Transcripts
    private let microphone: any HudConversationAudioInput
    private let speaker: any HudConversationAudioOutput
    private var phase: Phase = .idle
    private var stopRequested = false
    private var session: (any HudConversationSession)?
    private var pump: Task<Void, Never>?
    private var backgroundFailure: Error?
    private var toolTasks: [String: Task<Void, Never>] = [:]
    private var handledCalls: Set<String> = []

    public init(adapter: any HudConversationAdapter,
                configuration: HudConversationConfiguration,
                dispatcher: HudConversationToolDispatcher,
                tools: [HudConversationToolDeclaration],
                transcripts: Transcripts = Transcripts(),
                microphone: (any HudConversationAudioInput)? = nil,
                speaker: (any HudConversationAudioOutput)? = nil) {
        self.adapter = adapter
        self.configuration = configuration
        self.dispatcher = dispatcher
        self.tools = tools
        self.transcripts = transcripts
        self.microphone = microphone ?? HudConversationMicrophone()
        self.speaker = speaker ?? HudConversationSpeaker()
    }

    /// Open the session, start capture and playback, and process events until
    /// the session ends. Single use: a second call fails. `stop()` or task
    /// cancellation during any await aborts promptly, and cleanup is awaited
    /// before this method returns on every path.
    public func run() async throws {
        guard phase == .idle else {
            throw HudConversationError.invalidConfiguration(
                "This host session already ran; create a new one per conversation.")
        }
        phase = .opening
        do {
            let session = try await adapter.open(configuration: configuration, tools: tools)
            self.session = session
            try checkAbort()
            try await speaker.start()
            try checkAbort()
            let audioIn = try await microphone.start(format: configuration.inputAudio)
            try checkAbort()
            phase = .running
            pump = Task {
                for await chunk in audioIn {
                    do { try await session.send(audio: chunk) }
                    catch {
                        // A dead input path must not leave the session hanging
                        // with a live socket and no microphone; the failure is
                        // kept and rethrown from run().
                        self.recordBackgroundFailure(error)
                        await session.close()
                        break
                    }
                }
            }
            try await consume(session)
            try checkAbort()
            await teardown()
            if let backgroundFailure { throw backgroundFailure }
        } catch is StopSignal {
            await teardown()
        } catch {
            await teardown()
            throw error
        }
    }

    /// User barge-in: stop local playback immediately. The provider keeps its
    /// own turn handling, and tool or delegated work is deliberately left alone.
    public func userInterrupted() async {
        guard let session else { return }
        let generation = await session.interruptPlayback()
        await speaker.flush(to: generation)
    }

    /// End the user's audio and close gracefully. Safe during opening: the
    /// running `run()` aborts at its next checkpoint and the session closes.
    public func stop() async {
        stopRequested = true
        guard let session else { return }
        await microphone.stop()
        pump?.cancel()
        try? await session.finishAudio()
        await session.close()
    }

    private func checkAbort() throws {
        if Task.isCancelled { throw CancellationError() }
        if stopRequested { throw StopSignal() }
    }

    private func recordBackgroundFailure(_ error: Error) {
        if backgroundFailure == nil { backgroundFailure = error }
    }

    private func consume(_ session: any HudConversationSession) async throws {
        for try await event in session.events {
            switch event {
            case .assistantAudio(let chunk):
                // Playback failure is surfaced; a silent assistant with a live
                // billing session is not an acceptable steady state.
                try await speaker.play(chunk)
            case .interrupted(let generation):
                await speaker.flush(to: generation)
            case .userTranscriptDelta(let text):
                transcripts.onUserDelta(text)
            case .assistantTranscriptDelta(let text):
                transcripts.onAssistantDelta(text)
            case .toolCall(let call):
                // One task per call ID, ever: a duplicate announcement neither
                // replaces the original task nor races a duplicate result.
                guard handledCalls.insert(call.id).inserted else { break }
                let id = call.id
                toolTasks[id] = Task {
                    let result = await self.dispatcher.dispatch(call)
                    guard !Task.isCancelled, self.phase == .running else {
                        self.toolTaskFinished(id)
                        return
                    }
                    do { try await session.send(toolResult: result) }
                    catch {
                        // A provider-withdrawn call can race a suspended send.
                        // Its cancellation is expected; other delivery failures
                        // must end the run instead of silently losing a result.
                        if !Task.isCancelled, self.phase == .running {
                            self.recordBackgroundFailure(error)
                            await session.close()
                        }
                    }
                    self.toolTaskFinished(id)
                }
            case .toolCallsCancelled(let ids):
                for id in ids { toolTasks[id]?.cancel() }
                await dispatcher.cancel(ids: ids)
            case .ready, .turnComplete, .interactionStatus, .delegationStarted:
                break
            case .closed:
                return
            }
        }
    }

    private func toolTaskFinished(_ id: String) {
        toolTasks[id] = nil
    }

    private func teardown() async {
        phase = .finished
        pump?.cancel()
        pump = nil
        // Cancel dispatch first so a call still awaiting validation or
        // authorization can no longer start its effect afterwards.
        await dispatcher.cancel(ids: Array(toolTasks.keys))
        for task in toolTasks.values { task.cancel() }
        toolTasks = [:]
        if let session {
            await session.close()
        }
        await microphone.stop()
        await speaker.stop()
        session = nil
        phase = .finished
    }
}
