import SwiftUI

#if os(macOS)
import AppKit
#endif

// Themed code block for agent/chat surfaces: a titled container (language label
// + traffic lights + copy affordance) over a horizontally-scrolling, token-
// colored source body. Highlighting is a real tokenizer (not line regex), with
// language routes for JSON / shell / Swift / JS-like; everything else falls
// through the generic tokenizer. Colors resolve from `@Environment(\.hudTheme)`
// so the block follows whatever theme the host installs.

// MARK: - Tokens

public enum HudCodeTokenKind: Sendable, Equatable {
    case plain
    case keyword
    case string
    case number
    case comment
    case identifier
    case punctuation
}

public struct HudCodeToken: Equatable {
    public let text: String
    public let kind: HudCodeTokenKind

    public init(text: String, kind: HudCodeTokenKind) {
        self.text = text
        self.kind = kind
    }
}

// MARK: - Tokenizer

/// A small, dependency-free syntax tokenizer. Returns semantic token *kinds*;
/// the view maps kinds onto theme colors, so highlighting stays theme-pure.
public enum HudCodeSyntax {
    private static let jsLikeKeywords: Set<String> = [
        "const", "let", "var", "function", "return", "if", "else", "for", "while",
        "do", "switch", "case", "break", "continue", "import", "export", "from",
        "as", "default", "class", "extends", "new", "this", "await", "async",
        "yield", "try", "catch", "finally", "throw", "typeof", "instanceof",
        "true", "false", "null", "undefined", "in", "of",
    ]

    private static let swiftKeywords: Set<String> = [
        "func", "let", "var", "if", "else", "guard", "return", "for", "in",
        "while", "do", "switch", "case", "break", "continue", "import", "struct",
        "class", "enum", "protocol", "extension", "private", "public", "internal",
        "fileprivate", "open", "static", "final", "lazy", "weak", "unowned",
        "self", "Self", "init", "deinit", "throws", "throw", "try", "catch",
        "rethrows", "async", "await", "true", "false", "nil", "some", "any",
    ]

    private static let shellKeywords: Set<String> = [
        "if", "then", "else", "elif", "fi", "for", "do", "done", "while",
        "case", "esac", "function", "return", "in", "export", "local",
    ]

    private static let jsonKeywords: Set<String> = ["true", "false", "null"]

    public static func tokenize(_ source: String, language: String?) -> [HudCodeToken] {
        switch (language ?? "").lowercased() {
        case "json":                      return tokenizeJSON(source)
        case "bash", "sh", "shell", "zsh": return tokenizeShell(source)
        case "swift":                     return tokenizeSwift(source)
        default:                          return tokenizeGeneric(source)
        }
    }

    private static func tokenizeGeneric(_ source: String) -> [HudCodeToken] {
        var tokens: [HudCodeToken] = []
        var buffer = ""
        var inString = false
        var stringDelimiter: Character = "\""
        var inLineComment = false

        func push(_ kind: HudCodeTokenKind) {
            guard !buffer.isEmpty else { return }
            tokens.append(HudCodeToken(text: buffer, kind: kind))
            buffer.removeAll(keepingCapacity: true)
        }
        func pushWord() {
            guard !buffer.isEmpty else { return }
            push(jsLikeKeywords.contains(buffer) ? .keyword : .plain)
        }

        let chars = Array(source)
        var i = 0
        while i < chars.count {
            let ch = chars[i]

            if inLineComment {
                buffer.append(ch)
                if ch == "\n" { push(.comment); inLineComment = false }
                i += 1
                continue
            }
            if inString {
                buffer.append(ch)
                if ch == stringDelimiter { push(.string); inString = false }
                i += 1
                continue
            }
            if ch == "/" && i + 1 < chars.count && chars[i + 1] == "/" {
                inLineComment = true; buffer = "//"; i += 2; continue
            }
            if ch == "\"" || ch == "'" || ch == "`" {
                inString = true; stringDelimiter = ch; buffer = String(ch); i += 1; continue
            }
            if ch.isNumber {
                buffer.append(ch)
                var j = i + 1
                while j < chars.count, chars[j].isNumber || chars[j] == "." || chars[j] == "_" {
                    buffer.append(chars[j]); j += 1
                }
                push(.number); i = j; continue
            }
            if ch.isLetter || ch == "_" || ch == "$" {
                buffer.append(ch)
                var j = i + 1
                while j < chars.count, chars[j].isLetter || chars[j].isNumber || chars[j] == "_" || chars[j] == "$" {
                    buffer.append(chars[j]); j += 1
                }
                pushWord(); i = j; continue
            }
            if ch.isWhitespace {
                push(.plain)
                tokens.append(HudCodeToken(text: String(ch), kind: .plain))
                i += 1; continue
            }
            buffer.append(ch)
            push(.punctuation)
            i += 1
        }

        if !buffer.isEmpty {
            if inString { push(.string) }
            else if inLineComment { push(.comment) }
            else { push(.plain) }
        }
        return tokens
    }

    private static func tokenizeJSON(_ source: String) -> [HudCodeToken] {
        var tokens: [HudCodeToken] = []
        var current = ""
        var inString = false
        var escape = false

        for ch in source {
            if inString {
                current.append(ch)
                if escape { escape = false }
                else if ch == "\\" { escape = true }
                else if ch == "\"" {
                    tokens.append(HudCodeToken(text: current, kind: .string))
                    current.removeAll(keepingCapacity: true)
                    inString = false
                }
                continue
            }
            if ch == "\"" { inString = true; current = "\""; continue }
            if ch.isNumber || (ch == "-" && (current.isEmpty || current == ":")) {
                current.append(ch); continue
            }
            if !ch.isNumber && !current.isEmpty && current.allSatisfy({ $0.isNumber || $0 == "-" || $0 == "." }) {
                tokens.append(HudCodeToken(text: current, kind: .number))
                current.removeAll(keepingCapacity: true)
            }
            if ch == "{" || ch == "}" || ch == "[" || ch == "]" || ch == "," || ch == ":" {
                if !current.isEmpty {
                    tokens.append(HudCodeToken(text: current, kind: jsonKeywords.contains(current) ? .keyword : .plain))
                    current.removeAll(keepingCapacity: true)
                }
                tokens.append(HudCodeToken(text: String(ch), kind: .punctuation))
                continue
            }
            current.append(ch)
        }
        if !current.isEmpty {
            tokens.append(HudCodeToken(text: current, kind: jsonKeywords.contains(current) ? .keyword : .plain))
        }
        return tokens
    }

    private static func tokenizeShell(_ source: String) -> [HudCodeToken] {
        var tokens: [HudCodeToken] = []
        var current = ""
        var inSingle = false
        var inDouble = false
        var inComment = false

        for ch in source {
            if inComment { current.append(ch); continue }
            if inSingle { current.append(ch); if ch == "'" { inSingle = false }; continue }
            if inDouble { current.append(ch); if ch == "\"" { inDouble = false }; continue }
            if ch == "#" {
                if !current.isEmpty {
                    tokens.append(HudCodeToken(text: current, kind: .plain)); current.removeAll()
                }
                inComment = true; current = "#"; continue
            }
            if ch == "'" { inSingle = true; current.append(ch); continue }
            if ch == "\"" { inDouble = true; current.append(ch); continue }
            if ch == "$" || ch.isWhitespace || ch == "|" || ch == "&" || ch == ";" {
                if !current.isEmpty {
                    if shellKeywords.contains(current) {
                        tokens.append(HudCodeToken(text: current, kind: .keyword))
                    } else if current.hasPrefix("$") {
                        tokens.append(HudCodeToken(text: current, kind: .number))
                    } else {
                        tokens.append(HudCodeToken(text: current, kind: .plain))
                    }
                    current.removeAll()
                }
                if ch == "$" { tokens.append(HudCodeToken(text: "$", kind: .number)) }
                else if ch.isWhitespace { tokens.append(HudCodeToken(text: String(ch), kind: .plain)) }
                else { tokens.append(HudCodeToken(text: String(ch), kind: .punctuation)) }
                continue
            }
            current.append(ch)
        }
        if !current.isEmpty {
            tokens.append(HudCodeToken(text: current, kind: inComment ? .comment : .plain))
        }
        return tokens
    }

    private static func tokenizeSwift(_ source: String) -> [HudCodeToken] {
        // Swift shares most rules with the generic tokenizer; remap keyword hits
        // against the Swift keyword set.
        tokenizeGeneric(source).map { token in
            guard token.kind == .keyword || token.kind == .plain else { return token }
            return HudCodeToken(text: token.text, kind: swiftKeywords.contains(token.text) ? .keyword : token.kind)
        }
    }
}

// MARK: - View

public struct HudCodeBlock: View {
    let language: String?
    let source: String
    var codeSize: CGFloat

    @Environment(\.hudTheme) private var theme

    public init(language: String?, source: String, codeSize: CGFloat = 12) {
        self.language = language
        self.source = source
        self.codeSize = codeSize
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView(.horizontal, showsIndicators: false) {
                formattedBody
                    .font(HudFont.mono(codeSize))
                    .lineSpacing(2)
                    .textSelection(.enabled)
                    .padding(.horizontal, HudSpacing.xl)
                    .padding(.vertical, HudSpacing.lg)
            }
            .background(HudSurface.tintMuted(theme.palette.bg))
        }
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: HudRadius.card, style: .continuous)
                .strokeBorder(theme.palette.border, lineWidth: HudStrokeWidth.thin)
        )
    }

    private var header: some View {
        HStack(spacing: 8) {
            HStack(spacing: 5) {
                Circle().fill(HudTint.red.color).frame(width: HudDotSize.small, height: HudDotSize.small)
                Circle().fill(HudTint.amber.color).frame(width: HudDotSize.small, height: HudDotSize.small)
                Circle().fill(HudTint.green.color).frame(width: HudDotSize.small, height: HudDotSize.small)
            }
            Text((language ?? "code").uppercased())
                .font(HudFont.mono(8, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(theme.palette.muted)
            Spacer()
            #if os(macOS)
            Button {
                let pb = NSPasteboard.general
                pb.clearContents()
                pb.setString(source, forType: .string)
            } label: {
                Image(systemName: "doc.on.doc")
                    .font(HudFont.ui(HudTextSize.micro, weight: .semibold))
                    .foregroundStyle(theme.palette.muted)
                    .padding(HudSpacing.xs)
                    .background(
                        Circle()
                            .fill(HudSurface.tintStrong(theme.palette.surface))
                            .overlay(Circle().strokeBorder(theme.palette.border, lineWidth: HudStrokeWidth.thin))
                    )
            }
            .buttonStyle(.plain)
            .help("Copy code")
            #endif
        }
        .padding(.horizontal, HudSpacing.xl)
        .padding(.vertical, HudSpacing.md)
        .background(theme.palette.chrome)
    }

    private var formattedBody: Text {
        var combined = Text("")
        for token in HudCodeSyntax.tokenize(source, language: language) {
            combined = combined + Text(token.text)
                .foregroundColor(color(for: token.kind))
                .font(HudFont.mono(codeSize))
        }
        return combined
    }

    private func color(for kind: HudCodeTokenKind) -> Color {
        switch kind {
        case .plain:       return theme.palette.ink
        case .keyword:     return theme.palette.accent
        case .string:      return HudTint.amber.color
        case .number:      return HudTint.teal.color
        case .comment:     return theme.palette.dim
        case .identifier:  return HudTint.blue.color
        case .punctuation: return theme.palette.muted
        }
    }
}
