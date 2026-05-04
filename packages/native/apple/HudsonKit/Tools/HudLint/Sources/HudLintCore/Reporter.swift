import Foundation

public enum ReporterFormat: String, Sendable {
    case xcode  // <file>:<line>:<col>: error: <msg> [hudlint:<cat>]
    case plain  // human-readable
    case json
}

public enum Reporter {
    public static func render(_ violations: [Violation], format: ReporterFormat, strict: Bool) -> String {
        switch format {
        case .xcode:
            return violations.map { renderXcode($0, strict: strict) }.joined(separator: "\n")
        case .plain:
            return violations.map { renderPlain($0) }.joined(separator: "\n")
        case .json:
            return renderJSON(violations)
        }
    }

    private static func renderXcode(_ v: Violation, strict: Bool) -> String {
        let level = strict ? "error" : "warning"
        return "\(v.file):\(v.line):\(v.column): \(level): \(v.message) [hudlint:\(v.category.token)]"
    }

    private static func renderPlain(_ v: Violation) -> String {
        "\(v.file):\(v.line):\(v.column) [hudlint:\(v.category.token)] \(v.message)\n  → \(v.snippet)"
    }

    private static func renderJSON(_ violations: [Violation]) -> String {
        let dicts: [[String: Any]] = violations.map {
            [
                "file": $0.file,
                "line": $0.line,
                "column": $0.column,
                "category": $0.category.token,
                "message": $0.message,
                "snippet": $0.snippet,
            ]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: dicts, options: [.prettyPrinted]),
              let str = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return str
    }
}
