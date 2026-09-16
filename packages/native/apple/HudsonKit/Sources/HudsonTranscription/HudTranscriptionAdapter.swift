import Foundation

public protocol HudTranscriptionAdapter: Sendable {
    var descriptor: HudTranscriptionProviderDescriptor { get }

    func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor]
    func compatibility(
        request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) -> HudTranscriptionCompatibility
    func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness
    func prepare(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness
    func submit(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionBatchOperation
    func openLive(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionLiveSession
}

extension HudTranscriptionAdapter {
    public func prepare(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        try await readiness(configuration: configuration)
    }

    public func submit(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionBatchOperation {
        throw HudTranscriptionError.unsupportedMode(.batch)
    }

    public func openLive(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionLiveSession {
        throw HudTranscriptionError.unsupportedMode(.live)
    }
}
