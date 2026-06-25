import Testing
import SwiftUI
@testable import HudsonUI

@Suite("HudMarkdownParser")
struct HudMarkdownParserTests {
    typealias P = HudMarkdownParser

    @Test("empty / whitespace input yields no blocks")
    func empty() {
        #expect(P.parse("").isEmpty)
        #expect(P.parse("   \n\n ").isEmpty)
    }

    @Test("heading captures depth and text")
    func heading() {
        let blocks = P.parse("# Title\n\n### Deeper")
        #expect(blocks.count == 2)
        #expect(blocks[0].kind == .heading(depth: 1))
        #expect(blocks[0].text == "Title")
        #expect(blocks[1].kind == .heading(depth: 3))
        #expect(blocks[1].text == "Deeper")
    }

    @Test("consecutive list lines group into one block")
    func lists() {
        let unordered = P.parse("- one\n- two\n- three")
        #expect(unordered.count == 1)
        #expect(unordered[0].kind == .list(ordered: false, items: ["one", "two", "three"]))

        let ordered = P.parse("1. first\n2. second")
        #expect(ordered.count == 1)
        #expect(ordered[0].kind == .list(ordered: true, items: ["first", "second"]))
    }

    @Test("fenced code: empty language normalizes to nil, named language preserved")
    func codeFenceLanguage() {
        let bare = P.parse("```\nlet x = 1\n```")
        #expect(bare.count == 1)
        #expect(bare[0].kind == .code(language: nil))
        #expect(bare[0].text == "let x = 1")

        let swift = P.parse("```swift\nlet y = 2\n```")
        #expect(swift[0].kind == .code(language: "swift"))
    }

    @Test("pipe table parses headers and rows, separator row consumed")
    func table() {
        let blocks = P.parse("| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |")
        #expect(blocks.count == 1)
        #expect(blocks[0].kind == .table(headers: ["A", "B"], rows: [["1", "2"], ["3", "4"]]))
    }

    @Test("blockquote merges consecutive quote lines")
    func blockquote() {
        let blocks = P.parse("> line one\n> line two")
        #expect(blocks.count == 1)
        #expect(blocks[0].kind == .blockquote)
        #expect(blocks[0].text == "line one\nline two")
    }

    @Test("horizontal rule")
    func rule() {
        #expect(P.parse("---")[0].kind == .rule)
        #expect(P.parse("***")[0].kind == .rule)
    }

    @Test("paragraph joins soft-wrapped lines until a block boundary")
    func paragraph() {
        let blocks = P.parse("hello\nworld\n\n# Next")
        #expect(blocks.count == 2)
        #expect(blocks[0].kind == .paragraph)
        #expect(blocks[0].text == "hello\nworld")
        #expect(blocks[1].kind == .heading(depth: 1))
    }

    @Test("blocks are Sendable value types usable across isolation")
    func sendable() async {
        let blocks = P.parse("# Title")
        // Compiles only if HudMarkdownBlock is Sendable.
        let copy: [HudMarkdownBlock] = await Task { blocks }.value
        #expect(copy == blocks)
    }
}

@Suite("HudMarkdownStyle")
struct HudMarkdownStyleTests {
    @Test("default aliases the mono preset")
    func defaultIsMono() {
        #expect(HudMarkdownStyle.default.blockSpacing == HudMarkdownStyle.mono.blockSpacing)
    }

    @Test("mono and agent presets diverge on spacing and marker colors")
    func presetsDiffer() {
        #expect(HudMarkdownStyle.mono.listMarkerColor == .muted)
        #expect(HudMarkdownStyle.agent.listMarkerColor == .accent)
        #expect(HudMarkdownStyle.mono.blockSpacing != HudMarkdownStyle.agent.blockSpacing)
        #expect(HudMarkdownStyle.agent.unorderedMarkerWidth == 10)
        #expect(HudMarkdownStyle.mono.unorderedMarkerWidth == 12)
    }

    @Test("color roles resolve against the active palette")
    func colorRoles() {
        let palette = HudThemePalette.default
        #expect(HudMarkdownStyle.ColorRole.ink.color(in: palette) == palette.ink)
        #expect(HudMarkdownStyle.ColorRole.accent.color(in: palette) == palette.accent)
        #expect(HudMarkdownStyle.ColorRole.muted.color(in: palette) == palette.muted)
        #expect(HudMarkdownStyle.ColorRole.dim.color(in: palette) == palette.dim)
    }
}
