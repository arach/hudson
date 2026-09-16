import Foundation

public struct HudTranscriptionPCMFormat: Codable, Hashable, Sendable {
    public var sampleRate: Double
    public var channelCount: Int
    public var bitsPerSample: Int
    public var isFloat: Bool
    public var isInterleaved: Bool

    public init(
        sampleRate: Double,
        channelCount: Int,
        bitsPerSample: Int,
        isFloat: Bool = false,
        isInterleaved: Bool = true
    ) {
        self.sampleRate = sampleRate
        self.channelCount = channelCount
        self.bitsPerSample = bitsPerSample
        self.isFloat = isFloat
        self.isInterleaved = isInterleaved
    }
}
