import Foundation

extension HudAIProviders {
    public typealias Anthropic = AnthropicHudAIAdapter
}

public struct AnthropicHudAIAdapter: HudAIProviderAdapter {
    public var providerID: HudAIProviderID { .anthropic }
    public var displayName: String { "Anthropic Claude" }
    public var defaultModel: String { "claude-3-5-sonnet-20241022" }
    public var credentialKey: String { "anthropic_key" }

    public var endpoint: URL
    public var anthropicVersion: String
    public var anthropicBeta: String

    public init(
        endpoint: URL = URL(string: "https://api.anthropic.com/v1/messages")!,
        anthropicVersion: String = "2023-06-01",
        anthropicBeta: String = "prompt-caching-2024-07-31"
    ) {
        self.endpoint = endpoint
        self.anthropicVersion = anthropicVersion
        self.anthropicBeta = anthropicBeta
    }

    public func complete(_ request: HudAIRequest, context: HudAIAdapterContext) async throws -> HudAIResponse {
        let apiKey = try await context.apiKey(for: self)
        var urlRequest = try makeURLRequest(apiKey: apiKey, request: request, stream: false, timeout: context.defaults.timeout)
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await context.urlSession.data(for: urlRequest)
            urlRequest.setValue(nil, forHTTPHeaderField: "x-api-key")
        } catch is CancellationError {
            throw HudAIError.cancelled(provider: providerID)
        } catch {
            throw HudAIError.networkUnavailable(provider: providerID, message: error.localizedDescription)
        }
        try validateHTTP(response: response, data: data)
        return try parseMessageResponse(data)
    }

    public func stream(_ request: HudAIRequest, context: HudAIAdapterContext) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let apiKey = try await context.apiKey(for: self)
                    let urlRequest = try makeURLRequest(apiKey: apiKey, request: request, stream: true, timeout: context.defaults.timeout)
                    let (bytes, response) = try await context.urlSession.bytes(for: urlRequest)
                    try validateHTTP(response: response, data: nil)

                    let assembler = AnthropicStreamAssembler(provider: providerID, fallbackModel: request.model ?? defaultModel, tools: request.tools)
                    for try await line in bytes.lines {
                        try Task.checkCancellation()
                        guard line.hasPrefix("data:") else { continue }
                        let payload = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                        guard !payload.isEmpty, payload != "[DONE]" else { continue }
                        guard let data = payload.data(using: .utf8) else { continue }
                        for event in try assembler.consume(data: data) {
                            continuation.yield(event)
                        }
                    }
                    if let response = assembler.finishIfNeeded() {
                        continuation.yield(.completed(response))
                    }
                    continuation.finish()
                } catch let error as HudAIError {
                    continuation.yield(.failed(error))
                    continuation.finish(throwing: error)
                } catch is CancellationError {
                    continuation.yield(.cancelled)
                    continuation.finish(throwing: HudAIError.cancelled(provider: providerID))
                } catch {
                    let normalized = HudAIError.networkUnavailable(provider: providerID, message: error.localizedDescription)
                    continuation.yield(.failed(normalized))
                    continuation.finish(throwing: normalized)
                }
            }
        }
    }

    public func listModels(context _: HudAIAdapterContext) async throws -> [HudAIModelInfo] {
        [
            HudAIModelInfo(id: "claude-3-5-sonnet-20241022", provider: providerID, displayName: "Claude 3.5 Sonnet"),
            HudAIModelInfo(id: "claude-3-5-haiku-20241022", provider: providerID, displayName: "Claude 3.5 Haiku"),
            HudAIModelInfo(id: "claude-3-opus-20240229", provider: providerID, displayName: "Claude 3 Opus"),
        ]
    }

    private func makeURLRequest(apiKey: String, request: HudAIRequest, stream: Bool, timeout: TimeInterval) throws -> URLRequest {
        try validateTextOnly(request)
        var urlRequest = URLRequest(url: endpoint, timeoutInterval: timeout)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        urlRequest.setValue(anthropicVersion, forHTTPHeaderField: "anthropic-version")
        urlRequest.setValue(anthropicBeta, forHTTPHeaderField: "anthropic-beta")
        urlRequest.httpBody = try JSONEncoder().encode(anthropicPayload(for: request, stream: stream))
        return urlRequest
    }

    private func validateTextOnly(_ request: HudAIRequest) throws {
        let allowed: (HudAIContentPart) -> Bool = { part in
            switch part {
            case .text, .toolCall, .toolResult: return true
            }
        }
        guard request.system.allSatisfy(allowed), request.messages.flatMap(\.content).allSatisfy(allowed) else {
            throw HudAIError.unsupportedFeature(provider: providerID, feature: "non-text content parts")
        }
    }

    private func anthropicPayload(for request: HudAIRequest, stream: Bool) -> AnthropicRequestPayload {
        AnthropicRequestPayload(
            model: request.model ?? defaultModel,
            maxTokens: request.maxOutputTokens ?? 1_024,
            messages: request.messages.map { anthropicMessage($0) },
            system: anthropicSystem(request.system, cache: request.cache ?? .automatic()),
            tools: request.tools.map { anthropicTool($0, cache: request.cache ?? .automatic()) },
            toolChoice: request.toolChoice.map(anthropicToolChoice),
            temperature: request.temperature,
            metadata: request.metadata.isEmpty ? nil : request.metadata,
            stream: stream
        )
    }

    private func anthropicSystem(_ parts: [HudAIContentPart], cache: HudAICachePolicy) -> [AnthropicContentBlock]? {
        let blocks = parts.compactMap { part -> AnthropicContentBlock? in
            guard case .text(let text) = part else { return nil }
            return AnthropicContentBlock(type: "text", text: text, cacheControl: cacheControl(forText: text, stable: true, cache: cache))
        }
        return blocks.isEmpty ? nil : blocks
    }

    private func anthropicMessage(_ message: HudAIMessage) -> AnthropicMessage {
        switch message.role {
        case .tool:
            return AnthropicMessage(role: "user", content: message.content.map(anthropicBlock))
        default:
            return AnthropicMessage(role: message.role.rawValue, content: message.content.map(anthropicBlock))
        }
    }

    private func anthropicBlock(_ part: HudAIContentPart) -> AnthropicContentBlock {
        switch part {
        case .text(let text):
            return AnthropicContentBlock(type: "text", text: text)
        case .toolCall(let call):
            return AnthropicContentBlock(type: "tool_use", id: call.id, name: call.name, input: call.input)
        case .toolResult(let result):
            return AnthropicContentBlock(
                type: "tool_result",
                toolUseID: result.toolCallID,
                content: anthropicToolResultContent(result.content),
                isError: result.isError
            )
        }
    }

    private func anthropicToolResultContent(_ content: HudAIToolResultContent) -> HudAIJSONValue {
        switch content {
        case .text(let text): return .string(text)
        case .json(let value): return value
        }
    }

    private func anthropicTool(_ tool: HudAIToolDefinition, cache: HudAICachePolicy) -> AnthropicTool {
        AnthropicTool(
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            cacheControl: cacheControl(forText: tool.description + String(describing: tool.inputSchema), stable: tool.cacheStable, cache: cache)
        )
    }

    private func anthropicToolChoice(_ choice: HudAIToolChoice) -> AnthropicToolChoice {
        switch choice {
        case .auto: return AnthropicToolChoice(type: "auto", name: nil)
        case .none: return AnthropicToolChoice(type: "none", name: nil)
        case .required: return AnthropicToolChoice(type: "any", name: nil)
        case .named(let name): return AnthropicToolChoice(type: "tool", name: name)
        }
    }

    private func cacheControl(forText text: String, stable: Bool, cache: HudAICachePolicy) -> AnthropicCacheControl? {
        switch cache {
        case .off:
            return nil
        case .force:
            return stable ? AnthropicCacheControl(type: "ephemeral") : nil
        case .automatic(let minimumCharacters):
            return stable && text.count >= minimumCharacters ? AnthropicCacheControl(type: "ephemeral") : nil
        }
    }

    private func validateHTTP(response: URLResponse, data: Data?) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard !(200..<300).contains(http.statusCode) else { return }
        let requestID = http.value(forHTTPHeaderField: "request-id")
        let message = data.flatMap(providerErrorMessage) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
        switch http.statusCode {
        case 401, 403:
            throw HudAIError.credentialsInvalid(provider: providerID, key: credentialKey)
        case 429:
            throw HudAIError.rateLimited(provider: providerID, status: http.statusCode, requestID: requestID, message: message)
        case 408:
            throw HudAIError.timeout(provider: providerID, message: message)
        case 500...599:
            throw HudAIError.overloaded(provider: providerID, status: http.statusCode, requestID: requestID, message: message)
        default:
            throw HudAIError.providerRejectedRequest(provider: providerID, status: http.statusCode, requestID: requestID, message: message)
        }
    }

    private func providerErrorMessage(_ data: Data) -> String? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let error = json["error"] as? [String: Any]
        else { return String(data: data, encoding: .utf8) }
        return error["message"] as? String
    }

    private func parseMessageResponse(_ data: Data) throws -> HudAIResponse {
        let message = try JSONDecoder().decode(AnthropicMessageResponse.self, from: data)
        var text = ""
        var content: [HudAIContentPart] = []
        var toolCalls: [HudAIToolCall] = []
        for block in message.content {
            switch block.type {
            case "text":
                let value = block.text ?? ""
                text += value
                content.append(.text(value))
            case "tool_use":
                let call = HudAIToolCall(id: block.id ?? UUID().uuidString, name: block.name ?? "tool", input: block.input ?? .object([:]), rawInput: nil, status: .ready)
                toolCalls.append(call)
                content.append(.toolCall(call))
            default:
                continue
            }
        }
        return HudAIResponse(
            id: message.id,
            provider: providerID,
            model: message.model,
            text: text,
            content: content,
            toolCalls: toolCalls,
            usage: message.usage ?? HudAIUsage(),
            finishReason: mapStopReason(message.stopReason),
            providerMetadata: ["stop_sequence": message.stopSequence.map(HudAIJSONValue.string) ?? .null]
        )
    }

    private func mapStopReason(_ stopReason: String?) -> HudAIFinishReason {
        switch stopReason {
        case "end_turn", "stop_sequence": return .stop
        case "max_tokens": return .length
        case "tool_use": return .toolCalls
        case "pause_turn": return .stop
        case "refusal": return .error
        case nil: return .unknown
        default: return .unknown
        }
    }
}

private struct AnthropicRequestPayload: Encodable {
    var model: String
    var maxTokens: Int
    var messages: [AnthropicMessage]
    var system: [AnthropicContentBlock]?
    var tools: [AnthropicTool]
    var toolChoice: AnthropicToolChoice?
    var temperature: Double?
    var metadata: [String: HudAIJSONValue]?
    var stream: Bool

    enum CodingKeys: String, CodingKey {
        case model, messages, system, tools, temperature, metadata, stream
        case maxTokens = "max_tokens"
        case toolChoice = "tool_choice"
    }
}

private struct AnthropicMessage: Codable {
    var role: String
    var content: [AnthropicContentBlock]
}

private struct AnthropicContentBlock: Codable {
    var type: String
    var text: String?
    var id: String?
    var name: String?
    var input: HudAIJSONValue?
    var toolUseID: String?
    var content: HudAIJSONValue?
    var isError: Bool?
    var cacheControl: AnthropicCacheControl?

    enum CodingKeys: String, CodingKey {
        case type, text, id, name, input, content
        case toolUseID = "tool_use_id"
        case isError = "is_error"
        case cacheControl = "cache_control"
    }
}

private struct AnthropicTool: Encodable {
    var name: String
    var description: String
    var inputSchema: [String: HudAIJSONValue]
    var cacheControl: AnthropicCacheControl?

    enum CodingKeys: String, CodingKey {
        case name, description
        case inputSchema = "input_schema"
        case cacheControl = "cache_control"
    }
}

private struct AnthropicCacheControl: Codable {
    var type: String
}

private struct AnthropicToolChoice: Encodable {
    var type: String
    var name: String?
}

private struct AnthropicMessageResponse: Decodable {
    var id: String
    var model: String
    var content: [AnthropicContentBlock]
    var stopReason: String?
    var stopSequence: String?
    var usage: HudAIUsage?

    enum CodingKeys: String, CodingKey {
        case id, model, content, usage
        case stopReason = "stop_reason"
        case stopSequence = "stop_sequence"
    }
}

private final class AnthropicStreamAssembler: @unchecked Sendable {
    private let provider: HudAIProviderID
    private let fallbackModel: String
    private var id = UUID().uuidString
    private var model: String
    private var text = ""
    private var content: [HudAIContentPart] = []
    private var toolCalls: [HudAIToolCall] = []
    private var usage = HudAIUsage()
    private var finishReason = HudAIFinishReason.unknown
    private var completed = false
    private var blockIDByIndex: [Int: String] = [:]
    private var toolNameByIndex: [Int: String] = [:]
    private var toolIDByIndex: [Int: String] = [:]
    private var toolInputByIndex: [Int: String] = [:]
    private var toolsByName: [String: HudAIToolDefinition]

    init(provider: HudAIProviderID, fallbackModel: String, tools: [HudAIToolDefinition]) {
        self.provider = provider
        self.fallbackModel = fallbackModel
        self.model = fallbackModel
        self.toolsByName = Dictionary(uniqueKeysWithValues: tools.map { ($0.name, $0) })
    }

    func consume(data: Data) throws -> [HudAIStreamEvent] {
        let event = try JSONDecoder().decode(AnthropicSSEEvent.self, from: data)
        switch event.type {
        case "message_start":
            if let message = event.message {
                id = message.id ?? id
                model = message.model ?? fallbackModel
                if let messageUsage = message.usage { usage.merge(messageUsage) }
            }
            return [.started(requestID: id, provider: provider, model: model)]
        case "content_block_start":
            guard let index = event.index, let block = event.contentBlock else { return [] }
            let blockID = block.id ?? "content_\(index)"
            blockIDByIndex[index] = blockID
            if block.type == "tool_use" {
                toolIDByIndex[index] = block.id ?? blockID
                toolNameByIndex[index] = block.name ?? "tool"
                toolInputByIndex[index] = ""
                return [.toolCallStarted(toolCallID: toolIDByIndex[index] ?? blockID, name: toolNameByIndex[index] ?? "tool")]
            }
            return []
        case "content_block_delta":
            guard let index = event.index, let delta = event.delta else { return [] }
            let blockID = blockIDByIndex[index] ?? "content_\(index)"
            if delta.type == "text_delta", let value = delta.text {
                text += value
                return [.textDelta(contentBlockID: blockID, text: value)]
            }
            if delta.type == "input_json_delta", let partial = delta.partialJSON {
                toolInputByIndex[index, default: ""] += partial
                return [.toolCallInputDelta(toolCallID: toolIDByIndex[index] ?? blockID, partialJSON: partial)]
            }
            return []
        case "content_block_stop":
            guard let index = event.index, let toolID = toolIDByIndex[index] else { return [] }
            let name = toolNameByIndex[index] ?? "tool"
            let rawInput = toolInputByIndex[index] ?? "{}"
            let input: HudAIJSONValue
            do {
                let data = Data(rawInput.utf8)
                input = try JSONDecoder().decode(HudAIJSONValue.self, from: data)
            } catch {
                throw HudAIError.toolInputDecodeFailed(provider: provider, toolCallID: toolID, toolName: name, message: error.localizedDescription)
            }
            if let tool = toolsByName[name] {
                do {
                    try tool.validateInput(input)
                } catch {
                    throw HudAIError.toolInputDecodeFailed(provider: provider, toolCallID: toolID, toolName: name, message: error.localizedDescription)
                }
            }
            let call = HudAIToolCall(id: toolID, name: name, input: input, rawInput: rawInput, status: .ready)
            toolCalls.append(call)
            content.append(.toolCall(call))
            return [.toolCallReady(call)]
        case "message_delta":
            if let stopReason = event.delta?.stopReason {
                finishReason = mapStopReason(stopReason)
            }
            if let deltaUsage = event.usage { usage.merge(deltaUsage) }
            return event.usage.map { [.usage($0)] } ?? []
        case "message_stop":
            completed = true
            let response = response()
            return [.completed(response)]
        case "error":
            throw HudAIError.providerRejectedRequest(provider: provider, status: nil, requestID: id, message: event.error?.message ?? "Anthropic stream error")
        default:
            return []
        }
    }

    func finishIfNeeded() -> HudAIResponse? {
        guard !completed else { return nil }
        completed = true
        return response()
    }

    private func response() -> HudAIResponse {
        var finalContent: [HudAIContentPart] = []
        if !text.isEmpty { finalContent.append(.text(text)) }
        finalContent.append(contentsOf: content)
        return HudAIResponse(
            id: id,
            provider: provider,
            model: model,
            text: text,
            content: finalContent,
            toolCalls: toolCalls,
            usage: usage,
            finishReason: finishReason
        )
    }

    private func mapStopReason(_ stopReason: String?) -> HudAIFinishReason {
        switch stopReason {
        case "end_turn", "stop_sequence": return .stop
        case "max_tokens": return .length
        case "tool_use": return .toolCalls
        case "pause_turn": return .stop
        case "refusal": return .error
        case nil: return .unknown
        default: return .unknown
        }
    }
}

private struct AnthropicSSEEvent: Decodable {
    var type: String
    var index: Int?
    var message: AnthropicSSEMessage?
    var contentBlock: AnthropicContentBlock?
    var delta: AnthropicSSEDelta?
    var usage: HudAIUsage?
    var error: AnthropicSSEError?

    enum CodingKeys: String, CodingKey {
        case type, index, message, delta, usage, error
        case contentBlock = "content_block"
    }
}

private struct AnthropicSSEMessage: Decodable {
    var id: String?
    var model: String?
    var usage: HudAIUsage?
}

private struct AnthropicSSEDelta: Decodable {
    var type: String?
    var text: String?
    var partialJSON: String?
    var stopReason: String?

    enum CodingKeys: String, CodingKey {
        case type, text
        case partialJSON = "partial_json"
        case stopReason = "stop_reason"
    }
}

private struct AnthropicSSEError: Decodable {
    var type: String?
    var message: String?
}
