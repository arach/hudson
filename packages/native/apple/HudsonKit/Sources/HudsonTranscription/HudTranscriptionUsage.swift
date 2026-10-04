import Foundation

public struct HudTranscriptionUsage: Codable, Hashable, Sendable {
    public var billedAudioSeconds: Double?
    public var inputTokens: Int?
    public var outputTokens: Int?
    public var providerReported: [String: String]

    public init(
        billedAudioSeconds: Double? = nil,
        inputTokens: Int? = nil,
        outputTokens: Int? = nil,
        providerReported: [String: String] = [:]
    ) {
        self.billedAudioSeconds = billedAudioSeconds
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.providerReported = providerReported
    }
}
