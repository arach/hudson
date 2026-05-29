import SwiftUI
import HudsonUI

/// Resizable sidebar/inspector column with Hudson sidebar surface treatment.
public struct HudSidebarPanel<Content: View>: View {
    public enum Edge: Sendable {
        case leading
        case trailing
    }

    @Binding private var width: CGFloat
    private let edge: Edge
    private let widthRange: ClosedRange<CGFloat>
    private let content: Content

    @Environment(\.hudsonSidebarStyle) private var style
    @Environment(\.hudTheme) private var theme

    public init(
        width: Binding<CGFloat>,
        edge: Edge,
        widthRange: ClosedRange<CGFloat>,
        @ViewBuilder content: () -> Content
    ) {
        self._width = width
        self.edge = edge
        self.widthRange = widthRange
        self.content = content()
    }

    public var body: some View {
        HStack(spacing: 0) {
            if edge == .trailing {
                HudResizableDivider(
                    width: $width,
                    placement: .leading,
                    range: widthRange
                )
            }

            content
                .frame(width: width, alignment: .topLeading)
                .frame(maxHeight: .infinity)
                .background(HudSidebarSurfaceBackground(style: style.surface))
                .overlay(alignment: edgeRuleAlignment) {
                    HudSidebarEdgeRule(style: style.surface)
                }

            if edge == .leading {
                HudResizableDivider(
                    width: $width,
                    placement: .trailing,
                    range: widthRange
                )
            }
        }
    }

    private var edgeRuleAlignment: Alignment {
        edge == .leading ? .trailing : .leading
    }
}

/// Background fill shared by navigation sidebars and resizable panels.
public struct HudSidebarSurfaceBackground: View {
    public let style: HudSidebarSurfaceStyle

    public init(style: HudSidebarSurfaceStyle) {
        self.style = style
    }

    public var body: some View {
        switch style {
        case .base:
            ZStack {
                HudPalette.chrome
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.045),
                        Color.white.opacity(0.020),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        case .editorial:
            HudPalette.surface.opacity(HudOpacity.strong)
        case .glass:
            ZStack {
                Rectangle().fill(.ultraThinMaterial).opacity(0.55)
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.040),
                        Color.white.opacity(0.018),
                        Color.black.opacity(0.060),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        case .liquidGlass:
            EmptyView()
        }
    }
}

/// Hairline separating a sidebar column from canvas content.
public struct HudSidebarEdgeRule: View {
    public let style: HudSidebarSurfaceStyle

    public init(style: HudSidebarSurfaceStyle) {
        self.style = style
    }

    public var body: some View {
        switch style {
        case .glass:
            LinearGradient(
                colors: [
                    Color.white.opacity(0.02),
                    Color.white.opacity(0.10),
                    Color.white.opacity(0.02),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: HudStrokeWidth.thin)
        case .base, .editorial:
            Rectangle()
                .fill(HudHairline.standard)
                .frame(width: HudStrokeWidth.thin)
        case .liquidGlass:
            EmptyView()
        }
    }
}
