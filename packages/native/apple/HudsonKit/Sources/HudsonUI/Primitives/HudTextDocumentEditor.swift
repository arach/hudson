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
    var requestFocus: Bool = false

    var body: some View {
        #if os(macOS)
        if usesNativeEditor {
            HudMacTextDocumentEditor(
                text: $text,
                kind: kind,
                language: language,
                isReadOnly: isReadOnly,
                showsLineNumbers: showsLineNumbers,
                requestFocus: requestFocus
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            swiftUIEditor
        }
        #else
        swiftUIEditor
        #endif
    }

    private var usesNativeEditor: Bool {
        #if os(macOS)
        switch backend {
        case .native:
            return true
        case .swiftUI:
            return false
        case .automatic:
            return kind == .code || kind == .raw
        }
        #else
        return false
        #endif
    }

    private var swiftUIEditor: some View {
        TextEditor(text: $text)
            .font(editorFont)
            .foregroundStyle(HudPalette.ink)
            .tint(HudPalette.statusInfo)
            .padding(codePadding)
            .scrollContentBackground(.hidden)
            .background(HudSurface.base)
            .disabled(isReadOnly)
    }

    private var editorFont: Font {
        switch kind {
        case .code, .raw:
            return HudFont.mono(HudTextSize.sm)
        case .markdown, .text:
            return HudFont.ui(HudTextSize.base)
        }
    }

    private var codePadding: CGFloat {
        switch kind {
        case .code, .raw:
            return HudLayout.textDocumentCodePadding
        case .markdown, .text:
            return HudSpacing.xl
        }
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
    var requestFocus: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = true
        scrollView.backgroundColor = HudAppKitColor.editorBackground
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.scrollerStyle = .overlay
        scrollView.autoresizingMask = [.width, .height]

        let textView = NSTextView()
        textView.delegate = context.coordinator
        textView.string = text
        textView.font = HudAppKitFont.editor
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
        textView.isHorizontallyResizable = true
        textView.autoresizingMask = [.width]
        textView.textContainerInset = NSSize(
            width: HudLayout.textDocumentCodePadding,
            height: HudLayout.textDocumentCodePadding
        )
        textView.textContainer?.widthTracksTextView = false
        textView.textContainer?.containerSize = NSSize(
            width: CGFloat.greatestFiniteMagnitude,
            height: CGFloat.greatestFiniteMagnitude
        )

        scrollView.documentView = textView
        configureLineNumbers(on: scrollView, textView: textView)

        context.coordinator.textView = textView
        context.coordinator.scrollView = scrollView
        context.coordinator.applyPresentation(kind: kind, language: language)
        context.coordinator.highlightIfNeeded(
            force: true,
            kind: kind,
            language: language
        )
        context.coordinator.syncFocus(requestFocus: requestFocus, isReadOnly: isReadOnly)
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = context.coordinator.textView else { return }

        let textChangedExternally = textView.string != text
        if textChangedExternally {
            let selectedRange = textView.selectedRange()
            textView.string = text
            textView.setSelectedRange(clamped(range: selectedRange, length: (text as NSString).length))
        }

        textView.isEditable = !isReadOnly
        textView.isSelectable = true
        textView.textColor = HudAppKitColor.editorInk
        textView.insertionPointColor = HudAppKitColor.editorCaret
        textView.backgroundColor = HudAppKitColor.editorBackground
        scrollView.backgroundColor = HudAppKitColor.editorBackground

        if showsLineNumbers {
            configureLineNumbers(on: scrollView, textView: textView)
        } else {
            scrollView.hasVerticalRuler = false
            scrollView.rulersVisible = false
            scrollView.verticalRulerView = nil
        }

        context.coordinator.applyPresentation(kind: kind, language: language)

        if textChangedExternally {
            context.coordinator.highlightIfNeeded(
                force: true,
                kind: kind,
                language: language
            )
        }

        context.coordinator.lineNumberRuler?.needsDisplay = true
        context.coordinator.syncFocus(requestFocus: requestFocus, isReadOnly: isReadOnly)
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
            ruler.updateThickness(for: textView.string)
            return
        }

        let ruler = HudLineNumberRulerView(textView: textView)
        scrollView.verticalRulerView = ruler
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding var text: String
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?
        private var isHighlighting = false
        private var highlightWorkItem: DispatchWorkItem?
        private var lastHighlightedSource = ""
        private var lastHighlightKind: HudTextDocumentKind = .text
        private var lastHighlightLanguage = ""

        var lineNumberRuler: HudLineNumberRulerView? {
            scrollView?.verticalRulerView as? HudLineNumberRulerView
        }

        init(text: Binding<String>) {
            self._text = text
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
            scheduleHighlight()
            lineNumberRuler?.updateThickness(for: textView.string)
            lineNumberRuler?.needsDisplay = true
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            lineNumberRuler?.needsDisplay = true
        }

        func syncFocus(requestFocus: Bool, isReadOnly: Bool) {
            guard requestFocus, !isReadOnly, let textView else { return }
            guard textView.window?.firstResponder !== textView else { return }

            DispatchQueue.main.async {
                guard textView.isEditable else { return }
                textView.window?.makeFirstResponder(textView)
            }
        }

        func applyPresentation(kind: HudTextDocumentKind, language: String?) {
            guard let textView else { return }
            currentKind = kind
            currentLanguage = language

            textView.typingAttributes = [
                .font: HudAppKitFont.editor,
                .foregroundColor: HudAppKitColor.editorInk,
            ]

            if kind == .code || kind == .raw {
                textView.textContainerInset = NSSize(
                    width: HudLayout.textDocumentCodePadding,
                    height: HudLayout.textDocumentCodePadding
                )
            } else {
                textView.textContainerInset = NSSize(width: HudSpacing.xxl, height: HudSpacing.xxl)
            }
        }

        func highlightIfNeeded(
            force: Bool,
            kind: HudTextDocumentKind?,
            language: String?
        ) {
            guard let textView else { return }
            let resolvedKind = kind ?? currentKind
            let resolvedLanguage = language ?? currentLanguage ?? ""
            let source = textView.string

            if !force,
               source == lastHighlightedSource,
               resolvedKind == lastHighlightKind,
               resolvedLanguage == lastHighlightLanguage {
                return
            }

            lastHighlightedSource = source
            lastHighlightKind = resolvedKind
            lastHighlightLanguage = resolvedLanguage
            highlight(kind: resolvedKind, language: resolvedLanguage.isEmpty ? nil : resolvedLanguage)
        }

        private func scheduleHighlight() {
            highlightWorkItem?.cancel()
            let item = DispatchWorkItem { [weak self] in
                self?.highlightIfNeeded(force: true, kind: nil, language: nil)
            }
            highlightWorkItem = item
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: item)
        }

        private func highlight(kind: HudTextDocumentKind, language: String?) {
            guard !isHighlighting, let textView, let storage = textView.textStorage else { return }

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
                HudCodeHighlighter.paintLines(
                    in: storage,
                    source: storage.string as NSString,
                    language: language
                )
            }

            storage.endEditing()
            textView.setSelectedRange(clamped(range: selectedRange, length: fullRange.length))
            textView.typingAttributes = baseAttributes
        }

        private var currentKind: HudTextDocumentKind = .text
        private var currentLanguage: String?

        private var baseAttributes: [NSAttributedString.Key: Any] {
            [
                .font: HudAppKitFont.editor,
                .foregroundColor: HudAppKitColor.editorInk,
            ]
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
        updateThickness(for: textView.string)
    }

    required init(coder: NSCoder) {
        super.init(coder: coder)
    }

    func updateThickness(for source: String) {
        let lineCount = max(1, source.split(separator: "\n", omittingEmptySubsequences: false).count)
        let digits = max(1, String(lineCount).count)
        let gutter = CGFloat(digits) * HudLayout.textDocumentCodeGutterDigitWidth
        ruleThickness = gutter + HudLayout.textDocumentCodeLineGap
        needsDisplay = true
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
            .kern: -0.2,
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
        let x = ruleThickness - HudLayout.textDocumentCodeLineGap - size.width
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
    static let lineNumber = NSColor(HudPalette.dim.opacity(0.72))
}

private enum HudAppKitFont {
    static let editor = NSFont.monospacedSystemFont(ofSize: HudTextSize.sm, weight: .regular)
    static let lineNumber = NSFont.monospacedSystemFont(ofSize: HudTextSize.micro, weight: .light)
}
#endif