import Foundation

/// Azure Speech fast transcription wire client. The adapter supplies credentials per run.
/// Contract: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe
public struct HudMAITranscriptionClient: Sendable {
    public static let model = "MAI-Transcribe-2"
    public static let apiVersion = "2025-10-15"
    private let endpoint: HudTranscriptionEndpoint
    private let transport: any HudTranscriptionHTTPTransport

    public init(endpoint: HudTranscriptionEndpoint, transport: any HudTranscriptionHTTPTransport = HudTranscriptionURLSessionTransport()) {
        self.endpoint = endpoint
        self.transport = transport
    }

    public struct Options: Sendable {
        public var language: String?
        public var vocabulary: [String]
        public var diarization: Bool
        public var wordTimestamps: Bool
        public var clean: Bool

        public init(language: String? = nil, vocabulary: [String] = [], diarization: Bool = false, wordTimestamps: Bool = false, clean: Bool = false) {
            self.language = language
            self.vocabulary = vocabulary
            self.diarization = diarization
            self.wordTimestamps = wordTimestamps
            self.clean = clean
        }
    }

    public struct Response: Decodable, Sendable {
        public let durationMilliseconds: Double?
        public let combinedPhrases: [CombinedPhrase]?
        public let phrases: [Phrase]?

        public struct CombinedPhrase: Decodable, Sendable {
            public let channel: Int?
            public let text: String
        }

        public struct Phrase: Decodable, Sendable {
            public let text: String
            public let speaker: Int?
            public let locale: String?
            public let offsetMilliseconds: Double?
            public let durationMilliseconds: Double?
            public let confidence: Double?
            public let words: [Word]?
        }

        public struct Word: Decodable, Sendable {
            public let text: String
            public let offsetMilliseconds: Double?
            public let durationMilliseconds: Double?
        }

        public var text: String {
            if let combinedPhrases, !combinedPhrases.isEmpty {
                return combinedPhrases.map(\.text).joined(separator: "\n")
            }
            return phrases?.map(\.text).joined(separator: " ") ?? ""
        }
    }

    public struct Receipt: Sendable {
        public let response: Response
        public let providerRequestID: String?
    }

    public func transcribe(audio: Data, filename: String, mimeType: String, credential: String, options: Options, timeout: TimeInterval = 120) async throws -> Receipt {
        try Task.checkCancellation()
        var modelOptions: [String: Any] = ["transcribeStyle": options.clean ? "clean" : "verbatim"]
        modelOptions["timestamps"] = options.wordTimestamps ? "word" : "none"
        var definition: [String: Any] = [
            "enhancedMode": ["enabled": true, "model": Self.model, "modelOptions": modelOptions],
            "diarization": ["enabled": options.diarization]
        ]
        if let language = options.language { definition["locales"] = [language] }
        if !options.vocabulary.isEmpty { definition["phraseList"] = ["phrases": options.vocabulary] }
        let json = try JSONSerialization.data(withJSONObject: definition, options: [.sortedKeys])
        var form = HudTranscriptionMultipart()
        try form.append(name: "definition", text: String(decoding: json, as: UTF8.self))
        try form.append(name: "audio", filename: filename, mimeType: mimeType, data: audio)
        var request = URLRequest(url: try endpoint.url(path: "speechtotext/transcriptions:transcribe", query: [.init(name: "api-version", value: Self.apiVersion)]))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue(credential, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")
        request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = form.encoded()
        let response = try await transport.send(request)
        try response.requireSuccess()
        let decoded: Response
        do { decoded = try JSONDecoder().decode(Response.self, from: response.body) }
        catch { throw HudTranscriptionHTTPError.invalidResponse }
        guard decoded.combinedPhrases != nil || decoded.phrases != nil else {
            throw HudTranscriptionHTTPError.invalidResponse
        }
        return Receipt(response: decoded, providerRequestID: response.requestID)
    }
}
