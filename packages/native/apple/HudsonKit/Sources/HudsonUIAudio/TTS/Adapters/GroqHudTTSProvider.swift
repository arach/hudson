import Foundation

/// Groq's OpenAI-compatible Orpheus text-to-speech adapter.
public struct GroqHudTTSProvider: HudTTSProviderAdapter {
    public var providerID: HudTTSProviderID { .groq }
    public var displayName: String { "Groq" }
    public var credentialKey: String? { "groq_key" }
    public var defaultVoice: String { "autumn" }

    public var model: String
    public var endpoint: URL

    /// Orpheus rejects longer inputs. Callers should split longer utterances;
    /// this adapter truncates at the provider boundary as a final safeguard.
    static let maximumInputCharacters = 200

    public init(
        model: String = "canopylabs/orpheus-v1-english",
        endpoint: URL = URL(string: "https://api.groq.com/openai/v1/audio/speech")!
    ) {
        self.model = model
        self.endpoint = endpoint
    }

    public func isAvailable(context: HudTTSAdapterContext) async -> Bool {
        (try? await context.apiKey(for: self)) != nil
    }

    public func synthesize(
        _ request: HudTTSRequest,
        context: HudTTSAdapterContext
    ) async throws -> HudTTSResult {
        let text = request.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw HudTTSError.emptyInput }

        let apiKey = try await context.apiKey(for: self)
        let voice = request.voice?.hudTrimmedNonEmpty ?? defaultVoice
        let speed = request.rate.isFinite
            ? Self.clamp(request.rate, min: 0.5, max: 5)
            : 1

        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = context.requestTimeout
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": request.model?.hudTrimmedNonEmpty ?? model,
            "voice": voice,
            "input": String(text.prefix(Self.maximumInputCharacters)),
            "response_format": "mp3",
            "speed": speed,
        ])

        let (data, response) = try await context.urlSession.data(for: urlRequest)
        try validate(response, data: data)
        return HudTTSResult(
            audioData: data,
            format: .mp3,
            providerID: providerID,
            voice: voice
        )
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw HudTTSError.networkUnavailable(
                provider: providerID,
                message: "Groq TTS returned no HTTP response."
            )
        }
        guard (200...299).contains(http.statusCode) else {
            throw HudTTSError.providerRejectedRequest(
                provider: providerID,
                status: http.statusCode,
                message: Self.errorMessage(from: data)
                    ?? "Groq TTS failed (HTTP \(http.statusCode))."
            )
        }
        guard !data.isEmpty else {
            throw HudTTSError.synthesisFailed(
                provider: providerID,
                message: "Groq returned empty audio."
            )
        }
    }

    private static func errorMessage(from data: Data) -> String? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let error = json["error"] as? [String: Any],
            let message = error["message"] as? String
        else { return nil }
        return "Groq TTS: \(message)"
    }

    private static func clamp(_ value: Double, min: Double, max: Double) -> Double {
        Swift.min(Swift.max(value, min), max)
    }
}
