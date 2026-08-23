import SwiftUI
import HudsonUI

/// Resizable sidebar/inspector column with Hudson sidebar surface treatment.
///
/// `extendsBackgroundIntoTopSafeArea` extends only the surface and inner edge
/// rule beneath native titlebar chrome; panel content keeps its safe-area inset.
public struct HudSidebarPanel<Content: View>: View {
    public enum Edge: Sendable {
        case leading
        case trailing
    }

    @Binding private var width: CGFloat
    private let edge: Edge
    private let widthRange: ClosedRange<CGFloat>
    private let resizeHitWidth: CGFloat
    private let extendsBackgroundIntoTopSafeArea: Bool
    private let content: Content

    @Environment(\.hudsonSidebarStyle) private var style
    @Environment(\.hudTheme) private var theme

    public init(
        width: Binding<CGFloat>,
        edge: Edge,
        widthRange: ClosedRange<CGFloat>,
        extendsBackgroundIntoTopSafeArea: Bool = false,
        resizeHitWidth: CGFloat = 10,
        @ViewBuilder content: () -> Content
    ) {
        self._width = width
        self.edge = edge
        self.widthRange = widthRange
        self.extendsBackgroundIntoTopSafeArea = extendsBackgroundIntoTopSafeArea
        self.resizeHitWidth = resizeHitWidth
        self.content = content()
    }

    public var body: some View {
        HStack(spacing: 0) {
            if edge == .trailing {
                outerResizeHandle
            }

            panelContent

            if edge == .leading {
                outerResizeHandle
            }
        }
    }

    private var panelContent: some View {
        content
            .frame(width: width, alignment: .topLeading)
            .frame(maxHeight: .infinity)
            .background {
                panelBackground
            }
            .overlay(alignment: edgeRuleAlignment) {
                panelEdgeRule
            }
            .overlay(alignment: edgeRuleAlignment) {
                innerResizeHandle
            }
    }

    @ViewBuilder
    private var panelBackground: some View {
        if extendsBackgroundIntoTopSafeArea {
            HudSidebarSurfaceBackground(style: style.surface)
                .ignoresSafeArea(.container, edges: .top)
        } else {
            HudSidebarSurfaceBackground(style: style.surface)
        }
    }

    @ViewBuilder
    private var panelEdgeRule: some View {
        if extendsBackgroundIntoTopSafeArea {
            HudSidebarEdgeRule(style: style.surface)
                .ignoresSafeArea(.container, edges: .top)
        } else {
            HudSidebarEdgeRule(style: style.surface)
        }
    }

    private var outerResizeHandle: some View {
        HudResizableDivider(
            width: $width,
            placement: resizePlacement,
            range: widthRange,
            hitWidth: resizeHitWidth,
            hairlinePlacement: outerHairlinePlacement
        )
    }

    private var innerResizeHandle: some View {
        HudResizableDivider(
            width: $width,
            placement: resizePlacement,
            range: widthRange,
            hitWidth: resizeHitWidth,
            hairlinePlacement: innerHairlinePlacement,
            showsHairline: false
        )
    }

    private var edgeRuleAlignment: Alignment {
        edge == .leading ? .trailing : .leading
    }

    private var resizePlacement: HudResizableDivider.Placement {
        edge == .leading ? .trailing : .leading
    }

    private var outerHairlinePlacement: HudResizableDivider.HairlinePlacement {
        edge == .leading ? .leading : .trailing
    }

    private var innerHairlinePlacement: HudResizableDivider.HairlinePlacement {
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
                // hudlint:disable next-line palette,opacity
                LinearGradient(
                    colors: [
                        // hudlint:disable next-line palette,opacity
                        Color.white.opacity(0.045),
                        // hudlint:disable next-line palette,opacity
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
                // hudlint:disable next-line opacity
                Rectangle().fill(.ultraThinMaterial).opacity(0.55)
                // hudlint:disable next-line palette,opacity
                LinearGradient(
                    colors: [
                        // hudlint:disable next-line palette,opacity
                        Color.white.opacity(0.040),
                        // hudlint:disable next-line palette,opacity
                        Color.white.opacity(0.018),
                        // hudlint:disable next-line palette,opacity
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
            // hudlint:disable next-line palette,opacity
            LinearGradient(
                colors: [
                    // hudlint:disable next-line palette,opacity
                    Color.white.opacity(0.02),
                    // hudlint:disable next-line palette,opacity
                    Color.white.opacity(0.10),
                    // hudlint:disable next-line palette,opacity
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
