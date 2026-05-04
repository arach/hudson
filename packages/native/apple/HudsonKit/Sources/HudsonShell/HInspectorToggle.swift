import SwiftUI
import HudsonUI

/// Small chrome control for showing or hiding a trailing inspector.
///
/// Keep this outside `HInspector` so apps can place the affordance in the
/// status bar, toolbar, or any other app-owned chrome region.
public struct HInspectorToggle: View {
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
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(isCollapsed ? HPalette.dim : HPalette.muted)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: HRadius.standard).fill(background))
                .overlay(RoundedRectangle(cornerRadius: HRadius.standard).stroke(border, lineWidth: isFocused ? HFocus.ringWidth : 1))
                .contentShape(RoundedRectangle(cornerRadius: HRadius.standard))
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
            withAnimation(HMotion.chromeResize) {
                isCollapsed.toggle()
            }
        }
    }

    private var background: Color {
        isHovering ? HSurface.hover : .clear
    }

    private var border: Color {
        if isFocused {
            return HFocus.ring
        }
        return isHovering ? HHairline.subtle : .clear
    }
}
