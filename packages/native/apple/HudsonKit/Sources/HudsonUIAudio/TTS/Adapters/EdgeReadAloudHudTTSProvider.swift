import CryptoKit
import Foundation

/// Experimental, credential-free access to Microsoft Edge's consumer Read
/// Aloud transport.
///
/// This is **not** Azure Speech. It uses an unofficial, unsupported Microsoft
/// consumer WebSocket
/// (`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`).
/// Spoken text leaves the device and is processed by that endpoint. There is
/// no service, privacy, SLA, or compatibility guarantee; Microsoft may change
/// or withdraw the transport without notice.
///
/// **Opt-in only.** `HudTTSProviders.defaultCloudAdapters()` does not include
/// this adapter, so it is not part of default selectable TTS behavior. Hosts
/// that enable it must register `HudTTSProviders.EdgeReadAloud()` explicitly,
/// disclose the off-device processing, and keep an on-device fallback.
public struct EdgeReadAloudHudTTSProvider: HudTTSProviderAdapter {
    public var providerID: HudTTSProviderID { .edgeReadAloud }
    public var displayName: String { "Microsoft Read Aloud · Experimental" }
    public var credentialKey: String? { nil }
    public var defaultVoice: String { "en-US-EmmaMultilingualNeural" }

    static let trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
    static let chromiumVersion = "143.0.3650.75"
    static let maximumTextBytes = 4_096
    static let windowsEpoch: Int64 = 11_644_473_600

    private let now: @Sendable () -> Date

    public init() {
        self.now = { Date() }
    }

    init(now: @escaping @Sendable () -> Date) {
        self.now = now
    }

    public func isAvailable(context: HudTTSAdapterContext) async -> Bool {
        true
    }

    public func synthesize(
        _ request: HudTTSRequest,
        context: HudTTSAdapterContext
    ) async throws -> HudTTSResult {
        let cleaned = Self.removeUnsupportedControls(request.text)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { throw HudTTSError.emptyInput }

        let voice = Self.validatedVoice(request.voice) ?? defaultVoice
        let rate = Self.rateString(request.rate)
        let chunks = Self.escapedChunks(cleaned, maximumBytes: Self.maximumTextBytes)
        guard !chunks.isEmpty else { throw HudTTSError.emptyInput }

        var audio = Data()
        var wordTimings: [HudTTSWordTiming] = []
        do {
            for chunk in chunks {
                try Task.checkCancellation()
                // Word offsets restart at zero for every chunk's synthesis, so
                // shift them by the audio already accumulated. The requested
                // output is fixed 48 kbit/s CBR MP3, so elapsed seconds fall
                // straight out of the byte count.
                let elapsed = Self.estimatedSeconds(ofAudioBytes: audio.count)
                let piece = try await synthesizeChunk(
                    chunk,
                    voice: voice,
                    rate: rate,
                    context: context
                )
                audio.append(piece.audio)
                wordTimings.append(contentsOf: piece.wordTimings.map {
                    HudTTSWordTiming(word: $0.word, start: $0.start + elapsed, end: $0.end + elapsed)
                })
            }
        } catch {
            throw Self.mappedSynthesisError(error)
        }

        guard !audio.isEmpty else {
            throw HudTTSError.synthesisFailed(
                provider: providerID,
                message: "Microsoft Read Aloud returned no audio."
            )
        }
        return HudTTSResult(
            audioData: audio,
            format: .mp3,
            providerID: providerID,
            voice: voice,
            wordTimings: wordTimings.isEmpty ? nil : wordTimings
        )
    }

    struct ChunkSynthesis {
        var audio: Data
        var wordTimings: [HudTTSWordTiming]
    }

    /// The `speech.config` frame pins `audio-24khz-48kbitrate-mono-mp3`:
    /// constant 48 kbit/s = 6_000 bytes per second of audio.
    static func estimatedSeconds(ofAudioBytes count: Int) -> TimeInterval {
        TimeInterval(count) / 6_000
    }

    /// Cancellation must stay `CancellationError` so callers can distinguish
    /// stop/cancel from a transport failure. HudTTS errors pass through;
    /// everything else becomes `networkUnavailable`.
    static func mappedSynthesisError(_ error: Error) -> Error {
        if error is CancellationError {
            return error
        }
        if error is HudTTSError {
            return error
        }
        return HudTTSError.networkUnavailable(
            provider: .edgeReadAloud,
            message: "Microsoft Read Aloud was unavailable: \(error.localizedDescription) [\(String(reflecting: error))]"
        )
    }

    private func synthesizeChunk(
        _ escapedText: String,
        voice: String,
        rate: String,
        context: HudTTSAdapterContext
    ) async throws -> ChunkSynthesis {
        let connectionID = Self.connectionID()
        let gec = Self.secMSGEC(at: now())
        let majorVersion = Self.chromiumVersion.split(separator: ".").first.map(String.init) ?? "143"
        var components = URLComponents()
        components.scheme = "wss"
        components.host = "speech.platform.bing.com"
        components.path = "/consumer/speech/synthesize/readaloud/edge/v1"
        components.queryItems = [
            URLQueryItem(name: "TrustedClientToken", value: Self.trustedClientToken),
            URLQueryItem(name: "ConnectionId", value: connectionID),
            URLQueryItem(name: "Sec-MS-GEC", value: gec),
            URLQueryItem(name: "Sec-MS-GEC-Version", value: "1-\(Self.chromiumVersion)")
        ]
        guard let url = components.url else {
            throw HudTTSError.synthesisFailed(provider: providerID, message: "Could not construct Read Aloud endpoint.")
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.timeoutInterval = context.requestTimeout
        urlRequest.setValue("no-cache", forHTTPHeaderField: "Pragma")
        urlRequest.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        // Foundation rejects chrome-extension origins. A normal HTTPS origin
        // preserves the WebSocket handshake shape Microsoft expects.
        urlRequest.setValue("https://www.microsoft.com", forHTTPHeaderField: "Origin")
        urlRequest.setValue(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                + "(KHTML, like Gecko) Chrome/\(majorVersion).0.0.0 Safari/537.36 "
                + "Edg/\(majorVersion).0.0.0",
            forHTTPHeaderField: "User-Agent"
        )
        urlRequest.setValue("en-US,en;q=0.9", forHTTPHeaderField: "Accept-Language")
        urlRequest.setValue("muid=\(Self.connectionID());", forHTTPHeaderField: "Cookie")

        let webSocket = context.urlSession.webSocketTask(with: urlRequest)
        webSocket.resume()
        defer { webSocket.cancel(with: .normalClosure, reason: nil) }

        let timestamp = Self.javascriptDate(now())
        let config = """
        X-Timestamp:\(timestamp)\r
        Content-Type:application/json; charset=utf-8\r
        Path:speech.config\r
        \r
        {"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r
        """
        try await webSocket.send(.string(config))

        let ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
            + "<voice name='\(voice)'><prosody pitch='+0Hz' rate='\(rate)' volume='+0%'>"
            + escapedText
            + "</prosody></voice></speak>"
        let ssmlFrame = """
        X-RequestId:\(Self.connectionID())\r
        Content-Type:application/ssml+xml\r
        X-Timestamp:\(timestamp)Z\r
        Path:ssml\r
        \r
        \(ssml)
        """
        try await webSocket.send(.string(ssmlFrame))

        var audio = Data()
        var wordTimings: [HudTTSWordTiming] = []
        while true {
            let message = try await Self.receive(
                from: webSocket,
                timeout: context.requestTimeout
            )
            switch message {
            case .string(let text):
                let frame = Self.parseTextFrame(text)
                switch frame.path {
                case "turn.end":
                    guard !audio.isEmpty else {
                        throw HudTTSError.synthesisFailed(
                            provider: providerID,
                            message: "Microsoft Read Aloud returned no audio."
                        )
                    }
                    return ChunkSynthesis(audio: audio, wordTimings: wordTimings)
                case "audio.metadata":
                    wordTimings.append(contentsOf: Self.wordTimings(fromMetadataFrame: text))
                case "response", "turn.start":
                    continue
                default:
                    throw HudTTSError.synthesisFailed(
                        provider: providerID,
                        message: "Microsoft Read Aloud returned an unknown frame: \(frame.path ?? "missing path")."
                    )
                }
            case .data(let data):
                let frame = try Self.parseBinaryFrame(data)
                guard frame.path == "audio" else {
                    throw HudTTSError.synthesisFailed(
                        provider: providerID,
                        message: "Microsoft Read Aloud returned non-audio binary data."
                    )
                }
                if let contentType = frame.contentType,
                   contentType != "audio/mpeg" {
                    throw HudTTSError.synthesisFailed(
                        provider: providerID,
                        message: "Microsoft Read Aloud returned \(contentType), not MP3 audio."
                    )
                }
                if frame.contentType == nil, frame.payload.isEmpty { continue }
                guard !frame.payload.isEmpty else {
                    throw HudTTSError.synthesisFailed(
                        provider: providerID,
                        message: "Microsoft Read Aloud returned an empty audio frame."
                    )
                }
                audio.append(frame.payload)
            @unknown default:
                throw HudTTSError.synthesisFailed(
                    provider: providerID,
                    message: "Microsoft Read Aloud returned an unsupported WebSocket frame."
                )
            }
        }
    }

    private struct TextFrame {
        var path: String?
    }

    struct BinaryFrame: Equatable {
        var path: String?
        var contentType: String?
        var payload: Data
    }

    private static func parseTextFrame(_ text: String) -> TextFrame {
        let boundary = text.range(of: "\r\n\r\n")
        let headers = boundary.map { String(text[..<$0.lowerBound]) } ?? text
        return TextFrame(path: headerMap(headers)["path"])
    }

    private struct MetadataFrame: Decodable {
        struct Entry: Decodable {
            var type: String
            var data: Boundary?

            enum CodingKeys: String, CodingKey {
                case type = "Type"
                case data = "Data"
            }
        }

        struct Boundary: Decodable {
            var offset: Int64
            var duration: Int64?
            var text: BoundaryText?

            enum CodingKeys: String, CodingKey {
                case offset = "Offset"
                case duration = "Duration"
                case text
            }
        }

        struct BoundaryText: Decodable {
            var text: String

            enum CodingKeys: String, CodingKey {
                case text = "Text"
            }
        }

        var metadata: [Entry]?

        enum CodingKeys: String, CodingKey {
            case metadata = "Metadata"
        }
    }

    /// Extracts `WordBoundary` timings from a full `audio.metadata` text
    /// frame (headers + JSON body). Timings are best-effort: a frame that
    /// fails to parse yields no timings rather than failing the synthesis.
    static func wordTimings(fromMetadataFrame text: String) -> [HudTTSWordTiming] {
        guard let boundary = text.range(of: "\r\n\r\n") else { return [] }
        let body = String(text[boundary.upperBound...])
        guard
            let frame = try? JSONDecoder().decode(MetadataFrame.self, from: Data(body.utf8)),
            let entries = frame.metadata
        else { return [] }

        return entries.compactMap { entry in
            guard
                entry.type == "WordBoundary",
                let data = entry.data,
                let word = data.text?.text.hudTrimmedNonEmpty
            else { return nil }
            // Offset/Duration arrive in 100-nanosecond ticks from the start
            // of this synthesis turn's audio. Checked against a decoded live
            // synthesis (24 kHz/48 kbps MP3): measured speech onset landed
            // 35 ms after the first word's offset, so no lead-in correction
            // is applied for this output format.
            let start = TimeInterval(data.offset) / 10_000_000
            let end = start + TimeInterval(data.duration ?? 0) / 10_000_000
            return HudTTSWordTiming(word: word, start: start, end: end)
        }
    }

    static func parseBinaryFrame(_ data: Data) throws -> BinaryFrame {
        guard data.count >= 2 else {
            throw HudTTSError.synthesisFailed(
                provider: .edgeReadAloud,
                message: "Read Aloud binary frame omitted its header length."
            )
        }
        let headerLength = Int(data[data.startIndex]) << 8
            | Int(data[data.index(after: data.startIndex)])
        // Microsoft's length includes the two-byte prefix itself. Audio begins
        // two CRLF bytes after that absolute boundary. Treating the value as a
        // header-only length dropped the first two bytes of every MP3 frame,
        // which decoded as audible scrambling.
        guard headerLength >= 2, headerLength + 2 <= data.count else {
            throw HudTTSError.synthesisFailed(
                provider: .edgeReadAloud,
                message: "Read Aloud binary frame declared an invalid header length."
            )
        }
        let headerStart = data.index(data.startIndex, offsetBy: 2)
        let headerEnd = data.index(data.startIndex, offsetBy: headerLength)
        let header = String(data: data[headerStart..<headerEnd], encoding: .utf8) ?? ""
        let headers = headerMap(header)
        let payloadStart = data.index(headerEnd, offsetBy: 2)
        return BinaryFrame(
            path: headers["path"],
            contentType: headers["content-type"],
            payload: Data(data[payloadStart...])
        )
    }

    private static func headerMap(_ text: String) -> [String: String] {
        var headers: [String: String] = [:]
        for line in text.components(separatedBy: "\r\n") {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespacesAndNewlines)
            headers[key] = value
        }
        return headers
    }

    static func escapedChunks(_ text: String, maximumBytes: Int = maximumTextBytes) -> [String] {
        guard maximumBytes > 0 else { return [] }
        var chunks: [String] = []
        var current = ""
        var currentBytes = 0
        var lastBreak: String.Index?

        func flush(at breakIndex: String.Index? = nil) {
            if let breakIndex {
                let head = String(current[..<breakIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !head.isEmpty { chunks.append(head) }
                let tail = String(current[breakIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)
                current = tail
                currentBytes = tail.utf8.count
                lastBreak = nil
            } else {
                let value = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !value.isEmpty { chunks.append(value) }
                current = ""
                currentBytes = 0
                lastBreak = nil
            }
        }

        for character in text {
            let escaped = xmlEscape(character)
            let bytes = escaped.utf8.count
            if currentBytes + bytes > maximumBytes, !current.isEmpty {
                flush(at: lastBreak)
                if currentBytes + bytes > maximumBytes, !current.isEmpty {
                    flush()
                }
            }
            current.append(contentsOf: escaped)
            currentBytes += bytes
            if character.isWhitespace {
                lastBreak = current.endIndex
            }
        }
        flush()
        return chunks
    }

    private static func xmlEscape(_ character: Character) -> String {
        switch character {
        case "&": return "&amp;"
        case "<": return "&lt;"
        case ">": return "&gt;"
        case "'": return "&apos;"
        case "\"": return "&quot;"
        default: return String(character)
        }
    }

    private static func removeUnsupportedControls(_ text: String) -> String {
        String(text.unicodeScalars.map { scalar in
            let value = scalar.value
            if value <= 8 || (11...12).contains(value) || (14...31).contains(value) {
                return " "
            }
            return Character(scalar)
        })
    }

    private static func validatedVoice(_ voice: String?) -> String? {
        guard let voice = voice?.trimmingCharacters(in: .whitespacesAndNewlines),
              !voice.isEmpty,
              voice.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" })
        else { return nil }
        return voice
    }

    private static func rateString(_ rate: Double) -> String {
        let percent = Int(((min(max(rate, 0.5), 3.0) - 1) * 100).rounded())
        return percent >= 0 ? "+\(percent)%" : "\(percent)%"
    }

    static func secMSGEC(at date: Date) -> String {
        var seconds = Int64(date.timeIntervalSince1970) + windowsEpoch
        seconds -= seconds % 300
        let ticks = seconds * 10_000_000
        let source = Data("\(ticks)\(trustedClientToken)".utf8)
        return SHA256.hash(data: source)
            .map { String(format: "%02X", $0) }
            .joined()
    }

    private static func connectionID() -> String {
        UUID().uuidString.replacingOccurrences(of: "-", with: "").uppercased()
    }

    private static func javascriptDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'"
        return formatter.string(from: date)
    }

    private static func receive(
        from webSocket: URLSessionWebSocketTask,
        timeout: TimeInterval
    ) async throws -> URLSessionWebSocketTask.Message {
        try await withThrowingTaskGroup(of: URLSessionWebSocketTask.Message.self) { group in
            group.addTask { try await webSocket.receive() }
            group.addTask {
                try await Task.sleep(for: .seconds(max(1, timeout)))
                throw HudTTSError.networkUnavailable(
                    provider: .edgeReadAloud,
                    message: "Microsoft Read Aloud timed out."
                )
            }
            let message = try await group.next()!
            group.cancelAll()
            return message
        }
    }
}
