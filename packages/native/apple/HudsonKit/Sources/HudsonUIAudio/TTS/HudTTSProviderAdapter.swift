import Foundation

public protocol HudTTSCredentialSource: Sendable {
    func get(_ key: String) async throws -> Data?
}

public protocol HudTTSProviderAdapter: Sendable {
    var providerID: HudTTSProviderID { get }
    var displayName: String { get }
    var credentialKey: String? { get }
    var defaultVoice: String { get }

    func isAvailable(context: HudTTSAdapterContext) async -> Bool
    func synthesize(_ request: HudTTSRequest, context: HudTTSAdapterContext) async throws -> HudTTSResult
}

public struct HudTTSAdapterContext: Sendable {
    public var credentialSource: any HudTTSCredentialSource
    public var urlSession: URLSession
    public var requestTimeout: TimeInterval

    public init(
        credentialSource: any HudTTSCredentialSource,
        urlSession: URLSession = .shared,
        requestTimeout: TimeInterval = 60
    ) {
        self.credentialSource = credentialSource
        self.urlSession = urlSession
        self.requestTimeout = requestTimeout
    }

    public func apiKey(for adapter: any HudTTSProviderAdapter) async throws -> String {
        guard let credentialKey = adapter.credentialKey else {
            throw HudTTSError.credentialsMissing(provider: adapter.providerID, key: "none")
        }

        guard let data = try await credentialSource.get(credentialKey) else {
            throw HudTTSError.credentialsMissing(provider: adapter.providerID, key: credentialKey)
        }

        guard
            let key = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !key.isEmpty
        else {
            throw HudTTSError.credentialsInvalid(provider: adapter.providerID, key: credentialKey)
        }

        return key
    }
}
