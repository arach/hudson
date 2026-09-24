import Foundation

/// A message a sender writes to the notch: one JSON object per line.
///
/// ```json
/// {"op":"post","id":"job-42","source":"Claude Code","title":"Keep the old link?",
///  "state":"waiting","choices":[{"id":"a","title":"Keep"},{"id":"b","title":"Redirect"}]}
/// {"op":"dismiss","id":"job-42"}
/// {"op":"subscribe"}
/// ```
///
/// A line without `op` is read as a `post`, so senders built for the older
/// event shape (`title`, `body`, `level`, `ttl`, `action`) keep working.
public enum HudNotchCommand: Equatable, Sendable {
    /// Add an activity, or update the one with the same `id` in place.
    case post(HudNotchActivity)
    /// Remove an activity from the stage.
    case dismiss(id: String)
    /// Briefly open the notch without new content.
    case pulse
    /// Keep this connection open and receive every response.
    case subscribe
}

/// A message the notch writes back: a reply, or word that the person dismissed.
public enum HudNotchResponse: Equatable, Sendable {
    case reply(HudNotchReply)
    case dismissed(id: String)

    public var activityID: String {
        switch self {
        case .reply(let reply): return reply.id
        case .dismissed(let id): return id
        }
    }
}

/// What the person answered on a waiting activity.
public struct HudNotchReply: Codable, Equatable, Sendable {
    /// The activity's id.
    public var id: String
    /// The chosen `HudNotchChoice.id`, if they pressed a button.
    public var choice: String?
    /// Free text, if they typed a reply.
    public var text: String?
    public var at: Date

    public init(id: String, choice: String? = nil, text: String? = nil, at: Date = Date()) {
        self.id = id
        self.choice = choice
        self.text = text
        self.at = at
    }
}

public enum HudNotchWireError: LocalizedError, Equatable {
    case unknownOp(String)
    case missingID(String)

    public var errorDescription: String? {
        switch self {
        case .unknownOp(let op): return "Unknown notch op \"\(op)\"."
        case .missingID(let op): return "Notch op \"\(op)\" needs an id."
        }
    }
}

/// JSON-lines encoding for commands and responses.
public enum HudNotchWire {
    public static let maxLineBytes = 64 * 1024

    public static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return encoder
    }

    public static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private struct Envelope: Decodable {
        var op: String?
        var id: String?
    }

    public static func decodeCommand(_ line: Data) throws -> HudNotchCommand {
        let decoder = makeDecoder()
        let envelope = try decoder.decode(Envelope.self, from: line)
        let op = envelope.op?.lowercased() ?? "post"
        switch op {
        case "post", "event":
            return .post(try decoder.decode(HudNotchActivity.self, from: line))
        case "dismiss":
            guard let id = envelope.id else { throw HudNotchWireError.missingID(op) }
            return .dismiss(id: id)
        case "pulse":
            return .pulse
        case "subscribe":
            return .subscribe
        default:
            throw HudNotchWireError.unknownOp(op)
        }
    }

    public static func encodeCommand(_ command: HudNotchCommand) throws -> Data {
        let encoder = makeEncoder()
        var object: [String: Any]
        switch command {
        case .post(let activity):
            let data = try encoder.encode(activity)
            object = (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            object["op"] = "post"
        case .dismiss(let id):
            object = ["op": "dismiss", "id": id]
        case .pulse:
            object = ["op": "pulse"]
        case .subscribe:
            object = ["op": "subscribe"]
        }
        return try line(JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes]))
    }

    private struct ResponseEnvelope: Codable {
        var op: String
        var id: String
        var choice: String?
        var text: String?
        var at: Date?
    }

    public static func encodeResponse(_ response: HudNotchResponse) throws -> Data {
        let envelope: ResponseEnvelope
        switch response {
        case .reply(let reply):
            envelope = ResponseEnvelope(op: "reply", id: reply.id, choice: reply.choice, text: reply.text, at: reply.at)
        case .dismissed(let id):
            envelope = ResponseEnvelope(op: "dismissed", id: id)
        }
        return try line(makeEncoder().encode(envelope))
    }

    public static func decodeResponse(_ line: Data) throws -> HudNotchResponse {
        let envelope = try makeDecoder().decode(ResponseEnvelope.self, from: line)
        switch envelope.op {
        case "reply":
            return .reply(HudNotchReply(id: envelope.id, choice: envelope.choice, text: envelope.text, at: envelope.at ?? Date()))
        case "dismissed":
            return .dismissed(id: envelope.id)
        default:
            throw HudNotchWireError.unknownOp(envelope.op)
        }
    }

    private static func line(_ data: Data) -> Data {
        var data = data
        data.append(0x0A)
        return data
    }
}
