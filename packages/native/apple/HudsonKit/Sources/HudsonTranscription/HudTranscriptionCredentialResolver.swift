import Foundation

/// Host-injected resolver. Adapters receive this at construction, not via configuration JSON.
public protocol HudTranscriptionCredentialResolver: Sendable {
    func credential(for reference: HudTranscriptionCredentialReference) async throws -> Data
}
