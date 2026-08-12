#if canImport(AVFoundation)
import AVFoundation
import Observation

/// Hudson text-to-speech entry point.
///
/// Import `HudsonUIAudio` and construct a single `HudTTS` instance. It routes
/// on-device speech through `AVSpeechSynthesizer` and cloud providers through
/// the adapter layer in `TTS/Adapters`.
///
/// ```swift
/// let tts = HudTTS(credentialSource: vault)
/// try await tts.speak("Hello", providerID: .openai, voice: "alloy")
/// ```
@MainActor
@Observable
public final class HudTTS {
    public private(set) var isSpeaking = false {
        didSet {
            guard oldValue != isSpeaking else { return }
            onSpeakingChanged?(isSpeaking)
        }
    }

    /// Called whenever speaking state changes — useful for app-level wrappers.
    public var onSpeakingChanged: (@MainActor (Bool) -> Void)?

    public var currentTime: TimeInterval? {
        switch activePlayback {
        case .cloud:
            speechPlayer.currentTime
        case .system, .none:
            nil
        }
    }

    public var duration: TimeInterval? {
        switch activePlayback {
        case .cloud:
            speechPlayer.duration > 0 ? speechPlayer.duration : nil
        case .system, .none:
            nil
        }
    }

    private let client: HudTTSClient
    private let systemSpeech = HudSystemSpeechSynthesizer.shared
    private let speechPlayer = HudSpeechPlayer()

    private enum ActivePlayback {
        case none
        case system
        case cloud
    }

    private var activePlayback: ActivePlayback = .none

    public init(
        credentialSource: any HudTTSCredentialSource,
        urlSession: URLSession = .shared,
        requestTimeout: TimeInterval = 60,
        adapters: [any HudTTSProviderAdapter] = HudTTSProviders.defaultCloudAdapters()
    ) {
        self.client = HudTTSClient(
            credentialSource: credentialSource,
            urlSession: urlSession,
            requestTimeout: requestTimeout,
            adapters: adapters
        )
    }

    public func providerStatuses() async -> [HudTTSProviderStatus] {
        await client.providerStatuses()
    }

    public func isProviderAvailable(_ providerID: HudTTSProviderID) async -> Bool {
        await providerStatuses().first(where: { $0.id == providerID })?.isAvailable ?? false
    }

    public func synthesize(
        _ text: String,
        providerID: HudTTSProviderID,
        voice: String? = nil,
        rate: Double = 1.0,
        model: String? = nil,
        instructions: String? = nil,
        systemVoiceIdentifier: String? = nil
    ) async throws -> HudTTSResult {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw HudTTSError.emptyInput
        }

        switch providerID {
        case .system:
            let voiceIdentifier = systemVoiceIdentifier ?? voice ?? systemSpeech.selectedVoiceIdentifier
            let audioData = try await systemSpeech.synthesizeAudioData(
                trimmed,
                voiceIdentifier: voiceIdentifier
            )
            return HudTTSResult(
                audioData: audioData,
                format: .caf,
                providerID: .system,
                voice: voiceIdentifier ?? HudSystemSpeechDefaults.defaultVoiceIdentifier
            )

        default:
            return try await client.synthesize(
                HudTTSRequest(
                    text: trimmed,
                    voice: voice,
                    rate: rate,
                    model: model,
                    instructions: instructions
                ),
                providerID: providerID
            )
        }
    }

    public func speak(
        _ text: String,
        providerID: HudTTSProviderID,
        voice: String? = nil,
        rate: Double = 1.0,
        model: String? = nil,
        instructions: String? = nil,
        systemVoiceIdentifier: String? = nil
    ) async throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        stop()
        isSpeaking = true

        switch providerID {
        case .system:
            activePlayback = .system
            systemSpeech.speak(trimmed, voiceIdentifier: systemVoiceIdentifier ?? voice) { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.activePlayback = .none
                    self.isSpeaking = false
                }
            }

        default:
            let result = try await client.synthesize(
                HudTTSRequest(
                    text: trimmed,
                    voice: voice,
                    rate: rate,
                    model: model,
                    instructions: instructions
                ),
                providerID: providerID
            )
            activePlayback = .cloud
            try speechPlayer.play(data: result.audioData) { [weak self] in
                Task { @MainActor in
                    guard let self else { return }
                    self.activePlayback = .none
                    self.isSpeaking = false
                }
            }
            isSpeaking = speechPlayer.isPlaying

        }
    }

    public func pauseOrResume() {
        switch activePlayback {
        case .system:
            systemSpeech.pauseOrResume()
            isSpeaking = systemSpeech.isSpeaking
        case .cloud:
            speechPlayer.pauseOrResume()
            isSpeaking = speechPlayer.isPlaying
        case .none:
            break
        }
    }

    @discardableResult
    public func seek(to time: TimeInterval) -> Bool {
        switch activePlayback {
        case .cloud:
            return speechPlayer.seek(to: time)
        case .system, .none:
            return false
        }
    }

    public func stop() {
        systemSpeech.stop()
        speechPlayer.stop()
        activePlayback = .none
        isSpeaking = false
    }
}
#endif
