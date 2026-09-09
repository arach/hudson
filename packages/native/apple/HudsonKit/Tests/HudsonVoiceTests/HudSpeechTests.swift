import Testing
@testable import HudsonVoice

@Suite("HudSpeech")
struct HudSpeechTests {
    @Test("model ids resolve to their owning provider")
    func modelOwnership() {
        #expect(HudSpeechProvider.owning(modelId: "avspeech:system") == .system)
        #expect(HudSpeechProvider.owning(modelId: "gpt-4o-mini-tts") == .openAI)
        #expect(HudSpeechProvider.owning(modelId: "magpie-tts-multilingual") == .nvidia)
        #expect(HudSpeechProvider.owning(modelId: "canopylabs/orpheus-v1-english") == .groq)
        #expect(HudSpeechProvider.owning(modelId: "canopylabs/orpheus-arabic-saudi") == .groq)
        #expect(HudSpeechProvider.owning(modelId: "gemini-2.5-flash-preview-tts") == .gemini)
        #expect(HudSpeechProvider.owning(modelId: "gemini-2.5-pro-preview-tts") == .gemini)
        #expect(HudSpeechProvider.owning(modelId: "gemini-3.1-flash-tts-preview") == .gemini)
        #expect(HudSpeechProvider.owning(modelId: "not-a-model") == nil)
        #expect(HudSpeechProvider.owning(modelId: "system") == nil)
    }

    @Test("credentials are trimmed and blank values are unavailable")
    func credentialsAreNormalized() async {
        let input: [HudSpeechProvider: String] = [
            .openAI: "  \n",
            .elevenLabs: " test-key\n",
            .nvidia: "\t",
            .groq: " groq-key ",
            .gemini: "",
        ]
        let cleaned = HudSpeechSynthesizer.cleanedCredentials(input)

        #expect(cleaned[.openAI] == nil)
        #expect(cleaned[.elevenLabs] == "test-key")
        #expect(cleaned[.nvidia] == nil)
        #expect(cleaned[.groq] == "groq-key")
        #expect(cleaned[.gemini] == nil)

        let synthesizer = HudSpeechSynthesizer(credentials: input)

        let providers = await synthesizer.availableProviders()

        #expect(!providers.contains(.openAI))
        #expect(providers.contains(.elevenLabs))
        #expect(providers.contains(.system))
        #expect(!providers.contains(.nvidia))
        #expect(providers.contains(.groq))
        #expect(!providers.contains(.gemini))
    }

    @Test("unlent providers suppress ambient credential fallback")
    func unlentProvidersSuppressAmbientCredentials() {
        let config = HudSpeechSynthesizer.config(credentials: [:])
        let providers = Dictionary(uniqueKeysWithValues: config.providers.map { ($0.id, $0) })

        #expect(providers["openai"]?.env?["OPENAI_API_KEY"] == "")
        #expect(providers["elevenlabs"]?.env?["ELEVENLABS_API_KEY"] == "")
        #expect(providers["minimax"]?.env?["MINIMAX_API_KEY"] == "")
        #expect(providers["nvidia"]?.env?["NV_API_KEY"] == "")
        #expect(providers["nvidia"]?.env?["NVIDIA_API_KEY"] == "")
        #expect(providers["groq"]?.env?["GROQ_API_KEY"] == "")
        #expect(providers["gemini"]?.env?["GEMINI_API_KEY"] == "")
        #expect(providers["gemini"]?.env?["GOOGLE_API_KEY"] == "")
        #expect(providers["gemini"]?.env?["GOOGLE_GENAI_API_KEY"] == "")
        #expect(providers["avspeech"]?.env == nil)
    }

    @Test("lent credentials fill every alias key Vox consults")
    func lentCredentialsFillAliasKeys() {
        let config = HudSpeechSynthesizer.config(credentials: [
            .nvidia: "nv-secret",
            .gemini: "gemini-secret",
        ])
        let providers = Dictionary(uniqueKeysWithValues: config.providers.map { ($0.id, $0) })

        #expect(providers["nvidia"]?.env?["NV_API_KEY"] == "nv-secret")
        #expect(providers["nvidia"]?.env?["NVIDIA_API_KEY"] == "nv-secret")
        #expect(providers["gemini"]?.env?["GEMINI_API_KEY"] == "gemini-secret")
        #expect(providers["gemini"]?.env?["GOOGLE_API_KEY"] == "gemini-secret")
        #expect(providers["gemini"]?.env?["GOOGLE_GENAI_API_KEY"] == "gemini-secret")
        #expect(providers["groq"]?.env?["GROQ_API_KEY"] == "")
        #expect(providers["openai"]?.env?["OPENAI_API_KEY"] == "")
    }

    @Test("unlent provider models report unavailable")
    func unlentProviderModelsAreUnavailable() async {
        let models = await HudSpeechSynthesizer().models()
        let remoteModels = models.filter { $0.provider.requiresCredential }

        #expect(!remoteModels.isEmpty)
        #expect(remoteModels.allSatisfy { !$0.available })
        #expect(models.contains { $0.provider == .system && $0.available })
    }

    @Test("empty text fails before synthesis")
    func emptyTextFailsBeforeSynthesis() async {
        let synthesizer = HudSpeechSynthesizer()

        do {
            _ = try await synthesizer.synthesize(
                "  \n",
                modelId: "avspeech:system"
            )
            Issue.record("Expected empty text to be rejected")
        } catch let error as HudSpeechError {
            #expect(error == .emptyText)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }
}
