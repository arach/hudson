import Foundation

extension HudAIProviders {
    public typealias OpenAI = OpenAIHudAIAdapter
}

public typealias HudAIOpenAIAdapter = OpenAIHudAIAdapter

public struct OpenAIHudAIAdapter: HudAIProviderAdapter {
    public var providerID: HudAIProviderID { .openai }
    public var displayName: String { "OpenAI" }
    public var defaultModel: String { "gpt-4o-mini" }
    public var credentialKey: String { "openai_key" }

    public var endpoint: URL

    public init(endpoint: URL = URL(string: "https://api.openai.com/v1/chat/completions")!) {
        self.endpoint = endpoint
    }

    private var base: OpenAICompatibleBase {
        OpenAICompatibleBase(providerID: providerID, defaultModel: defaultModel, endpoint: endpoint)
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
