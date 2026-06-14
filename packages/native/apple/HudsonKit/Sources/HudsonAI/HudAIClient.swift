import Foundation
import HudsonUI

public struct HudAIClient: Sendable {
    public var provider: any HudAIProviderAdapter
    public var model: String?
    public var vault: any HudAICredentialSource
    public var defaults: HudAIDefaults
    public var routeDefault: HudAIRoute
    public var urlSession: URLSession

    public init(
        provider: any HudAIProviderAdapter = AnthropicHudAIAdapter(),
        model: String? = nil,
        vault: any HudAICredentialSource,
        defaults: HudAIDefaults = HudAIDefaults(),
        routeDefault: HudAIRoute = .local,
        urlSession: URLSession = .shared
    ) {
        self.provider = provider
        self.model = model
        self.vault = vault
        self.defaults = defaults
        self.routeDefault = routeDefault
        self.urlSession = urlSession
    }

    public init(
        provider: any HudAIProviderAdapter = AnthropicHudAIAdapter(),
        model: String? = nil,
        hudVault: HudVault,
        defaults: HudAIDefaults = HudAIDefaults(),
        routeDefault: HudAIRoute = .local,
        urlSession: URLSession = .shared
    ) {
        self.init(
            provider: provider,
            model: model,
            vault: HudVaultCredentialSource(vault: hudVault),
            defaults: defaults,
            routeDefault: routeDefault,
            urlSession: urlSession
        )
    }

    public func complete(_ request: HudAIRequest) async throws -> HudAIResponse {
        let resolved = try resolvedRequest(request)
        return try await provider.complete(resolved, context: context)
    }

    public func stream(_ request: HudAIRequest) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let resolved = try resolvedRequest(request)
                    for try await event in provider.stream(resolved, context: context) {
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch let error as HudAIError {
                    continuation.yield(.failed(error))
                    continuation.finish(throwing: error)
                } catch is CancellationError {
                    continuation.yield(.cancelled)
                    continuation.finish(throwing: HudAIError.cancelled(provider: provider.providerID))
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    public func listModels(provider _: HudAIProviderID? = nil) async throws -> [HudAIModelInfo] {
        try await provider.listModels(context: context)
    }

    private var context: HudAIAdapterContext {
        HudAIAdapterContext(credentialSource: vault, defaults: defaults, urlSession: urlSession)
    }

    private func resolvedRequest(_ request: HudAIRequest) throws -> HudAIRequest {
        let route = request.route ?? routeDefault
        guard route.requiresLocalExecution else {
            throw HudAIError.pairingChannelUnavailable(message: "HudAI paired-device routing is represented in v1 but not implemented yet")
        }

        var next = request
        if next.model == nil { next.model = model ?? provider.defaultModel }
        if next.maxOutputTokens == nil { next.maxOutputTokens = defaults.maxOutputTokens }
        if next.temperature == nil { next.temperature = defaults.temperature }
        if next.cache == nil { next.cache = defaults.cache }
        next.route = .local
        return next
    }
}
