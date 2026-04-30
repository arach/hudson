import Foundation

/// Small JSON value used by HudsonVoice transports.
///
/// Keeping this local avoids pulling VoxCore into HudsonKit. Vox currently
/// exposes its daemon over JSON-RPC dictionaries, so HudsonKit only needs a
/// stable JSON boundary and can keep the provider dependency optional.
public enum HudsonJSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: HudsonJSONValue])
    case array([HudsonJSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: HudsonJSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([HudsonJSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

public extension HudsonJSONValue {
    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var numberValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    var intValue: Int? {
        numberValue.map(Int.init)
    }

    var objectValue: [String: HudsonJSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var arrayValue: [HudsonJSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }
}

public extension Dictionary where Key == String, Value == HudsonJSONValue {
    func string(_ key: String) -> String? {
        self[key]?.stringValue
    }

    func number(_ key: String) -> Double? {
        self[key]?.numberValue
    }

    func int(_ key: String) -> Int? {
        self[key]?.intValue
    }

    func object(_ key: String) -> [String: HudsonJSONValue]? {
        self[key]?.objectValue
    }

    func array(_ key: String) -> [HudsonJSONValue]? {
        self[key]?.arrayValue
    }
}
