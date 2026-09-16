import Foundation

public actor HudTranscriptionRegistry {
    private var adapters: [HudTranscriptionProviderID: any HudTranscriptionAdapter] = [:]
    private var saved: [String: HudTranscriptionConfiguration] = [:]

    public init() {}

    public func register(_ adapter: any HudTranscriptionAdapter) throws {
        let id = adapter.descriptor.id
        if adapters[id] != nil {
            throw HudTranscriptionError.duplicateProviderID(id)
        }
        adapters[id] = adapter
    }

    public func adapter(for id: HudTranscriptionProviderID) -> (any HudTranscriptionAdapter)? {
        adapters[id]
    }

    public func registeredDescriptors() -> [HudTranscriptionProviderDescriptor] {
        adapters.values.map(\.descriptor).sorted { $0.id.rawValue < $1.id.rawValue }
    }

    /// Keep a saved configuration even when its provider or model is currently unknown.
    public func retainSaved(_ configuration: HudTranscriptionConfiguration) {
        saved[configuration.secretFreeFingerprint] = configuration
    }

    public func retainedConfigurations() -> [HudTranscriptionConfiguration] {
        saved.values.sorted { $0.secretFreeFingerprint < $1.secretFreeFingerprint }
    }

    public func resolve(_ configuration: HudTranscriptionConfiguration) async -> HudTranscriptionResolvedConfiguration {
        retainSaved(configuration)
        guard let adapter = adapters[configuration.providerID] else {
            return .unknownProvider(configuration)
        }

        let discovered: [HudTranscriptionModelDescriptor]
        do {
            discovered = try await adapter.models(configuration: configuration)
        } catch {
            let readiness = HudTranscriptionReadiness.failed(
                "The engine could not report its availability. Check its configuration and try again.",
                lastProbe: Date()
            )
            return .recognized(
                adapter: adapter,
                configuration: configuration,
                model: nil,
                readiness: readiness
            )
        }

        let model = discovered.first { $0.id == configuration.modelID }
        let readiness: HudTranscriptionReadiness
        if model == nil {
            readiness = HudTranscriptionReadiness.unavailable(
                "Saved model \(configuration.modelID.rawValue) is not in the current catalog",
                lastProbe: Date()
            )
        } else {
            do {
                readiness = try await adapter.readiness(configuration: configuration)
            } catch {
                readiness = HudTranscriptionReadiness.failed(
                    "The engine could not report its availability. Check its configuration and try again.",
                    lastProbe: Date()
                )
            }
        }

        return .recognized(
            adapter: adapter,
            configuration: configuration,
            model: model,
            readiness: readiness
        )
    }

    public func candidates(for request: HudTranscriptionRequest) async -> [HudTranscriptionCandidate] {
        await evaluate(request: request, configurations: retainedConfigurations())
    }

    public func evaluate(
        request: HudTranscriptionRequest,
        configurations: [HudTranscriptionConfiguration]
    ) async -> [HudTranscriptionCandidate] {
        var results: [HudTranscriptionCandidate] = []
        for configuration in configurations {
            retainSaved(configuration)
            results.append(await evaluate(request: request, configuration: configuration))
        }
        return results
    }

    private func evaluate(
        request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async -> HudTranscriptionCandidate {
        guard let adapter = adapters[configuration.providerID] else {
            return HudTranscriptionCandidate(
                configuration: configuration,
                adapterDescriptor: nil,
                compatibility: .unsupported([
                    HudTranscriptionCompatibilityReason(
                        code: .unknownProvider,
                        message: "Provider \(configuration.providerID.rawValue) is not registered",
                        userExplanation: "This saved engine is not available in the current app."
                    ),
                ]),
                readiness: .unavailable(
                    "Provider \(configuration.providerID.rawValue) is not registered",
                    lastProbe: Date()
                )
            )
        }

        let compatibility = adapter.compatibility(request: request, configuration: configuration)
        let readiness: HudTranscriptionReadiness
        do {
            let catalog = try await adapter.models(configuration: configuration)
            if catalog.contains(where: { $0.id == configuration.modelID }) {
                readiness = try await adapter.readiness(configuration: configuration)
            } else {
                readiness = .unavailable("The saved model is not in this engine's current catalog.", lastProbe: Date())
            }
        } catch {
            return HudTranscriptionCandidate(
                configuration: configuration,
                adapterDescriptor: adapter.descriptor,
                compatibility: compatibility,
                readiness: .failed("The engine could not report its availability. Check its configuration and try again.", lastProbe: Date())
            )
        }

        return HudTranscriptionCandidate(
            configuration: configuration,
            adapterDescriptor: adapter.descriptor,
            compatibility: compatibility,
            readiness: readiness
        )
    }
}
