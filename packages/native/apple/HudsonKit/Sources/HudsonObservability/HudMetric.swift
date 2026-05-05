import Foundation

public enum HudMetricUnit: Sendable {
    case count
    case milliseconds
    case bytes
    case ratio
    case custom(String)

    public var label: String {
        switch self {
        case .count:
            return "count"
        case .milliseconds:
            return "ms"
        case .bytes:
            return "bytes"
        case .ratio:
            return "ratio"
        case .custom(let label):
            return label
        }
    }
}

public struct HudMetric: Sendable {
    public let name: String
    public let unit: HudMetricUnit
    public let metadata: [String: String]

    public init(
        _ name: String,
        unit: HudMetricUnit = .count,
        metadata: [String: String] = [:]
    ) {
        self.name = name
        self.unit = unit
        self.metadata = metadata
    }

    public func record(
        _ value: Double = 1,
        logger: HudLogger = .observability,
        metadata additionalMetadata: [String: String] = [:]
    ) {
        var merged = metadata
        for (key, value) in additionalMetadata {
            merged[key] = value
        }
        merged["metric"] = name
        merged["unit"] = unit.label
        logger.info("metric.record", metadata: merged.merging(["value": Self.format(value)], uniquingKeysWith: { current, _ in current }))
    }

    private static func format(_ value: Double) -> String {
        if value.rounded() == value {
            return "\(Int64(value))"
        }
        var text = String(format: "%.4f", value)
        while text.last == "0" {
            text.removeLast()
        }
        if text.last == "." {
            text.removeLast()
        }
        return text
    }
}
