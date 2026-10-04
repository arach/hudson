import Foundation

public enum HudTranscriptionBatchEvent: Sendable, Equatable {
    case accepted(providerRequestID: String)
    case progress(message: String)
    case completed(HudTranscriptionResult)
    case cancellation(HudTranscriptionCancellationOutcome)
    case failed(HudTranscriptionError)
}
