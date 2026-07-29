import Testing
@testable import HudsonVoice

@Suite("HudSpeech")
struct HudSpeechTests {
    @Test("model ids resolve to their owning provider")
    func modelOwnership() {
        #expect(HudSpeechProvider.owning(modelId: "avspeech:system") == .system)
        #expect(HudSpeechProvider.owning(modelId: "not-a-model") == nil)
    }

    @Test("blank credentials are unavailable at initialization")
    func blankCredentialsAreUnavailable() async {
        let synthesizer = HudSpeechSynthesizer(credentials: [
            .openAI: "  \n",
            .elevenLabs: "test-key",
        ])

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
