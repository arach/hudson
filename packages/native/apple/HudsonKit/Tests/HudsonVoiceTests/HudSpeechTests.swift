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
