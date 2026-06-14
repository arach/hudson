import Foundation

public protocol HudAIProviderAdapter: Sendable {
    var providerID: HudAIProviderID { get }
    var displayName: String { get }
    var defaultModel: String { get }
    var credentialKey: String { get }

    func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse
    func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error>
    func listModels(context: HudAIAdapterContext) async throws -> [HudAIModelInfo]
}
