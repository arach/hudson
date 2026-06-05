import SwiftUI

// Block-level markdown renderer for agent/chat message content. Parses real
// blocks (heading / list / table / blockquote / rule / code / paragraph) and
// gives each its own SwiftUI treatment, themed via `@Environment(\.hudTheme)`;
// inline emphasis runs through AttributedString within each block. Code blocks
// render through `HudCodeBlock` (tokenized highlighting). Content is set in the
// monospaced family so message copy reads as terminal-grade text.
//
// Provider-agnostic: feed it a markdown string, get a rendered block stack.

// MARK: - Parser

public struct HudMarkdownBlock: Identifiable, Equatable {
    public enum Kind: Equatable {
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
}

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

// MARK: - View

public struct HudMarkdownView: View {
    let text: String
    var contentSize: CGFloat

    @Environment(\.hudTheme) private var theme

    public init(text: String, contentSize: CGFloat = 13) {
        self.text = text
        self.contentSize = contentSize
    }

    private var blocks: [HudMarkdownBlock] { HudMarkdownParser.parse(text) }

    public var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(blocks) { block in
                blockView(block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
    }

    @ViewBuilder
    private func blockView(_ block: HudMarkdownBlock) -> some View {
        switch block.kind {
        case .paragraph:
            inline(block.text, font: HudFont.mono(contentSize), color: theme.palette.ink)
        case .heading(let depth):
            inline(
                block.text,
                font: HudFont.mono(headingSize(depth), weight: .semibold),
                color: theme.palette.ink
            )
            .padding(.top, depth <= 2 ? 4 : 1)
        case .rule:
            Rectangle().fill(theme.palette.border).frame(height: 1).padding(.vertical, 3)
        case .list(let ordered, let items):
            listView(ordered: ordered, items: items)
        case .blockquote:
            quoteView(block.text)
        case .code(let language):
            HudCodeBlock(language: language, source: block.text, codeSize: contentSize)
        case .table(let headers, let rows):
            tableView(headers: headers, rows: rows)
        }
    }

    private func headingSize(_ depth: Int) -> CGFloat {
        depth <= 1 ? contentSize + 3 : (depth == 2 ? contentSize + 1 : contentSize)
    }

    private func inline(_ text: String, font: Font, color: Color) -> some View {
        Text(Self.inlineMarkdown(text))
            .font(font)
            .foregroundColor(color)
            .lineSpacing(2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static func inlineMarkdown(_ s: String) -> AttributedString {
        let opts = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: s, options: opts)) ?? AttributedString(s)
    }

    private func listView(ordered: Bool, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(ordered ? "\(i + 1)." : "•")
                        .font(HudFont.mono(11))
                        .foregroundColor(theme.palette.muted)
                        .frame(width: ordered ? 20 : 12, alignment: .trailing)
                    inline(item, font: HudFont.mono(contentSize), color: theme.palette.ink)
                }
            }
        }
    }

    private func quoteView(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            RoundedRectangle(cornerRadius: 1, style: .continuous)
                .fill(theme.palette.accent.opacity(0.5))
                .frame(width: 3)
            inline(text, font: HudFont.mono(contentSize), color: theme.palette.dim)
        }
        .padding(.vertical, 2)
    }

    private func tableView(headers: [String], rows: [[String]]) -> some View {
        let columns = max(headers.count, rows.map(\.count).max() ?? 0)
        return ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                tableRow(headers, columns: columns, isHeader: true)
                Rectangle().fill(theme.palette.border).frame(height: 1)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    tableRow(row, columns: columns, isHeader: false)
                }
            }
            .background(theme.palette.surface.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .strokeBorder(theme.palette.border, lineWidth: 0.5)
            )
        }
    }

    private func tableRow(_ cells: [String], columns: Int, isHeader: Bool) -> some View {
        HStack(spacing: 0) {
            ForEach(0..<columns, id: \.self) { index in
                inline(
                    cells.indices.contains(index) ? cells[index] : "",
                    font: isHeader ? HudFont.mono(11, weight: .semibold) : HudFont.mono(contentSize),
                    color: isHeader ? theme.palette.dim : theme.palette.ink
                )
                .frame(width: 150, alignment: .leading)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
            }
        }
        .background(isHeader ? theme.palette.surface.opacity(0.6) : Color.clear)
    }
}
