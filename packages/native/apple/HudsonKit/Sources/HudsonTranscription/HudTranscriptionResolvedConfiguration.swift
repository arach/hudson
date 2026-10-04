import Foundation

public enum HudTranscriptionResolvedConfiguration: Sendable {
    case recognized(
        adapter: any HudTranscriptionAdapter,
        configuration: HudTranscriptionConfiguration,
        model: HudTranscriptionModelDescriptor?,
        readiness: HudTranscriptionReadiness
    )
    case unknownProvider(HudTranscriptionConfiguration)

    public var configuration: HudTranscriptionConfiguration {
        switch self {
        case .recognized(_, let configuration, _, _):
            return configuration
        case .unknownProvider(let configuration):
            return configuration
        }
    }

    public var modelID: HudTranscriptionModelID {
        configuration.modelID
    }
}
