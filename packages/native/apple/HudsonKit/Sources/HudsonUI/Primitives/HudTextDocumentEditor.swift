import SwiftUI

public enum HudTextDocumentEditorBackend: String, CaseIterable, Identifiable, Sendable {
    case automatic
    case native
    case swiftUI

    public var id: String { rawValue }
}

struct HudEditableTextDocumentView: View {
    @Binding var text: String
    var kind: HudTextDocumentKind
    var language: String?
    var isReadOnly: Bool
    var showsLineNumbers: Bool
    var backend: HudTextDocumentEditorBackend

    @ScaledMetric(relativeTo: .caption) private var readableEditorSize = HudTextSize.sm

    var body: some View {
        #if os(macOS)
        if backend != .swiftUI {
            HudMacTextDocumentEditor(
                text: $text,
                kind: kind,
                language: language,
                isReadOnly: isReadOnly,
                showsLineNumbers: showsLineNumbers,
                editorPointSize: editorPointSize
            )
        } else {
            swiftUIEditor
        }
        #else
        swiftUIEditor
        #endif
    }

    private var swiftUIEditor: some View {
        TextEditor(text: $text)
            .font(.system(size: editorPointSize, weight: .regular, design: .monospaced))
            .foregroundStyle(HudPalette.ink)
            .tint(HudPalette.statusInfo)
            .padding(HudSpacing.xl)
            .scrollContentBackground(.hidden)
            .background(HudSurface.base)
            .disabled(isReadOnly)
    }

    private var editorPointSize: CGFloat {
        HudTextDocumentTypographyPolicy.bodyTextRole(for: kind) == nil
            ? HudTextSize.sm
            : readableEditorSize
    }
}

#if os(macOS)
import AppKit

private struct HudMacTextDocumentEditor: NSViewRepresentable {
    @Binding var text: String
    var kind: HudTextDocumentKind
    var language: String?
    var isReadOnly: Bool
    var showsLineNumbers: Bool
    var editorPointSize: CGFloat

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, editorPointSize: editorPointSize)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = true
        scrollView.backgroundColor = HudAppKitColor.editorBackground
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.scrollerStyle = .overlay

        let textView = NSTextView()
        textView.delegate = context.coordinator
        textView.string = text
        textView.font = HudAppKitFont.editor(size: editorPointSize)
        textView.textColor = HudAppKitColor.editorInk
        textView.insertionPointColor = HudAppKitColor.editorCaret
        textView.backgroundColor = HudAppKitColor.editorBackground
        textView.drawsBackground = true
        textView.isEditable = !isReadOnly
        textView.isSelectable = true
        textView.allowsUndo = true
        textView.isRichText = false
        textView.importsGraphics = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isContinuousSpellCheckingEnabled = false
        textView.usesFindPanel = true
        textView.allowsDocumentBackgroundColorChange = false
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.textContainerInset = NSSize(width: HudSpacing.xl, height: HudSpacing.xl)

        scrollView.documentView = textView
        configureLineNumbers(on: scrollView, textView: textView)
        configureTextLayout(on: scrollView, textView: textView)

        context.coordinator.textView = textView
        context.coordinator.scrollView = scrollView
        context.coordinator.highlight(kind: kind, language: language)
        context.coordinator.applyPresentation(kind: kind, language: language)
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = context.coordinator.textView else { return }

        if textView.string != text {
            let selectedRange = textView.selectedRange()
            textView.string = text
            textView.setSelectedRange(clamped(range: selectedRange, length: (text as NSString).length))
        }

        textView.isEditable = !isReadOnly
        textView.textColor = HudAppKitColor.editorInk
        textView.insertionPointColor = HudAppKitColor.editorCaret
        textView.backgroundColor = HudAppKitColor.editorBackground
        scrollView.backgroundColor = HudAppKitColor.editorBackground
        context.coordinator.editorPointSize = editorPointSize
        textView.font = HudAppKitFont.editor(size: editorPointSize)

        if showsLineNumbers {
            configureLineNumbers(on: scrollView, textView: textView)
        } else {
            scrollView.hasVerticalRuler = false
            scrollView.rulersVisible = false
            scrollView.verticalRulerView = nil
        }
        configureTextLayout(on: scrollView, textView: textView)

        context.coordinator.applyPresentation(kind: kind, language: language)
        context.coordinator.highlight(kind: kind, language: language)
        context.coordinator.lineNumberRuler?.needsDisplay = true
    }

    private func clamped(range: NSRange, length: Int) -> NSRange {
        let location = min(range.location, length)
        let end = min(range.location + range.length, length)
        return NSRange(location: location, length: max(0, end - location))
    }

    private func configureLineNumbers(on scrollView: NSScrollView, textView: NSTextView) {
        scrollView.hasVerticalRuler = showsLineNumbers
        scrollView.rulersVisible = showsLineNumbers

        guard showsLineNumbers else { return }
        if let ruler = scrollView.verticalRulerView as? HudLineNumberRulerView {
            ruler.textView = textView
            return
        }

        let ruler = HudLineNumberRulerView(textView: textView)
        scrollView.verticalRulerView = ruler
    }

    private func configureTextLayout(on scrollView: NSScrollView, textView: NSTextView) {
        let wrapsLines = HudTextDocumentTypographyPolicy.wrapsEditorLines(for: kind)
        scrollView.hasHorizontalScroller = !wrapsLines
        scrollView.autohidesScrollers = wrapsLines

        textView.isHorizontallyResizable = !wrapsLines
        textView.autoresizingMask = wrapsLines ? [.width] : []
        textView.textContainer?.widthTracksTextView = wrapsLines
        textView.textContainer?.containerSize = NSSize(
            width: wrapsLines ? scrollView.contentSize.width : CGFloat.greatestFiniteMagnitude,
            height: CGFloat.greatestFiniteMagnitude
        )
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding var text: String
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?
        private var isHighlighting = false
        var editorPointSize: CGFloat

        var lineNumberRuler: HudLineNumberRulerView? {
            scrollView?.verticalRulerView as? HudLineNumberRulerView
        }

        init(text: Binding<String>, editorPointSize: CGFloat) {
            self._text = text
            self.editorPointSize = editorPointSize
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
            highlight(kind: nil, language: nil)
            lineNumberRuler?.needsDisplay = true
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            lineNumberRuler?.needsDisplay = true
        }

        func applyPresentation(kind: HudTextDocumentKind, language: String?) {
            guard let textView else { return }
            textView.typingAttributes = [
                .font: HudAppKitFont.editor(size: editorPointSize),
                .foregroundColor: HudAppKitColor.editorInk,
            ]

            if kind == .code || kind == .raw {
                textView.textContainerInset = NSSize(width: HudSpacing.xl, height: HudSpacing.xl)
            } else {
                textView.textContainerInset = NSSize(width: HudSpacing.xxl, height: HudSpacing.xxl)
            }
        }

        func highlight(kind: HudTextDocumentKind?, language: String?) {
            guard !isHighlighting, let textView, let storage = textView.textStorage else { return }
            let kind = kind ?? currentKind
            let language = language ?? currentLanguage
            currentKind = kind
            currentLanguage = language

            isHighlighting = true
            defer { isHighlighting = false }

            let selectedRange = textView.selectedRange()
            let fullRange = NSRange(location: 0, length: (storage.string as NSString).length)
            guard fullRange.length > 0 else {
                textView.typingAttributes = baseAttributes
                return
            }

            storage.beginEditing()
            storage.setAttributes(baseAttributes, range: fullRange)

            if kind == .code || kind == .raw {
                let source = storage.string
                apply(pattern: #""(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'"#, color: HudAppKitColor.syntaxString, storage: storage, source: source)
                apply(pattern: #"\b(true|false|null|nil|undefined)\b"#, color: HudAppKitColor.syntaxLiteral, storage: storage, source: source)
                apply(pattern: #"\b(import|export|from|return|func|function|struct|class|enum|let|var|const|if|else|switch|case|for|while|guard|public|private|try|await|async|throws|some|View)\b"#, color: HudAppKitColor.syntaxKeyword, storage: storage, source: source)
                apply(pattern: #"\b([0-9]+(?:\.[0-9]+)?)\b"#, color: HudAppKitColor.syntaxNumber, storage: storage, source: source)
                apply(pattern: #"//.*$|#.*$"#, color: HudAppKitColor.syntaxComment, storage: storage, source: source, options: [.anchorsMatchLines])
            }

            storage.endEditing()
            textView.setSelectedRange(clamped(range: selectedRange, length: fullRange.length))
            textView.typingAttributes = baseAttributes
        }

        private var currentKind: HudTextDocumentKind = .text
        private var currentLanguage: String?

        private var baseAttributes: [NSAttributedString.Key: Any] {
            [
                .font: HudAppKitFont.editor(size: editorPointSize),
                .foregroundColor: HudAppKitColor.editorInk,
            ]
        }

        private func apply(
            pattern: String,
            color: NSColor,
            storage: NSTextStorage,
            source: String,
            options: NSRegularExpression.Options = []
        ) {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return }
            let range = NSRange(location: 0, length: (source as NSString).length)
            regex.enumerateMatches(in: source, range: range) { match, _, _ in
                guard let matchRange = match?.range, matchRange.location != NSNotFound else { return }
                storage.addAttribute(.foregroundColor, value: color, range: matchRange)
            }
        }

        private func clamped(range: NSRange, length: Int) -> NSRange {
            let location = min(range.location, length)
            let end = min(range.location + range.length, length)
            return NSRange(location: location, length: max(0, end - location))
        }
    }
}

private final class HudLineNumberRulerView: NSRulerView {
    weak var textView: NSTextView?

    init(textView: NSTextView) {
        self.textView = textView
        super.init(scrollView: textView.enclosingScrollView, orientation: .verticalRuler)
        self.clientView = textView
        self.ruleThickness = HudLayout.textDocumentLineNumberWidth + HudSpacing.xxl
    }

    required init(coder: NSCoder) {
        super.init(coder: coder)
    }

    override func drawHashMarksAndLabels(in rect: NSRect) {
        guard let textView,
              let layoutManager = textView.layoutManager,
              let textContainer = textView.textContainer else {
            return
        }

        HudAppKitColor.editorBackground.setFill()
        rect.fill()

        let visibleRect = textView.visibleRect
        let glyphRange = layoutManager.glyphRange(forBoundingRect: visibleRect, in: textContainer)
        let text = textView.string as NSString
        let attributes: [NSAttributedString.Key: Any] = [
            .font: HudAppKitFont.lineNumber,
            .foregroundColor: HudAppKitColor.lineNumber,
        ]

        var glyphIndex = glyphRange.location
        while glyphIndex < NSMaxRange(glyphRange) {
            var effectiveRange = NSRange(location: 0, length: 0)
            let lineRect = layoutManager.lineFragmentRect(
                forGlyphAt: glyphIndex,
                effectiveRange: &effectiveRange,
                withoutAdditionalLayout: true
            )
            let charIndex = layoutManager.characterIndexForGlyph(at: glyphIndex)
            let lineNumber = text.substring(to: charIndex).reduce(1) { count, character in
                character == "\n" ? count + 1 : count
            }
            draw(lineNumber: lineNumber, lineRect: lineRect, attributes: attributes)
            glyphIndex = NSMaxRange(effectiveRange)
        }
    }

    private func draw(lineNumber: Int, lineRect: NSRect, attributes: [NSAttributedString.Key: Any]) {
        let numberString = "\(lineNumber)" as NSString
        let size = numberString.size(withAttributes: attributes)
        let x = ruleThickness - HudSpacing.xxl - size.width
        let y = lineRect.minY + textViewYOffset
        numberString.draw(at: NSPoint(x: x, y: y), withAttributes: attributes)
    }

    private var textViewYOffset: CGFloat {
        guard let textView else { return 0 }
        return textView.textContainerOrigin.y
    }
}

private enum HudAppKitColor {
    static let editorBackground = NSColor(HudPalette.bg)
    static let editorInk = NSColor(HudPalette.ink)
    static let editorCaret = NSColor(HudPalette.statusInfo)
    static let lineNumber = NSColor(HudPalette.dim)
    static let syntaxComment = NSColor(HudPalette.dim)
    static let syntaxKeyword = NSColor(HudPalette.statusInfo)
    static let syntaxLiteral = NSColor(HudPalette.statusWarn)
    static let syntaxNumber = NSColor(HudTint.teal.color)
    static let syntaxString = NSColor(HudTint.green.color)
}

private enum HudAppKitFont {
    static func editor(size: CGFloat) -> NSFont {
        NSFont.monospacedSystemFont(ofSize: size, weight: .regular)
    }

    static let lineNumber = NSFont.monospacedSystemFont(ofSize: HudTextSize.xxs, weight: .regular)
}
#endif
