import Foundation

public struct HudTranscriptionPCMChunk: Sendable, Equatable {
    public var sequence: UInt64
    public var bytes: Data
    public var sourceOffset: TimeInterval?

    public init(sequence: UInt64, bytes: Data, sourceOffset: TimeInterval? = nil) {
        self.sequence = sequence
        self.bytes = bytes
        self.sourceOffset = sourceOffset
    }
}
