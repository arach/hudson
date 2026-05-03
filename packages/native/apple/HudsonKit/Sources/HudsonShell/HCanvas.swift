import SwiftUI
import HudsonUI

/// Free-form work surface for the content slot of `HAppShell`.
///
/// `HCanvas` provides the chrome around a target-scoped or task-scoped
/// surface: an optional grid background, an optional pinned header bar
/// (target identity, breadcrumb, controls), and a generic scrolling content
/// area. Apps decide what lives inside the canvas — a target detail panel,
/// a windowed deck, an editor, etc.
///
/// Conceptual counterpart to the web `Canvas` surface in
/// `packages/web/hudsonkit/src/components/...` — the chassis is shared, the
/// content is per-app.
public struct HCanvas<Header: View, Content: View>: View {
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
                    .padding(.horizontal, HSpacing.xxl)
                    .frame(height: HLayout.navHeight)
                    .background(HPalette.chrome)
                HDivider(color: HHairline.standard)
            }

            ZStack {
                if showGrid {
                    HGridBackground()
                        .allowsHitTesting(false)
                }

                ScrollView {
                    content
                        .padding(HSpacing.xxl)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Convenience inits

extension HCanvas where Header == EmptyView {
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
