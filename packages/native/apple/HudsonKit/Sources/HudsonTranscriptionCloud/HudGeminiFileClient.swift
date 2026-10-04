import Foundation

/// Dedicated Gemini transcription uses Files plus Interactions, not generateContent.
public struct HudGeminiFileClient: Sendable {
    public static let defaultBaseURL = "https://generativelanguage.googleapis.com"
    private let endpoint: HudTranscriptionEndpoint
    private let transport: any HudTranscriptionHTTPTransport

    public init(endpoint: HudTranscriptionEndpoint, transport: any HudTranscriptionHTTPTransport = HudTranscriptionURLSessionTransport()) {
        self.endpoint = endpoint
        self.transport = transport
    }

    public struct UploadedFile: Decodable, Sendable {
        public let name: String
        public let uri: String
        public let state: String?
    }

    public struct Interaction: Decodable, Sendable {
        public let id: String?
        public let status: String?
        public let model: String?
        public let output_text: String?
        public let steps: [Step]?
        public let outputs: [Content]?

        public struct Step: Decodable, Sendable {
            public let type: String?
            public let content: [Content]?
        }
        public struct Content: Decodable, Sendable {
            public let type: String?
            public let text: String?
            public let annotations: [Annotation]?
        }
        public struct Annotation: Decodable, Sendable {
            public let type: String
            public let text: String?
            public let speaker: String?
            public let start_offset: String?
            public let end_offset: String?
        }
        public var text: String {
            if let output_text { return output_text }
            let content = outputs ?? steps?.filter { $0.type == "model_output" }.flatMap { $0.content ?? [] } ?? []
            return content.filter { $0.type == "text" }.compactMap(\.text).joined()
        }
        public var words: [Annotation] {
            let content = outputs ?? steps?.filter { $0.type == "model_output" }.flatMap { $0.content ?? [] } ?? []
            return content.flatMap { $0.annotations ?? [] }.filter { $0.type == "word_info" }
        }
    }

    /// Upload finalization is separate so the host can retain and delete the resource.
    public func upload(audio: Data, mimeType: String, displayName: String, credential: String, timeout: TimeInterval = 120) async throws -> UploadedFile {
        let deadline = Date().addingTimeInterval(timeout)
        var start = try request(path: "upload/v1beta/files", credential: credential, timeout: timeout)
        start.setValue("resumable", forHTTPHeaderField: "X-Goog-Upload-Protocol")
        start.setValue("start", forHTTPHeaderField: "X-Goog-Upload-Command")
        start.setValue(String(audio.count), forHTTPHeaderField: "X-Goog-Upload-Header-Content-Length")
        start.setValue(mimeType, forHTTPHeaderField: "X-Goog-Upload-Header-Content-Type")
        start.httpBody = try JSONSerialization.data(withJSONObject: ["file": ["display_name": displayName]])
        let response = try await transport.send(start)
        try response.requireSuccess()
        guard let rawURL = response.headers["x-goog-upload-url"], let uploadURL = URL(string: rawURL),
              uploadURL.scheme == "https", uploadURL.host == endpoint.baseURL.host,
              uploadURL.user == nil, uploadURL.password == nil else {
            throw HudTranscriptionHTTPError.invalidResponse
        }
        // The signed upload URL carries its own authority; never forward the API key.
        var upload = URLRequest(url: uploadURL)
        upload.httpMethod = "POST"
        guard deadline > Date() else { throw HudTranscriptionHTTPError.connectionFailed }
        upload.timeoutInterval = deadline.timeIntervalSinceNow
        upload.setValue("0", forHTTPHeaderField: "X-Goog-Upload-Offset")
        upload.setValue("upload, finalize", forHTTPHeaderField: "X-Goog-Upload-Command")
        upload.setValue(String(audio.count), forHTTPHeaderField: "Content-Length")
        upload.httpBody = audio
        let uploaded = try await transport.send(upload)
        try uploaded.requireSuccess()
        struct Envelope: Decodable { let file: UploadedFile }
        return try decode(Envelope.self, from: uploaded.body).file
    }

    public func file(name: String, credential: String, timeout: TimeInterval = 120) async throws -> UploadedFile {
        try validateFileName(name)
        var query = try request(path: "v1beta/" + name, credential: credential, timeout: timeout)
        query.httpMethod = "GET"
        let response = try await transport.send(query)
        try response.requireSuccess()
        return try decode(UploadedFile.self, from: response.body)
    }

    public func deleteFile(name: String, credential: String, timeout: TimeInterval = 15) async throws {
        try validateFileName(name)
        var deletion = try request(path: "v1beta/" + name, credential: credential, timeout: timeout)
        deletion.httpMethod = "DELETE"
        let response = try await transport.send(deletion)
        try response.requireSuccess()
    }

    public func transcribe(file: UploadedFile, mimeType: String, model: String, credential: String, languages: [String] = [], vocabulary: [String] = [], speakers: Bool = false, wordTimestamps: Bool = false, clean: Bool = false, timeout: TimeInterval = 120) async throws -> Interaction {
        // Vendor option constraints are repeated here as defense before submission.
        guard !(clean && (speakers || wordTimestamps)), !( !vocabulary.isEmpty && (speakers || wordTimestamps)) else {
            throw HudTranscriptionHTTPError.incompatibleOptions
        }
        guard file.state == nil || file.state == "ACTIVE" else { throw HudTranscriptionHTTPError.fileNotReady }
        var mode: [String: Any] = ["type": "verbatim"]
        if speakers { mode["diarization_mode"] = "speaker" }
        if wordTimestamps { mode["timestamp_granularities"] = ["word"] }
        var config: [String: Any] = ["language_codes": languages, "mode": clean ? "smart" : mode]
        if !vocabulary.isEmpty { config["custom_vocabulary"] = vocabulary }
        var submission = try request(path: "v1beta/interactions", credential: credential, timeout: timeout)
        submission.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": model,
            "input": [["type": "audio", "uri": file.uri, "mime_type": mimeType]],
            "generation_config": ["transcription_config": config]
        ])
        let response = try await transport.send(submission)
        try response.requireSuccess()
        let interaction = try decode(Interaction.self, from: response.body)
        guard interaction.status == "completed",
              interaction.output_text != nil || interaction.outputs != nil || interaction.steps != nil else {
            throw HudTranscriptionHTTPError.invalidResponse
        }
        return interaction
    }

    private func request(path: String, credential: String, timeout: TimeInterval) throws -> URLRequest {
        var request = URLRequest(url: try endpoint.url(path: path))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue(credential, forHTTPHeaderField: "x-goog-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    private func validateFileName(_ name: String) throws {
        let parts = name.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, parts[0] == "files", !parts[1].isEmpty,
              parts[1].allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }) else {
            throw HudTranscriptionHTTPError.invalidEndpoint
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do { return try JSONDecoder().decode(type, from: data) }
        catch { throw HudTranscriptionHTTPError.invalidResponse }
    }
}
