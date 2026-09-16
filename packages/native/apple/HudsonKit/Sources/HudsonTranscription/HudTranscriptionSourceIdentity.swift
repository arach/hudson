import Foundation

public struct HudTranscriptionSourceIdentity: Codable, Hashable, Sendable {
    public var id: String
    public var kind: String
    public var digest: String?

    public init(id: String, kind: String, digest: String? = nil) {
        self.id = id
        self.kind = kind
        self.digest = digest
    }
}
