import Foundation
import SwiftUI

public enum HudTextDocumentKind: String, CaseIterable, Identifiable, Sendable {
    case text
    case markdown
    case code
    case raw

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .text: return "Text"
        case .markdown: return "Markdown"
        case .code: return "Code"
        case .raw: return "Raw"
        }
    }
}

public enum HudTextDocumentMode: String, CaseIterable, Identifiable, Sendable {
    case read
    case edit
    case preview

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .read: return "Read"
        case .edit: return "Edit"
        case .preview: return "Preview"
        }
    }
}

public struct HudTextDocument: Identifiable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var uri: String?
    public var mediaType: String?
    public var language: String?
    public var kind: HudTextDocumentKind
    public var value: String
    public var isReadOnly: Bool

    public init(
        id: String,
        title: String,
        uri: String? = nil,
        mediaType: String? = nil,
        language: String? = nil,
        kind: HudTextDocumentKind,
        value: String,
        isReadOnly: Bool = false
    ) {
        self.id = id
        self.title = title
        self.uri = uri
        self.mediaType = mediaType
        self.language = language
        self.kind = kind
        self.value = value
        self.isReadOnly = isReadOnly
    }
}

public enum HudTextDocumentDetector {
    private static let markdownExtensions: Set<String> = ["md", "mdx", "markdown"]
    private static let markupExtensions: Set<String> = ["html", "htm", "xml", "svg"]
    private static let codeExtensions: Set<String> = [
        "c", "cc", "cpp", "cs", "css", "go", "h", "hpp", "java", "js",
        "jsx", "kt", "m", "mm", "php", "py", "rb", "rs", "sh", "swift",
        "ts", "tsx", "vue"
    ]
    private static let dataExtensions: Set<String> = ["json", "jsonc", "toml", "yaml", "yml"]

    public static func makeDocument(
        id: String,
        title: String,
        uri: String? = nil,
        mediaType: String? = nil,
        kind: HudTextDocumentKind? = nil,
        language: String? = nil,
        value: String,
        isReadOnly: Bool = false
    ) -> HudTextDocument {
        let resolvedLanguage = language ?? inferLanguage(title: title, uri: uri, mediaType: mediaType)
        let resolvedKind = kind ?? detectKind(title: title, uri: uri, mediaType: mediaType, language: resolvedLanguage, value: value)
        return HudTextDocument(
            id: id,
            title: title,
            uri: uri,
            mediaType: mediaType,
            language: resolvedLanguage,
            kind: resolvedKind,
            value: value,
            isReadOnly: isReadOnly
        )
    }

    public static func inferLanguage(title: String? = nil, uri: String? = nil, mediaType: String? = nil) -> String? {
        let media = mediaType?.lowercased() ?? ""
        if media.contains("markdown") { return "markdown" }
        if media.contains("javascript") { return "javascript" }
        if media.contains("typescript") { return "typescript" }
        if media.contains("json") { return "json" }
        if media.contains("css") { return "css" }
        if media.contains("html") { return "html" }
        if media.contains("xml") { return "xml" }

        guard let ext = fileExtension(title: title, uri: uri) else { return nil }
        switch ext {
        case "md", "markdown": return "markdown"
        case "mdx": return "mdx"
        case "js", "jsx": return "javascript"
        case "ts", "tsx": return "typescript"
        case "json", "jsonc": return "json"
        case "css": return "css"
        case "html", "htm": return "html"
        case "xml", "svg": return "xml"
        case "sh", "zsh", "bash": return "shell"
        default: return ext
        }
    }

    public static func detectKind(
        title: String? = nil,
        uri: String? = nil,
        mediaType: String? = nil,
        language: String? = nil,
        value: String = ""
    ) -> HudTextDocumentKind {
        let media = mediaType?.lowercased() ?? ""
        let lang = language?.lowercased() ?? ""

        if media.contains("markdown") || lang == "markdown" || lang == "mdx" {
            return .markdown
        }
        if media.contains("json") || media.contains("xml") || media.contains("html") {
            return .code
        }
        if media.hasPrefix("text/plain") {
            return .text
        }
        if ["swift", "typescript", "javascript", "json", "css", "html", "xml", "shell"].contains(lang) {
            return .code
        }

        if let ext = fileExtension(title: title, uri: uri) {
            if markdownExtensions.contains(ext) { return .markdown }
            if codeExtensions.contains(ext) || markupExtensions.contains(ext) || dataExtensions.contains(ext) {
                return .code
            }
            if ext == "txt" || ext == "text" { return .text }
        }

        if value.range(of: #"(?m)^#{1,6}\s+"#, options: .regularExpression) != nil ||
            value.range(of: #"(?m)^```"#, options: .regularExpression) != nil {
            return .markdown
        }

        return .raw
    }

    private static func fileExtension(title: String?, uri: String?) -> String? {
        let candidate = uri ?? title
        guard let candidate, let ext = candidate.split(separator: ".").last else {
            return nil
        }
        let normalized = ext.lowercased().split(separator: "?").first.map(String.init) ?? ext.lowercased()
        return normalized.isEmpty ? nil : normalized
    }
}

public struct HudTextDocumentSurface: View {
    @Binding private var document: HudTextDocument
    @Binding private var mode: HudTextDocumentMode

    private var showHeader: Bool
    private var showsChrome: Bool
    private var showsLineNumbers: Bool
    private var editorBackend: HudTextDocumentEditorBackend
    private var onSave: ((HudTextDocument) -> Void)?

    public init(
        document: Binding<HudTextDocument>,
        mode: Binding<HudTextDocumentMode>,
        showHeader: Bool = true,
        showsChrome: Bool = true,
        showsLineNumbers: Bool = true,
        editorBackend: HudTextDocumentEditorBackend = .automatic,
        onSave: ((HudTextDocument) -> Void)? = nil
    ) {
        self._document = document
        self._mode = mode
        self.showHeader = showHeader
        self.showsChrome = showsChrome
        self.showsLineNumbers = showsLineNumbers
        self.editorBackend = editorBackend
        self.onSave = onSave
    }

    public var body: some View {
        VStack(spacing: 0) {
            if showHeader {
                header
                Divider()
                    .overlay(HudHairline.subtle)
            }

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .modifier(HudTextDocumentChrome(showsChrome: showsChrome))
    }

    private var header: some View {
        HStack(spacing: HudSpacing.xl) {
            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                Text(document.title)
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                    .lineLimit(1)

                if let uri = document.uri {
                    Text(uri)
                        .font(HudFont.mono(HudTextSize.xxs))
                        .foregroundStyle(HudPalette.dim)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: HudSpacing.xl)

            HudBadge(document.kind.label, tint: kindTint)

            modePicker

            if let onSave {
                HudButton("Save", icon: "square.and.arrow.down", style: .ghost) {
                    onSave(document)
                }
            }
        }
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.vertical, HudSpacing.xl)
        .background(HudSurface.chrome)
    }

    private var modePicker: some View {
        HStack(spacing: HudSpacing.xs) {
            ForEach(availableModes) { candidate in
                Button {
                    mode = candidate
                } label: {
                    Text(candidate.label)
                        .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                        .foregroundStyle(mode == candidate ? HudPalette.ink : HudPalette.muted)
                        .padding(.horizontal, HudSpacing.md)
                        .frame(height: HudLayout.textDocumentModeButtonHeight)
                        .background(
                            RoundedRectangle(cornerRadius: HudRadius.tight)
                                .fill(mode == candidate ? HudSurface.tintFill(HudPalette.statusInfo) : .clear)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: HudRadius.tight)
                                .stroke(mode == candidate ? HudSurface.tintBorder(HudPalette.statusInfo) : HudHairline.subtle, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .disabled(candidate == .edit && document.isReadOnly)
            }
        }
        .padding(HudSpacing.xs)
        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.control))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: 1))
    }

    @ViewBuilder
    private var content: some View {
        switch resolvedMode {
        case .preview where document.kind == .markdown:
            markdownPreview
        case .edit where document.kind == .code || document.kind == .raw:
            codeEditSurface
        case .edit:
            editingSurface
        case .read, .preview:
            readSurface
        }
    }

    private var codeEditSurface: some View {
        HudEditableTextDocumentView(
            text: valueBinding,
            kind: document.kind,
            language: document.language,
            isReadOnly: document.isReadOnly,
            showsLineNumbers: showsLineNumbers,
            backend: .native,
            requestFocus: !document.isReadOnly
        )
        .id("\(document.id)-edit")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .frame(minHeight: HudLayout.textDocumentPreviewHeight)
        .background(HudSurface.base)
    }

    private var markdownPreview: some View {
        ScrollView {
            Text(markdownAttributedString)
                .font(HudFont.ui(HudTextSize.base))
                .foregroundStyle(HudPalette.ink)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(HudSpacing.xxl)
                .textSelection(.enabled)
        }
        .background(HudSurface.base)
    }

    private var editingSurface: some View {
        HudEditableTextDocumentView(
            text: valueBinding,
            kind: document.kind,
            language: document.language,
            isReadOnly: document.isReadOnly,
            showsLineNumbers: showsLineNumbers,
            backend: editorBackend
        )
    }

    private var readSurface: some View {
        // A bidirectional ScrollView centers content narrower than its viewport,
        // which floated the code block in the middle of the card. Pin the content
        // to at least the viewport width, top-leading, so code reads hard-left
        // while long lines still scroll horizontally.
        GeometryReader { geo in
            ScrollView([.vertical, .horizontal]) {
                readContent
                    .frame(minWidth: geo.size.width, alignment: .topLeading)
            }
            .background(HudSurface.base)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(HudSurface.base)
    }

    @ViewBuilder
    private var readContent: some View {
        if document.kind == .code || document.kind == .raw {
            HudCodeText(
                source: document.value,
                language: document.language,
                showsLineNumbers: showsLineNumbers
            )
            .padding(.vertical, HudLayout.textDocumentCodePadding)
            .padding(.trailing, HudLayout.textDocumentCodePadding)
            .padding(.leading, HudSpacing.xs)
        } else {
            Text(document.value)
                .font(editorFont)
                .foregroundStyle(HudPalette.ink)
                .padding(HudSpacing.xxl)
                .textSelection(.enabled)
        }
    }

    private var valueBinding: Binding<String> {
        Binding(
            get: { document.value },
            set: { document.value = $0 }
        )
    }

    private var availableModes: [HudTextDocumentMode] {
        switch document.kind {
        case .markdown:
            return [.preview, .edit, .read]
        case .code:
            return [.read, .edit]
        case .text, .raw:
            return [.read, .edit]
        }
    }

    private var resolvedMode: HudTextDocumentMode {
        if mode == .edit && document.isReadOnly { return .read }
        if mode == .preview && document.kind != .markdown { return .read }
        return mode
    }

    private var editorFont: Font {
        document.kind == .markdown
            ? HudFont.mono(HudTextSize.sm)
            : HudFont.mono(HudTextSize.sm)
    }

    private var kindTint: Color {
        switch document.kind {
        case .text: return HudPalette.muted
        case .markdown: return HudPalette.statusInfo
        case .code: return HudTint.cyan.color
        case .raw: return HudTint.teal.color
        }
    }

    private var markdownAttributedString: AttributedString {
        do {
            return try AttributedString(markdown: document.value)
        } catch {
            return AttributedString(document.value)
        }
    }
}

private struct HudCodeText: View {
    var source: String
    var language: String?
    var showsLineNumbers: Bool

    private var lines: [String] {
        source.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    }

    private var gutterWidth: CGFloat {
        let digits = max(1, String(lines.count).count)
        return CGFloat(digits) * HudLayout.textDocumentCodeGutterDigitWidth
    }

    var body: some View {
        HStack(alignment: .top, spacing: HudLayout.textDocumentCodeLineGap) {
            if showsLineNumbers {
                VStack(alignment: .trailing, spacing: 0) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { index, _ in
                        Text("\(index + 1)")
                            .font(HudFont.mono(HudTextSize.micro, weight: .regular))
                            .foregroundStyle(HudPalette.dim.opacity(0.65))
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .textSelection(.disabled)
                    }
                }
                .frame(width: gutterWidth, alignment: .trailing)
            }

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    Text(highlightedLine(line, language: language))
                        .font(HudFont.mono(HudTextSize.sm))
                        .lineSpacing(2)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
        }
    }

    private func highlightedLine(_ line: String, language: String?) -> AttributedString {
        HudCodeHighlighter.highlight(line, language: language)
    }
}

private struct HudTextDocumentChrome: ViewModifier {
    let showsChrome: Bool

    func body(content: Content) -> some View {
        if showsChrome {
            content
                .background(RoundedRectangle(cornerRadius: HudRadius.card).fill(HudSurface.raised))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.card).stroke(HudHairline.standard, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: HudRadius.card))
        } else {
            content.background(HudSurface.base)
        }
    }
}
