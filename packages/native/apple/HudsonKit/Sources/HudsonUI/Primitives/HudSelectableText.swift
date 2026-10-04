#if os(macOS)
import AppKit
import SwiftUI

// Selectable rich text for macOS transcripts and documents.
//
// A turn renders into ONE AppKit text view, so a drag selects across
// paragraphs, bullets, headings and code in a single pass (SwiftUI's
// `.textSelection` stops at every `Text` boundary). And the glyphs rasterize
// crisply at 1x: every colour is opaque, pre-composited over the ground the
// view paints under them. Translucent white over a translucent page falls back
// to soft greyscale edges.

// MARK: - Inks

/// Opaque text colours for one ground. `over(alpha)` is `base` at `alpha`
/// flattened onto `ground`, so "ink at 86%" stays solid. `base` is white for a
/// dark ground and black for a light one.
public struct HudOpaqueInk: Equatable, @unchecked Sendable {
    public var ground: NSColor
    public var base: NSColor
    public var prose: NSColor
    public var strong: NSColor
    public var dim: NSColor
    public var muted: NSColor
    public var code: NSColor
    public var codeGround: NSColor
    public var selection: NSColor

    public init(ground: NSColor, base: NSColor = .white) {
        self.ground = ground
        self.base = base
        prose = base
        strong = base
        dim = base
        muted = base
        code = base
        codeGround = ground
        selection = ground
        prose = over(0.86)
        strong = over(0.95)
        dim = over(0.60)
        muted = over(0.42)
        code = over(0.84)
        codeGround = over(0.055)
        selection = over(0.20)
    }

    /// `base` at `alpha` composited onto the ground.
    public func over(_ alpha: CGFloat) -> NSColor {
        let g = ground.usingColorSpace(.sRGB) ?? ground
        let b = base.usingColorSpace(.sRGB) ?? base
        return NSColor(
            srgbRed: g.redComponent + (b.redComponent - g.redComponent) * alpha,
            green: g.greenComponent + (b.greenComponent - g.greenComponent) * alpha,
            blue: g.blueComponent + (b.blueComponent - g.blueComponent) * alpha,
            alpha: 1
        )
    }

    public var swiftUI: (prose: Color, strong: Color, dim: Color, muted: Color) {
        (Color(nsColor: prose), Color(nsColor: strong), Color(nsColor: dim), Color(nsColor: muted))
    }
}

// MARK: - Markdown → attributed string

/// Fonts and inks for `HudAttributedMarkdown`.
public struct HudAttributedMarkdownStyle: @unchecked Sendable {
    public var size: CGFloat
    public var ink: HudOpaqueInk
    /// Prose face at a size and weight. Defaults to the system sans.
    public var prose: (CGFloat, NSFont.Weight) -> NSFont
    /// Code face. Defaults to SF Mono.
    public var code: (CGFloat, NSFont.Weight) -> NSFont
    /// Weight for code runs and blocks.
    public var codeWeight: NSFont.Weight
    /// Tint behind inline code. Off, inline code is set apart by its face and
    /// the code ink alone; on, a run that wraps paints its ground out to the
    /// line's end (TextKit fills the whole fragment tail).
    public var inlineCodeGround: Bool

    public init(
        size: CGFloat = 13,
        ink: HudOpaqueInk,
        prose: @escaping (CGFloat, NSFont.Weight) -> NSFont = { .systemFont(ofSize: $0, weight: $1) },
        code: @escaping (CGFloat, NSFont.Weight) -> NSFont = { .monospacedSystemFont(ofSize: $0, weight: $1) },
        codeWeight: NSFont.Weight = .regular,
        inlineCodeGround: Bool = true
    ) {
        self.size = size
        self.ink = ink
        self.prose = prose
        self.code = code
        self.codeWeight = codeWeight
        self.inlineCodeGround = inlineCodeGround
    }
}

/// Markdown to one `NSAttributedString` for `HudSelectableText`. Blocks come
/// from `HudMarkdownParser`; inline runs from Foundation's markdown. Code
/// blocks are `NSTextBlock`s (TextKit 1), so they select and copy with the
/// prose around them. Tables render as aligned monospace columns, which paste
/// back as readable text.
public struct HudAttributedMarkdown {
    public var style: HudAttributedMarkdownStyle

    public init(style: HudAttributedMarkdownStyle) {
        self.style = style
    }

    private var size: CGFloat { style.size }
    private var ink: HudOpaqueInk { style.ink }
    private var lineSpacing: CGFloat { (size * 0.36).rounded() }
    private var blockGap: CGFloat { (size * 0.85).rounded() }
    private var codeSize: CGFloat { size - 1 }

    /// Plain text (user turns): no markdown, same metrics.
    public func plain(_ text: String, color: NSColor? = nil) -> NSAttributedString {
        NSAttributedString(string: text, attributes: [
            .font: style.prose(size, .regular),
            .foregroundColor: color ?? ink.strong,
            .paragraphStyle: paragraph(),
        ])
    }

    public func render(_ text: String) -> NSAttributedString {
        let blocks = HudMarkdownParser.parse(text)
        let out = NSMutableAttributedString()

        for (index, block) in blocks.enumerated() {
            let isLast = index == blocks.count - 1
            let gap = isLast ? 0 : blockGap

            switch block.kind {
            case .paragraph:
                out.append(inline(block.text, style: paragraph(after: gap)))

            case .heading(let depth):
                let headingSize = depth <= 1 ? size + 3 : (depth == 2 ? size + 1.5 : size)
                let paragraphStyle = paragraph(before: index == 0 ? 0 : 4, after: max(4, gap * 0.6))
                out.append(inline(block.text, style: paragraphStyle, baseSize: headingSize, baseWeight: .semibold, color: ink.strong))

            case .list(let ordered, let items):
                for (i, item) in items.enumerated() {
                    let marker = ordered ? "\(i + 1)." : "•"
                    let paragraphStyle = listParagraph(after: i == items.count - 1 ? gap : (size * 0.3).rounded())
                    let row = NSMutableAttributedString(string: marker + "\t", attributes: [
                        .font: ordered ? style.code(codeSize, style.codeWeight) : style.prose(size, .regular),
                        .foregroundColor: ink.muted,
                        .paragraphStyle: paragraphStyle,
                    ])
                    row.append(inline(item, style: paragraphStyle))
                    out.append(row)
                    if i < items.count - 1 { out.append(newline(paragraphStyle)) }
                }

            case .blockquote:
                let paragraphStyle = paragraph(after: gap)
                paragraphStyle.headIndent = 14
                paragraphStyle.firstLineHeadIndent = 14
                out.append(inline(block.text, style: paragraphStyle, color: ink.dim))

            case .code:
                out.append(codeBlock(block.text, after: gap))

            case .table(let headers, let rows):
                out.append(table(headers: headers, rows: rows, after: gap))

            case .rule:
                out.append(NSAttributedString(string: "", attributes: [.paragraphStyle: paragraph(after: gap)]))
            }

            if !isLast { out.append(newline(paragraph())) }
        }
        return out
    }

    // MARK: Blocks

    private func paragraph(before: CGFloat = 0, after: CGFloat = 0) -> NSMutableParagraphStyle {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = lineSpacing
        paragraphStyle.paragraphSpacingBefore = before
        paragraphStyle.paragraphSpacing = after
        return paragraphStyle
    }

    private func listParagraph(after: CGFloat) -> NSMutableParagraphStyle {
        let indent = (size * 1.45).rounded()
        let paragraphStyle = paragraph(after: after)
        paragraphStyle.tabStops = [NSTextTab(textAlignment: .left, location: indent)]
        paragraphStyle.defaultTabInterval = indent
        paragraphStyle.headIndent = indent
        return paragraphStyle
    }

    private func newline(_ paragraphStyle: NSParagraphStyle) -> NSAttributedString {
        NSAttributedString(string: "\n", attributes: [
            .font: style.prose(size, .regular),
            .paragraphStyle: paragraphStyle,
        ])
    }

    private func codeBlock(_ code: String, after: CGFloat) -> NSAttributedString {
        let block = NSTextBlock()
        block.backgroundColor = ink.codeGround
        block.setContentWidth(100, type: .percentageValueType)
        block.setWidth(10, type: .absoluteValueType, for: .padding, edge: .minY)
        block.setWidth(10, type: .absoluteValueType, for: .padding, edge: .maxY)
        block.setWidth(12, type: .absoluteValueType, for: .padding, edge: .minX)
        block.setWidth(12, type: .absoluteValueType, for: .padding, edge: .maxX)

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.textBlocks = [block]
        paragraphStyle.lineSpacing = (codeSize * 0.3).rounded()
        paragraphStyle.paragraphSpacing = after

        return NSAttributedString(string: code, attributes: [
            .font: style.code(codeSize, style.codeWeight),
            .foregroundColor: ink.code,
            .paragraphStyle: paragraphStyle,
        ])
    }

    private func table(headers: [String], rows: [[String]], after: CGFloat) -> NSAttributedString {
        let all = [headers] + rows
        let columns = all.map(\.count).max() ?? 0
        let widths = (0..<columns).map { c in all.map { c < $0.count ? $0[c].count : 0 }.max() ?? 0 }

        func line(_ cells: [String]) -> String {
            (0..<columns).map { c in
                let cell = c < cells.count ? cells[c] : ""
                return cell.padding(toLength: widths[c], withPad: " ", startingAt: 0)
            }
            .joined(separator: "   ")
            .trimmingCharacters(in: .whitespaces)
        }

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = (codeSize * 0.35).rounded()
        paragraphStyle.paragraphSpacing = after

        let out = NSMutableAttributedString(string: line(headers) + "\n", attributes: [
            .font: style.code(codeSize, .medium),
            .foregroundColor: ink.dim,
            .paragraphStyle: paragraphStyle,
        ])
        out.append(NSAttributedString(string: rows.map(line).joined(separator: "\n"), attributes: [
            .font: style.code(codeSize, style.codeWeight),
            .foregroundColor: ink.prose,
            .paragraphStyle: paragraphStyle,
        ]))
        return out
    }

    // MARK: Inline

    private func inline(
        _ text: String,
        style paragraphStyle: NSParagraphStyle,
        baseSize: CGFloat? = nil,
        baseWeight: NSFont.Weight = .regular,
        color: NSColor? = nil
    ) -> NSAttributedString {
        let baseSize = baseSize ?? size
        let color = color ?? ink.prose
        let parsed = (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)

        let out = NSMutableAttributedString()
        for run in parsed.runs {
            let piece = String(parsed[run.range].characters)
            let intent = run.inlinePresentationIntent ?? []
            var attributes: [NSAttributedString.Key: Any] = [.paragraphStyle: paragraphStyle]

            if intent.contains(.code) {
                attributes[.font] = style.code(baseSize - 1, style.codeWeight)
                attributes[.foregroundColor] = ink.code
                if style.inlineCodeGround {
                    attributes[.backgroundColor] = ink.codeGround
                }
            } else {
                let weight: NSFont.Weight = intent.contains(.stronglyEmphasized) ? .semibold : baseWeight
                var font = style.prose(baseSize, weight)
                if intent.contains(.emphasized) {
                    font = NSFontManager.shared.convert(font, toHaveTrait: .italicFontMask)
                }
                attributes[.font] = font
                attributes[.foregroundColor] = intent.contains(.stronglyEmphasized) ? ink.strong : color
            }
            if intent.contains(.strikethrough) {
                attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
            }
            if let url = run.link {
                attributes[.link] = url
            }
            out.append(NSAttributedString(string: piece, attributes: attributes))
        }
        return out
    }
}

// MARK: - Selectable text view

/// One non-editable, selectable AppKit text view sized to its content.
///
/// `ground` paints under the glyphs and is what makes them rasterize crisply;
/// pass nil on a translucent host (the text then antialiases in greyscale).
/// `hugsWidth` shrinks the view to its longest line.
public struct HudSelectableText: NSViewRepresentable {
    public let text: NSAttributedString
    public var ground: NSColor?
    public var hugsWidth: Bool
    public var linkColor: NSColor?
    public var selectionColor: NSColor?
    /// Font smoothing (AppKit's stem darkening). Nil smooths on a light
    /// ground only: on a dark one it fattens light glyphs into a soft bloom,
    /// the reason browsers offer `-webkit-font-smoothing: antialiased`.
    public var smoothing: Bool?

    public init(
        _ text: NSAttributedString,
        ground: NSColor?,
        hugsWidth: Bool = false,
        linkColor: NSColor? = nil,
        selectionColor: NSColor? = nil,
        smoothing: Bool? = nil
    ) {
        self.text = text
        self.ground = ground
        self.hugsWidth = hugsWidth
        self.linkColor = linkColor
        self.selectionColor = selectionColor
        self.smoothing = smoothing
    }

    /// Ground, link and selection colours from one ink set.
    public init(_ text: NSAttributedString, ink: HudOpaqueInk, opaque: Bool = true, hugsWidth: Bool = false) {
        self.init(
            text,
            ground: opaque ? ink.ground : nil,
            hugsWidth: hugsWidth,
            linkColor: ink.strong,
            selectionColor: ink.selection
        )
    }

    public func makeNSView(context: Context) -> NSTextView {
        // TextKit 1: `NSTextBlock` code grounds and exact height measurement.
        let view = HudSmoothingTextView(usingTextLayoutManager: false)
        view.isEditable = false
        view.isSelectable = true
        view.isRichText = true
        view.textContainerInset = .zero
        view.textContainer?.lineFragmentPadding = 0
        view.textContainer?.widthTracksTextView = true
        view.isVerticallyResizable = false
        view.isHorizontallyResizable = false
        apply(to: view)
        view.textStorage?.setAttributedString(text)
        return view
    }

    public func updateNSView(_ view: NSTextView, context: Context) {
        apply(to: view)
        guard let storage = view.textStorage, !storage.isEqual(to: text) else { return }
        storage.setAttributedString(text)
    }

    private func apply(to view: NSTextView) {
        if let view = view as? HudSmoothingTextView {
            let smooths = smoothing ?? !(ground?.hudIsDark ?? false)
            if view.smoothsFonts != smooths {
                view.smoothsFonts = smooths
                view.needsDisplay = true
            }
        }
        view.drawsBackground = ground != nil
        if let ground, view.backgroundColor != ground { view.backgroundColor = ground }
        view.linkTextAttributes = [
            .foregroundColor: linkColor ?? NSColor.labelColor,
            .underlineStyle: NSUnderlineStyle.single.rawValue,
            .underlineColor: (linkColor ?? NSColor.labelColor).withAlphaComponent(0.35),
            .cursor: NSCursor.pointingHand,
        ]
        if let selectionColor {
            view.selectedTextAttributes = [.backgroundColor: selectionColor]
        }
    }

    public func sizeThatFits(_ proposal: ProposedViewSize, nsView view: NSTextView, context: Context) -> CGSize? {
        guard let container = view.textContainer, let layout = view.layoutManager else { return nil }
        let proposed = proposal.width ?? 10_000
        let width = proposed.isFinite ? max(proposed, 1) : 10_000
        container.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        layout.ensureLayout(for: container)
        let used = layout.usedRect(for: container)
        let fitted = hugsWidth ? min(width, ceil(used.width)) : width
        return CGSize(width: fitted, height: ceil(used.height))
    }
}

/// An `NSTextView` that can switch font smoothing off for its own drawing.
class HudSmoothingTextView: NSTextView {
    var smoothsFonts = true

    override func draw(_ dirtyRect: NSRect) {
        if !smoothsFonts, let context = NSGraphicsContext.current?.cgContext {
            context.saveGState()
            context.setShouldSmoothFonts(false)
            super.draw(dirtyRect)
            context.restoreGState()
        } else {
            super.draw(dirtyRect)
        }
    }
}

extension NSColor {
    /// Relative luminance under 0.4: light text goes on this ground.
    var hudIsDark: Bool {
        guard let c = usingColorSpace(.sRGB) else { return false }
        return 0.2126 * c.redComponent + 0.7152 * c.greenComponent + 0.0722 * c.blueComponent < 0.4
    }
}
#endif
