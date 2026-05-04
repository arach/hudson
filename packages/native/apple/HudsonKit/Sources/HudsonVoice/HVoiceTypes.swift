import Foundation

public enum HVoiceMode: String, Codable, Equatable, Sendable {
    case pushToTalk = "push_to_talk"
    case alwaysOn = "always_on"
}

public enum HVoiceSessionState: String, Codable, Equatable, Sendable {
    case starting
    case recording
    case processing
    case done
    case cancelled
    case error
}

public struct HVoiceSessionStateEvent: Equatable, Sendable {
    public let sessionId: String
    public let state: HVoiceSessionState
    public let previous: HVoiceSessionState?

    public init(sessionId: String, state: HVoiceSessionState, previous: HVoiceSessionState? = nil) {
        self.sessionId = sessionId
        self.state = state
        self.previous = previous
    }
}

public struct HVoicePartialEvent: Equatable, Sendable {
    public let sessionId: String
    public let text: String

    public init(sessionId: String, text: String) {
        self.sessionId = sessionId
        self.text = text
    }
}

public struct HVoiceWordTiming: Equatable, Sendable {
    public let word: String
    public let start: Double
    public let end: Double
    public let confidence: Double?

    public init(word: String, start: Double, end: Double, confidence: Double? = nil) {
        self.word = word
        self.start = start
        self.end = end
        self.confidence = confidence
    }
}

public struct HVoiceFinalEvent: Equatable, Sendable {
    public let sessionId: String
    public let text: String
    public let elapsedMs: Int
    public let utteranceIndex: Int?
    public let metrics: [String: HJSONValue]
    public let words: [HVoiceWordTiming]

    public init(
        sessionId: String,
        text: String,
        elapsedMs: Int,
        utteranceIndex: Int? = nil,
        metrics: [String: HJSONValue] = [:],
        words: [HVoiceWordTiming] = []
    ) {
        self.sessionId = sessionId
        self.text = text
        self.elapsedMs = elapsedMs
        self.utteranceIndex = utteranceIndex
        self.metrics = metrics
        self.words = words
    }
}

public enum HVoiceEvent: Equatable, Sendable {
    case state(HVoiceSessionStateEvent)
    case partial(HVoicePartialEvent)
    case final(HVoiceFinalEvent)
    case raw(name: String, data: [String: HJSONValue])
}

public struct HVoxEndpoint: Equatable, Sendable {
    public var host: String
    public var port: UInt16

    public init(host: String = "127.0.0.1", port: UInt16 = 42137) {
        self.host = host
        self.port = port
    }

    public var url: URL {
        URL(string: "ws://\(host):\(port)")!
    }
}

public struct HVoxHealth: Equatable, Sendable {
    public let service: String
    public let version: String
    public let startedAt: String?
    public let pid: Int?
    public let port: Int?

    public init(service: String, version: String, startedAt: String? = nil, pid: Int? = nil, port: Int? = nil) {
        self.service = service
        self.version = version
        self.startedAt = startedAt
        self.pid = pid
        self.port = port
    }
}

public struct HVoxLiveSessionOptions: Equatable, Sendable {
    public var clientId: String
    public var modelId: String
    public var language: String?
    public var mode: HVoiceMode
    public var metadata: [String: String]

    public init(
        clientId: String = "HudsonKit",
        modelId: String = "parakeet:v3",
        language: String? = nil,
        mode: HVoiceMode = .pushToTalk,
        metadata: [String: String] = [:]
    ) {
        self.clientId = clientId
        self.modelId = modelId
        self.language = language
        self.mode = mode
        self.metadata = metadata
    }

    var rpcParams: [String: HJSONValue] {
        var params: [String: HJSONValue] = [
            "clientId": .string(clientId),
            "modelId": .string(modelId),
            "mode": .string(mode.rawValue)
        ]
        if let language {
            params["language"] = .string(language)
        }
        if !metadata.isEmpty {
            params["metadata"] = .object(metadata.mapValues(HJSONValue.string))
        }
        return params
    }
}

extension HVoiceWordTiming {
    static func parseMany(_ value: HJSONValue?) -> [HVoiceWordTiming] {
        guard let array = value?.arrayValue else { return [] }
        return array.compactMap { item in
            guard let object = item.objectValue else { return nil }
            return HVoiceWordTiming(
                word: object.string("word") ?? "",
                start: object.number("start") ?? 0,
                end: object.number("end") ?? 0,
                confidence: object.number("confidence")
            )
        }
    }
}
