#if os(macOS)
import AppKit
import SwiftUI

/// Non-activating floating panel used for menu-bar HUDs and command overlays.
///
/// The panel can follow the operator across Spaces, preserve focus in the
/// frontmost app, and still become key when a hosted text field needs input.
@MainActor
public final class HudOverlayPanel: NSPanel {
    public var activatesOnMouseDown = false
    public var onKeyDown: ((NSEvent) -> Void)?
    public var onFlagsChanged: ((NSEvent) -> Void)?

    public override var canBecomeKey: Bool { true }
    public override var canBecomeMain: Bool { true }

    public override func sendEvent(_ event: NSEvent) {
        if activatesOnMouseDown,
           event.type == .leftMouseDown || event.type == .rightMouseDown {
            if !NSApp.isActive {
                NSApp.activate(ignoringOtherApps: true)
            }
            if !isKeyWindow {
                makeKey()
            }
        }
        super.sendEvent(event)
    }

    public override func keyDown(with event: NSEvent) {
        let isEscape = event.keyCode == 53
        let hasCommand = event.modifierFlags.contains(.command)
        if firstResponderIsTextEditing && !isEscape && !hasCommand {
            super.keyDown(with: event)
            return
        }
        if let onKeyDown {
            onKeyDown(event)
        } else {
            super.keyDown(with: event)
        }
    }

    public override func flagsChanged(with event: NSEvent) {
        if let onFlagsChanged {
            onFlagsChanged(event)
        } else {
            super.flagsChanged(with: event)
        }
    }

    private var firstResponderIsTextEditing: Bool {
        if let responder = firstResponder as? NSText, responder.isEditable {
            return true
        }
        if firstResponder is NSTextView {
            return true
        }
        return false
    }
}

private final class HudOverlayHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override var focusRingType: NSFocusRingType { get { .none } set {} }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        applyBackingScale()
    }

    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        applyBackingScale()
    }

    private func applyBackingScale() {
        let scale = window?.backingScaleFactor
            ?? NSScreen.main?.backingScaleFactor
            ?? 2.0
        wantsLayer = true
        apply(scale: scale, to: layer)
    }

    private func apply(scale: CGFloat, to layer: CALayer?) {
        guard let layer else { return }
        layer.contentsScale = scale
        layer.rasterizationScale = scale
        layer.sublayers?.forEach { apply(scale: scale, to: $0) }
    }
}

@MainActor
public enum HudOverlayPanelShell {
    public enum Placement: Sendable {
        case centered(yOffsetRatio: CGFloat = 0)
        case mouseScreenCentered(yOffsetRatio: CGFloat = 0)
        case topCenter(margin: CGFloat = 40)
    }

    public struct Configuration {
        public var size: NSSize
        public var styleMask: NSWindow.StyleMask
        public var title: String
        public var level: NSWindow.Level
        public var hasShadow: Bool
        public var hidesOnDeactivate: Bool
        public var isReleasedWhenClosed: Bool
        public var isMovableByWindowBackground: Bool
        public var collectionBehavior: NSWindow.CollectionBehavior
        public var activatesOnMouseDown: Bool
        public var onKeyDown: ((NSEvent) -> Void)?
        public var onFlagsChanged: ((NSEvent) -> Void)?
        public var appearance: NSAppearance?
        public var resizable: Bool
        public var minContentSize: NSSize?
        public var maxContentSize: NSSize?

        public init(
            size: NSSize,
            styleMask: NSWindow.StyleMask = [.borderless, .nonactivatingPanel],
            title: String = "",
            level: NSWindow.Level = .floating,
            hasShadow: Bool = true,
            hidesOnDeactivate: Bool = false,
            isReleasedWhenClosed: Bool = false,
            isMovableByWindowBackground: Bool = false,
            collectionBehavior: NSWindow.CollectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary],
            activatesOnMouseDown: Bool = false,
            onKeyDown: ((NSEvent) -> Void)? = nil,
            onFlagsChanged: ((NSEvent) -> Void)? = nil,
            appearance: NSAppearance? = NSAppearance(named: .darkAqua),
            resizable: Bool = false,
            minContentSize: NSSize? = nil,
            maxContentSize: NSSize? = nil
        ) {
            self.size = size
            self.styleMask = styleMask
            self.title = title
            self.level = level
            self.hasShadow = hasShadow
            self.hidesOnDeactivate = hidesOnDeactivate
            self.isReleasedWhenClosed = isReleasedWhenClosed
            self.isMovableByWindowBackground = isMovableByWindowBackground
            self.collectionBehavior = collectionBehavior
            self.activatesOnMouseDown = activatesOnMouseDown
            self.onKeyDown = onKeyDown
            self.onFlagsChanged = onFlagsChanged
            self.appearance = appearance
            self.resizable = resizable
            self.minContentSize = minContentSize
            self.maxContentSize = maxContentSize
        }
    }

    public static func makePanel<Content: View>(
        configuration: Configuration,
        rootView: Content
    ) -> HudOverlayPanel {
        let hosting = HudOverlayHostingView(rootView: rootView)
        hosting.translatesAutoresizingMaskIntoConstraints = false

        var styleMask = configuration.styleMask
        if configuration.resizable {
            styleMask.insert(.resizable)
        }

        let panel = HudOverlayPanel(
            contentRect: NSRect(origin: .zero, size: configuration.size),
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )
        if let minSize = configuration.minContentSize {
            panel.contentMinSize = minSize
        }
        if let maxSize = configuration.maxContentSize {
            panel.contentMaxSize = maxSize
        }
        panel.title = configuration.title
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.level = configuration.level
        panel.sharingType = .readOnly
        panel.hasShadow = configuration.hasShadow
        panel.hidesOnDeactivate = configuration.hidesOnDeactivate
        panel.isReleasedWhenClosed = configuration.isReleasedWhenClosed
        panel.isMovableByWindowBackground = configuration.isMovableByWindowBackground
        panel.collectionBehavior = configuration.collectionBehavior
        panel.activatesOnMouseDown = configuration.activatesOnMouseDown
        panel.onKeyDown = configuration.onKeyDown
        panel.onFlagsChanged = configuration.onFlagsChanged
        if let appearance = configuration.appearance {
            panel.appearance = appearance
        }
        panel.contentView = hosting
        return panel
    }

    public static func position(_ window: NSWindow, placement: Placement) {
        let screen: NSScreen
        switch placement {
        case .mouseScreenCentered, .topCenter:
            screen = mouseScreen()
        case .centered:
            screen = NSScreen.main ?? mouseScreen()
        }

        let visibleFrame = screen.visibleFrame
        let size = window.frame.size
        let origin: NSPoint

        switch placement {
        case .centered(let yOffsetRatio), .mouseScreenCentered(let yOffsetRatio):
            origin = NSPoint(
                x: visibleFrame.midX - size.width / 2,
                y: visibleFrame.midY - size.height / 2 + visibleFrame.height * yOffsetRatio
            )
        case .topCenter(let margin):
            origin = NSPoint(
                x: visibleFrame.midX - size.width / 2,
                y: visibleFrame.maxY - size.height - margin
            )
        }

        window.setFrameOrigin(origin)
    }

    public static func present(
        _ panel: NSPanel,
        activate: Bool = false,
        makeKey: Bool = true,
        orderFrontRegardless: Bool = true
    ) {
        if orderFrontRegardless {
            panel.orderFrontRegardless()
        } else if makeKey {
            panel.makeKeyAndOrderFront(nil)
        } else {
            panel.orderFront(nil)
        }

        if makeKey {
            panel.makeKey()
        }

        if activate {
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    public static func fadeIn(_ panel: NSPanel, duration: TimeInterval = 0.12) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = duration
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            panel.animator().alphaValue = 1.0
        }
    }

    public static func fadeOut(
        _ panel: NSPanel,
        duration: TimeInterval = 0.14,
        completion: @escaping @MainActor () -> Void
    ) {
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = duration
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            panel.animator().alphaValue = 0
        }) {
            Task { @MainActor in completion() }
        }
    }

    public static func animateFrame(
        _ panel: NSPanel,
        to frame: NSRect,
        duration: TimeInterval = 0.22
    ) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = duration
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            context.allowsImplicitAnimation = true
            panel.animator().setFrame(frame, display: true)
        }
    }

    private static func mouseScreen() -> NSScreen {
        let mouseLocation = NSEvent.mouseLocation
        return NSScreen.screens.first(where: { $0.frame.contains(mouseLocation) })
            ?? NSScreen.main
            ?? NSScreen.screens.first!
    }
}
#endif
