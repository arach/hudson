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
/// Vendor coverage in v1: Anthropic, OpenAI, and OpenRouter are implemented.
/// OpenAI-compatible variants should share `OpenAICompatibleBase` where their
/// wire protocol remains compatible with `/v1/chat/completions`. Grok remains
/// a clear `.unsupportedFeature` stub until its adapter lands.
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
    public typealias Grok = HudAIGrokAdapter
}
