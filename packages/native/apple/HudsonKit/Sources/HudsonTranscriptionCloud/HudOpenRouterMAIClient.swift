import Foundation
import HudsonTranscription

/// OpenRouter wire format for MAI; lifecycle and capability policy stay in the MAI adapter.
struct HudOpenRouterMAIClient: Sendable {
    static let endpoint = URL(string: "https://openrouter.ai/api/v1/audio/transcriptions")!
    let transport: any HudTranscriptionHTTPTransport

    struct Response: Decodable, Sendable {
        let text: String
        let language: String?
        let segments: [Segment]?
        let words: [Word]?
        let usage: Usage?
        var requestID: String?
        struct Segment: Decodable, Sendable {
            let text: String
            let start: Double?
            let end: Double?
            let speaker: Int?
        }
        struct Word: Decodable, Sendable {
            let word: String
            let start: Double?
            let end: Double?
            let speaker: Int?
        }
        struct Usage: Decodable, Sendable {
            let seconds: Double?
            let cost: Double?
        }
        func result(configuration: HudTranscriptionConfiguration, digest: String,
                    operationID: HudTranscriptionOperationID) -> HudTranscriptionResult {
            .init(transcript: text,
                segments: segments?.map { .init(text: $0.text, start: $0.start, end: $0.end, speakerID: $0.speaker.map(String.init)) },
                words: words?.map { .init(text: $0.word, start: $0.start, end: $0.end, speakerID: $0.speaker.map(String.init)) },
                language: language, completion: .completed,
                provenance: .init(providerID: configuration.providerID, modelID: configuration.modelID,
                    adapterVersion: "1", configurationFingerprint: configuration.secretFreeFingerprint,
                    sourceDigest: digest, providerRequestID: requestID, runID: operationID.rawValue, timestamp: Date()),
                usage: usage.map { .init(billedAudioSeconds: $0.seconds,
                    providerReported: $0.cost.map { ["costUSD": String($0)] } ?? [:]) })
        }
    }

    func transcribe(audio: Data, format: String, credential: String,
                    features: HudTranscriptionRequestedFeatures, timeout: TimeInterval) async throws -> Response {
        try Task.checkCancellation()
        var azure: [String: Any] = [
            "diarization": ["enabled": features.speakerLabels],
            "enhancedMode": ["modelOptions": ["transcribeStyle": features.style == .clean || features.smartFormatting ? "clean" : "verbatim"]]
        ]
        if !features.vocabularyHints.isEmpty { azure["phraseList"] = ["phrases": features.vocabularyHints] }
        var body: [String: Any] = [
            "model": "microsoft/mai-transcribe-2",
            "input_audio": ["data": audio.base64EncodedString(), "format": format],
            "response_format": "verbose_json",
            "timestamp_granularities": features.wordTiming ? ["segment", "word"] : ["segment"],
            "provider": ["options": ["azure": azure]]
        ]
        if let language = features.languageHints.first { body["language"] = language }
        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = min(timeout, 60)
        request.setValue("Bearer " + credential.trimmingCharacters(in: .whitespacesAndNewlines), forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let response = try await transport.send(request)
        let generationID = response.headers["x-generation-id"]
        guard (200..<300).contains(response.status) else {
            throw HudTranscriptionHTTPError.rejected(status: response.status, requestID: generationID ?? response.requestID)
        }
        var decoded: Response
        do { decoded = try JSONDecoder().decode(Response.self, from: response.body) }
        catch { throw HudTranscriptionHTTPError.invalidResponse }
        decoded.requestID = generationID ?? response.requestID
        return decoded
    }
}
