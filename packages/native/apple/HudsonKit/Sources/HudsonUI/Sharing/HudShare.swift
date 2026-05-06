import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

#if canImport(AppKit)
import AppKit
#endif

public extension View {
    /// Present the system share UI. iOS uses `UIActivityViewController` in a
    /// sheet; macOS auto-anchors `NSSharingServicePicker` to the host view.
    /// Replaces hand-rolled `ShareSheet` UIViewControllerRepresentables and the
    /// "find keyWindow.contentView, show picker" boilerplate scattered across
    /// app code.
    ///
    /// ```swift
    /// .hudShare(isPresented: $isSharing, items: [.text(memo.transcription)])
    /// ```
    func hudShare(isPresented: Binding<Bool>, items: [HudShareItem]) -> some View {
        modifier(HudShareModifier(isPresented: isPresented, items: items))
    }
}

private struct HudShareModifier: ViewModifier {
    @Binding var isPresented: Bool
    let items: [HudShareItem]

    func body(content: Content) -> some View {
        #if os(iOS)
        content.sheet(isPresented: $isPresented) {
            HudShareSheetIOS(items: items.platformValues)
        }
        #elseif os(macOS)
        content.background(HudShareAnchorMac(isPresented: $isPresented, items: items.platformValues))
        #else
        content
        #endif
    }
}

#if os(iOS)
private struct HudShareSheetIOS: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif

#if os(macOS)
private struct HudShareAnchorMac: NSViewRepresentable {
    @Binding var isPresented: Bool
    let items: [Any]

    func makeNSView(context: Context) -> NSView { NSView() }

    func updateNSView(_ nsView: NSView, context: Context) {
        guard isPresented else { return }
        // Reset the binding before showing so the picker re-fires cleanly on
        // the next request.
        DispatchQueue.main.async { isPresented = false }
        let picker = NSSharingServicePicker(items: items)
        let anchor = nsView.window?.contentView ?? nsView
        picker.show(relativeTo: .zero, of: anchor, preferredEdge: .minY)
    }
}
#endif
