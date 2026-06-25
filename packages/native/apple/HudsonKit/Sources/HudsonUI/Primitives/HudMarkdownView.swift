import SwiftUI

// Block-level markdown renderer for agent/chat message content. Parses real
// blocks via `HudMarkdownParser` (heading / list / table / blockquote / rule /
// code / paragraph) and gives each its own SwiftUI treatment, themed via
// `@Environment(\.hudTheme)`; inline emphasis runs through AttributedString
// within each block. Code blocks render through `HudCodeBlock` (tokenized
// highlighting).
//
// Typography/spacing is driven by `HudMarkdownStyle` — `.mono` (default,
// terminal-grade, all monospaced) or `.agent` (UI-font assistant-message look).
//
// Consumers can post-process the inline `AttributedString` of every text run via
// `inlineTransform` — e.g. to linkify file paths — without Hudson knowing about
// any consumer-specific URL scheme. Link *behavior* (OpenURLAction, base
// directories) stays at the call site.
//
// Provider-agnostic: feed it a markdown string, get a rendered block stack.

public struct HudMarkdownView: View {
    let text: String
    var contentSize: CGFloat
    var style: HudMarkdownStyle
    var inlineTransform: ((AttributedString) -> AttributedString)?

    @Environment(\.hudTheme) private var theme

    public init(
        text: String,
        contentSize: CGFloat = 13,
        style: HudMarkdownStyle = .mono,
        inlineTransform: ((AttributedString) -> AttributedString)? = nil
    ) {
        self.text = text
        self.contentSize = contentSize
        self.style = style
        self.inlineTransform = inlineTransform
    }

    private var blocks: [HudMarkdownBlock] { HudMarkdownParser.parse(text) }

    public var body: some View {
        VStack(alignment: .leading, spacing: style.blockSpacing) {
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
            inline(block.text, font: style.bodyFont(contentSize), color: color(style.bodyColor))
        case .heading(let depth):
            inline(
                block.text,
                font: style.headingFont(depth, contentSize),
                color: color(style.headingColor)
            )
            .padding(.top, depth <= 2 ? HudSpacing.xs : HudStrokeWidth.standard)
        case .rule:
            Rectangle()
                .fill(theme.palette.border)
                .frame(height: HudStrokeWidth.standard)
                .padding(.vertical, HudSpacing.xxs)
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

    private func color(_ role: HudMarkdownStyle.ColorRole) -> Color {
        role.color(in: theme.palette)
    }

    private func inline(_ text: String, font: Font, color: Color) -> some View {
        Text(inlineAttributed(text))
            .font(font)
            .foregroundColor(color)
            .lineSpacing(style.paragraphLineSpacing)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func inlineAttributed(_ s: String) -> AttributedString {
        let opts = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        let parsed = (try? AttributedString(markdown: s, options: opts)) ?? AttributedString(s)
        return inlineTransform?(parsed) ?? parsed
    }

    private func listView(ordered: Bool, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: style.listItemSpacing) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(ordered ? "\(i + 1)." : "•")
                        .font(style.listMarkerFont(contentSize))
                        .foregroundColor(color(style.listMarkerColor))
                        .frame(width: ordered ? style.orderedMarkerWidth : style.unorderedMarkerWidth, alignment: .trailing)
                    inline(item, font: style.bodyFont(contentSize), color: color(style.bodyColor))
                }
            }
        }
    }

    private func quoteView(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            RoundedRectangle(cornerRadius: HudRadius.tight, style: .continuous)
                .fill(HudSurface.tintMuted(theme.palette.accent))
                .frame(width: HudStrokeWidth.bold)
            inline(text, font: style.blockquoteFont(contentSize), color: color(style.blockquoteColor))
        }
        .padding(.vertical, HudSpacing.xxs)
    }

    private func tableView(headers: [String], rows: [[String]]) -> some View {
        let columns = max(headers.count, rows.map(\.count).max() ?? 0)
        return ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                tableRow(headers, columns: columns, isHeader: true)
                Rectangle()
                    .fill(theme.palette.border)
                    .frame(height: HudStrokeWidth.standard)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    tableRow(row, columns: columns, isHeader: false)
                }
            }
            .background(HudSurface.tintMuted(theme.palette.surface))
            .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: HudRadius.standard, style: .continuous)
                    .strokeBorder(theme.palette.border, lineWidth: HudStrokeWidth.thin)
            )
        }
    }

    private func tableRow(_ cells: [String], columns: Int, isHeader: Bool) -> some View {
        HStack(spacing: 0) {
            ForEach(0..<columns, id: \.self) { index in
                inline(
                    cells.indices.contains(index) ? cells[index] : "",
                    font: isHeader ? style.tableHeaderFont(contentSize) : style.bodyFont(contentSize),
                    color: isHeader ? color(style.tableHeaderColor) : color(style.tableCellColor)
                )
                .frame(width: HudLayout.markdownTableCellWidth, alignment: .leading)
                .padding(.horizontal, HudSpacing.lg)
                .padding(.vertical, HudSpacing.sm)
            }
        }
        .background(isHeader ? HudSurface.tintStrong(theme.palette.surface) : Color.clear)
    }
}
