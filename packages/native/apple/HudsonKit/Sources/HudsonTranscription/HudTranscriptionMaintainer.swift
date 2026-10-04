import Foundation

public enum HudTranscriptionMaintainerKind: String, Codable, Hashable, Sendable {
    case maintained
    case custom
}

public struct HudTranscriptionMaintainer: Codable, Hashable, Sendable {
    public var kind: HudTranscriptionMaintainerKind
    public var name: String

    public init(kind: HudTranscriptionMaintainerKind, name: String) {
        self.kind = kind
        self.name = name
    }
}
