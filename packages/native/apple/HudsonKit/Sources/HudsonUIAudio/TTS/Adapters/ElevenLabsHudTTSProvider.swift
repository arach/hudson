import Foundation

public struct ElevenLabsHudTTSProvider: HudTTSProviderAdapter {
    public var providerID: HudTTSProviderID { .elevenlabs }
    public var displayName: String { "ElevenLabs" }
    public var credentialKey: String? { "elevenlabs_key" }
    public var defaultVoice: String { "9BWtsMINqrJLrRacOk9x" }

    private static let readingSpeed = 0.92

    public var modelID: String

    public init(modelID: String = "eleven_multilingual_v2") {
        self.modelID = modelID
    }

    public func isAvailable(context: HudTTSAdapterContext) async -> Bool {
        (try? await context.apiKey(for: self)) != nil
    }

    public func synthesize(_ request: HudTTSRequest, context: HudTTSAdapterContext) async throws -> HudTTSResult {
        let trimmed = request.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw HudTTSError.emptyInput }

        let apiKey = try await context.apiKey(for: self)
        let voiceID = resolvedVoice(request.voice)

        guard let endpoint = URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voiceID)") else {
            throw HudTTSError.synthesisFailed(provider: providerID, message: "Could not build the ElevenLabs request URL.")
        }

        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = context.requestTimeout
        urlRequest.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("audio/mpeg", forHTTPHeaderField: "Accept")

        let body: [String: Any] = [
            "text": String(trimmed.prefix(5000)),
            "model_id": modelID,
            "voice_settings": [
                "stability": 0.58,
                "similarity_boost": 0.78,
                "style": 0.04,
                "use_speaker_boost": true,
                "speed": Self.clamp(request.rate * Self.readingSpeed, min: 0.7, max: 1.2)
            ]
        ]
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await context.urlSession.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HudTTSError.networkUnavailable(provider: providerID, message: "ElevenLabs TTS returned no HTTP response.")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            throw HudTTSError.providerRejectedRequest(
                provider: providerID,
                status: httpResponse.statusCode,
                message: message?.isEmpty == false ? message! : "ElevenLabs TTS failed (HTTP \(httpResponse.statusCode))."
            )
        }

        return HudTTSResult(
            audioData: data,
            format: .mp3,
            providerID: providerID,
            voice: voiceID
        )
    }

    private func resolvedVoice(_ voice: String?) -> String {
        let trimmed = voice?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? defaultVoice : trimmed
    }

    private static func clamp(_ value: Double, min: Double, max: Double) -> Double {
        Swift.min(Swift.max(value, min), max)
    }
}
