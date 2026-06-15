import Foundation

public struct HudAIDefaults: Sendable {
    public var temperature: Double?
    public var maxOutputTokens: Int
    public var cache: HudAICachePolicy
    public var timeout: TimeInterval

    public init(temperature: Double? = nil, maxOutputTokens: Int = 1_024, cache: HudAICachePolicy = .automatic(), timeout: TimeInterval = 120) {
        self.temperature = temperature
        self.maxOutputTokens = maxOutputTokens
        self.cache = cache
        self.timeout = timeout
    }
}
