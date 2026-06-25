import Foundation

// Block-level markdown structure parser for agent/chat message content. Splits a
// raw markdown string into an ordered list of semantic blocks (heading / list /
// table / blockquote / rule / code / paragraph); inline emphasis stays in each
// block's `text` for the renderer to interpret.
//
// Pure Foundation — no SwiftUI, no @MainActor, no UI. This is deliberately the
// single source of truth so every consumer (HudMarkdownView on macOS/iOS and any
// non-SwiftUI call site) parses markup identically. `HudMarkdownView` renders the
// blocks this produces.

// MARK: - Block

public struct HudMarkdownBlock: Identifiable, Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        case paragraph
        case heading(depth: Int)
        case rule
        case list(ordered: Bool, items: [String])
        case blockquote
        case code(language: String?)
        case table(headers: [String], rows: [[String]])
    }

    public let id: Int
    public let kind: Kind
    public let text: String

    public init(id: Int, kind: Kind, text: String) {
        self.id = id
        self.kind = kind
        self.text = text
    }
}

// MARK: - Parser

public enum HudMarkdownParser {
    public static func parse(_ rawText: String) -> [HudMarkdownBlock] {
        let normalized = rawText
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return [] }

        let lines = normalized.components(separatedBy: "\n")
        var blocks: [HudMarkdownBlock] = []
        var index = 0
        var nextID = 0

        func append(_ kind: HudMarkdownBlock.Kind, text: String = "") {
            blocks.append(HudMarkdownBlock(id: nextID, kind: kind, text: text))
            nextID += 1
        }

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { index += 1; continue }

            if let language = fenceLanguage(trimmed) {
                var codeLines: [String] = []
                index += 1
                while index < lines.count && fenceLanguage(lines[index].trimmingCharacters(in: .whitespaces)) == nil {
                    codeLines.append(lines[index]); index += 1
                }
                if index < lines.count { index += 1 }
                append(.code(language: language.isEmpty ? nil : language), text: codeLines.joined(separator: "\n"))
                continue
            }

            if isRule(trimmed) { append(.rule); index += 1; continue }

            if let heading = heading(trimmed) {
                append(.heading(depth: heading.depth), text: heading.text); index += 1; continue
            }

            if isTableStart(lines, index) {
                let headers = splitTableRow(lines[index])
                index += 2
                var rows: [[String]] = []
                while index < lines.count, lines[index].contains("|"),
                      !lines[index].trimmingCharacters(in: .whitespaces).isEmpty {
                    rows.append(splitTableRow(lines[index])); index += 1
                }
                append(.table(headers: headers, rows: rows))
                continue
            }

            if let unordered = unorderedListItem(line) {
                var items = [unordered]; index += 1
                while index < lines.count, let item = unorderedListItem(lines[index]) { items.append(item); index += 1 }
                append(.list(ordered: false, items: items))
                continue
            }

            if let ordered = orderedListItem(line) {
                var items = [ordered]; index += 1
                while index < lines.count, let item = orderedListItem(lines[index]) { items.append(item); index += 1 }
                append(.list(ordered: true, items: items))
                continue
            }

            if trimmed.hasPrefix(">") {
                var quoteLines: [String] = []
                while index < lines.count {
                    let q = lines[index].trimmingCharacters(in: .whitespaces)
                    guard q.hasPrefix(">") else { break }
                    quoteLines.append(String(q.dropFirst()).trimmingCharacters(in: .whitespaces)); index += 1
                }
                append(.blockquote, text: quoteLines.joined(separator: "\n"))
                continue
            }

            var paragraphLines: [String] = []
            while index < lines.count && !isBlockStart(lines, index) {
                paragraphLines.append(lines[index].trimmingCharacters(in: .whitespaces)); index += 1
            }
            append(.paragraph, text: paragraphLines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines))
        }

        if blocks.isEmpty {
            blocks.append(HudMarkdownBlock(id: 0, kind: .paragraph, text: rawText))
        }
        return blocks
    }

    private static func fenceLanguage(_ trimmed: String) -> String? {
        guard trimmed.hasPrefix("```") else { return nil }
        let language = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
        guard language.rangeOfCharacter(from: .whitespacesAndNewlines) == nil else { return nil }
        return language
    }

    private static func heading(_ trimmed: String) -> (depth: Int, text: String)? {
        let depth = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(depth) else { return nil }
        let rest = trimmed.dropFirst(depth)
        guard rest.first == " " else { return nil }
        return (depth, String(rest.dropFirst()).trimmingCharacters(in: .whitespaces))
    }

    private static func isRule(_ trimmed: String) -> Bool {
        guard trimmed.count >= 3 else { return false }
        let allowed = Set(trimmed)
        return allowed == ["-"] || allowed == ["*"] || allowed == ["_"]
    }

    private static func unorderedListItem(_ line: String) -> String? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") else { return nil }
        return String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespaces)
    }

    private static func orderedListItem(_ line: String) -> String? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        let digits = trimmed.prefix { $0.isNumber }
        guard !digits.isEmpty else { return nil }
        let rest = trimmed.dropFirst(digits.count)
        guard rest.count >= 2, let marker = rest.first,
              marker == "." || marker == ")", rest.dropFirst().first == " " else { return nil }
        return String(rest.dropFirst(2)).trimmingCharacters(in: .whitespaces)
    }

    private static func splitTableRow(_ line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("|") { trimmed.removeFirst() }
        if trimmed.hasSuffix("|") { trimmed.removeLast() }
        return trimmed.split(separator: "|", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespaces) }
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        let cells = splitTableRow(line)
        guard cells.count >= 2 else { return false }
        return cells.allSatisfy { cell in
            let core = cell.trimmingCharacters(in: CharacterSet(charactersIn: " :-"))
            return core.isEmpty && cell.contains("-")
        }
    }

    private static func isTableStart(_ lines: [String], _ index: Int) -> Bool {
        guard index + 1 < lines.count else { return false }
        return lines[index].contains("|") && isTableSeparator(lines[index + 1])
    }

    private static func isBlockStart(_ lines: [String], _ index: Int) -> Bool {
        guard index < lines.count else { return true }
        let line = lines[index]
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty
            || fenceLanguage(trimmed) != nil
            || heading(trimmed) != nil
            || isRule(trimmed)
            || unorderedListItem(line) != nil
            || orderedListItem(line) != nil
            || trimmed.hasPrefix(">")
            || isTableStart(lines, index)
    }
}
