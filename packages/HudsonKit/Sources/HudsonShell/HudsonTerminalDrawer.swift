import SwiftUI
import HudsonUI

/// Bottom-attached drawer with a slide-up content area.
///
/// Designed for the `bottomDrawer` slot of `HudsonAppShell`. The drawer always
/// shows a hairline header bar (~32pt) with a title, status dot, and a
/// chevron toggle; when `isOpen` is true the content slot expands to
/// `expandedHeight` (default 280pt) below the header.
///
/// The content slot is generic — apps decide what lives inside (a real terminal
/// view via TermBridgeKit, a fake mono shell, an inspector panel, etc.). The
/// drawer has no opinion on terminal semantics.
public struct HudsonTerminalDrawer<Content: View>: View {
    @Binding public var isOpen: Bool
    public let title: String
    public let subtitle: String?
    public let statusColor: Color
    public let expandedHeight: CGFloat
    public let content: () -> Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        isOpen: Binding<Bool>,
        title: String = "Terminal",
        subtitle: String? = nil,
        statusColor: Color = HudsonPalette.statusOk,
        expandedHeight: CGFloat = 280,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self._isOpen = isOpen
        self.title = title
        self.subtitle = subtitle
        self.statusColor = statusColor
        self.expandedHeight = expandedHeight
        self.content = content
    }

    public var body: some View {
        VStack(spacing: 0) {
            HudsonDivider(color: HudsonHairline.standard)
            header

            if isOpen {
                HudsonDivider(color: HudsonHairline.subtle)
                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .frame(height: expandedHeight)
                    .clipped()
            }
        }
        .background(HudsonPalette.chrome)
    }

    private var header: some View {
        Button(action: toggleOpen) {
            HStack(spacing: HudsonSpacing.lg) {
                HudsonStatusDot(color: statusColor, size: 6, pulses: isOpen)
                Text(title.uppercased())
                    .font(HudsonFont.mono(10, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(HudsonPalette.ink)

                if let subtitle {
                    Text("·")
                        .font(HudsonFont.mono(10))
                        .foregroundStyle(HudsonPalette.dim)
                    Text(subtitle)
                        .font(HudsonFont.mono(10))
                        .foregroundStyle(HudsonPalette.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: HudsonSpacing.md)

                Image(systemName: isOpen ? "chevron.down" : "chevron.up")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(HudsonPalette.muted)
            }
            .padding(.horizontal, HudsonSpacing.xxl)
            .frame(height: 32)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isOpen ? "Collapse \(title)" : "Expand \(title)")
    }

    private func toggleOpen() {
        HudsonInstrumentation.event("TerminalDrawer.toggle")
        if reduceMotion {
            isOpen.toggle()
        } else {
            withAnimation(HudsonMotion.drawerSpring) {
                isOpen.toggle()
            }
        }
    }
}
