import Foundation

/// Opaque host credential handle. Never carries a secret value.
public struct HudTranscriptionCredentialReference: Codable, Hashable, Sendable {
    public var identifier: String

    public init(identifier: String) {
        self.identifier = identifier
    }
}
