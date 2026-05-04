import SwiftUI

#if os(macOS)
import AppKit

// MARK: - HVisualEffectView (macOS)
//
// Bridges `NSVisualEffectView` into SwiftUI so chrome surfaces can use real
// AppKit materials (true behind-window translucency, desktop wallpaper bleed,
// proper inactive dimming) rather than SwiftUI's cross-platform Material
// approximations.
//
// `.sidebar` material with `.behindWindow` blending matches stock macOS
// sidebar chrome (Finder, Mail). Use `.followsWindowActiveState` so the
// surface dims when the window is inactive — same as system apps.

public struct HVisualEffectView: NSViewRepresentable {
    public let material: NSVisualEffectView.Material
    public let blendingMode: NSVisualEffectView.BlendingMode
    public let state: NSVisualEffectView.State
    public let isEmphasized: Bool

    public init(
        material: NSVisualEffectView.Material = .sidebar,
        blendingMode: NSVisualEffectView.BlendingMode = .behindWindow,
        state: NSVisualEffectView.State = .followsWindowActiveState,
        isEmphasized: Bool = false
    ) {
        self.material = material
        self.blendingMode = blendingMode
        self.state = state
        self.isEmphasized = isEmphasized
    }

    public func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = state
        view.isEmphasized = isEmphasized
        view.autoresizingMask = [.width, .height]
        return view
    }

    public func updateNSView(_ view: NSVisualEffectView, context: Context) {
        view.material = material
        view.blendingMode = blendingMode
        view.state = state
        view.isEmphasized = isEmphasized
    }
}

#else

// MARK: - HVisualEffectView (iOS fallback)
//
// iOS has no NSVisualEffectView. Fall back to SwiftUI's `.ultraThinMaterial`
// rendered via Rectangle so the API surface stays consistent.

public struct HVisualEffectView: View {
    public init() {}
    public var body: some View {
        Rectangle().fill(.ultraThinMaterial)
    }
}

#endif
