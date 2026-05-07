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

    public init(colorScheme: ColorScheme) {
        self.colorScheme = colorScheme
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

        window.appearance = NSAppearance(
            named: colorScheme == .dark ? .darkAqua : .aqua
        )
        window.backgroundColor = colorScheme == .dark ? .black : .white
        window.titlebarAppearsTransparent = false
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
