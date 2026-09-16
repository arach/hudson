import Foundation

public struct HudTranscriptionPlatform: RawRepresentable, Codable, Hashable, Sendable, ExpressibleByStringLiteral {
    public var rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public init(stringLiteral value: String) {
        self.rawValue = value
    }

    public static let macOS = HudTranscriptionPlatform(rawValue: "macOS")
    public static let iOS = HudTranscriptionPlatform(rawValue: "iOS")
}
