import Foundation

/// A rule scans a single source line and emits zero or more violations.
///
/// Rules are stateless and operate on raw text. Multi-line analysis is out
/// of scope for V1 — strict-by-default catches enough drift on its own.
public protocol Rule: Sendable {
    var category: RuleCategory { get }
    func evaluate(line: String, lineNumber: Int, file: String) -> [Violation]
}

/// Helper that walks every regex match on a line and produces violations
/// using a shared message. Subclasses pick the regex + message; column is
/// taken from the match's UTF-16 offset (close enough for Xcode parsing).
public struct RegexRule: Rule {
    public let category: RuleCategory
    public let regex: NSRegularExpression
    public let message: String

    public init(category: RuleCategory, pattern: String, message: String) {
        self.category = category
        self.regex = try! NSRegularExpression(pattern: pattern, options: [])
        self.message = message
    }

    public func evaluate(line: String, lineNumber: Int, file: String) -> [Violation] {
        let range = NSRange(line.startIndex..., in: line)
        let matches = regex.matches(in: line, options: [], range: range)
        return matches.compactMap { match in
            guard let r = Range(match.range, in: line) else { return nil }
            let column = line.distance(from: line.startIndex, to: r.lowerBound) + 1
            let snippet = String(line[r]).trimmingCharacters(in: .whitespaces)
            return Violation(
                file: file,
                line: lineNumber,
                column: column,
                category: category,
                message: message,
                snippet: snippet
            )
        }
    }
}
