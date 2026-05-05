import Foundation

extension HudAIProviders {
    public typealias OpenRouter = OpenRouterHudAIAdapter
}

public typealias HudAIOpenRouterAdapter = OpenRouterHudAIAdapter

/// OpenRouter is an OpenAI-compatible meta-provider. It uses the same Chat
/// Completions wire shape as `OpenAICompatibleBase`, but model ids are
/// conventionally provider-namespaced, for example
/// `anthropic/claude-3.5-sonnet`, `openai/gpt-4o-mini`, or
/// `deepseek/deepseek-chat`.
public struct OpenRouterHudAIAdapter: HudAIProviderAdapter {
    public var providerID: HudAIProviderID { .openrouter }
    public var displayName: String { "OpenRouter" }
    public var defaultModel: String { "anthropic/claude-3.5-sonnet" }
    public var credentialKey: String { "openrouter_key" }

    public var endpoint: URL
    public var appTitle: String?
    public var siteURL: URL?

    public init(
        endpoint: URL = URL(string: "https://openrouter.ai/api/v1/chat/completions")!,
        appTitle: String? = nil,
        siteURL: URL? = nil
    ) {
        self.endpoint = endpoint
        self.appTitle = appTitle
        self.siteURL = siteURL
    }

    private var base: OpenAICompatibleBase {
        var headers: [String: String] = [:]
        if let appTitle { headers["X-Title"] = appTitle }
        if let siteURL { headers["HTTP-Referer"] = siteURL.absoluteString }
        return OpenAICompatibleBase(
            providerID: providerID,
            defaultModel: defaultModel,
            endpoint: endpoint,
            extraHeaders: headers,
            modelNamespaceDescription: "OpenRouter model ids are provider/model strings, e.g. anthropic/claude-3.5-sonnet."
        )
    }

    public func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse {
        try await base.complete(request, context: context, apiKey: try await context.apiKey(for: self))
    }

    public func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let apiKey = try await context.apiKey(for: self)
                    for try await event in base.stream(request, context: context, apiKey: apiKey) {
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch let error as HudAIError {
                    continuation.yield(.failed(error))
                    continuation.finish(throwing: error)
                } catch {
                    let normalized = HudAIError.networkUnavailable(provider: providerID, message: error.localizedDescription)
                    continuation.yield(.failed(normalized))
                    continuation.finish(throwing: normalized)
                }
            }
        }
    }

    public func listModels(context: HudAIAdapterContext) async throws -> [HudAIModelInfo] {
        try await base.listModels(context: context, apiKey: try await context.apiKey(for: self))
    }
}
