import Foundation

private struct HVoxRPCRequest: Encodable {
    let id: String
    let method: String
    let params: [String: HJSONValue]?
}

private struct HVoxRPCMessage: Decodable {
    let id: String?
    let event: String?
    let data: [String: HJSONValue]?
    let result: [String: HJSONValue]?
    let error: HJSONValue?
}

public enum HVoxError: Error, LocalizedError, Equatable {
    case alreadyStarted
    case notStarted
    case invalidMessage
    case provider(String)

    public var errorDescription: String? {
        switch self {
        case .alreadyStarted:
            return "Vox live session is already started."
        case .notStarted:
            return "Vox live session has not started."
        case .invalidMessage:
            return "Vox returned a message HudsonVoice could not decode."
        case .provider(let message):
            return message
        }
    }
}

/// Native HudsonKit adapter for Vox's local WebSocket JSON-RPC daemon.
///
/// This deliberately depends on the Vox wire contract instead of the Vox Swift
/// package so HudsonKit can stay on its lower platform/toolchain baseline.
public final class HVoxLiveSession: @unchecked Sendable {
    public let endpoint: HVoxEndpoint
    public let options: HVoxLiveSessionOptions

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let lock = NSLock()
    private var task: URLSessionWebSocketTask?
    private var streamContinuation: AsyncThrowingStream<HVoiceEvent, Error>.Continuation?
    private var sessionId: String?
    private var started = false

    public init(endpoint: HVoxEndpoint = HVoxEndpoint(), options: HVoxLiveSessionOptions = HVoxLiveSessionOptions()) {
        self.endpoint = endpoint
        self.options = options
    }

    public var id: String? {
        locked { sessionId }
    }

    public func start() async throws -> AsyncThrowingStream<HVoiceEvent, Error> {
        let webSocket = URLSession.shared.webSocketTask(with: endpoint.url)
        let stream = try prepareStart(webSocket: webSocket)

        webSocket.resume()
        Task { [weak self] in
            await self?.receiveLoop()
        }

        try await send(method: "transcribe.startSession", params: options.rpcParams)
        return stream
    }

    public func stop() async throws {
        let currentId = id
        var params: [String: HJSONValue] = ["clientId": .string(options.clientId)]
        if let currentId {
            params["sessionId"] = .string(currentId)
        }
        try await send(method: "transcribe.stopSession", params: params)
    }

    public func cancel() async throws {
        let currentId = id
        var params: [String: HJSONValue] = ["clientId": .string(options.clientId)]
        if let currentId {
            params["sessionId"] = .string(currentId)
        }
        try await send(method: "transcribe.cancelSession", params: params)
        close()
    }

    public func close() {
        lock.lock()
        let webSocket = task
        task = nil
        started = false
        let continuation = streamContinuation
        streamContinuation = nil
        lock.unlock()

        webSocket?.cancel(with: .normalClosure, reason: nil)
        continuation?.finish()
    }

    private func send(method: String, params: [String: HJSONValue]?) async throws {
        let webSocket = locked { task }
        guard let webSocket else {
            throw HVoxError.notStarted
        }

        let request = HVoxRPCRequest(id: UUID().uuidString, method: method, params: params)
        let data = try encoder.encode(request)
        guard let text = String(data: data, encoding: .utf8) else {
            throw HVoxError.invalidMessage
        }
        try await webSocket.send(.string(text))
    }

    private func receiveLoop() async {
        while true {
            let webSocket = locked { task }
            guard let webSocket else { return }

            do {
                let message = try await webSocket.receive()
                try handle(message)
            } catch {
                finish(error)
                return
            }
        }
    }

    private func prepareStart(webSocket: URLSessionWebSocketTask) throws -> AsyncThrowingStream<HVoiceEvent, Error> {
        try locked {
            guard !started else {
                throw HVoxError.alreadyStarted
            }

            started = true
            task = webSocket
        }

        return AsyncThrowingStream<HVoiceEvent, Error> { continuation in
            self.locked {
                self.streamContinuation = continuation
            }

            continuation.onTermination = { [weak self] _ in
                self?.close()
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) throws {
        let data: Data
        switch message {
        case .string(let text):
            guard let encoded = text.data(using: .utf8) else {
                throw HVoxError.invalidMessage
            }
            data = encoded
        case .data(let payload):
            data = payload
        @unknown default:
            throw HVoxError.invalidMessage
        }

        let payload = try decoder.decode(HVoxRPCMessage.self, from: data)

        if let error = payload.error {
            finish(HVoxError.provider(error.stringValue ?? String(describing: error)))
            return
        }

        if let event = payload.event, let data = payload.data {
            emit(event: event, data: data)
            return
        }

        if let result = payload.result, result.string("text") != nil {
            emit(event: "session.final", data: result)
        }
    }

    private func emit(event: String, data: [String: HJSONValue]) {
        let mapped: HVoiceEvent
        switch event {
        case "session.state":
            let state = HVoiceSessionState(rawValue: data.string("state") ?? "") ?? .error
            let previous = data.string("previous").flatMap(HVoiceSessionState.init(rawValue:))
            let payload = HVoiceSessionStateEvent(
                sessionId: data.string("sessionId") ?? id ?? "",
                state: state,
                previous: previous
            )
            remember(sessionId: payload.sessionId)
            mapped = .state(payload)
        case "session.partial":
            let payload = HVoicePartialEvent(
                sessionId: data.string("sessionId") ?? id ?? "",
                text: data.string("text") ?? ""
            )
            remember(sessionId: payload.sessionId)
            mapped = .partial(payload)
        case "session.final":
            let payload = HVoiceFinalEvent(
                sessionId: data.string("sessionId") ?? id ?? "",
                text: data.string("text") ?? "",
                elapsedMs: data.int("elapsedMs") ?? 0,
                utteranceIndex: data.int("utteranceIndex"),
                metrics: data.object("metrics") ?? [:],
                words: HVoiceWordTiming.parseMany(data["words"])
            )
            remember(sessionId: payload.sessionId)
            mapped = .final(payload)
        default:
            mapped = .raw(name: event, data: data)
        }

        lock.lock()
        let continuation = streamContinuation
        lock.unlock()
        continuation?.yield(mapped)
    }

    private func remember(sessionId: String) {
        guard !sessionId.isEmpty else { return }
        locked {
            self.sessionId = sessionId
        }
    }

    private func finish(_ error: Error? = nil) {
        lock.lock()
        let continuation = streamContinuation
        streamContinuation = nil
        let webSocket = task
        task = nil
        started = false
        lock.unlock()

        webSocket?.cancel(with: .normalClosure, reason: nil)
        if let error {
            continuation?.finish(throwing: error)
        } else {
            continuation?.finish()
        }
    }

    @discardableResult
    private func locked<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }
}
