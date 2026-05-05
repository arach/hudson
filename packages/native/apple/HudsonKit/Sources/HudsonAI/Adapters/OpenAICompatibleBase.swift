import Foundation

/// Shared transport for OpenAI-compatible Chat Completions providers.
///
/// HudAI intentionally targets Chat Completions here instead of OpenAI's newer
/// Responses API because OpenRouter, DeepSeek, Fireworks, Together, and many
/// other OpenAI-compatible providers converge on `/v1/chat/completions` today.
/// That gives Hudson one reusable wire translator for the compatibility family;
/// provider-specific adapters only supply endpoint, credential key, defaults,
/// model namespace conventions, and extra headers.
struct OpenAICompatibleBase: Sendable {
    var providerID: HudAIProviderID
    var defaultModel: String
    var endpoint: URL
    var extraHeaders: [String: String]
    var modelNamespaceDescription: String?

    init(
        providerID: HudAIProviderID,
        defaultModel: String,
        endpoint: URL,
        extraHeaders: [String: String] = [:],
        modelNamespaceDescription: String? = nil
    ) {
        self.providerID = providerID
        self.defaultModel = defaultModel
        self.endpoint = endpoint
        self.extraHeaders = extraHeaders
        self.modelNamespaceDescription = modelNamespaceDescription
    }

    func complete(_ request: HudAIRequest, context: HudAIAdapterContext, apiKey: String) async throws -> HudAIResponse {
        var urlRequest = try makeURLRequest(apiKey: apiKey, request: request, stream: false, timeout: context.defaults.timeout)
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await context.urlSession.data(for: urlRequest)
            urlRequest.setValue(nil, forHTTPHeaderField: "authorization")
        } catch is CancellationError {
            throw HudAIError.cancelled(provider: providerID)
        } catch {
            throw HudAIError.networkUnavailable(provider: providerID, message: error.localizedDescription)
        }
        try validateHTTP(response: response, data: data)
        return try parseChatCompletionResponse(data, fallbackModel: request.model ?? defaultModel, tools: request.tools)
    }

    func stream(_ request: HudAIRequest, context: HudAIAdapterContext, apiKey: String) -> AsyncThrowingStream<HudAIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let urlRequest = try makeURLRequest(apiKey: apiKey, request: request, stream: true, timeout: context.defaults.timeout)
                    let (bytes, response) = try await context.urlSession.bytes(for: urlRequest)
                    try validateHTTP(response: response, data: nil)

                    let assembler = OpenAIChatStreamAssembler(provider: providerID, fallbackModel: request.model ?? defaultModel, tools: request.tools)
                    for try await line in bytes.lines {
                        try Task.checkCancellation()
                        guard line.hasPrefix("data:") else { continue }
                        let payload = String(line.dropFirst(5)).trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !payload.isEmpty else { continue }
                        if payload == "[DONE]" { break }
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

    func listModels(context: HudAIAdapterContext, apiKey: String) async throws -> [HudAIModelInfo] {
        let modelsURL = endpoint.deletingLastPathComponent().appendingPathComponent("models")
        var request = URLRequest(url: modelsURL, timeoutInterval: context.defaults.timeout)
        request.httpMethod = "GET"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "authorization")
        for (key, value) in extraHeaders { request.setValue(value, forHTTPHeaderField: key) }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await context.urlSession.data(for: request)
        } catch is CancellationError {
            throw HudAIError.cancelled(provider: providerID)
        } catch {
            throw HudAIError.networkUnavailable(provider: providerID, message: error.localizedDescription)
        }
        try validateHTTP(response: response, data: data)
        let decoded = try JSONDecoder().decode(OpenAIModelsResponse.self, from: data)
        return decoded.data.map { HudAIModelInfo(id: $0.id, provider: providerID, displayName: $0.id) }
    }

    private func makeURLRequest(apiKey: String, request: HudAIRequest, stream: Bool, timeout: TimeInterval) throws -> URLRequest {
        try validateTextOnly(request)
        var urlRequest = URLRequest(url: endpoint, timeoutInterval: timeout)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.setValue("text/event-stream", forHTTPHeaderField: "accept")
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "authorization")
        for (key, value) in extraHeaders { urlRequest.setValue(value, forHTTPHeaderField: key) }
        urlRequest.httpBody = try JSONEncoder().encode(openAIPayload(for: request, stream: stream))
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

    private func openAIPayload(for request: HudAIRequest, stream: Bool) -> OpenAIChatCompletionRequest {
        var messages: [OpenAIChatMessage] = []
        let systemText = request.system.compactMap { part -> String? in
            if case .text(let text) = part { return text }
            return nil
        }.joined(separator: "\n\n")
        if !systemText.isEmpty {
            messages.append(OpenAIChatMessage(role: "system", content: systemText))
        }
        messages.append(contentsOf: request.messages.flatMap(openAIMessages))
        return OpenAIChatCompletionRequest(
            model: request.model ?? defaultModel,
            messages: messages,
            tools: request.tools.isEmpty ? nil : request.tools.map(openAITool),
            toolChoice: request.toolChoice.map(openAIToolChoice),
            temperature: request.temperature,
            maxTokens: request.maxOutputTokens,
            metadata: request.metadata.isEmpty ? nil : request.metadata,
            stream: stream,
            streamOptions: stream ? OpenAIStreamOptions(includeUsage: true) : nil
        )
    }

    private func openAIMessages(_ message: HudAIMessage) -> [OpenAIChatMessage] {
        if message.role == .tool {
            return message.content.compactMap { part in
                guard case .toolResult(let result) = part else { return nil }
                return OpenAIChatMessage(role: "tool", content: toolResultContent(result.content), name: message.name, toolCallID: result.toolCallID)
            }
        }

        var content = ""
        var toolCalls: [OpenAIChatToolCall]? = nil
        for part in message.content {
            switch part {
            case .text(let text):
                content += text
            case .toolCall(let call):
                var calls = toolCalls ?? []
                calls.append(OpenAIChatToolCall(id: call.id, type: "function", function: OpenAIFunctionCall(name: call.name, arguments: jsonString(call.input))))
                toolCalls = calls
            case .toolResult:
                continue
            }
        }
        return [OpenAIChatMessage(role: message.role.rawValue, content: content.isEmpty ? nil : content, name: message.name, toolCalls: toolCalls)]
    }

    private func toolResultContent(_ content: HudAIToolResultContent) -> String {
        switch content {
        case .text(let text): return text
        case .json(let value): return jsonString(value)
        }
    }

    private func openAITool(_ tool: HudAIToolDefinition) -> OpenAITool {
        OpenAITool(type: "function", function: OpenAIToolFunction(name: tool.name, description: tool.description, parameters: .object(tool.inputSchema)))
    }

    private func openAIToolChoice(_ choice: HudAIToolChoice) -> OpenAIToolChoice {
        switch choice {
        case .auto: return .string("auto")
        case .none: return .string("none")
        case .required: return .string("required")
        case .named(let name):
            return .object(OpenAIToolChoiceObject(type: "function", function: OpenAIToolChoiceFunction(name: name)))
        }
    }

    private func jsonString(_ value: HudAIJSONValue) -> String {
        guard let data = try? JSONEncoder().encode(value), let string = String(data: data, encoding: .utf8) else { return "{}" }
        return string
    }

    private func validateHTTP(response: URLResponse, data: Data?) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard !(200..<300).contains(http.statusCode) else { return }
        let requestID = http.value(forHTTPHeaderField: "x-request-id") ?? http.value(forHTTPHeaderField: "request-id")
        let message = data.flatMap(providerErrorMessage) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
        switch http.statusCode {
        case 401, 403:
            throw HudAIError.credentialsInvalid(provider: providerID, key: "provider credential")
        case 429:
            throw HudAIError.rateLimited(provider: providerID, status: http.statusCode, requestID: requestID, message: message)
        case 500...599:
            throw HudAIError.overloaded(provider: providerID, status: http.statusCode, requestID: requestID, message: message)
        default:
            throw HudAIError.providerRejectedRequest(provider: providerID, status: http.statusCode, requestID: requestID, message: message)
        }
    }

    private func providerErrorMessage(_ data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return String(data: data, encoding: .utf8)
        }
        if let error = json["error"] as? [String: Any] {
            return error["message"] as? String ?? error["code"] as? String
        }
        return json["message"] as? String ?? String(data: data, encoding: .utf8)
    }

    private func parseChatCompletionResponse(_ data: Data, fallbackModel: String, tools: [HudAIToolDefinition]) throws -> HudAIResponse {
        let response = try JSONDecoder().decode(OpenAIChatCompletionResponse.self, from: data)
        let choice = response.choices.first
        var text = choice?.message?.content ?? ""
        var content: [HudAIContentPart] = text.isEmpty ? [] : [.text(text)]
        var toolCalls: [HudAIToolCall] = []
        for toolCall in choice?.message?.toolCalls ?? [] {
            let name = toolCall.function.name ?? "tool"
            let rawInput = toolCall.function.arguments ?? "{}"
            let input = try decodeToolInput(rawInput, toolCallID: toolCall.id, name: name, tools: tools)
            let call = HudAIToolCall(id: toolCall.id, name: name, input: input, rawInput: rawInput, status: .ready)
            toolCalls.append(call)
            content.append(.toolCall(call))
        }
        if text.isEmpty, let firstText = content.compactMap({ part -> String? in if case .text(let value) = part { return value }; return nil }).first {
            text = firstText
        }
        return HudAIResponse(
            id: response.id,
            provider: providerID,
            model: response.model ?? fallbackModel,
            text: text,
            content: content,
            toolCalls: toolCalls,
            usage: response.usage?.hudAIUsage ?? HudAIUsage(),
            finishReason: mapFinishReason(choice?.finishReason),
            providerMetadata: ["object": response.object.map(HudAIJSONValue.string) ?? .null]
        )
    }

    private func decodeToolInput(_ rawInput: String, toolCallID: String, name: String, tools: [HudAIToolDefinition]) throws -> HudAIJSONValue {
        let input: HudAIJSONValue
        do {
            input = try JSONDecoder().decode(HudAIJSONValue.self, from: Data(rawInput.utf8))
        } catch {
            throw HudAIError.toolInputDecodeFailed(provider: providerID, toolCallID: toolCallID, toolName: name, message: error.localizedDescription)
        }
        if let tool = tools.first(where: { $0.name == name }) {
            do { try tool.validateInput(input) } catch {
                throw HudAIError.toolInputDecodeFailed(provider: providerID, toolCallID: toolCallID, toolName: name, message: error.localizedDescription)
            }
        }
        return input
    }

    private func mapFinishReason(_ reason: String?) -> HudAIFinishReason {
        switch reason {
        case "stop": return .stop
        case "length": return .length
        case "tool_calls", "function_call": return .toolCalls
        case nil: return .unknown
        default: return .unknown
        }
    }
}

private struct OpenAIChatCompletionRequest: Encodable {
    var model: String
    var messages: [OpenAIChatMessage]
    var tools: [OpenAITool]?
    var toolChoice: OpenAIToolChoice?
    var temperature: Double?
    var maxTokens: Int?
    var metadata: [String: HudAIJSONValue]?
    var stream: Bool
    var streamOptions: OpenAIStreamOptions?

    enum CodingKeys: String, CodingKey {
        case model, messages, tools, temperature, metadata, stream
        case toolChoice = "tool_choice"
        case maxTokens = "max_tokens"
        case streamOptions = "stream_options"
    }
}

private struct OpenAIStreamOptions: Encodable {
    var includeUsage: Bool
    enum CodingKeys: String, CodingKey { case includeUsage = "include_usage" }
}

private struct OpenAIChatMessage: Codable {
    var role: String
    var content: String?
    var name: String?
    var toolCalls: [OpenAIChatToolCall]?
    var toolCallID: String?

    enum CodingKeys: String, CodingKey {
        case role, content, name
        case toolCalls = "tool_calls"
        case toolCallID = "tool_call_id"
    }
}

private struct OpenAITool: Encodable {
    var type: String
    var function: OpenAIToolFunction
}

private struct OpenAIToolFunction: Encodable {
    var name: String
    var description: String
    var parameters: HudAIJSONValue
}

private enum OpenAIToolChoice: Encodable {
    case string(String)
    case object(OpenAIToolChoiceObject)

    func encode(to encoder: Encoder) throws {
        switch self {
        case .string(let value):
            var container = encoder.singleValueContainer()
            try container.encode(value)
        case .object(let value):
            try value.encode(to: encoder)
        }
    }
}

private struct OpenAIToolChoiceObject: Encodable {
    var type: String
    var function: OpenAIToolChoiceFunction
}

private struct OpenAIToolChoiceFunction: Encodable {
    var name: String
}

private struct OpenAIChatCompletionResponse: Decodable {
    var id: String
    var object: String?
    var model: String?
    var choices: [OpenAIChoice]
    var usage: OpenAIUsage?
}

private struct OpenAIChoice: Decodable {
    var index: Int?
    var message: OpenAIChatMessage?
    var delta: OpenAIChatDelta?
    var finishReason: String?

    enum CodingKeys: String, CodingKey {
        case index, message, delta
        case finishReason = "finish_reason"
    }
}

private struct OpenAIChatToolCall: Codable {
    var id: String
    var type: String?
    var function: OpenAIFunctionCall
}

private struct OpenAIFunctionCall: Codable {
    var name: String?
    var arguments: String?
}

private struct OpenAIChatDelta: Decodable {
    var role: String?
    var content: String?
    var toolCalls: [OpenAIStreamingToolCall]?

    enum CodingKeys: String, CodingKey {
        case role, content
        case toolCalls = "tool_calls"
    }
}

private struct OpenAIStreamingToolCall: Decodable {
    var index: Int
    var id: String?
    var type: String?
    var function: OpenAIFunctionCall?
}

private struct OpenAIUsage: Decodable {
    var promptTokens: Int?
    var completionTokens: Int?
    var totalTokens: Int?
    var promptTokensDetails: OpenAIPromptTokenDetails?

    enum CodingKeys: String, CodingKey {
        case promptTokens = "prompt_tokens"
        case completionTokens = "completion_tokens"
        case totalTokens = "total_tokens"
        case promptTokensDetails = "prompt_tokens_details"
    }

    var hudAIUsage: HudAIUsage {
        HudAIUsage(
            inputTokens: promptTokens ?? 0,
            outputTokens: completionTokens ?? 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: promptTokensDetails?.cachedTokens ?? 0
        )
    }
}

private struct OpenAIPromptTokenDetails: Decodable {
    var cachedTokens: Int?
    enum CodingKeys: String, CodingKey { case cachedTokens = "cached_tokens" }
}

private struct OpenAIModelsResponse: Decodable {
    var data: [OpenAIModel]
}

private struct OpenAIModel: Decodable {
    var id: String
}

private struct OpenAIErrorEvent: Decodable {
    var error: OpenAIProviderError?
}

private struct OpenAIProviderError: Decodable {
    var message: String?
    var type: String?
    var code: String?
}

private final class OpenAIChatStreamAssembler: @unchecked Sendable {
    private let provider: HudAIProviderID
    private let fallbackModel: String
    private var id = UUID().uuidString
    private var model: String
    private var text = ""
    private var usage = HudAIUsage()
    private var finishReason = HudAIFinishReason.unknown
    private var completed = false
    private var started = false
    private var toolIDByIndex: [Int: String] = [:]
    private var toolNameByIndex: [Int: String] = [:]
    private var toolInputByIndex: [Int: String] = [:]
    private var toolCalls: [HudAIToolCall] = []
    private var toolsByName: [String: HudAIToolDefinition]

    init(provider: HudAIProviderID, fallbackModel: String, tools: [HudAIToolDefinition]) {
        self.provider = provider
        self.fallbackModel = fallbackModel
        self.model = fallbackModel
        self.toolsByName = Dictionary(uniqueKeysWithValues: tools.map { ($0.name, $0) })
    }

    func consume(data: Data) throws -> [HudAIStreamEvent] {
        if let error = try? JSONDecoder().decode(OpenAIErrorEvent.self, from: data), let providerError = error.error {
            throw HudAIError.providerRejectedRequest(provider: provider, status: nil, requestID: id, message: providerError.message ?? providerError.code ?? "OpenAI-compatible stream error")
        }

        let chunk = try JSONDecoder().decode(OpenAIChatCompletionResponse.self, from: data)
        var events: [HudAIStreamEvent] = []
        id = chunk.id
        model = chunk.model ?? fallbackModel
        if !started {
            started = true
            events.append(.started(requestID: id, provider: provider, model: model))
        }
        if let chunkUsage = chunk.usage?.hudAIUsage {
            usage.merge(chunkUsage)
            events.append(.usage(chunkUsage))
        }

        for choice in chunk.choices {
            if let finish = choice.finishReason { finishReason = mapFinishReason(finish) }
            guard let delta = choice.delta else { continue }
            if let content = delta.content, !content.isEmpty {
                text += content
                events.append(.textDelta(contentBlockID: "message_0", text: content))
            }
            for toolDelta in delta.toolCalls ?? [] {
                let index = toolDelta.index
                if let id = toolDelta.id, toolIDByIndex[index] == nil {
                    toolIDByIndex[index] = id
                }
                if let name = toolDelta.function?.name, toolNameByIndex[index] == nil {
                    toolNameByIndex[index] = name
                    events.append(.toolCallStarted(toolCallID: toolIDByIndex[index] ?? "tool_\(index)", name: name))
                }
                if let arguments = toolDelta.function?.arguments, !arguments.isEmpty {
                    toolInputByIndex[index, default: ""] += arguments
                    events.append(.toolCallInputDelta(toolCallID: toolIDByIndex[index] ?? "tool_\(index)", partialJSON: arguments))
                }
            }
        }

        for choice in chunk.choices where choice.finishReason == "tool_calls" || choice.finishReason == "function_call" {
            events.append(contentsOf: try finishToolCalls())
        }
        if chunk.choices.contains(where: { $0.finishReason != nil && $0.finishReason != "tool_calls" && $0.finishReason != "function_call" }) {
            completed = true
            events.append(.completed(response()))
        }
        return events
    }

    func finishIfNeeded() -> HudAIResponse? {
        guard !completed else { return nil }
        _ = try? finishToolCalls()
        completed = true
        return response()
    }

    private func finishToolCalls() throws -> [HudAIStreamEvent] {
        var events: [HudAIStreamEvent] = []
        for index in toolInputByIndex.keys.sorted() {
            let toolID = toolIDByIndex[index] ?? "tool_\(index)"
            guard !toolCalls.contains(where: { $0.id == toolID }) else { continue }
            let name = toolNameByIndex[index] ?? "tool"
            let rawInput = toolInputByIndex[index] ?? "{}"
            let input: HudAIJSONValue
            do { input = try JSONDecoder().decode(HudAIJSONValue.self, from: Data(rawInput.utf8)) } catch {
                throw HudAIError.toolInputDecodeFailed(provider: provider, toolCallID: toolID, toolName: name, message: error.localizedDescription)
            }
            if let tool = toolsByName[name] {
                do { try tool.validateInput(input) } catch {
                    throw HudAIError.toolInputDecodeFailed(provider: provider, toolCallID: toolID, toolName: name, message: error.localizedDescription)
                }
            }
            let call = HudAIToolCall(id: toolID, name: name, input: input, rawInput: rawInput, status: .ready)
            toolCalls.append(call)
            events.append(.toolCallReady(call))
        }
        return events
    }

    private func response() -> HudAIResponse {
        var content: [HudAIContentPart] = []
        if !text.isEmpty { content.append(.text(text)) }
        content.append(contentsOf: toolCalls.map(HudAIContentPart.toolCall))
        return HudAIResponse(id: id, provider: provider, model: model, text: text, content: content, toolCalls: toolCalls, usage: usage, finishReason: finishReason)
    }

    private func mapFinishReason(_ reason: String?) -> HudAIFinishReason {
        switch reason {
        case "stop": return .stop
        case "length": return .length
        case "tool_calls", "function_call": return .toolCalls
        case nil: return .unknown
        default: return .unknown
        }
    }
}
