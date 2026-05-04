import SwiftUI
import HudsonUI

/// Small chrome control for showing or hiding a trailing inspector.
///
/// Keep this outside `HudInspector` so apps can place the affordance in the
/// status bar, toolbar, or any other app-owned chrome region.
public struct HudInspectorToggle: View {
    @Binding public var isCollapsed: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    public init(isCollapsed: Binding<Bool>) {
        self._isCollapsed = isCollapsed
    }

    public var body: some View {
        Button(action: toggle) {
            Image(systemName: "sidebar.right")
                .font(HudFont.ui(HudTextSize.base, weight: .medium))
                .foregroundStyle(isCollapsed ? HudPalette.dim : HudPalette.muted)
                .frame(width: HudIconSize.medium, height: HudIconSize.medium)
                .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(background))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(border, lineWidth: isFocused ? HudFocus.ringWidth : HudStrokeWidth.standard))
                .contentShape(RoundedRectangle(cornerRadius: HudRadius.standard))
        }
        .buttonStyle(.plain)
        .focusable(true)
        .focused($isFocused)
        .onHover { isHovering = $0 }
        .help(isCollapsed ? "Show Inspector" : "Hide Inspector")
        .accessibilityLabel(isCollapsed ? "Show Inspector" : "Hide Inspector")
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isHovering)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.10), value: isFocused)
    }

    private func toggle() {
        if reduceMotion {
            isCollapsed.toggle()
        } else {
            withAnimation(HudMotion.chromeResize) {
                isCollapsed.toggle()
            }
        }
    }

    private var background: Color {
        isHovering ? HudSurface.hover : .clear
    }

    private var border: Color {
        if isFocused {
            return HudFocus.ring
        }
        return isHovering ? HudHairline.subtle : .clear
    }
}
