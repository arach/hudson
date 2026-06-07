import Foundation

public struct HudTTSClient: Sendable {
    public var credentialSource: any HudTTSCredentialSource
    public var urlSession: URLSession
    public var requestTimeout: TimeInterval
    public var adapters: [any HudTTSProviderAdapter]

    public init(
        credentialSource: any HudTTSCredentialSource,
        urlSession: URLSession = .shared,
        requestTimeout: TimeInterval = 60,
        adapters: [any HudTTSProviderAdapter] = HudTTSProviders.defaultCloudAdapters()
    ) {
        self.credentialSource = credentialSource
        self.urlSession = urlSession
        self.requestTimeout = requestTimeout
        self.adapters = adapters
    }

    public func adapter(for providerID: HudTTSProviderID) -> (any HudTTSProviderAdapter)? {
        adapters.first { $0.providerID == providerID }
    }

    public func providerStatuses() async -> [HudTTSProviderStatus] {
        let context = makeContext()
        var statuses: [HudTTSProviderStatus] = [
            HudTTSProviderStatus(
                id: .system,
                label: "On Device",
                isAvailable: true,
                defaultVoice: HudSystemSpeechDefaults.defaultVoiceIdentifier
            )
        ]

        for adapter in adapters {
            statuses.append(
                HudTTSProviderStatus(
                    id: adapter.providerID,
                    label: adapter.displayName,
                    isAvailable: await adapter.isAvailable(context: context),
                    defaultVoice: adapter.defaultVoice
                )
            )
        }

        return statuses
    }

    public func synthesize(
        _ request: HudTTSRequest,
        providerID: HudTTSProviderID
    ) async throws -> HudTTSResult {
        guard providerID != .system else {
            throw HudTTSError.synthesisFailed(
                provider: .system,
                message: "Use HudTTS.speak(providerID: .system) for on-device playback."
            )
        }

        guard let adapter = adapter(for: providerID) else {
            throw HudTTSError.unknownProvider(providerID.rawValue)
        }

        return try await adapter.synthesize(request, context: makeContext())
    }

    private func makeContext() -> HudTTSAdapterContext {
        HudTTSAdapterContext(
            credentialSource: credentialSource,
            urlSession: urlSession,
            requestTimeout: requestTimeout
        )
    }
}
