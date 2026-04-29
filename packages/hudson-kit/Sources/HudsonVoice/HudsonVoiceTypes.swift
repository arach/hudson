import Foundation

public enum HudsonVoiceMode: String, Codable, Equatable, Sendable {
    case pushToTalk = "push_to_talk"
    case alwaysOn = "always_on"
}

public enum HudsonVoiceSessionState: String, Codable, Equatable, Sendable {
    case starting
    case recording
    case processing
    case done
    case cancelled
    case error
}

public struct HudsonVoiceSessionStateEvent: Equatable, Sendable {
    public let sessionId: String
    public let state: HudsonVoiceSessionState
    public let previous: HudsonVoiceSessionState?

    public init(sessionId: String, state: HudsonVoiceSessionState, previous: HudsonVoiceSessionState? = nil) {
        self.sessionId = sessionId
        self.state = state
        self.previous = previous
    }
}

public struct HudsonVoicePartialEvent: Equatable, Sendable {
    public let sessionId: String
    public let text: String

    public init(sessionId: String, text: String) {
        self.sessionId = sessionId
        self.text = text
    }
}

public struct HudsonVoiceWordTiming: Equatable, Sendable {
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

public struct HudsonVoiceFinalEvent: Equatable, Sendable {
    public let sessionId: String
    public let text: String
    public let elapsedMs: Int
    public let utteranceIndex: Int?
    public let metrics: [String: HudsonJSONValue]
    public let words: [HudsonVoiceWordTiming]

    public init(
        sessionId: String,
        text: String,
        elapsedMs: Int,
        utteranceIndex: Int? = nil,
        metrics: [String: HudsonJSONValue] = [:],
        words: [HudsonVoiceWordTiming] = []
    ) {
        self.sessionId = sessionId
        self.text = text
        self.elapsedMs = elapsedMs
        self.utteranceIndex = utteranceIndex
        self.metrics = metrics
        self.words = words
    }
}

public enum HudsonVoiceEvent: Equatable, Sendable {
    case state(HudsonVoiceSessionStateEvent)
    case partial(HudsonVoicePartialEvent)
    case final(HudsonVoiceFinalEvent)
    case raw(name: String, data: [String: HudsonJSONValue])
}

public struct HudsonVoxEndpoint: Equatable, Sendable {
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

public struct HudsonVoxHealth: Equatable, Sendable {
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

public struct HudsonVoxLiveSessionOptions: Equatable, Sendable {
    public var clientId: String
    public var modelId: String
    public var language: String?
    public var mode: HudsonVoiceMode
    public var metadata: [String: String]

    public init(
        clientId: String = "hudson-kit",
        modelId: String = "parakeet:v3",
        language: String? = nil,
        mode: HudsonVoiceMode = .pushToTalk,
        metadata: [String: String] = [:]
    ) {
        self.clientId = clientId
        self.modelId = modelId
        self.language = language
        self.mode = mode
        self.metadata = metadata
    }

    var rpcParams: [String: HudsonJSONValue] {
        var params: [String: HudsonJSONValue] = [
            "clientId": .string(clientId),
            "modelId": .string(modelId),
            "mode": .string(mode.rawValue)
        ]
        if let language {
            params["language"] = .string(language)
        }
        if !metadata.isEmpty {
            params["metadata"] = .object(metadata.mapValues(HudsonJSONValue.string))
        }
        return params
    }
}

extension HudsonVoiceWordTiming {
    static func parseMany(_ value: HudsonJSONValue?) -> [HudsonVoiceWordTiming] {
        guard let array = value?.arrayValue else { return [] }
        return array.compactMap { item in
            guard let object = item.objectValue else { return nil }
            return HudsonVoiceWordTiming(
                word: object.string("word") ?? "",
                start: object.number("start") ?? 0,
                end: object.number("end") ?? 0,
                confidence: object.number("confidence")
            )
        }
    }
}
