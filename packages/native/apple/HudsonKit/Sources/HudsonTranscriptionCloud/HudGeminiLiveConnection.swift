import Foundation

/// Wire-level session. The public adapter owns timeout, timeline, and terminal results.
/// Receiving a finalized utterance does not close the session.
public actor HudGeminiLiveConnection {
    public enum Mode: Sendable { case dedicatedTranscription, conversationalInput }
    public enum Event: Sendable, Equatable {
        case partial(String)
        case finalized(String)
        case inputFragment(String, finished: Bool)
        case turnComplete
        case interrupted
        case goAway
        case usage(Data)
    }
    public enum Failure: Error, Sendable, Equatable {
        case invalidState, invalidChunk, concurrentWrite, malformedMessage, providerFailure
    }

    private enum State { case idle, starting, open, draining, closed }
    private let socket: any HudTranscriptionSocket
    private let mode: Mode
    private var state = State.idle
    private var writing = false
    private var reading = false
    private var nextChunk: UInt64 = 0
    public static let maximumChunkBytes = 6_400
    public static let socketPath = "ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"

    public init(socket: any HudTranscriptionSocket, mode: Mode) {
        self.socket = socket
        self.mode = mode
    }

    public static func socketRequest(endpoint: HudTranscriptionEndpoint, credential: String) throws -> URLRequest {
        let https = try endpoint.url(path: socketPath, query: [.init(name: "key", value: credential)])
        guard var parts = URLComponents(url: https, resolvingAgainstBaseURL: false) else {
            throw HudTranscriptionHTTPError.invalidEndpoint
        }
        parts.scheme = "wss"
        guard let url = parts.url else { throw HudTranscriptionHTTPError.invalidEndpoint }
        return URLRequest(url: url)
    }

    public func start(model: String, languages: [String] = [], vocabulary: [String] = [], clean: Bool = false) async throws {
        guard state == .idle else { throw Failure.invalidState }
        state = .starting
        var input: [String: Any] = [:]
        if mode == .dedicatedTranscription {
            input["languageCodes"] = languages
            input["customVocabulary"] = vocabulary
            input["mode"] = clean ? "SMART" : "VERBATIM"
        } else if !languages.isEmpty || !vocabulary.isEmpty || clean {
            state = .closed
            await socket.close()
            throw HudTranscriptionHTTPError.incompatibleOptions
        }
        let setup: [String: Any] = ["setup": [
            "model": model.hasPrefix("models/") ? model : "models/" + model,
            "generationConfig": ["responseModalities": [mode == .dedicatedTranscription ? "TEXT" : "AUDIO"]],
            "inputAudioTranscription": input
        ]]
        do {
            try await socket.send(try JSONSerialization.data(withJSONObject: setup))
            let data = try await socket.receive()
            guard state == .starting else { throw Failure.invalidState }
            let response = try object(data)
            guard response["error"] == nil, response["setupComplete"] != nil else { throw Failure.providerFailure }
            state = .open
        } catch {
            state = .closed
            await socket.close()
            throw error
        }
    }

    /// Caller feeds PCM16 little-endian, mono, 16 kHz. Await each send before the next.
    public func sendPCM(_ bytes: Data, sequence: UInt64) async throws {
        guard state == .open else { throw Failure.invalidState }
        guard !writing else { throw Failure.concurrentWrite }
        guard sequence == nextChunk, !bytes.isEmpty, bytes.count <= Self.maximumChunkBytes, bytes.count.isMultiple(of: 2) else {
            throw Failure.invalidChunk
        }
        writing = true
        defer { writing = false }
        do {
            try await socket.send(try JSONSerialization.data(withJSONObject: ["realtimeInput": ["audio": ["data": bytes.base64EncodedString(), "mimeType": "audio/pcm;rate=16000"]]]))
            guard state == .open else { throw Failure.invalidState }
            nextChunk += 1
        } catch {
            state = .closed
            await socket.close()
            throw error
        }
    }

    public func finishInput() async throws {
        guard state == .open else { throw Failure.invalidState }
        guard !writing else { throw Failure.concurrentWrite }
        state = .draining
        do { try await socket.send(try JSONSerialization.data(withJSONObject: ["realtimeInput": ["audioStreamEnd": true]])) }
        catch { state = .closed; await socket.close(); throw error }
    }

    public func receive() async throws -> [Event] {
        guard state == .open || state == .draining, !reading else { throw Failure.invalidState }
        reading = true
        defer { reading = false }
        do {
            let data = try await socket.receive()
            guard state != .closed else { throw Failure.invalidState }
            let message = try object(data)
            guard message["error"] == nil else { throw Failure.providerFailure }
            var events: [Event] = []
            if message["goAway"] != nil { events.append(.goAway) }
            if let usage = message["usageMetadata"] as? [String: Any] {
                events.append(.usage(try JSONSerialization.data(withJSONObject: usage, options: [.sortedKeys])))
            }
            if let content = message["serverContent"] as? [String: Any] {
                if let partial = content["interimInputTranscription"] as? [String: Any], let text = partial["text"] as? String {
                    events.append(.partial(text))
                }
                if let input = content["inputTranscription"] as? [String: Any], let text = input["text"] as? String {
                    switch mode {
                    case .dedicatedTranscription: events.append(.finalized(text))
                    case .conversationalInput: events.append(.inputFragment(text, finished: input["finished"] as? Bool ?? false))
                    }
                }
                if content["interrupted"] as? Bool == true { events.append(.interrupted) }
                if content["turnComplete"] as? Bool == true { events.append(.turnComplete) }
                // Generated output/audio is never mistaken for the user's transcript.
            }
            return events
        } catch {
            state = .closed
            await socket.close()
            throw error
        }
    }

    public func cancel() async { state = .closed; await socket.close() }

    private func object(_ data: Data) throws -> [String: Any] {
        do {
            guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Failure.malformedMessage }
            return object
        } catch { throw Failure.malformedMessage }
    }
}
