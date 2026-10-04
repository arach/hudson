import Foundation

public struct HudTranscriptionCandidate: Sendable {
    public var configuration: HudTranscriptionConfiguration
    public var adapterDescriptor: HudTranscriptionProviderDescriptor?
    public var compatibility: HudTranscriptionCompatibility
    public var readiness: HudTranscriptionReadiness

    public init(
        configuration: HudTranscriptionConfiguration,
        adapterDescriptor: HudTranscriptionProviderDescriptor?,
        compatibility: HudTranscriptionCompatibility,
        readiness: HudTranscriptionReadiness
    ) {
        self.configuration = configuration
        self.adapterDescriptor = adapterDescriptor
        self.compatibility = compatibility
        self.readiness = readiness
    }

    /// Unverified or unavailable candidates are never ready to run.
    public var canRun: Bool {
        compatibility.status == .supported && readiness.status == .ready
    }
}
