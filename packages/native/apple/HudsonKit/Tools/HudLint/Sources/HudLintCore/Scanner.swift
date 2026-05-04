import Foundation

/// Scans files line-by-line, applies the rule set, and honors inline disable
/// directives.
///
/// Inline directive syntax:
///
///   `// hudlint:disable next-line`              — silence all rules on the next line
///   `// hudlint:disable next-line palette`      — silence one category on the next line
///   `// hudlint:disable next-line palette,opacity` — silence multiple categories
///
/// The directive must appear on its own line above the offending code.
public struct LintScanner: Sendable {
    public let rules: [Rule]
    public let configuration: Configuration

    public init(rules: [Rule] = DefaultRules.all, configuration: Configuration = Configuration()) {
        self.rules = rules
        self.configuration = configuration
    }

    public func scanFile(at absolutePath: String, displayPath: String) -> [Violation] {
        guard let contents = try? String(contentsOfFile: absolutePath, encoding: .utf8) else {
            return []
        }
        let lines = contents.split(omittingEmptySubsequences: false, whereSeparator: { $0 == "\n" })
        var violations: [Violation] = []
        var pendingDisables: Set<String> = []

        for (index, raw) in lines.enumerated() {
            let line = String(raw)
            let lineNumber = index + 1

            if let directive = parseDisableDirective(line: line) {
                pendingDisables = directive
                continue
            }

            let codeOnly = stripLineComment(from: line)
            for rule in rules {
                if pendingDisables.contains(rule.category.token) || pendingDisables.contains("all") {
                    continue
                }
                let hits = rule.evaluate(line: codeOnly, lineNumber: lineNumber, file: displayPath)
                violations.append(contentsOf: hits)
            }

            // Disables consume exactly one line.
            pendingDisables.removeAll(keepingCapacity: true)
        }

        return violations
    }

    /// Strip trailing `// ...` comments before evaluating rules, so a disable
    /// directive's own text doesn't trip the linter.
    private func stripLineComment(from line: String) -> String {
        guard let commentRange = line.range(of: "//") else { return line }
        // Naive but sufficient for V1: doesn't handle `//` inside string literals.
        // No primitive in HudsonKit currently puts a `//` inside a string.
        return String(line[..<commentRange.lowerBound])
    }

    private func parseDisableDirective(line: String) -> Set<String>? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("//") else { return nil }
        guard let range = trimmed.range(of: "hudlint:disable next-line") else { return nil }
        let tail = trimmed[range.upperBound...].trimmingCharacters(in: .whitespaces)
        if tail.isEmpty {
            return ["all"]
        }
        let tokens = tail
            .split(whereSeparator: { $0 == "," || $0 == " " })
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return Set(tokens)
    }
}
