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

    var body: some View {
        #if os(macOS)
        if backend != .swiftUI {
            HudMacTextDocumentEditor(
                text: $text,
                kind: kind,
                language: language,
                isReadOnly: isReadOnly,
                showsLineNumbers: showsLineNumbers
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
            .font(editorFont)
            .foregroundStyle(HudPalette.ink)
            .tint(HudPalette.statusInfo)
            .padding(HudSpacing.xl)
            .scrollContentBackground(.hidden)
            .background(HudSurface.base)
            .disabled(isReadOnly)
    }

    private var editorFont: Font {
        HudFont.mono(HudTextSize.sm)
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
        scrollView.autohidesScrollers = false
        scrollView.scrollerStyle = .overlay

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
        textView.textContainerInset = NSSize(width: HudSpacing.xl, height: HudSpacing.xl)
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

        if showsLineNumbers {
            configureLineNumbers(on: scrollView, textView: textView)
        } else {
            scrollView.hasVerticalRuler = false
            scrollView.rulersVisible = false
            scrollView.verticalRulerView = nil
        }

        context.coordinator.applyPresentation(kind: kind, language: language)
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

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding var text: String
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?

        var lineNumberRuler: HudLineNumberRulerView? {
            scrollView?.verticalRulerView as? HudLineNumberRulerView
        }

        init(text: Binding<String>) {
            self._text = text
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
            lineNumberRuler?.needsDisplay = true
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            lineNumberRuler?.needsDisplay = true
        }

        func applyPresentation(kind: HudTextDocumentKind, language: String?) {
            guard let textView else { return }
            textView.typingAttributes = [
                .font: HudAppKitFont.editor,
                .foregroundColor: HudAppKitColor.editorInk,
            ]

            if kind == .code || kind == .raw {
                textView.textContainerInset = NSSize(width: HudSpacing.xl, height: HudSpacing.xl)
            } else {
                textView.textContainerInset = NSSize(width: HudSpacing.xxl, height: HudSpacing.xxl)
            }
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
}

private enum HudAppKitFont {
    static let editor = NSFont.monospacedSystemFont(ofSize: HudTextSize.sm, weight: .regular)
    static let lineNumber = NSFont.monospacedSystemFont(ofSize: HudTextSize.xxs, weight: .regular)
}
#endif
