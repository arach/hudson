import Foundation

public struct HudTranscriptionLocalModelReference: Codable, Hashable, Sendable {
    public var location: String

    public init(location: String) {
        self.location = location
    }
}
