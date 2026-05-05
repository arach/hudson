import Foundation

public struct HudAIProviderID: RawRepresentable, Codable, Hashable, Sendable, ExpressibleByStringLiteral {
    public var rawValue: String

    public init(rawValue: String) {
        self.rawValue = rawValue
    }

    public init(stringLiteral value: String) {
        self.rawValue = value
    }

    public static let anthropic  = HudAIProviderID(rawValue: "anthropic")
    public static let openai     = HudAIProviderID(rawValue: "openai")
    public static let openrouter = HudAIProviderID(rawValue: "openrouter")
    public static let grok       = HudAIProviderID(rawValue: "grok")
    public static let deepseek   = HudAIProviderID(rawValue: "deepseek")
    public static let fireworks  = HudAIProviderID(rawValue: "fireworks")
    public static let together   = HudAIProviderID(rawValue: "together")
}

public enum HudAIRoute: Equatable, Sendable {
    case local
    case paired(deviceId: String)
    case auto

    var requiresLocalExecution: Bool {
        switch self {
        case .local: return true
        case .auto: return true
        case .paired: return false
        }
    }
}

public enum HudAICachePolicy: Equatable, Sendable {
    case automatic(minimumCharacters: Int = 1_024)
    case off
    case force
}

public enum HudAIMessageRole: String, Codable, Sendable {
    case user
    case assistant
    case tool
}

public enum HudAIContentPart: Equatable, Sendable {
    case text(String)
    case toolCall(HudAIToolCall)
    case toolResult(HudAIToolResult)
}

public struct HudAIMessage: Equatable, Sendable {
    public var role: HudAIMessageRole
    public var content: [HudAIContentPart]
    public var toolCallID: String?
    public var name: String?

    public init(role: HudAIMessageRole, content: [HudAIContentPart], toolCallID: String? = nil, name: String? = nil) {
        self.role = role
        self.content = content
        self.toolCallID = toolCallID
        self.name = name
    }

    public static func user(_ text: String, name: String? = nil) -> HudAIMessage {
        HudAIMessage(role: .user, content: [.text(text)], name: name)
    }

    public static func assistant(_ text: String, name: String? = nil) -> HudAIMessage {
        HudAIMessage(role: .assistant, content: [.text(text)], name: name)
    }

    public static func toolResult(_ result: HudAIToolResult, name: String? = nil) -> HudAIMessage {
        HudAIMessage(role: .tool, content: [.toolResult(result)], toolCallID: result.toolCallID, name: name)
    }
}

public struct HudAIToolAnnotations: Codable, Equatable, Sendable {
    public var safe: Bool?
    public var readOnly: Bool?
    public var destructive: Bool?
    public var requiresConfirmation: Bool?

    public init(safe: Bool? = nil, readOnly: Bool? = nil, destructive: Bool? = nil, requiresConfirmation: Bool? = nil) {
        self.safe = safe
        self.readOnly = readOnly
        self.destructive = destructive
        self.requiresConfirmation = requiresConfirmation
    }
}

public struct HudAIToolInputCodec: @unchecked Sendable {
    public var typeName: String
    private var validator: @Sendable (HudAIJSONValue) throws -> Void

    public init<Input: Decodable>(_ type: Input.Type = Input.self) {
        self.typeName = String(reflecting: type)
        self.validator = { value in
            let data = try JSONEncoder().encode(value)
            _ = try JSONDecoder().decode(Input.self, from: data)
        }
    }

    public func validate(_ value: HudAIJSONValue) throws {
        try validator(value)
    }
}

public struct HudAIToolDefinition: Equatable, Sendable {
    public var name: String
    public var description: String
    public var inputSchema: [String: HudAIJSONValue]
    public var outputSchema: [String: HudAIJSONValue]?
    public var annotations: HudAIToolAnnotations?
    public var cacheStable: Bool
    public var inputCodec: HudAIToolInputCodec

    public init<Input: Decodable>(
        name: String,
        description: String,
        inputSchema: [String: HudAIJSONValue],
        outputSchema: [String: HudAIJSONValue]? = nil,
        annotations: HudAIToolAnnotations? = nil,
        cacheStable: Bool = true,
        inputType: Input.Type = Input.self
    ) {
        self.name = name
        self.description = description
        self.inputSchema = inputSchema
        self.outputSchema = outputSchema
        self.annotations = annotations
        self.cacheStable = cacheStable
        self.inputCodec = HudAIToolInputCodec(inputType)
    }

    public static func untyped(
        name: String,
        description: String,
        inputSchema: [String: HudAIJSONValue],
        outputSchema: [String: HudAIJSONValue]? = nil,
        annotations: HudAIToolAnnotations? = nil,
        cacheStable: Bool = true
    ) -> HudAIToolDefinition {
        HudAIToolDefinition(
            name: name,
            description: description,
            inputSchema: inputSchema,
            outputSchema: outputSchema,
            annotations: annotations,
            cacheStable: cacheStable,
            inputType: HudAIJSONValue.self
        )
    }

    public func validateInput(_ value: HudAIJSONValue) throws {
        try inputCodec.validate(value)
    }

    public static func == (lhs: HudAIToolDefinition, rhs: HudAIToolDefinition) -> Bool {
        lhs.name == rhs.name &&
            lhs.description == rhs.description &&
            lhs.inputSchema == rhs.inputSchema &&
            lhs.outputSchema == rhs.outputSchema &&
            lhs.annotations == rhs.annotations &&
            lhs.cacheStable == rhs.cacheStable
    }
}

public enum HudAIToolCallStatus: String, Codable, Sendable {
    case streaming
    case ready
    case resultSubmitted
    case failed
}

public struct HudAIToolCall: Equatable, Sendable {
    public var id: String
    public var name: String
    public var input: HudAIJSONValue
    public var rawInput: String?
    public var status: HudAIToolCallStatus

    public init(id: String, name: String, input: HudAIJSONValue, rawInput: String? = nil, status: HudAIToolCallStatus = .ready) {
        self.id = id
        self.name = name
        self.input = input
        self.rawInput = rawInput
        self.status = status
    }

    public func decodeInput<T: Decodable>(_ type: T.Type = T.self, decoder: JSONDecoder = JSONDecoder()) throws -> T {
        let data = try JSONEncoder().encode(input)
        return try decoder.decode(T.self, from: data)
    }
}

public enum HudAIToolResultContent: Equatable, Sendable {
    case text(String)
    case json(HudAIJSONValue)
}

public struct HudAIToolResult: Equatable, Sendable {
    public var toolCallID: String
    public var content: HudAIToolResultContent
    public var isError: Bool
    public var metadata: [String: HudAIJSONValue]

    public init(toolCallID: String, content: HudAIToolResultContent, isError: Bool = false, metadata: [String: HudAIJSONValue] = [:]) {
        self.toolCallID = toolCallID
        self.content = content
        self.isError = isError
        self.metadata = metadata
    }
}

public enum HudAIToolChoice: Equatable, Sendable {
    case auto
    case none
    case required
    case named(String)
}

public struct HudAIRequest: Sendable {
    public var model: String?
    public var messages: [HudAIMessage]
    public var system: [HudAIContentPart]
    public var tools: [HudAIToolDefinition]
    public var toolChoice: HudAIToolChoice?
    public var temperature: Double?
    public var maxOutputTokens: Int?
    public var metadata: [String: HudAIJSONValue]
    public var cache: HudAICachePolicy?
    public var route: HudAIRoute?

    public init(
        model: String? = nil,
        messages: [HudAIMessage],
        system: String? = nil,
        tools: [HudAIToolDefinition] = [],
        toolChoice: HudAIToolChoice? = nil,
        temperature: Double? = nil,
        maxOutputTokens: Int? = nil,
        metadata: [String: HudAIJSONValue] = [:],
        cache: HudAICachePolicy? = nil,
        route: HudAIRoute? = nil
    ) {
        self.model = model
        self.messages = messages
        self.system = system.map { [.text($0)] } ?? []
        self.tools = tools
        self.toolChoice = toolChoice
        self.temperature = temperature
        self.maxOutputTokens = maxOutputTokens
        self.metadata = metadata
        self.cache = cache
        self.route = route
    }

    public init(
        model: String? = nil,
        messages: [HudAIMessage],
        system: [HudAIContentPart],
        tools: [HudAIToolDefinition] = [],
        toolChoice: HudAIToolChoice? = nil,
        temperature: Double? = nil,
        maxOutputTokens: Int? = nil,
        metadata: [String: HudAIJSONValue] = [:],
        cache: HudAICachePolicy? = nil,
        route: HudAIRoute? = nil
    ) {
        self.model = model
        self.messages = messages
        self.system = system
        self.tools = tools
        self.toolChoice = toolChoice
        self.temperature = temperature
        self.maxOutputTokens = maxOutputTokens
        self.metadata = metadata
        self.cache = cache
        self.route = route
    }
}

public struct HudAIUsage: Codable, Equatable, Sendable {
    public var inputTokens: Int
    public var outputTokens: Int
    public var cacheCreationInputTokens: Int
    public var cacheReadInputTokens: Int

    enum CodingKeys: String, CodingKey {
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case cacheCreationInputTokens = "cache_creation_input_tokens"
        case cacheReadInputTokens = "cache_read_input_tokens"
    }

    public init(inputTokens: Int = 0, outputTokens: Int = 0, cacheCreationInputTokens: Int = 0, cacheReadInputTokens: Int = 0) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.cacheCreationInputTokens = cacheCreationInputTokens
        self.cacheReadInputTokens = cacheReadInputTokens
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.inputTokens = try container.decodeIfPresent(Int.self, forKey: .inputTokens) ?? 0
        self.outputTokens = try container.decodeIfPresent(Int.self, forKey: .outputTokens) ?? 0
        self.cacheCreationInputTokens = try container.decodeIfPresent(Int.self, forKey: .cacheCreationInputTokens) ?? 0
        self.cacheReadInputTokens = try container.decodeIfPresent(Int.self, forKey: .cacheReadInputTokens) ?? 0
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(inputTokens, forKey: .inputTokens)
        try container.encode(outputTokens, forKey: .outputTokens)
        try container.encode(cacheCreationInputTokens, forKey: .cacheCreationInputTokens)
        try container.encode(cacheReadInputTokens, forKey: .cacheReadInputTokens)
    }

    public mutating func merge(_ other: HudAIUsage) {
        inputTokens = max(inputTokens, other.inputTokens)
        outputTokens = max(outputTokens, other.outputTokens)
        cacheCreationInputTokens = max(cacheCreationInputTokens, other.cacheCreationInputTokens)
        cacheReadInputTokens = max(cacheReadInputTokens, other.cacheReadInputTokens)
    }
}

public enum HudAIFinishReason: String, Codable, Equatable, Sendable {
    case stop
    case length
    case toolCalls
    case cancelled
    case error
    case unknown
}

public struct HudAIResponse: Equatable, Sendable {
    public var id: String
    public var provider: HudAIProviderID
    public var model: String
    public var text: String
    public var content: [HudAIContentPart]
    public var toolCalls: [HudAIToolCall]
    public var usage: HudAIUsage
    public var finishReason: HudAIFinishReason
    public var providerMetadata: [String: HudAIJSONValue]

    public init(
        id: String,
        provider: HudAIProviderID,
        model: String,
        text: String,
        content: [HudAIContentPart],
        toolCalls: [HudAIToolCall],
        usage: HudAIUsage,
        finishReason: HudAIFinishReason,
        providerMetadata: [String: HudAIJSONValue] = [:]
    ) {
        self.id = id
        self.provider = provider
        self.model = model
        self.text = text
        self.content = content
        self.toolCalls = toolCalls
        self.usage = usage
        self.finishReason = finishReason
        self.providerMetadata = providerMetadata
    }
}

public enum HudAIStreamEvent: Sendable {
    case started(requestID: String, provider: HudAIProviderID, model: String)
    case textDelta(contentBlockID: String, text: String)
    case reasoningDelta(contentBlockID: String, text: String)
    case toolCallStarted(toolCallID: String, name: String)
    case toolCallInputDelta(toolCallID: String, partialJSON: String)
    case toolCallReady(HudAIToolCall)
    case toolResultAccepted(toolCallID: String)
    case usage(HudAIUsage)
    case completed(HudAIResponse)
    case failed(HudAIError)
    case cancelled
}

public struct HudAIModelInfo: Codable, Equatable, Sendable {
    public var id: String
    public var provider: HudAIProviderID
    public var displayName: String?

    public init(id: String, provider: HudAIProviderID, displayName: String? = nil) {
        self.id = id
        self.provider = provider
        self.displayName = displayName
    }
}
