import Testing
import VoxAppleSpeech
import VoxEngine
@testable import HudsonVoice

@Suite("HudSpeechPlayback")
struct HudSpeechPlaybackTests {
    @Test("speak snapshots host-lent credentials onto the Vox request")
    func speakDelegatesCanonicalRequest() async throws {
        let controller = RecordingPlaybackController()
        let playback = HudSpeechPlayback(
            controller: controller,
            credentials: [
                .openAI: "  \n",
                .groq: " groq-secret\n",
                .nvidia: "nv-secret",
            ]
        )

        let requestId = await playback.speak(
            "Hello from Hudson",
            modelId: "avspeech:system",
            voiceId: "com.apple.voice.compact.en-US.Samantha",
            speed: 1.0,
            requestId: "surface-request-1"
        )

        let request = try #require(await controller.requests.first)
        #expect(await controller.requests.count == 1)
        #expect(requestId == "surface-request-1")
        #expect(request.requestId == "surface-request-1")
        #expect(request.text == "Hello from Hudson")
        #expect(request.modelId == "avspeech:system")
        #expect(request.voiceId == "com.apple.voice.compact.en-US.Samantha")
        #expect(request.speed == 1.0)
        #expect(request.providerCredentials["GROQ_API_KEY"] == "groq-secret")
        #expect(request.providerCredentials["NV_API_KEY"] == "nv-secret")
        #expect(request.providerCredentials["NVIDIA_API_KEY"] == "nv-secret")
        #expect(request.providerCredentials["OPENAI_API_KEY"] == nil)
        #expect(request.providerCredentials["GEMINI_API_KEY"] == nil)
    }

    @Test("Vox lifecycle and resolved route map to Hudson-owned event types")
    func mapsLifecycleAndRoute() {
        let raw = SpeechOutputEvent(
            requestId: "surface-request-2",
            generation: 42,
            phase: .playing,
            synthesis: SpeechSynthesisIdentity(
                requestedModelId: "magpie-tts-multilingual",
                modelId: "magpie-tts-multilingual",
                requestedVoiceId: "Magpie-Multilingual.EN-US.Aria",
                voiceId: "Magpie-Multilingual.EN-US.Aria",
                backend: "nvidia",
                delivery: .generatedAudio
            ),
            audioOutput: SpeechAudioOutputRoute(kind: .generatedAudioPlayer)
        )

        let event = HudSpeechPlaybackEvent(raw)

        #expect(event.requestId == "surface-request-2")
        #expect(event.generation == 42)
        #expect(event.phase == .playing)
        #expect(event.provider == .nvidia)
        #expect(event.requestedModelId == "magpie-tts-multilingual")
        #expect(event.modelId == "magpie-tts-multilingual")
        #expect(event.voiceId == "Magpie-Multilingual.EN-US.Aria")
        #expect(event.delivery == .generatedAudio)
        #expect(event.audioOutput == .generatedAudioPlayer)
        #expect(event.error == nil)
    }

    @Test("unknown failed routes remain unclaimed instead of masquerading as system speech")
    func preservesUnknownFailedRoute() {
        let raw = SpeechOutputEvent(
            requestId: "bad-model",
            generation: 7,
            phase: .failed,
            synthesis: SpeechSynthesisIdentity(
                requestedModelId: "unknown:model",
                backend: nil,
                delivery: .generatedAudio
            ),
            audioOutput: SpeechAudioOutputRoute(kind: .generatedAudioPlayer),
            error: "Unknown model"
        )

        let event = HudSpeechPlaybackEvent(raw)

        #expect(event.phase == .failed)
        #expect(event.provider == nil)
        #expect(event.error == "Unknown model")
    }

    @Test("event mapping preserves generation so hosts can fence stale callbacks")
    func preservesGenerationForStaleEventFencing() {
        func event(generation: UInt64) -> HudSpeechPlaybackEvent {
            HudSpeechPlaybackEvent(
                SpeechOutputEvent(
                    requestId: "reused-by-host",
                    generation: generation,
                    phase: .finished,
                    synthesis: SpeechSynthesisIdentity(
                        requestedModelId: "avspeech:system",
                        backend: "avspeech",
                        delivery: .liveSystem
                    ),
                    audioOutput: SpeechAudioOutputRoute(kind: .systemSynthesizer)
                )
            )
        }

        let stale = event(generation: 11)
        let current = event(generation: 12)

        #expect(stale.requestId == current.requestId)
        #expect(stale.generation == 11)
        #expect(current.generation == 12)
        #expect(stale != current)
    }

    @Test("stop and cancel forward to the controller")
    func stopAndCancelDelegate() async {
        let controller = RecordingPlaybackController()
        let playback = HudSpeechPlayback(controller: controller, credentials: [:])

        await playback.stop()
        await playback.cancel()
        await playback.stop()

        #expect(await controller.stopCount == 2)
        #expect(await controller.cancelCount == 1)
        #expect(await controller.requests.isEmpty)
    }
}

private actor RecordingPlaybackController: HudSpeechPlaybackControlling {
    private(set) var requests: [SynthesisRequest] = []
    private(set) var stopCount = 0
    private(set) var cancelCount = 0

    func speak(_ request: SynthesisRequest) async {
        requests.append(request)
    }

    func stop() async {
        stopCount += 1
    }

    func cancel() async {
        cancelCount += 1
    }
}
