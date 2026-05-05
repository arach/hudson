import Foundation

public enum HudVoiceMode: String, Codable, Equatable, Sendable {
    case pushToTalk = "push_to_talk"
    case alwaysOn = "always_on"
}

public enum HudVoiceSessionState: String, Codable, Equatable, Sendable {
    case starting
    case recording
    case processing
    case done
    case cancelled
    case error
}

public struct HudVoiceSessionStateEvent: Equatable, Sendable {
    public let sessionId: String
    public let state: HudVoiceSessionState
    public let previous: HudVoiceSessionState?

    public init(sessionId: String, state: HudVoiceSessionState, previous: HudVoiceSessionState? = nil) {
        self.sessionId = sessionId
        self.state = state
        self.previous = previous
    }
}

public struct HudVoicePartialEvent: Equatable, Sendable {
    public let sessionId: String
    public let text: String

    public init(sessionId: String, text: String) {
        self.sessionId = sessionId
        self.text = text
    }
}

public struct HudVoiceWordTiming: Equatable, Sendable {
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

public struct HudVoiceFinalEvent: Equatable, Sendable {
    public let sessionId: String
    public let text: String
    public let elapsedMs: Int
    public let utteranceIndex: Int?
    public let metrics: [String: HudJSONValue]
    public let words: [HudVoiceWordTiming]

    public init(
        sessionId: String,
        text: String,
        elapsedMs: Int,
        utteranceIndex: Int? = nil,
        metrics: [String: HudJSONValue] = [:],
        words: [HudVoiceWordTiming] = []
    ) {
        self.sessionId = sessionId
        self.text = text
        self.elapsedMs = elapsedMs
        self.utteranceIndex = utteranceIndex
        self.metrics = metrics
        self.words = words
    }
}

public enum HudVoiceEvent: Equatable, Sendable {
    case state(HudVoiceSessionStateEvent)
    case partial(HudVoicePartialEvent)
    case final(HudVoiceFinalEvent)
    case raw(name: String, data: [String: HudJSONValue])
}

public struct HudVoxEndpoint: Equatable, Sendable {
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

public struct HudVoxHealth: Equatable, Sendable {
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

public struct HudVoxLiveSessionOptions: Equatable, Sendable {
    public var clientId: String
    public var modelId: String
    public var language: String?
    public var mode: HudVoiceMode
    public var metadata: [String: String]

    public init(
        clientId: String = "HudsonKit",
        modelId: String = "parakeet:v3",
        language: String? = nil,
        mode: HudVoiceMode = .pushToTalk,
        metadata: [String: String] = [:]
    ) {
        self.clientId = clientId
        self.modelId = modelId
        self.language = language
        self.mode = mode
        self.metadata = metadata
    }

    var rpcParams: [String: HudJSONValue] {
        var params: [String: HudJSONValue] = [
            "clientId": .string(clientId),
            "modelId": .string(modelId),
            "mode": .string(mode.rawValue)
        ]
        if let language {
            params["language"] = .string(language)
        }
        if !metadata.isEmpty {
            params["metadata"] = .object(metadata.mapValues(HudJSONValue.string))
        }
        return params
    }
}

extension HudVoiceWordTiming {
    static func parseMany(_ value: HudJSONValue?) -> [HudVoiceWordTiming] {
        guard let array = value?.arrayValue else { return [] }
        return array.compactMap { item in
            guard let object = item.objectValue else { return nil }
            return HudVoiceWordTiming(
                word: object.string("word") ?? "",
                start: object.number("start") ?? 0,
                end: object.number("end") ?? 0,
                confidence: object.number("confidence")
            )
        }
    }
}
