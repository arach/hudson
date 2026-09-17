import Foundation
import HudsonConversation

/// One GPT-Live WebSocket session.
///
/// Wire summary (voice-websockets, live-delegation):
/// - client: session.start, session.instructions.append {content},
///   session.input_audio.append {audio}, session.close,
///   session.commentary.append {content, delegation_id},
///   response.item.create {item: function_call_output}, response.create
/// - server: session.started, session.input_transcript.delta,
///   session.output_transcript.delta, session.output_audio.delta {delta},
///   session.delegation.created, response.event {delegation_id, event},
///   session.closed {usage}
/// GPT-Live manages listen/speak timing; there is no input commit loop and no
/// output-audio-done event. Speech interruption never cancels backend work.
/// response.item.create / response.create address the current Responses
/// context and carry no delegation_id.
public actor HudGPTLiveSession: HudConversationSession {
    public nonisolated let events: AsyncThrowingStream<HudConversationEvent, Error>
    private let gate: HudConversationEventGate

    private let socket: any HudConversationSocket
    private let configuration: HudConversationConfiguration
    private let tools: [HudConversationToolDeclaration]
    private var reader: Task<Void, Never>?
    private var started = false
    private var closed = false
    private var generation: UInt64 = 0
    private var sequence: UInt64 = 0

    /// Responses-delegated work in flight. Backend work proceeds in rounds:
    /// response.created opens a round, response.completed/done bounds it, and
    /// response.create is sent only once per round after the boundary was
    /// reached AND every announced call of that round has a result. A fast
    /// first result must not continue the backend early, and a continued
    /// round must not block the next one. Call IDs are deduplicated across
    /// duplicate output_item.done deliveries and across rounds.
    private struct ResponsesDelegation {
        var currentResponseID: String?
        var pendingCalls: Set<String> = []
        var seenCalls: Set<String> = []
        var boundaryReached = false
        var outputsSentThisRound = 0
        var continuedThisRound = false

        mutating func beginRound(responseID: String?) {
            currentResponseID = responseID
            pendingCalls = []
            boundaryReached = false
            outputsSentThisRound = 0
            continuedThisRound = false
        }
    }
    private var responsesDelegations: [String: ResponsesDelegation] = [:]
    private var clientDelegations: Set<String> = []

    private var readyWaiter: CheckedContinuation<Bool, Never>?
    private var closeWaiter: CheckedContinuation<Bool, Never>?
    private var closeTask: Task<Void, Never>?
    private let setupTimeout: UInt64
    private let closeTimeout: UInt64

    private let delegation: [String: Any]?

    init(socket: any HudConversationSocket, configuration: HudConversationConfiguration,
         tools: [HudConversationToolDeclaration], delegation: [String: Any]?,
         setupTimeout: UInt64 = 10_000_000_000, closeTimeout: UInt64 = 5_000_000_000) {
        self.socket = socket
        self.configuration = configuration
        self.tools = tools
        self.delegation = delegation
        self.setupTimeout = setupTimeout
        self.closeTimeout = closeTimeout
        gate = HudConversationEventGate()
        events = gate.stream
    }

    /// Delegation configuration is validated before any socket exists.
    /// Rules, not guesses:
    /// - Authored `delegation` JSON that does not parse is an error.
    /// - Responses delegation requires the host-configured backend model
    ///   (`delegation.responses.model` or the `delegationModel` option); no
    ///   model identifier is ever invented.
    /// - Declared tools merge into an authored responses branch only when it
    ///   declares none of its own; conflicting tool sources are an error,
    ///   never a silent overwrite.
    static func delegationConfiguration(
        configuration: HudConversationConfiguration,
        tools: [HudConversationToolDeclaration]
    ) throws -> [String: Any]? {
        var delegation: [String: Any]
        if let raw = configuration.options["delegation"] {
            guard let parsed = (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any] else {
                throw HudConversationError.invalidConfiguration("The delegation option is not a JSON object.")
            }
            delegation = parsed
        } else if !tools.isEmpty {
            guard let model = configuration.options["delegationModel"],
                  !model.trimmingCharacters(in: .whitespaces).isEmpty else {
                throw HudConversationError.invalidConfiguration(
                    "Declared tools need a Responses backend model (delegationModel option).")
            }
            delegation = ["type": "responses", "responses": ["model": model]]
        } else {
            return nil
        }
        guard delegation["type"] as? String == "responses" else { return delegation }
        var responses = delegation["responses"] as? [String: Any] ?? [:]
        guard let model = responses["model"] as? String, !model.isEmpty else {
            throw HudConversationError.invalidConfiguration(
                "Responses delegation requires a backend model before connecting.")
        }
        if !tools.isEmpty {
            guard responses["tools"] == nil else {
                throw HudConversationError.invalidConfiguration(
                    "Tools are declared both on the session and inside the delegation option; declare them once.")
            }
            responses["tools"] = tools.map { declaration -> [String: Any] in
                var tool: [String: Any] = ["type": "function", "name": declaration.name]
                if let description = declaration.description { tool["description"] = description }
                if let schema = declaration.parametersJSONSchema,
                   let parameters = try? JSONSerialization.jsonObject(with: schema) {
                    tool["parameters"] = parameters
                }
                return tool
            }
        }
        delegation["responses"] = responses
        return delegation
    }

    /// Sends session.start and waits for session.started. The setup deadline
    /// covers the initial send as well as the acknowledgement, cancellation
    /// interrupts the wait, and every failure path closes the socket before
    /// throwing. Input and commands are rejected until acknowledgement.
    func start() async throws {
        var session: [String: Any] = ["model": configuration.modelID.rawValue]
        var audio: [String: Any] = [
            "format": ["type": "audio/pcm", "rate": configuration.inputAudio.sampleRate],
        ]
        if let voice = configuration.voice { audio["output"] = ["voice": voice] }
        session["audio"] = audio
        if let instructions = configuration.instructions { session["instructions"] = instructions }
        if let delegation { session["delegation"] = delegation }
        let startMessage: [String: Any] = ["type": "session.start", "session": session]
        reader = Task { await self.readLoop() }
        let acknowledged = await withTaskCancellationHandler {
            await withCheckedContinuation { (waiter: CheckedContinuation<Bool, Never>) in
                readyWaiter = waiter
                Task {
                    do { try await self.send(json: startMessage) }
                    catch { self.expireReadyWaiter() }
                }
                Task {
                    try? await Task.sleep(nanoseconds: self.setupTimeout)
                    self.expireReadyWaiter()
                }
            }
        } onCancel: {
            Task { await self.expireReadyWaiter() }
        }
        guard acknowledged, started else {
            let failure = HudConversationError.setupRejected("The provider did not acknowledge the session in time.")
            finish(error: failure)
            await socket.close()
            throw failure
        }
    }

    public func send(audio: Data) async throws {
        try requireOpenAndStarted()
        guard !audio.isEmpty, audio.count.isMultiple(of: 2) else { throw HudConversationError.invalidAudioChunk }
        try await send(json: ["type": "session.input_audio.append", "audio": audio.base64EncodedString()])
    }

    /// GPT-Live manages listen/speak timing itself; there is no end-of-input
    /// message to send.
    public func finishAudio() async throws {
        try requireOpenAndStarted()
    }

    public func appendInstruction(_ text: String) async throws {
        try requireOpenAndStarted()
        try await send(json: ["type": "session.instructions.append", "content": text,
                              "delegation_id": NSNull()])
    }

    public func interruptPlayback() async -> UInt64 {
        generation += 1
        return generation
    }

    public func send(toolResult: HudConversationToolResult) async throws {
        try requireOpenAndStarted()
        guard toolResult.scheduling == nil else {
            throw HudConversationError.invalidConfiguration("GPT-Live does not take result scheduling.")
        }
        guard let delegationID = toolResult.delegationID else {
            throw HudConversationError.invalidConfiguration("GPT-Live tool results need their delegation ID.")
        }
        let output = outputText(toolResult.output)
        if responsesDelegations[delegationID] != nil {
            // Reserve before the first await so a concurrent duplicate result
            // for the same call cannot send twice.
            guard responsesDelegations[delegationID]?.pendingCalls.remove(toolResult.callID) != nil else {
                throw HudConversationError.unknownToolCall(toolResult.callID)
            }
            responsesDelegations[delegationID]?.outputsSentThisRound += 1
            try await send(json: ["type": "response.item.create",
                                  "item": ["type": "function_call_output",
                                           "call_id": toolResult.callID, "output": output]])
            try await continueResponsesIfComplete(delegationID)
        } else if clientDelegations.contains(delegationID) {
            // Client delegation announced only an opaque ID; the host returns
            // spoken content it reconstructed from transcript and app state.
            try await send(json: ["type": "session.commentary.append",
                                  "content": output, "delegation_id": delegationID])
        } else {
            throw HudConversationError.unknownToolCall(toolResult.callID)
        }
    }

    /// Idempotent graceful close: the waiter is registered before
    /// session.close is sent so a fast session.closed cannot be missed, and
    /// concurrent callers share one close attempt.
    public func close() async {
        if closeTask == nil {
            closeTask = Task { await self.performClose() }
        }
        await closeTask?.value
    }

    private func performClose() async {
        guard !closed else { return }
        let confirmed = await withCheckedContinuation { (waiter: CheckedContinuation<Bool, Never>) in
            closeWaiter = waiter
            Task { try? await self.send(json: ["type": "session.close"]) }
            Task {
                try? await Task.sleep(nanoseconds: self.closeTimeout)
                self.expireCloseWaiter()
            }
        }
        finish(error: confirmed ? nil : HudConversationError.closeUnconfirmed)
        await socket.close()
    }

    // MARK: - Receive loop

    private func readLoop() async {
        do {
            while !closed {
                let data = try await socket.receive()
                guard let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let type = message["type"] as? String else { continue }
                try await handle(type: type, message: message)
                if type == "session.closed" { break }
            }
        } catch is CancellationError {
        } catch {
            if !closed { finish(error: HudConversationError.connectionFailed) }
        }
    }

    private func handle(type: String, message: [String: Any]) async throws {
        switch type {
        case "session.started":
            started = true
            let id = (message["session"] as? [String: Any])?["id"] as? String
            yield(.ready(sessionID: id))
            readyWaiter?.resume(returning: true)
            readyWaiter = nil
        case "session.output_audio.delta":
            guard let delta = message["delta"] as? String, let data = Data(base64Encoded: delta) else { return }
            sequence += 1
            yield(.assistantAudio(.init(
                data: data, format: configuration.inputAudio, generation: generation, sequence: sequence)))
        case "session.input_transcript.delta":
            if let delta = message["delta"] as? String { yield(.userTranscriptDelta(delta)) }
        case "session.output_transcript.delta":
            if let delta = message["delta"] as? String { yield(.assistantTranscriptDelta(delta)) }
        case "session.delegation.created":
            guard let delegation = message["delegation"] as? [String: Any],
                  let id = delegation["id"] as? String else { return }
            if delegation["target"] as? String == "client" {
                clientDelegations.insert(id)
                yield(.delegationStarted(.init(id: id, target: .client)))
            } else {
                if responsesDelegations[id] == nil { responsesDelegations[id] = ResponsesDelegation() }
                yield(.delegationStarted(.init(id: id, target: .responses)))
            }
        case "response.event":
            guard let delegationID = message["delegation_id"] as? String,
                  let event = message["event"] as? [String: Any] else { return }
            try await handleDelegated(event: event, delegationID: delegationID)
        case "session.closed":
            var usage: HudConversationUsage?
            if let raw = message["usage"] as? [String: Any] {
                usage = HudConversationUsage(detail: raw.compactMapValues { ($0 as? NSNumber)?.doubleValue })
            }
            yield(.closed(usage))
            if let waiter = closeWaiter {
                closeWaiter = nil
                waiter.resume(returning: true)
            } else {
                finish(error: nil)
            }
        case "error":
            // Fixed copy: raw provider payloads stay out of host-facing text.
            finish(error: HudConversationError.providerError("The provider reported an error."))
        default:
            break
        }
    }

    /// Custom-function calls arrive nested in response.event envelopes and
    /// still run through host dispatch and authorization.
    private func handleDelegated(event: [String: Any], delegationID: String) async throws {
        if responsesDelegations[delegationID] == nil {
            responsesDelegations[delegationID] = ResponsesDelegation()
            yield(.delegationStarted(.init(id: delegationID, target: .responses)))
        }
        switch event["type"] as? String {
        case "response.created":
            let responseID = (event["response"] as? [String: Any])?["id"] as? String
            // Duplicate creation of the same response is idempotent; it must
            // not reset a round that already announced calls.
            if let responseID, responsesDelegations[delegationID]?.currentResponseID == responseID { return }
            responsesDelegations[delegationID]?.beginRound(responseID: responseID)
        case "response.output_item.done":
            guard let item = event["item"] as? [String: Any],
                  item["type"] as? String == "function_call",
                  let callID = item["call_id"] as? String,
                  let name = item["name"] as? String else { return }
            // Duplicate deliveries of the same call must not re-dispatch.
            guard responsesDelegations[delegationID]?.seenCalls.contains(callID) != true else { return }
            // Function arguments are a JSON string on the wire. Preserve
            // invalid/missing values as invalid input, never an empty call.
            let arguments = item["arguments"] as? String ?? "null"
            responsesDelegations[delegationID]?.seenCalls.insert(callID)
            responsesDelegations[delegationID]?.pendingCalls.insert(callID)
            yield(.toolCall(.init(
                id: callID, name: name, argumentsJSON: Data(arguments.utf8), delegationID: delegationID)))
        case "response.completed", "response.done":
            // A stale completion for an earlier response must not bound the
            // current round.
            let responseID = (event["response"] as? [String: Any])?["id"] as? String
            if let responseID, let current = responsesDelegations[delegationID]?.currentResponseID,
               responseID != current { return }
            responsesDelegations[delegationID]?.boundaryReached = true
            try await continueResponsesIfComplete(delegationID)
        default:
            break
        }
    }

    private func continueResponsesIfComplete(_ delegationID: String) async throws {
        guard var state = responsesDelegations[delegationID],
              state.boundaryReached, state.pendingCalls.isEmpty,
              state.outputsSentThisRound > 0, !state.continuedThisRound else { return }
        state.continuedThisRound = true
        responsesDelegations[delegationID] = state
        try await send(json: ["type": "response.create"])
    }

    // MARK: - Plumbing

    private func requireOpenAndStarted() throws {
        guard !closed else { throw HudConversationError.sessionClosed }
        guard started else { throw HudConversationError.notStarted }
    }

    private func outputText(_ output: HudConversationToolResult.Output) -> String {
        switch output {
        case .success(let data):
            return String(decoding: data, as: UTF8.self)
        case .failure(let message):
            let body = (try? JSONSerialization.data(withJSONObject: ["error": message])) ?? Data("{}".utf8)
            return String(decoding: body, as: UTF8.self)
        }
    }

    private func yield(_ event: HudConversationEvent) {
        if !gate.yield(event) { finish(error: HudConversationError.eventOverflow) }
    }

    private func send(json: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: json)
        try await socket.send(data)
    }

    private func finish(error: Error?) {
        guard !closed else { return }
        closed = true
        reader?.cancel()
        readyWaiter?.resume(returning: false)
        readyWaiter = nil
        closeWaiter?.resume(returning: false)
        closeWaiter = nil
        gate.finish(throwing: error)
        Task { await socket.close() }
    }

    private func expireReadyWaiter() {
        readyWaiter?.resume(returning: false)
        readyWaiter = nil
    }

    private func expireCloseWaiter() {
        closeWaiter?.resume(returning: false)
        closeWaiter = nil
    }
}
