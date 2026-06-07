import Foundation

public struct OpenAIHudTTSProvider: HudTTSProviderAdapter {
    public var providerID: HudTTSProviderID { .openai }
    public var displayName: String { "OpenAI" }
    public var credentialKey: String? { "openai_key" }
    public var defaultVoice: String { "alloy" }

    public var model: String
    public var endpoint: URL

    public init(
        model: String = "tts-1",
        endpoint: URL = URL(string: "https://api.openai.com/v1/audio/speech")!
    ) {
        self.model = model
        self.endpoint = endpoint
    }

    public func isAvailable(context: HudTTSAdapterContext) async -> Bool {
        (try? await context.apiKey(for: self)) != nil
    }

    public func synthesize(_ request: HudTTSRequest, context: HudTTSAdapterContext) async throws -> HudTTSResult {
        let trimmed = request.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw HudTTSError.emptyInput }

        let apiKey = try await context.apiKey(for: self)
        let voice = resolvedVoice(request.voice)

        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = context.requestTimeout
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "model": model,
            "input": String(trimmed.prefix(4096)),
            "voice": voice,
            "response_format": "mp3",
            "speed": request.rate
        ]
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await context.urlSession.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HudTTSError.networkUnavailable(provider: providerID, message: "OpenAI TTS returned no HTTP response.")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = Self.errorMessage(from: data)
                ?? "OpenAI TTS failed (HTTP \(httpResponse.statusCode))."
            throw HudTTSError.providerRejectedRequest(
                provider: providerID,
                status: httpResponse.statusCode,
                message: message
            )
        }

        return HudTTSResult(
            audioData: data,
            format: .mp3,
            providerID: providerID,
            voice: voice
        )
    }

    private func resolvedVoice(_ voice: String?) -> String {
        let trimmed = voice?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? defaultVoice : trimmed
    }

    private static func errorMessage(from data: Data) -> String? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let error = json["error"] as? [String: Any],
            let message = error["message"] as? String
        else { return nil }
        return "OpenAI TTS: \(message)"
    }
}
