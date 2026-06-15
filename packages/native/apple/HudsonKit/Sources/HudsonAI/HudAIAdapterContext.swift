import Foundation

public struct HudAIAdapterContext: Sendable {
    public var credentialSource: any HudAICredentialSource
    public var defaults: HudAIDefaults
    public var urlSession: URLSession

    public init(credentialSource: any HudAICredentialSource, defaults: HudAIDefaults, urlSession: URLSession) {
        self.credentialSource = credentialSource
        self.defaults = defaults
        self.urlSession = urlSession
    }

    public func apiKey(for adapter: any HudAIProviderAdapter) async throws -> String {
        guard let data = try await credentialSource.get(adapter.credentialKey) else {
            throw HudAIError.credentialsMissing(provider: adapter.providerID, key: adapter.credentialKey)
        }
        guard let key = String(data: data, encoding: .utf8), !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw HudAIError.credentialsInvalid(provider: adapter.providerID, key: adapter.credentialKey)
        }
        return key.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
