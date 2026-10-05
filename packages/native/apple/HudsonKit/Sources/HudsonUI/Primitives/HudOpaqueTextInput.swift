#if os(macOS)
import AppKit
import SwiftUI

// A multi-line text input that paints its own solid ground.
//
// AppKit only applies full font smoothing to text drawn into an opaque layer.
// SwiftUI's `TextField` draws its glyphs on a transparent layer, so at 1x they
// come out thinner and softer than the same face in an opaque `NSTextView`,
// even when the pixels behind are solid. This input is an `NSTextView` with
// `drawsBackground` on, so typed text rasterizes exactly like
// `HudSelectableText` beside it.

public struct HudOpaqueTextInput: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var font: NSFont
    /// Placeholder face. Defaults to `font` at Medium: the placeholder is
    /// grey, and a one-pixel grey stem never reaches a solid core at 1x.
    var placeholderFont: NSFont?
    var ink: NSColor
    var placeholderInk: NSColor
    /// The solid colour under the text. Match the surface the input sits on.
    var ground: NSColor
    var lineLimit: ClosedRange<Int>
    var focus: FocusState<Bool>.Binding?
    /// Return without Shift or Option. Return `true` to consume the key.
    var onReturn: () -> Bool
    var onCommandReturn: () -> Bool
    var onEscape: () -> Bool

    public init(
        text: Binding<String>,
        placeholder: String = "",
        font: NSFont,
        placeholderFont: NSFont? = nil,
        ink: NSColor,
        placeholderInk: NSColor,
        ground: NSColor,
        lineLimit: ClosedRange<Int> = 1...8,
        focus: FocusState<Bool>.Binding? = nil,
        onReturn: @escaping () -> Bool = { false },
        onCommandReturn: @escaping () -> Bool = { false },
        onEscape: @escaping () -> Bool = { false }
    ) {
        self._text = text
        self.placeholder = placeholder
        self.font = font
        self.placeholderFont = placeholderFont
        self.ink = ink
        self.placeholderInk = placeholderInk
        self.ground = ground
        self.lineLimit = lineLimit
        self.focus = focus
        self.onReturn = onReturn
        self.onCommandReturn = onCommandReturn
        self.onEscape = onEscape
    }

    public func makeCoordinator() -> Coordinator { Coordinator(self) }

    public func makeNSView(context: Context) -> NSScrollView {
        let textView = HudOpaqueTextView(usingTextLayoutManager: false)
        textView.delegate = context.coordinator
        textView.coordinator = context.coordinator
        textView.isRichText = false
        textView.allowsUndo = true
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.textContainerInset = .zero
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.minSize = .zero
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        textView.string = text

        let scroll = NSScrollView()
        scroll.documentView = textView
        scroll.hasVerticalScroller = false
        scroll.hasHorizontalScroller = false
        scroll.drawsBackground = true
        scroll.borderType = .noBorder
        apply(to: textView, scroll: scroll)
        return scroll
    }

    public func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = scroll.documentView as? HudOpaqueTextView else { return }
        apply(to: textView, scroll: scroll)
        if textView.string != text {
            textView.string = text
            textView.needsDisplay = true
        }
        if let focus, focus.wrappedValue, let window = textView.window, window.firstResponder !== textView {
            DispatchQueue.main.async { window.makeFirstResponder(textView) }
        }
    }

    private func apply(to textView: HudOpaqueTextView, scroll: NSScrollView) {
        textView.font = font
        textView.textColor = ink
        textView.insertionPointColor = ink
        textView.drawsBackground = true
        textView.backgroundColor = ground
        textView.smoothsFonts = !ground.hudIsDark
        scroll.backgroundColor = ground
        textView.typingAttributes = [.font: font, .foregroundColor: ink]
        textView.selectedTextAttributes = [.backgroundColor: ground.blended(withFraction: 0.2, of: .white) ?? ground]
        textView.placeholder = placeholder
        textView.placeholderFont = placeholderFont
            ?? font.withWeight(.medium)
        textView.placeholderInk = placeholderInk
    }

    public func sizeThatFits(_ proposal: ProposedViewSize, nsView scroll: NSScrollView, context: Context) -> CGSize? {
        guard let textView = scroll.documentView as? NSTextView,
              let container = textView.textContainer,
              let layout = textView.layoutManager else { return nil }
        let proposed = proposal.width ?? 10_000
        let width = proposed.isFinite ? max(proposed, 1) : 10_000
        container.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        layout.ensureLayout(for: container)
        let line = ceil(layout.defaultLineHeight(for: font))
        let used = ceil(layout.usedRect(for: container).height)
        let lines = CGFloat(lineLimit.lowerBound)...CGFloat(lineLimit.upperBound)
        let height = min(max(used, line * lines.lowerBound), line * lines.upperBound)
        return CGSize(width: width, height: height)
    }

    public final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: HudOpaqueTextInput

        init(_ parent: HudOpaqueTextInput) {
            self.parent = parent
        }

        public func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
            textView.needsDisplay = true
        }

        public func textView(_ textView: NSTextView, doCommandBy selector: Selector) -> Bool {
            switch selector {
            case #selector(NSResponder.insertNewline(_:)):
                let flags = NSApp.currentEvent?.modifierFlags ?? []
                if flags.contains(.command) { return parent.onCommandReturn() }
                if flags.contains(.shift) || flags.contains(.option) { return false }
                return parent.onReturn()
            case #selector(NSResponder.cancelOperation(_:)):
                return parent.onEscape()
            default:
                return false
            }
        }

        func focusChanged(_ focused: Bool) {
            guard let focus = parent.focus, focus.wrappedValue != focused else { return }
            DispatchQueue.main.async { focus.wrappedValue = focused }
        }
    }
}

/// Draws the placeholder in the view's own pass (so it rasterizes like the
/// text) and reports focus to the coordinator.
final class HudOpaqueTextView: HudSmoothingTextView {
    weak var coordinator: HudOpaqueTextInput.Coordinator?
    var placeholder = ""
    var placeholderFont: NSFont?
    var placeholderInk = NSColor.placeholderTextColor

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard string.isEmpty, !placeholder.isEmpty else { return }
        let context = NSGraphicsContext.current?.cgContext
        context?.saveGState()
        context?.setShouldSmoothFonts(smoothsFonts)
        defer { context?.restoreGState() }
        let attributes: [NSAttributedString.Key: Any] = [
            .font: placeholderFont ?? font ?? .systemFont(ofSize: NSFont.systemFontSize),
            .foregroundColor: placeholderInk,
        ]
        NSAttributedString(string: placeholder, attributes: attributes)
            .draw(at: NSPoint(x: textContainerInset.width, y: textContainerInset.height))
    }

    override func becomeFirstResponder() -> Bool {
        let accepted = super.becomeFirstResponder()
        if accepted { coordinator?.focusChanged(true) }
        return accepted
    }

    override func resignFirstResponder() -> Bool {
        let accepted = super.resignFirstResponder()
        if accepted { coordinator?.focusChanged(false) }
        return accepted
    }
}

private extension NSFont {
    /// The same family and size at `weight`.
    func withWeight(_ weight: NSFont.Weight) -> NSFont {
        let traits = [NSFontDescriptor.TraitKey.weight: weight]
        let descriptor = fontDescriptor.addingAttributes([.traits: traits])
        return NSFont(descriptor: descriptor, size: pointSize) ?? self
    }
}
#endif
