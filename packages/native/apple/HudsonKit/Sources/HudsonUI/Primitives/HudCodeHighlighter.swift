import Foundation
import SwiftUI

public enum HudCodeHighlighter {
    public static func highlight(_ line: String, language: String? = nil) -> AttributedString {
        var attributed = AttributedString(line.isEmpty ? " " : line)
        attributed.foregroundColor = HudPalette.ink

        guard !line.isEmpty else { return attributed }

        for rule in rules(for: language) {
            apply(rule, source: line, attributed: &attributed)
        }
        return attributed
    }

    private static func rules(for language: String?) -> [Rule] {
        let normalized = language?.lowercased() ?? ""
        if normalized == "json" || normalized.hasSuffix(".json") {
            return jsonRules
        }
        if normalized == "markdown" || normalized == "md" || normalized.hasSuffix(".md") {
            return markdownRules
        }
        return codeRules
    }

    private static func apply(_ rule: Rule, source: String, attributed: inout AttributedString) {
        guard let expression = try? NSRegularExpression(pattern: rule.pattern, options: rule.options) else {
            return
        }
        let sourceRange = NSRange(source.startIndex..<source.endIndex, in: source)
        for match in expression.matches(in: source, options: [], range: sourceRange) {
            guard let range = Range(match.range, in: source),
                  let attributedRange = Range(range, in: attributed) else {
                continue
            }
            attributed[attributedRange].foregroundColor = rule.color
        }
    }

    private static let codeRules: [Rule] = [
        Rule(#"\b(import|export|from|return|func|function|struct|class|enum|protocol|extension|let|var|const|if|else|switch|case|for|while|guard|public|private|internal|try|catch|await|async|throws|throw|some|any|in|where|as|is|new|typealias|associatedtype)\b"#, HudTint.cyan.color),
        Rule(#"\b(true|false|null|nil|undefined|self|super|Self)\b"#, HudTint.amber.color),
        Rule(#"\b([0-9]+(?:\.[0-9]+)?)\b"#, HudTint.teal.color),
        Rule(#""(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'"#, HudTint.green.color),
        Rule(#"//.*$|#.*$"#, HudPalette.dim, options: [.anchorsMatchLines]),
    ]

    private static let jsonRules: [Rule] = [
        Rule(#""(?:\\.|[^"\\])*""#, HudTint.green.color),
        Rule(#"\b(true|false|null)\b"#, HudTint.amber.color),
        Rule(#"-?\b([0-9]+(?:\.[0-9]+)?)\b"#, HudTint.teal.color),
    ]

    private static let markdownRules: [Rule] = [
        Rule(#"^#{1,6}\s+.*$"#, HudTint.cyan.color, options: [.anchorsMatchLines]),
        Rule(#"`[^`]+`"#, HudTint.green.color),
        Rule(#"\*\*[^*]+\*\*"#, HudPalette.ink),
        Rule(#"\[[^\]]+\]\([^)]+\)"#, HudTint.blue.color),
    ]

    private struct Rule {
        var pattern: String
        var color: Color
        var options: NSRegularExpression.Options

        init(
            _ pattern: String,
            _ color: Color,
            options: NSRegularExpression.Options = []
        ) {
            self.pattern = pattern
            self.color = color
            self.options = options
        }
    }
}
