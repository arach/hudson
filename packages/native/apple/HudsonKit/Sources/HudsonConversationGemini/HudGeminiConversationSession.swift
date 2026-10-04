import Foundation
import HudsonConversation

/// One Gemini Live conversational session over BidiGenerateContent.
///
/// Wire summary (live-api docs, tools, thinking):
/// - client: {setup:{model, generationConfig, systemInstruction, tools, ...}},
///   {realtimeInput:{audio:{data,mimeType}}}, {realtimeInput:{audioStreamEnd:true}},
///   {toolResponse:{functionResponses:[{id,name,response}]}}
/// - server: {setupComplete}, {serverContent:{modelTurn|inputTranscription|
///   outputTranscription|interrupted|turnComplete|interactionStatus}},
///   {toolCall:{functionCalls:[{id,name,args}]}}, {toolCallCancellation:{ids}},
///   {goAway}, top-level {interactionStatus}
/// turnComplete marks the end of one utterance only; interactionStatus
/// (IDLE / IN_PROGRESS) reports background work and must be read after
/// turnComplete — extended thinking keeps working across utterances.
public actor HudGeminiConversationSession: HudConversationSession {
    public nonisolated let events: AsyncThrowingStream<HudConversationEvent, Error>
    private let gate: HudConversationEventGate

    private let socket: any HudConversationSocket
    private let configuration: HudConversationConfiguration
    private let tools: [HudConversationToolDeclaration]
    private let extendedThinking: Bool
    private var reader: Task<Void, Never>?
    private var started = false
    private var closed = false
    private var generation: UInt64 = 0
    private var sequence: UInt64 = 0
    /// Calls awaiting a host result (id → declared name).
    private var pendingCalls: [String: String] = [:]
    /// Every call ID the provider ever announced. A repeated announcement of a
    /// completed or cancelled call is dropped instead of re-dispatching and
    /// racing a duplicate-error result against the still-running original.
    private var knownCalls: Set<String> = []
    private var readyWaiter: CheckedContinuation<Bool, Never>?
    private var closeTask: Task<Void, Never>?
    private let setupTimeout: UInt64

    init(socket: any HudConversationSocket, configuration: HudConversationConfiguration,
         tools: [HudConversationToolDeclaration], setupTimeout: UInt64 = 10_000_000_000) {
        self.socket = socket
        self.configuration = configuration
        self.tools = tools
        self.setupTimeout = setupTimeout
        extendedThinking = HudGeminiConversationAdapter.isExtendedThinking(configuration.modelID)
        gate = HudConversationEventGate()
        events = gate.stream
    }

    func start() async throws {
        // Defense in depth for sessions constructed without the adapter:
        // model rules are enforced, never silently adjusted.
        if extendedThinking, tools.contains(where: { $0.behavior == .blocking }) {
            throw HudConversationError.invalidConfiguration(
                "Extended thinking requires non-blocking tools; blocking mode returns a hard provider error.")
        }
        if !extendedThinking, configuration.thinkingLevel != nil {
            throw HudConversationError.invalidConfiguration(
                "This model does not take a thinking level. Choose the extended-thinking model instead.")
        }
        var generationConfig: [String: Any] = ["responseModalities": ["AUDIO"]]
        if let level = configuration.thinkingLevel {
            // Only reachable on the extended-thinking model; the adapter
            // rejects a thinking level on the base model outright.
            generationConfig["thinkingConfig"] = ["thinkingLevel": level.rawValue.uppercased()]
        }
        if let voice = configuration.voice {
            generationConfig["speechConfig"] =
                ["voiceConfig": ["prebuiltVoiceConfig": ["voiceName": voice]]]
        }
        var setup: [String: Any] = [
            "model": "models/" + configuration.modelID.rawValue,
            "generationConfig": generationConfig,
            "inputAudioTranscription": [:] as [String: Any],
            "outputAudioTranscription": [:] as [String: Any],
        ]
        if let instructions = configuration.instructions {
            setup["systemInstruction"] = ["parts": [["text": instructions]]]
        }
        if !tools.isEmpty {
            setup["tools"] = [["functionDeclarations": tools.map { declaration -> [String: Any] in
                var function: [String: Any] = ["name": declaration.name]
                if let description = declaration.description { function["description"] = description }
                if let schema = declaration.parametersJSONSchema,
                   let parameters = try? JSONSerialization.jsonObject(with: schema) {
                    function["parameters"] = parameters
                }
                // The provider default is NON_BLOCKING, so both behaviors are
                // serialized explicitly; blocking on extended thinking was
                // rejected above, never rewritten.
                function["behavior"] = declaration.behavior == .blocking ? "BLOCKING" : "NON_BLOCKING"
                return function
            }]]
        }
        // The setup deadline covers the initial send as well as the
        // acknowledgement; cancellation interrupts the wait, and every
        // failure path closes the socket before throwing.
        let setupMessage: [String: Any] = ["setup": setup]
        reader = Task { await self.readLoop() }
        let acknowledged = await withTaskCancellationHandler {
            await withCheckedContinuation { (waiter: CheckedContinuation<Bool, Never>) in
                readyWaiter = waiter
                Task {
                    do { try await self.send(json: setupMessage) }
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
        try await send(json: ["realtimeInput": ["audio": [
            "data": audio.base64EncodedString(),
            "mimeType": "audio/pcm;rate=\(configuration.inputAudio.sampleRate)",
        ]]])
    }

    public func finishAudio() async throws {
        try requireOpenAndStarted()
        try await send(json: ["realtimeInput": ["audioStreamEnd": true]])
    }

    /// Gemini Live steering is conversation content, not a dedicated
    /// instruction channel; sessions reject it rather than pretending.
    public func appendInstruction(_ text: String) async throws {
        try requireOpenAndStarted()
        throw HudConversationError.invalidConfiguration(
            "Gemini Live does not take appended instructions mid-session.")
    }

    public func interruptPlayback() async -> UInt64 {
        generation += 1
        return generation
    }

    public func send(toolResult: HudConversationToolResult) async throws {
        try requireOpenAndStarted()
        // Validate everything before reserving: an invalid result must not
        // consume the pending call it failed to answer.
        guard let name = pendingCalls[toolResult.callID], name == toolResult.name else {
            throw HudConversationError.unknownToolCall(toolResult.callID)
        }
        if extendedThinking, toolResult.scheduling != nil {
            throw HudConversationError.invalidConfiguration(
                "Extended thinking does not take function-result scheduling.")
        }
        // Reserve before the first await so a concurrent duplicate result for
        // the same call cannot send twice.
        pendingCalls.removeValue(forKey: toolResult.callID)
        var response: [String: Any]
        switch toolResult.output {
        case .success(let data):
            response = ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any]) ??
                ["output": String(decoding: data, as: UTF8.self)]
        case .failure(let message):
            response = ["error": message]
        }
        if let scheduling = toolResult.scheduling {
            let wire: String
            switch scheduling {
            case .interrupt: wire = "INTERRUPT"
            case .whenIdle: wire = "WHEN_IDLE"
            case .silent: wire = "SILENT"
            }
            response["scheduling"] = wire
        }
        try await send(json: ["toolResponse": ["functionResponses": [[
            "id": toolResult.callID, "name": toolResult.name, "response": response,
        ]]]])
    }

    /// BidiGenerateContent has no close confirmation message; graceful close
    /// is a socket close after a final `.closed` event.
    public func close() async {
        if closeTask == nil {
            closeTask = Task { await self.performClose() }
        }
        await closeTask?.value
    }

    private func performClose() async {
        guard !closed else { return }
        yield(.closed(nil))
        finish(error: nil)
        await socket.close()
    }

    // MARK: - Receive loop

    private func readLoop() async {
        do {
            while !closed {
                let data = try await socket.receive()
                guard let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                handle(message: message)
            }
        } catch is CancellationError {
        } catch {
            if !closed { finish(error: HudConversationError.connectionFailed) }
        }
    }

    private func handle(message: [String: Any]) {
        if message["error"] != nil {
            finish(error: HudConversationError.providerError("The provider reported an error."))
            return
        }
        if message["setupComplete"] != nil {
            started = true
            yield(.ready(sessionID: nil))
            readyWaiter?.resume(returning: true)
            readyWaiter = nil
            return
        }
        if message["goAway"] != nil {
            finish(error: HudConversationError.providerError("The provider is ending the session."))
            return
        }
        // interactionStatus appears both nested in serverContent and at the
        // top level; both placements are authoritative.
        if let status = interactionStatus(message["interactionStatus"]) {
            yield(.interactionStatus(status))
        }
        if let toolCall = message["toolCall"] as? [String: Any],
           let calls = toolCall["functionCalls"] as? [[String: Any]] {
            for call in calls {
                guard let id = call["id"] as? String, let name = call["name"] as? String,
                      !knownCalls.contains(id) else { continue }
                // Preserve present malformed shapes for dispatcher rejection. In
                // particular, a scalar must never become a valid empty call.
                let arguments = (try? JSONSerialization.data(
                    withJSONObject: call["args"] ?? [:], options: [.fragmentsAllowed])) ?? Data("null".utf8)
                knownCalls.insert(id)
                pendingCalls[id] = name
                yield(.toolCall(.init(id: id, name: name, argumentsJSON: arguments)))
            }
        }
        if let cancellation = message["toolCallCancellation"] as? [String: Any],
           let ids = cancellation["ids"] as? [String] {
            for id in ids { pendingCalls[id] = nil }
            yield(.toolCallsCancelled(ids))
        }
        guard let content = message["serverContent"] as? [String: Any] else { return }
        if let status = interactionStatus(content["interactionStatus"]) {
            yield(.interactionStatus(status))
        }
        if let input = content["inputTranscription"] as? [String: Any], let text = input["text"] as? String {
            yield(.userTranscriptDelta(text))
        }
        if let output = content["outputTranscription"] as? [String: Any], let text = output["text"] as? String {
            yield(.assistantTranscriptDelta(text))
        }
        if let turn = content["modelTurn"] as? [String: Any], let parts = turn["parts"] as? [[String: Any]] {
            for part in parts {
                guard let inline = part["inlineData"] as? [String: Any],
                      let encoded = inline["data"] as? String,
                      let data = Data(base64Encoded: encoded) else { continue }
                sequence += 1
                yield(.assistantAudio(.init(
                    data: data,
                    format: .init(sampleRate: sampleRate(of: inline["mimeType"] as? String)),
                    generation: generation, sequence: sequence)))
            }
        }
        if content["interrupted"] as? Bool == true {
            generation += 1
            yield(.interrupted(generation: generation))
        }
        // End of one utterance only: background work state stays untouched and
        // the read loop keeps consuming interactionStatus and tool traffic.
        if content["turnComplete"] as? Bool == true {
            yield(.turnComplete)
        }
    }

    private func interactionStatus(_ raw: Any?) -> HudConversationInteractionStatus? {
        switch raw as? String {
        case "IDLE": return .idle
        case "IN_PROGRESS": return .inProgress
        default: return nil
        }
    }

    private func sampleRate(of mimeType: String?) -> Int {
        guard let mimeType, let range = mimeType.range(of: "rate=") else { return 24000 }
        return Int(mimeType[range.upperBound...].prefix(while: \.isNumber)) ?? 24000
    }

    // MARK: - Plumbing

    private func requireOpenAndStarted() throws {
        guard !closed else { throw HudConversationError.sessionClosed }
        guard started else { throw HudConversationError.notStarted }
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
        gate.finish(throwing: error)
        Task { await socket.close() }
    }

    private func expireReadyWaiter() {
        readyWaiter?.resume(returning: false)
        readyWaiter = nil
    }
}
