import Foundation
import HudsonTranscription

public struct HudGeminiLiveAdapter: HudTranscriptionAdapter {
    public enum Profile: Sendable {
        case dedicated
        case conversationalInput

        public var model: String {
            switch self { case .dedicated: "gemini-3.5-transcribe-live"; case .conversationalInput: "gemini-3.8-live" }
        }
        var provider: HudTranscriptionProviderID {
            switch self { case .dedicated: "gemini-live-transcription"; case .conversationalInput: "gemini-live-input" }
        }
    }
    public typealias SocketFactory = @Sendable (URLRequest) async throws -> any HudTranscriptionSocket
    private let profile: Profile
    private let credentials: any HudTranscriptionCredentialResolver
    private let socketFactory: SocketFactory
    public let descriptor: HudTranscriptionProviderDescriptor

    public init(profile: Profile, credentials: any HudTranscriptionCredentialResolver,
                socketFactory: @escaping SocketFactory = { HudTranscriptionURLSocket(request: $0) }) {
        self.profile = profile
        self.credentials = credentials
        self.socketFactory = socketFactory
        descriptor = .init(id: profile.provider,
            displayName: profile == .dedicated ? "Gemini live transcription" : "Gemini Live input transcription",
            adapterVersion: "1", maintainer: .init(kind: .maintained, name: "Hudson"), origin: .remote,
            platforms: [.macOS, .iOS], configurationSchema: [
                .init(key: "credentialReference", displayName: "Gemini API key", kind: .credentialReference, required: true)
            ], modelDiscovery: .adapterMetadata)
    }

    public func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        [.init(id: .init(rawValue: profile.model), displayName: profile == .dedicated ? "Gemini 3.5 Transcribe Live" : "Gemini 3.8 Live — input transcription",
            supportsBatch: false, supportsLive: true, timing: .none, speakers: .none, inputFormats: ["pcm16le-mono-16000"],
            limits: .init(maximumSessionDuration: .seconds(600)),
            evidence: .init(documentationURL: URL(string: profile == .dedicated ? "https://ai.google.dev/gemini-api/docs/live-api/live-transcribe" : "https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live"),
                notes: profile == .dedicated ? "Dedicated speech recognition; ten-minute session limit." : "Separate conversational evaluation path. Audio output is generated and may be billed even though this adapter ignores it. Adapter limits sessions to ten minutes."))]
    }

    public func compatibility(request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) -> HudTranscriptionCompatibility {
        func reject(_ code: HudTranscriptionCompatibilityReasonCode, _ reason: String) -> HudTranscriptionCompatibility {
            .unsupported([.init(code: code, message: reason, userExplanation: reason)])
        }
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == profile.model else { return reject(.unknownModel, "Select a model supported by this Gemini live profile.") }
        guard case .pcm(let format) = request.audio else { return reject(.modeUnsupported, "This engine takes caller-fed live audio.") }
        guard format.sampleRate == 16000, format.channelCount == 1, format.bitsPerSample == 16, !format.isFloat else {
            return reject(.formatUnsupported, "Provide mono, 16 kHz, signed 16-bit little-endian PCM audio.")
        }
        guard !request.features.speakerLabels, !request.features.wordTiming else { return reject(.featureCombination, "This live path does not provide speaker labels or word timing.") }
        if profile == .conversationalInput && (!request.features.languageHints.isEmpty || !request.features.vocabularyHints.isEmpty || request.features.style == .clean || request.features.smartFormatting) {
            return reject(.featureCombination, "Vocabulary, language hints, and smart transcription are available through the dedicated transcription profile.")
        }
        guard request.features.vocabularyHints.count <= 1000 else { return reject(.featureCombination, "Gemini accepts at most 1,000 vocabulary hints.") }
        if let duration = request.duration, !duration.isFinite || duration < 0 || duration > 600 { return reject(.durationExceeded, "This adapter supports live sessions up to ten minutes.") }
        if let deadline = request.deadline, deadline <= Date() { return reject("deadline-expired", "The transcription deadline has passed.") }
        return .supported
    }

    public func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == profile.model else { return .unavailable("The selected live model is unavailable.") }
        guard (try? endpoint(configuration)) != nil else { return .init(status: .unconfigured, reason: "Configure an HTTPS Gemini endpoint.") }
        guard let reference = configuration.credentialReference else { return .init(status: .needsCredential) }
        let data = try await credentials.credential(for: reference)
        guard let key = String(data: data, encoding: .utf8), !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return .init(status: .needsCredential) }
        return .init(status: .ready, reason: "Configured locally. Account access is checked when connecting.")
    }

    public func openLive(_ request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) async throws -> any HudTranscriptionLiveSession {
        let compatibility = compatibility(request: request, configuration: configuration)
        guard compatibility.status == .supported else { throw HudTranscriptionError.invalidRequest(compatibility.reasons.first?.userExplanation ?? "Unsupported live request.") }
        let ready = try await readiness(configuration: configuration)
        guard ready.isReady else { throw HudTranscriptionError.notReady(ready) }
        guard let reference = configuration.credentialReference else { throw HudTranscriptionError.notReady(.init(status: .needsCredential)) }
        let data = try await credentials.credential(for: reference)
        guard let key = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty else { throw HudTranscriptionError.notReady(.init(status: .needsCredential)) }
        let socket = try await socketFactory(HudGeminiLiveConnection.socketRequest(endpoint: try endpoint(configuration), credential: key))
        let connection = HudGeminiLiveConnection(socket: socket, mode: profile == .dedicated ? .dedicatedTranscription : .conversationalInput)
        return try await HudGeminiLiveSession.open(connection: connection, request: request, configuration: configuration)
    }

    private func endpoint(_ configuration: HudTranscriptionConfiguration) throws -> HudTranscriptionEndpoint {
        guard let url = configuration.endpoint ?? URL(string: HudGeminiFileClient.defaultBaseURL) else { throw HudTranscriptionHTTPError.invalidEndpoint }
        return try .init(url)
    }
}
