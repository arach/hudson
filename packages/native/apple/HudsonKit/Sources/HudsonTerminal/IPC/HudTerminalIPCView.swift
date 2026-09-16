#if os(macOS)
import AppKit
import Metal
import QuartzCore

@MainActor public final class HudTerminalIPCView: NSView, @preconcurrency NSTextInputClient {
    let metalLayer = CAMetalLayer()
    private weak var session: HudTerminalIPCSession?
    private var observers: [NSObjectProtocol] = []
    private var marked = NSAttributedString(string: "")
    private var currentKey: NSEvent?
    private var insertedDuringKey = false
    init(session: HudTerminalIPCSession) {
        self.session = session
        super.init(frame: .zero)
        metalLayer.device = MTLCreateSystemDefaultDevice(); metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true; metalLayer.maximumDrawableCount = 3
        metalLayer.allowsNextDrawableTimeout = true; metalLayer.isOpaque = true
        layer = metalLayer; wantsLayer = true
        setAccessibilityElement(true); setAccessibilityRole(.textArea); setAccessibilityLabel("Terminal")
    }
    required init?(coder: NSCoder) { fatalError("Use a terminal session") }
    public override var acceptsFirstResponder: Bool { true }
    public override var isOpaque: Bool { true }
    public override func layout() {
        super.layout()
        let scale = window?.backingScaleFactor ?? 1
        metalLayer.contentsScale = scale
        metalLayer.drawableSize = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
        session?.geometryChanged()
    }
    public override func viewDidChangeBackingProperties() { super.viewDidChangeBackingProperties(); needsLayout = true }
    public override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        for observer in observers { NotificationCenter.default.removeObserver(observer) }; observers.removeAll()
        if let window {
            for name in [NSWindow.didChangeOcclusionStateNotification, NSWindow.didBecomeKeyNotification, NSWindow.didResignKeyNotification, NSWindow.didMiniaturizeNotification, NSWindow.didDeminiaturizeNotification] {
                observers.append(NotificationCenter.default.addObserver(forName: name, object: window, queue: .main) { [weak self] _ in
                    MainActor.assumeIsolated { self?.session?.geometryChanged() }
                })
            }
        }
        needsLayout = true; session?.geometryChanged()
    }
    public override func viewDidHide() { super.viewDidHide(); session?.geometryChanged() }
    public override func viewDidUnhide() { super.viewDidUnhide(); session?.geometryChanged() }
    public override func becomeFirstResponder() -> Bool {
        DispatchQueue.main.async { [weak self] in self?.session?.geometryChanged() }
        return true
    }
    public override func resignFirstResponder() -> Bool { unmarkText(); DispatchQueue.main.async { [weak self] in self?.session?.geometryChanged() }; return true }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
    private func modifiers(_ event: NSEvent) -> UInt32 {
        var value: UInt32 = 0
        if event.modifierFlags.contains(.shift) { value |= 1 }
        if event.modifierFlags.contains(.control) { value |= 2 }
        if event.modifierFlags.contains(.option) { value |= 4 }
        if event.modifierFlags.contains(.command) { value |= 8 }
        if event.modifierFlags.contains(.capsLock) { value |= 16 }
        return value
    }
    private func key(_ event: NSEvent, text: String? = nil) {
        var input = HudTerminalInputEvent(kind: "key")
        input.action = event.type == .keyUp ? 1 : (event.isARepeat ? 2 : 0)
        input.keycode = UInt32(event.keyCode); input.modifiers = modifiers(event)
        input.codepoint = event.characters(byApplyingModifiers: [])?.unicodeScalars.first?.value ?? 0
        var chars = text ?? event.characters ?? ""
        if chars.unicodeScalars.count == 1, let scalar = chars.unicodeScalars.first {
            if scalar.value >= 0xF700 && scalar.value <= 0xF8FF { chars = "" }
            else if scalar.value < 0x20 { chars = event.characters(byApplyingModifiers: event.modifierFlags.subtracting(.control)) ?? "" }
        }
        input.text = chars; session?.sendEvent(input)
    }
    public override func keyDown(with event: NSEvent) {
        currentKey = event; insertedDuringKey = false
        if event.modifierFlags.contains(.control) || event.modifierFlags.contains(.command) { key(event) }
        else { interpretKeyEvents([event]); if !insertedDuringKey && !hasMarkedText() { key(event) } }
        currentKey = nil
    }
    public override func keyUp(with event: NSEvent) { key(event, text: "") }
    public override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard window?.firstResponder === self, event.modifierFlags.contains(.command) else { return false }
        switch event.charactersIgnoringModifiers?.lowercased() {
        case "c": session?.copySelection(); return true
        case "v": paste(nil); return true
        case "a": var input = HudTerminalInputEvent(kind: "binding"); input.text = "select_all"; session?.sendEvent(input); return true
        default: return false
        }
    }
    @objc public func copy(_ sender: Any?) { session?.copySelection() }
    @objc public func paste(_ sender: Any?) {
        guard let text = NSPasteboard.general.string(forType: .string) else { return }
        // Paste is explicit user input; helper enables bracketed-paste encoding.
        var input = HudTerminalInputEvent(kind: "paste"); input.text = text; session?.sendEvent(input)
    }
    public func insertText(_ string: Any, replacementRange: NSRange) {
        let text = (string as? NSAttributedString)?.string ?? (string as? String ?? "")
        let composing = hasMarkedText(); unmarkText(); insertedDuringKey = true
        if let event = currentKey, !composing { key(event, text: text) }
        else { session?.send(Data(text.utf8)) }
    }
    public func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
        marked = (string as? NSAttributedString) ?? NSAttributedString(string: string as? String ?? "")
        var input = HudTerminalInputEvent(kind: "preedit"); input.text = marked.string; session?.sendEvent(input)
        insertedDuringKey = true
    }
    public func unmarkText() {
        guard marked.length > 0 else { return }; marked = NSAttributedString(string: "")
        session?.sendEvent(HudTerminalInputEvent(kind: "preedit"))
    }
    public func selectedRange() -> NSRange { NSRange(location: NSNotFound, length: 0) }
    public func markedRange() -> NSRange { NSRange(location: marked.length == 0 ? NSNotFound : 0, length: marked.length) }
    public func hasMarkedText() -> Bool { marked.length > 0 }
    public func validAttributesForMarkedText() -> [NSAttributedString.Key] { [] }
    public func attributedSubstring(forProposedRange range: NSRange, actualRange: NSRangePointer?) -> NSAttributedString? { nil }
    public func characterIndex(for point: NSPoint) -> Int { NSNotFound }
    public func firstRect(forCharacterRange range: NSRange, actualRange: NSRangePointer?) -> NSRect {
        window?.convertToScreen(convert(NSRect(x: 0, y: 0, width: 1, height: 20), to: nil)) ?? .zero
    }
    public override func doCommand(by selector: Selector) {
        if let event = currentKey, !insertedDuringKey { key(event); insertedDuringKey = true }
    }
    private func mouse(_ event: NSEvent, action: Int) {
        let point = convert(event.locationInWindow, from: nil)
        var input = HudTerminalInputEvent(kind: "mouse")
        input.x = point.x; input.y = bounds.height - point.y; input.modifiers = modifiers(event)
        input.button = event.buttonNumber; input.action = action; session?.sendEvent(input)
    }
    public override func mouseDown(with event: NSEvent) { window?.makeFirstResponder(self); mouse(event, action: 0) }
    public override func mouseUp(with event: NSEvent) { mouse(event, action: 1) }
    public override func mouseDragged(with event: NSEvent) { mouse(event, action: 2) }
    public override func rightMouseDown(with event: NSEvent) { mouse(event, action: 0) }
    public override func rightMouseUp(with event: NSEvent) { mouse(event, action: 1) }
    public override func rightMouseDragged(with event: NSEvent) { mouse(event, action: 2) }
    public override func otherMouseDown(with event: NSEvent) { mouse(event, action: 0) }
    public override func otherMouseUp(with event: NSEvent) { mouse(event, action: 1) }
    public override func otherMouseDragged(with event: NSEvent) { mouse(event, action: 2) }
    public override func scrollWheel(with event: NSEvent) {
        var input = HudTerminalInputEvent(kind: "scroll")
        input.x = event.scrollingDeltaX * (event.hasPreciseScrollingDeltas ? 2 : 1)
        input.y = event.scrollingDeltaY * (event.hasPreciseScrollingDeltas ? 2 : 1)
        var momentum = 0
        switch event.momentumPhase { case .began: momentum = 1; case .stationary: momentum = 2; case .changed: momentum = 3; case .ended: momentum = 4; case .cancelled: momentum = 5; case .mayBegin: momentum = 6; default: break }
        input.modifiers = UInt32((event.hasPreciseScrollingDeltas ? 1 : 0) | momentum << 1)
        session?.sendEvent(input)
    }
}
#endif
