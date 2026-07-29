import Testing
@testable import HudsonVoice

@Suite("HudSpeech")
struct HudSpeechTests {
    @Test("model ids resolve to their owning provider")
    func modelOwnership() {
        #expect(HudSpeechProvider.owning(modelId: "avspeech:system") == .system)
        #expect(HudSpeechProvider.owning(modelId: "not-a-model") == nil)
    }

    @Test("credentials are trimmed and blank values are unavailable")
    func credentialsAreNormalized() async {
        let input: [HudSpeechProvider: String] = [
            .openAI: "  \n",
            .elevenLabs: " test-key\n",
        ]
        let cleaned = HudSpeechSynthesizer.cleanedCredentials(input)

        #expect(cleaned[.openAI] == nil)
        #expect(cleaned[.elevenLabs] == "test-key")

        let synthesizer = HudSpeechSynthesizer(credentials: input)

        let providers = await synthesizer.availableProviders()

        #expect(!providers.contains(.openAI))
        #expect(providers.contains(.elevenLabs))
        #expect(providers.contains(.system))
    }

    @Test("unlent providers suppress ambient credential fallback")
    func unlentProvidersSuppressAmbientCredentials() {
        let config = HudSpeechSynthesizer.config(credentials: [:])
        let providers = Dictionary(uniqueKeysWithValues: config.providers.map { ($0.id, $0) })

        #expect(providers["openai"]?.env?["OPENAI_API_KEY"] == "")
        #expect(providers["elevenlabs"]?.env?["ELEVENLABS_API_KEY"] == "")
        #expect(providers["minimax"]?.env?["MINIMAX_API_KEY"] == "")
        #expect(providers["avspeech"]?.env == nil)
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
