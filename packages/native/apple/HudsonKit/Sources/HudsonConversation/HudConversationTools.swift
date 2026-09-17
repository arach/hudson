import Foundation

/// Whether the provider should pause speech for the tool result or keep
/// conversing while the host works.
public enum HudConversationToolBehavior: String, Codable, Hashable, Sendable {
    case blocking, nonBlocking
}

public struct HudConversationToolDeclaration: Codable, Hashable, Sendable {
    public var name: String
    public var description: String?
    /// JSON Schema object for the arguments, encoded as UTF-8 JSON.
    public var parametersJSONSchema: Data?
    public var behavior: HudConversationToolBehavior

    public init(name: String, description: String? = nil, parametersJSONSchema: Data? = nil,
                behavior: HudConversationToolBehavior = .nonBlocking) {
        self.name = name
        self.description = description
        self.parametersJSONSchema = parametersJSONSchema
        self.behavior = behavior
    }
}

public struct HudConversationToolCall: Codable, Hashable, Sendable, Identifiable {
    /// Provider call ID. Results must echo it verbatim.
    public var id: String
    public var name: String
    /// Raw provider-supplied JSON arguments. Data, never executable code.
    public var argumentsJSON: Data
    /// Present when the call arrived inside a delegated-work envelope.
    public var delegationID: String?

    public init(id: String, name: String, argumentsJSON: Data, delegationID: String? = nil) {
        self.id = id
        self.name = name
        self.argumentsJSON = argumentsJSON
        self.delegationID = delegationID
    }
}

/// How an out-of-band result should enter the conversation, for providers that
/// support scheduling. Adapters must reject this on models that do not.
public enum HudConversationResultScheduling: String, Codable, Hashable, Sendable {
    case interrupt, whenIdle, silent
}

public struct HudConversationToolResult: Codable, Hashable, Sendable {
    public enum Output: Codable, Hashable, Sendable {
        case success(Data)
        case failure(String)
    }
    public var callID: String
    public var name: String
    public var output: Output
    public var scheduling: HudConversationResultScheduling?
    public var delegationID: String?

    public init(callID: String, name: String, output: Output,
                scheduling: HudConversationResultScheduling? = nil, delegationID: String? = nil) {
        self.callID = callID
        self.name = name
        self.output = output
        self.scheduling = scheduling
        self.delegationID = delegationID
    }
}
