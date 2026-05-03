import SwiftUI
import HudsonUI
import HudsonObservability

/// Bottom-attached drawer with a slide-up content area.
///
/// Designed for the `bottomDrawer` slot of `HAppShell`. The drawer always
/// shows a hairline header bar (~32pt) with a title, status dot, and a
/// chevron toggle; when `isOpen` is true the content slot expands to
/// `expandedHeight` (default 280pt) below the header.
///
/// The content slot is generic — apps decide what lives inside (a real terminal
/// view via TermBridgeKit, a fake mono shell, an inspector panel, etc.). The
/// drawer has no opinion on terminal semantics.
public struct HTerminalDrawer<Content: View>: View {
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
        statusColor: Color = HPalette.statusOk,
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
            HDivider(color: HHairline.standard)
            header

            if isOpen {
                HDivider(color: HHairline.subtle)
                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .frame(height: expandedHeight)
                    .clipped()
            }
        }
        .background(HPalette.chrome)
    }

    private var header: some View {
        Button(action: toggleOpen) {
            HStack(spacing: HSpacing.lg) {
                HStatusDot(color: statusColor, size: 6, pulses: isOpen)
                Text(title.uppercased())
                    .font(HFont.mono(10, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(HPalette.ink)

                if let subtitle {
                    Text("·")
                        .font(HFont.mono(10))
                        .foregroundStyle(HPalette.dim)
                    Text(subtitle)
                        .font(HFont.mono(10))
                        .foregroundStyle(HPalette.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: HSpacing.md)

                Image(systemName: isOpen ? "chevron.down" : "chevron.up")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(HPalette.muted)
            }
            .padding(.horizontal, HSpacing.xxl)
            .frame(height: 32)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isOpen ? "Collapse \(title)" : "Expand \(title)")
    }

    private func toggleOpen() {
        let metadata = [
            "expandedHeight": "\(Int(expandedHeight.rounded()))",
            "fromOpen": hudsonBool(isOpen),
            "toOpen": hudsonBool(!isOpen),
        ]

        HInstrumentation.ui.event("TerminalDrawer.toggle", metadata: metadata)
        HInstrumentation.ui.span("TerminalDrawer.toggle.apply", metadata: metadata) {
            if reduceMotion {
                isOpen.toggle()
            } else {
                withAnimation(HMotion.drawerSpring) {
                    isOpen.toggle()
                }
            }
        }
    }
}

private func hudsonBool(_ value: Bool) -> String {
    value ? "true" : "false"
}
