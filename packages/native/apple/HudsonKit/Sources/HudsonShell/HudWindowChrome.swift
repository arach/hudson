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
    /// Optional explicit window background. When set, it overrides the default
    /// system light/dark window color so the transparent title bar reads in the
    /// host's theme (e.g. a warm paper) instead of stark `windowBackgroundColor`.
    public var backgroundColor: NSColor?

    public init(
        colorScheme: ColorScheme,
        titleVisibility: NSWindow.TitleVisibility = .hidden,
        titlebarAppearsTransparent: Bool = true,
        usesFullSizeContentView: Bool = true,
        isMovableByWindowBackground: Bool = true,
        hidesToolbar: Bool = true,
        backgroundColor: NSColor? = nil
    ) {
        self.colorScheme = colorScheme
        self.titleVisibility = titleVisibility
        self.titlebarAppearsTransparent = titlebarAppearsTransparent
        self.usesFullSizeContentView = usesFullSizeContentView
        self.isMovableByWindowBackground = isMovableByWindowBackground
        self.hidesToolbar = hidesToolbar
        self.backgroundColor = backgroundColor
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

        switch colorScheme {
        case .light:
            window.appearance = NSAppearance(named: .aqua)
            window.backgroundColor = backgroundColor ?? .windowBackgroundColor
        case .dark:
            window.appearance = NSAppearance(named: .darkAqua)
            window.backgroundColor = backgroundColor ?? .black
        @unknown default:
            window.appearance = nil
            window.backgroundColor = backgroundColor ?? .windowBackgroundColor
        }
        window.titlebarAppearsTransparent = titlebarAppearsTransparent
        if usesFullSizeContentView {
            window.styleMask.insert(.fullSizeContentView)
        } else {
            window.styleMask.remove(.fullSizeContentView)
        }
        window.titleVisibility = titleVisibility
        window.titlebarSeparatorStyle = .none
        window.isMovableByWindowBackground = isMovableByWindowBackground
        window.isOpaque = true
        if hidesToolbar {
            window.toolbar?.isVisible = false
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
