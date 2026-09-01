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
    /// Cloud adapters that are safe to register by default.
    ///
    /// This list is also the default selectable set for `HudTTS` /
    /// `HudTTSClient`. It does **not** include Microsoft Edge Read Aloud.
    /// That adapter uses an unofficial, unsupported Microsoft consumer
    /// endpoint and sends spoken text off-device; opt in explicitly:
    ///
    /// ```swift
    /// let tts = HudTTS(
    ///     credentialSource: vault,
    ///     adapters: HudTTSProviders.defaultCloudAdapters() + [
    ///         HudTTSProviders.EdgeReadAloud()
    ///     ]
    /// )
    /// ```
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
    public typealias EdgeReadAloud = EdgeReadAloudHudTTSProvider
}
