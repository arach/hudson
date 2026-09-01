import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudTTS speak lifecycle")
@MainActor
struct HudTTSSpeakTests {
    @Test("generation failure clears speaking state")
    func generationFailureClearsSpeakingState() async {
        let player = RecordingSpeechPlayer()
        let tts = HudTTS(
            credentialSource: StaticSpeakCredentialSource(),
            adapters: [
                FailingTTSAdapter(
                    error: .synthesisFailed(provider: .groq, message: "boom")
                )
            ],
            speechPlayer: player
        )

        do {
            try await tts.speak("Hello", providerID: .groq)
            Issue.record("Expected synthesisFailed")
        } catch let HudTTSError.synthesisFailed(provider, message) {
            #expect(provider == .groq)
            #expect(message == "boom")
        } catch {
            Issue.record("Expected synthesisFailed, got \(error)")
        }

        #expect(!tts.isSpeaking)
        #expect(player.playCount == 0)
    }

    @Test("stop during generation fences the late result")
    func stopDuringGenerationDoesNotStartAudio() async throws {
        let gate = SpeakGate()
        let player = RecordingSpeechPlayer()
        let tts = HudTTS(
            credentialSource: StaticSpeakCredentialSource(),
            adapters: [HoldingTTSAdapter(gate: gate, holdText: "held")],
            speechPlayer: player
        )

        let speakTask = Task { @MainActor in
            try await tts.speak("held", providerID: .groq)
        }
        await gate.waitUntilStarted()
        #expect(tts.isSpeaking)

        tts.stop()
        #expect(!tts.isSpeaking)
        await gate.release()
        try await speakTask.value

        #expect(player.playCount == 0)
        #expect(!tts.isSpeaking)
    }

    @Test("stale completion does not clear a newer request")
    func staleCompletionDoesNotClearNewerRequest() async throws {
        let gate = SpeakGate()
        let player = RecordingSpeechPlayer()
        let tts = HudTTS(
            credentialSource: StaticSpeakCredentialSource(),
            adapters: [HoldingTTSAdapter(gate: gate, holdText: "two")],
            speechPlayer: player
        )

        try await tts.speak("one", providerID: .groq)
        #expect(tts.isSpeaking)
        #expect(player.playCount == 1)
        let staleCompletion = player.takeCompletion()

        let second = Task { @MainActor in
            try await tts.speak("two", providerID: .groq)
        }
        await gate.waitUntilStarted()
        #expect(tts.isSpeaking)

        staleCompletion?()
        await Task.yield()
        await Task.yield()
        #expect(tts.isSpeaking)
        #expect(player.playCount == 1)

        await gate.release()
        try await second.value
        #expect(player.playCount == 2)
        #expect(tts.isSpeaking)
    }

    @Test("play() failure clears speaking state")
    func playFalseClearsSpeakingState() async {
        let player = RecordingSpeechPlayer()
        player.playError = HudTTSError.playbackFailed(message: "Speech audio could not be played.")
        let tts = HudTTS(
            credentialSource: StaticSpeakCredentialSource(),
            adapters: [ImmediateTTSAdapter()],
            speechPlayer: player
        )

        do {
            try await tts.speak("Hello", providerID: .groq)
            Issue.record("Expected playbackFailed")
        } catch let HudTTSError.playbackFailed(message) {
            #expect(message.contains("could not be played"))
        } catch {
            Issue.record("Expected playbackFailed, got \(error)")
        }

        #expect(!tts.isSpeaking)
        #expect(player.playCount == 0)
    }
}

private struct StaticSpeakCredentialSource: HudTTSCredentialSource {
    func get(_ key: String) async throws -> Data? {
        Data("test-key".utf8)
    }
}

private actor SpeakGate {
    private var started: CheckedContinuation<Void, Never>?
    private var proceed: CheckedContinuation<Void, Never>?
    private var didStart = false
    private var released = false

    func waitUntilStarted() async {
        if didStart { return }
        await withCheckedContinuation { started = $0 }
    }

    func markStartedAndWait() async {
        didStart = true
        started?.resume()
        started = nil
        if released { return }
        await withCheckedContinuation { proceed = $0 }
    }

    func release() {
        released = true
        proceed?.resume()
        proceed = nil
    }
}

private struct HoldingTTSAdapter: HudTTSProviderAdapter {
    let gate: SpeakGate
    let holdText: String

    var providerID: HudTTSProviderID { .groq }
    var displayName: String { "Hold" }
    var credentialKey: String? { nil }
    var defaultVoice: String { "autumn" }

    func isAvailable(context: HudTTSAdapterContext) async -> Bool { true }

    func synthesize(
        _ request: HudTTSRequest,
        context: HudTTSAdapterContext
    ) async throws -> HudTTSResult {
        if request.text == holdText {
            await gate.markStartedAndWait()
        }
        return HudTTSResult(
            audioData: Data(request.text.utf8),
            format: .mp3,
            providerID: providerID,
            voice: defaultVoice
        )
    }
}

private struct ImmediateTTSAdapter: HudTTSProviderAdapter {
    var providerID: HudTTSProviderID { .groq }
    var displayName: String { "Immediate" }
    var credentialKey: String? { nil }
    var defaultVoice: String { "autumn" }

    func isAvailable(context: HudTTSAdapterContext) async -> Bool { true }

    func synthesize(
        _ request: HudTTSRequest,
        context: HudTTSAdapterContext
    ) async throws -> HudTTSResult {
        HudTTSResult(
            audioData: Data(request.text.utf8),
            format: .mp3,
            providerID: providerID,
            voice: defaultVoice
        )
    }
}

private struct FailingTTSAdapter: HudTTSProviderAdapter {
    let error: HudTTSError

    var providerID: HudTTSProviderID { .groq }
    var displayName: String { "Failing" }
    var credentialKey: String? { nil }
    var defaultVoice: String { "autumn" }

    func isAvailable(context: HudTTSAdapterContext) async -> Bool { true }

    func synthesize(
        _ request: HudTTSRequest,
        context: HudTTSAdapterContext
    ) async throws -> HudTTSResult {
        throw error
    }
}

@MainActor
private final class RecordingSpeechPlayer: HudSpeechPlaying {
    private(set) var playCount = 0
    private var completionHandler: (() -> Void)?
    var playError: Error?
    var isPlaying = false
    var currentTime: TimeInterval = 0
    var duration: TimeInterval = 1

    func play(data: Data, format: HudTTSAudioFormat?, completion: (() -> Void)?) throws {
        if let playError {
            throw playError
        }
        playCount += 1
        completionHandler = completion
        isPlaying = true
    }

    func pauseOrResume() {}

    func seek(to time: TimeInterval) -> Bool { false }

    func stop() {
        isPlaying = false
        completionHandler = nil
    }

    func takeCompletion() -> (() -> Void)? {
        let completion = completionHandler
        completionHandler = nil
        return completion
    }
}
