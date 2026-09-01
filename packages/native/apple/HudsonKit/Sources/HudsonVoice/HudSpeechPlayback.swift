import Foundation
import VoxAppleSpeech
import VoxCore
import VoxEngine

/// Lifecycle emitted by one Hudson speech playback surface.
public enum HudSpeechPlaybackPhase: String, Sendable, Codable, Equatable {
    case resolving
    case generating
    case starting
    case playing
    case finished
    case cancelled
    case failed
}

/// Whether a model speaks live through the OS or returns audio for playback.
public enum HudSpeechPlaybackDelivery: String, Sendable, Codable, Equatable {
    case liveSystem
    case generatedAudio
}

/// The physical Apple audio path used for the utterance.
public enum HudSpeechPlaybackOutput: String, Sendable, Codable, Equatable {
    case systemSynthesizer
    case generatedAudioPlayer
}

/// Hudson-owned, provider-aware playback event.
///
/// Requested identity is retained alongside the resolved identity so hosts can
/// report the route that actually spoke without importing Vox types.
public struct HudSpeechPlaybackEvent: Sendable, Equatable {
    public let requestId: String
    public let generation: UInt64
    public let phase: HudSpeechPlaybackPhase
    public let requestedModelId: String
    public let modelId: String
    public let requestedVoiceId: String?
    public let voiceId: String?
    public let backend: String?
    public let provider: HudSpeechProvider?
    public let delivery: HudSpeechPlaybackDelivery
    public let audioOutput: HudSpeechPlaybackOutput
    public let error: String?

    init(_ event: SpeechOutputEvent) {
        requestId = event.requestId
        generation = event.generation
        phase = HudSpeechPlaybackPhase(event.phase)
        requestedModelId = event.synthesis.requestedModelId
        modelId = event.synthesis.modelId
        requestedVoiceId = event.synthesis.requestedVoiceId
        voiceId = event.synthesis.voiceId
        backend = event.synthesis.backend
        provider = HudSpeechProvider.resolving(
            modelId: event.synthesis.modelId,
            backend: event.synthesis.backend
        )
        delivery = HudSpeechPlaybackDelivery(event.synthesis.delivery)
        audioOutput = HudSpeechPlaybackOutput(event.audioOutput.kind)
        error = event.error
    }
}

private extension HudSpeechPlaybackPhase {
    init(_ phase: SpeechOutputPhase) {
        switch phase {
        case .resolving: self = .resolving
        case .generating: self = .generating
        case .starting: self = .starting
        case .playing: self = .playing
        case .finished: self = .finished
        case .cancelled: self = .cancelled
        case .failed: self = .failed
        }
    }
}

private extension HudSpeechPlaybackDelivery {
    init(_ delivery: SpeechOutputDelivery) {
        switch delivery {
        case .liveSystem: self = .liveSystem
        case .generatedAudio: self = .generatedAudio
        }
    }
}

private extension HudSpeechPlaybackOutput {
    init(_ output: SpeechAudioOutputKind) {
        switch output {
        case .systemSynthesizer: self = .systemSynthesizer
        case .generatedAudioPlayer: self = .generatedAudioPlayer
        }
    }
}

/// Per-audible-surface spoken output. One instance owns one
/// `AppleSpeechOutputController`; there is no process-wide singleton and no
/// pause/seek state.
///
/// Credentials are host-lent and snapshotted at initialization. Construct a
/// new instance if the operator changes a key. The event callback is not
/// isolated to the main actor — hop if the host needs to touch UI.
public final class HudSpeechPlayback: Sendable {
    private let controller: any HudSpeechPlaybackControlling
    private let catalog: HudSpeechSynthesizer
    private let lentCredentials: [String: String]

    public init(
        credentials: [HudSpeechProvider: String] = [:],
        onEvent: (@Sendable (HudSpeechPlaybackEvent) -> Void)? = nil
    ) {
        let cleaned = HudSpeechSynthesizer.cleanedCredentials(credentials)
        let engine = TTSEngineManager(
            provider: TTSProviderRegistry(config: HudSpeechSynthesizer.config(credentials: cleaned))
        )
        self.catalog = HudSpeechSynthesizer(credentials: cleaned)
        self.lentCredentials = HudSpeechSynthesizer.lentCredentials(cleaned)
        self.controller = AppleSpeechOutputController(engine: engine, onEvent: { event in
            onEvent?(HudSpeechPlaybackEvent(event))
        })
    }

    init(
        controller: any HudSpeechPlaybackControlling,
        credentials: [HudSpeechProvider: String]
    ) {
        let cleaned = HudSpeechSynthesizer.cleanedCredentials(credentials)
        self.catalog = HudSpeechSynthesizer(credentials: cleaned)
        self.lentCredentials = HudSpeechSynthesizer.lentCredentials(cleaned)
        self.controller = controller
    }

    /// Models reachable with the credential snapshot held by this surface.
    public func models() async -> [HudSpeechModel] {
        await catalog.models()
    }

    /// Voices reachable with the credential snapshot held by this surface.
    public func voices(modelId: String) async throws -> [HudSpeechVoice] {
        try await catalog.voices(modelId: modelId)
    }

    /// Start speaking. A new request replaces any pending generation or playback.
    ///
    /// Pass canonical Vox model ids such as `avspeech:system`. UI aliases like
    /// `system` belong at the product boundary, not here.
    @discardableResult
    public func speak(
        _ text: String,
        modelId: String,
        voiceId: String? = nil,
        speed: Double? = nil,
        instructions: String? = nil,
        requestId: String = UUID().uuidString
    ) async -> String {
        let request = SynthesisRequest(
            requestId: requestId,
            text: text,
            modelId: modelId,
            voiceId: voiceId,
            speed: speed,
            instructions: instructions,
            providerCredentials: lentCredentials
        )
        await controller.speak(request)
        return requestId
    }

    /// Stop current generation and playback. Idempotent.
    public func stop() async {
        await controller.stop()
    }

    /// Cancel current generation and playback. Idempotent.
    public func cancel() async {
        await controller.cancel()
    }
}

protocol HudSpeechPlaybackControlling: Sendable {
    func speak(_ request: SynthesisRequest) async
    func stop() async
    func cancel() async
}

extension AppleSpeechOutputController: HudSpeechPlaybackControlling {}
