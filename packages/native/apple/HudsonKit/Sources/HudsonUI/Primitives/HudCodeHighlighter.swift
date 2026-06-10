import Foundation
import SwiftUI
#if os(macOS)
import AppKit
#endif

public enum HudCodeHighlighter {
    public static func highlight(_ line: String, language: String? = nil) -> AttributedString {
        if line.isEmpty {
            var space = AttributedString(" ")
            space.foregroundColor = HudPalette.ink
            return space
        }

        var attributed = AttributedString()
        for token in HudCodeSyntax.tokenize(line, language: language) {
            var part = AttributedString(token.text)
            part.foregroundColor = color(for: token.kind)
            attributed.append(part)
        }
        return attributed
    }

    public static func color(for kind: HudCodeTokenKind) -> Color {
        switch kind {
        case .plain:       return HudPalette.ink
        case .keyword:     return HudTint.cyan.color
        case .string:      return HudTint.amber.color
        case .number:      return HudTint.teal.color
        case .comment:     return HudPalette.dim
        case .identifier:  return HudTint.blue.color
        case .punctuation: return HudPalette.muted.opacity(0.9)
        }
    }

    #if os(macOS)
    public static func apply(
        to storage: NSTextStorage,
        language: String?,
        baseFont: NSFont,
        baseColor: NSColor
    ) {
        let source = storage.string
        guard !source.isEmpty else { return }

        let nsSource = source as NSString
        let fullRange = NSRange(location: 0, length: nsSource.length)
        storage.setAttributes(
            [.font: baseFont, .foregroundColor: baseColor],
            range: fullRange
        )
        paintLines(in: storage, source: nsSource, language: language)
    }

    /// Applies token colors without wrapping `beginEditing` / `endEditing`.
    public static func paintLines(
        in storage: NSTextStorage,
        source: NSString,
        language: String?
    ) {
        var lineStart = 0
        while lineStart <= source.length {
            var lineEnd = lineStart
            while lineEnd < source.length, source.character(at: lineEnd) != 0x0A {
                lineEnd += 1
            }

            let lineRange = NSRange(location: lineStart, length: lineEnd - lineStart)
            if lineRange.length > 0 {
                let line = source.substring(with: lineRange)
                applyLine(
                    line,
                    language: language,
                    storage: storage,
                    lineRange: lineRange
                )
            }

            if lineEnd >= source.length { break }
            lineStart = lineEnd + 1
        }
    }

    private static func applyLine(
        _ line: String,
        language: String?,
        storage: NSTextStorage,
        lineRange: NSRange
    ) {
        var offset = 0
        for token in HudCodeSyntax.tokenize(line, language: language) {
            let tokenLength = (token.text as NSString).length
            guard tokenLength > 0 else { continue }
            let range = NSRange(location: lineRange.location + offset, length: tokenLength)
            storage.addAttribute(.foregroundColor, value: nsColor(for: token.kind), range: range)
            offset += tokenLength
        }
    }

    private static func nsColor(for kind: HudCodeTokenKind) -> NSColor {
        NSColor(color(for: kind))
    }
    #endif
}