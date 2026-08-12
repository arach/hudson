import Foundation

/// Namespace for HudTTS provider adapters. Apps construct adapters via
/// `HudTTSProviders.<Vendor>` so the call site reads as a clear vendor
/// selection instead of a free-floating type name.
///
/// ```swift
/// let tts = HudTTS(credentialSource: vault)
/// try await tts.speak("Hello", providerID: .openai, voice: "alloy")
/// ```
public enum HudTTSProviders {
    public static func defaultCloudAdapters() -> [any HudTTSProviderAdapter] {
        [
            OpenAI(),
            ElevenLabs(),
            Groq(),
            Gemini()
        ]
    }
}

extension HudTTSProviders {
    public typealias OpenAI = OpenAIHudTTSProvider
    public typealias ElevenLabs = ElevenLabsHudTTSProvider
    public typealias Groq = GroqHudTTSProvider
    public typealias Gemini = GeminiHudTTSProvider
}
