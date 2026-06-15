import SwiftUI

#if os(macOS)
import AppKit

/// Applies Hudson's app-level color scheme to the hosting `NSWindow`.
///
/// SwiftUI content chrome can follow `HudTheme` on its own, but the native
/// title bar belongs to AppKit. This bridge keeps the window frame in the same
/// light/dark family as the Hudson surface hosted inside it.
public struct HudWindowChrome: NSViewRepresentable {
    public var colorScheme: ColorScheme
    public var titleVisibility: NSWindow.TitleVisibility
    public var titlebarAppearsTransparent: Bool
    public var usesFullSizeContentView: Bool
    public var isMovableByWindowBackground: Bool
    public var hidesToolbar: Bool

    public init(
        colorScheme: ColorScheme,
        titleVisibility: NSWindow.TitleVisibility = .hidden,
        titlebarAppearsTransparent: Bool = true,
        usesFullSizeContentView: Bool = true,
        isMovableByWindowBackground: Bool = true,
        hidesToolbar: Bool = true
    ) {
        self.colorScheme = colorScheme
        self.titleVisibility = titleVisibility
        self.titlebarAppearsTransparent = titlebarAppearsTransparent
        self.usesFullSizeContentView = usesFullSizeContentView
        self.isMovableByWindowBackground = isMovableByWindowBackground
        self.hidesToolbar = hidesToolbar
    }

    public func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        DispatchQueue.main.async {
            apply(to: view.window)
        }
        return view
    }

    public func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async {
            apply(to: view.window)
        }
    }

    private func apply(to window: NSWindow?) {
        guard let window else { return }

        // Guard EVERY assignment. This runs on every SwiftUI updateNSView; in a
        // continuously-updating window, re-setting window.appearance/styleMask
        // each time invalidates SwiftUI's internal window-appearance model and
        // re-triggers a window relayout — a self-perpetuating re-render loop that
        // pegs idle CPU. Only touch the window when a value actually changed.
        let darkAqua = NSAppearance(named: .darkAqua)
        if window.appearance?.name != darkAqua?.name { window.appearance = darkAqua }
        if window.backgroundColor != .black { window.backgroundColor = .black }
        if window.titlebarAppearsTransparent != titlebarAppearsTransparent {
            window.titlebarAppearsTransparent = titlebarAppearsTransparent
        }
        if window.styleMask.contains(.fullSizeContentView) != usesFullSizeContentView {
            if usesFullSizeContentView {
                window.styleMask.insert(.fullSizeContentView)
            } else {
                window.styleMask.remove(.fullSizeContentView)
            }
        }
        if window.titleVisibility != titleVisibility { window.titleVisibility = titleVisibility }
        if window.titlebarSeparatorStyle != .none { window.titlebarSeparatorStyle = .none }
        if window.isMovableByWindowBackground != isMovableByWindowBackground {
            window.isMovableByWindowBackground = isMovableByWindowBackground
        }
        if !window.isOpaque { window.isOpaque = true }
        if hidesToolbar, let toolbar = window.toolbar, toolbar.isVisible {
            toolbar.isVisible = false
        }
    }
}

#else

public struct HudWindowChrome: View {
    public init(colorScheme: ColorScheme) {}
    public var body: some View {
        EmptyView()
    }
}

#endif
