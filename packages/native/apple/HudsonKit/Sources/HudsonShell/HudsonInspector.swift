import SwiftUI
import HudsonUI

/// Trailing-side inspector panel for `HudsonAppShell`.
///
/// 280pt wide when expanded (matches `HudsonLayout.panelWidth`) and removed
/// from layout when collapsed. Apps should place `HudsonInspectorToggle` in
/// their status bar, toolbar, or other app-owned chrome. Hidden entirely by the shell
/// in compact size class — apps don't need to special-case that here.
///
/// The header slot is meant for a section title or action row; the content
/// slot scrolls.
public struct HudsonInspector<Header: View, Content: View>: View {
    @Binding public var isCollapsed: Bool
    public let header: Header
    public let content: Content

    public init(
        isCollapsed: Binding<Bool>,
        @ViewBuilder header: () -> Header,
        @ViewBuilder content: () -> Content
    ) {
        self._isCollapsed = isCollapsed
        self.header = header()
        self.content = content()
    }

    public var body: some View {
        if isCollapsed {
            EmptyView()
        } else {
            VStack(spacing: 0) {
                headerBar
                HudsonDivider(color: HudsonHairline.standard)

                ScrollView {
                    VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                        content
                    }
                    .padding(HudsonSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(width: HudsonLayout.panelWidth)
            .frame(maxHeight: .infinity)
            .background(HudsonPalette.chrome)
        }
    }

    private var headerBar: some View {
        HStack(spacing: HudsonSpacing.lg) {
            header
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, HudsonSpacing.lg)
        .frame(height: HudsonLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Convenience inits

extension HudsonInspector where Header == EmptyView {
    public init(
        isCollapsed: Binding<Bool>,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            isCollapsed: isCollapsed,
            header: { EmptyView() },
            content: content
        )
    }
}
