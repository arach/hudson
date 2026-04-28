import SwiftUI
import HudsonUI

/// Free-form work surface for the content slot of `HudsonAppShell`.
///
/// `HudsonCanvas` provides the chrome around a target-scoped or task-scoped
/// surface: an optional grid background, an optional pinned header bar
/// (target identity, breadcrumb, controls), and a generic scrolling content
/// area. Apps decide what lives inside the canvas — a target detail panel,
/// a windowed deck, an editor, etc.
///
/// Conceptual counterpart to the web `Canvas` surface in
/// `packages/hudson-sdk/src/components/...` — the chassis is shared, the
/// content is per-app.
public struct HudsonCanvas<Header: View, Content: View>: View {
    public let showGrid: Bool
    public let header: Header
    public let content: Content

    public init(
        showGrid: Bool = true,
        @ViewBuilder header: () -> Header,
        @ViewBuilder content: () -> Content
    ) {
        self.showGrid = showGrid
        self.header = header()
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: 0) {
            if Header.self != EmptyView.self {
                header
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, HudsonSpacing.xxl)
                    .frame(height: HudsonLayout.navHeight)
                    .background(Color.black.opacity(0.20))
                HudsonDivider(color: HudsonHairline.standard)
            }

            ZStack {
                if showGrid {
                    HudsonGridBackground()
                        .allowsHitTesting(false)
                }

                ScrollView {
                    content
                        .padding(HudsonSpacing.xxl)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Convenience inits

extension HudsonCanvas where Header == EmptyView {
    public init(
        showGrid: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            showGrid: showGrid,
            header: { EmptyView() },
            content: content
        )
    }
}
