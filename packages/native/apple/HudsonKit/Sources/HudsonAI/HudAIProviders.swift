import Foundation

/// Namespace for HudAI provider adapters. Apps construct adapters via
/// `HudAIProviders.<Vendor>` so the call site reads as a clear vendor
/// selection instead of a free-floating type name.
///
/// ```swift
/// let client = HudAIClient(
///     provider: HudAIProviders.Anthropic(),
///     credentialSource: HudVaultCredentialSource(vault: vault)
/// )
/// ```
///
/// Vendor coverage in v1: **Anthropic** is fully implemented. Stubs exist
/// for `OpenAI`, `OpenRouter`, and `Grok` so apps can wire the types and
/// get a clear `.unsupportedFeature` error until those adapters land.
/// `OpenAI` is intended to become an OpenAI-compatible base that
/// DeepSeek / Fireworks / Together can extend with thin variants per the
/// HudAI spec.
public enum HudAIProviders {}

// MARK: - Stub adapters

/// Internal helper for stub adapters — every operation throws
/// `.unsupportedFeature` so callers get a clear error pointing at the
/// missing implementation.
private struct StubAdapterImpl {
    let provider: HudAIProviderID

    func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse {
        throw HudAIError.unsupportedFeature(provider: provider, feature: "adapter not implemented yet")
    }

    func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish(throwing: HudAIError.unsupportedFeature(provider: provider, feature: "adapter not implemented yet"))
        }
    }

    func listModels(context: HudAIAdapterContext) async throws -> [HudAIModelInfo] {
        throw HudAIError.unsupportedFeature(provider: provider, feature: "adapter not implemented yet")
    }
}

/// Stub for OpenAI. Throws `.unsupportedFeature` on any call until the
/// adapter is implemented. Construction is allowed so apps can declare
/// their intended provider in code paths that won't run yet.
public struct HudAIOpenAIAdapter: HudAIProviderAdapter {
    public var providerID: HudAIProviderID { .openai }
    public var displayName: String { "OpenAI" }
    public var defaultModel: String { "gpt-4o-mini" }
    public var credentialKey: String { "openai_key" }
    public init() {}

    public func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse {
        try await StubAdapterImpl(provider: providerID).complete(request, context: context)
    }
    public func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        StubAdapterImpl(provider: providerID).stream(request, context: context)
    }
    public func listModels(context: HudAIAdapterContext) async throws -> [HudAIModelInfo] {
        try await StubAdapterImpl(provider: providerID).listModels(context: context)
    }
}

/// Stub for OpenRouter. Meta-provider routing to dozens of models.
public struct HudAIOpenRouterAdapter: HudAIProviderAdapter {
    public var providerID: HudAIProviderID { .openrouter }
    public var displayName: String { "OpenRouter" }
    public var defaultModel: String { "anthropic/claude-3.5-sonnet" }
    public var credentialKey: String { "openrouter_key" }
    public init() {}

    public func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse {
        try await StubAdapterImpl(provider: providerID).complete(request, context: context)
    }
    public func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        StubAdapterImpl(provider: providerID).stream(request, context: context)
    }
    public func listModels(context: HudAIAdapterContext) async throws -> [HudAIModelInfo] {
        try await StubAdapterImpl(provider: providerID).listModels(context: context)
    }
}

/// Stub for Grok (xAI).
public struct HudAIGrokAdapter: HudAIProviderAdapter {
    public var providerID: HudAIProviderID { .grok }
    public var displayName: String { "Grok" }
    public var defaultModel: String { "grok-2-1212" }
    public var credentialKey: String { "grok_key" }
    public init() {}

    public func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse {
        try await StubAdapterImpl(provider: providerID).complete(request, context: context)
    }
    public func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        StubAdapterImpl(provider: providerID).stream(request, context: context)
    }
    public func listModels(context: HudAIAdapterContext) async throws -> [HudAIModelInfo] {
        try await StubAdapterImpl(provider: providerID).listModels(context: context)
    }
}

extension HudAIProviders {
    public typealias OpenAI = HudAIOpenAIAdapter
    public typealias OpenRouter = HudAIOpenRouterAdapter
    public typealias Grok = HudAIGrokAdapter
}
