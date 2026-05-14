import SwiftUI
import HudsonUI

/// Trailing-side inspector panel for `HudAppShell`.
///
/// 280pt wide when expanded (matches `HudLayout.panelWidth`) and removed
/// from layout when collapsed. Apps should place `HudInspectorToggle` in
/// their status bar, toolbar, or other app-owned chrome. Hidden entirely by the shell
/// in compact size class — apps don't need to special-case that here.
///
/// The header slot is meant for a section title or action row; the content
/// slot scrolls.
public struct HudInspector<Header: View, Content: View>: View {
    @Environment(\.hudTheme) private var theme

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
                HudDivider(color: theme.hairline.standard)

                ScrollView {
                    VStack(alignment: .leading, spacing: HudSpacing.xl) {
                        content
                    }
                    .padding(HudSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(width: HudLayout.panelWidth)
            .frame(maxHeight: .infinity)
            .background(theme.palette.chrome)
        }
    }

    private var headerBar: some View {
        HStack(spacing: HudSpacing.lg) {
            header
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, HudSpacing.lg)
        .frame(height: HudLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Convenience inits

extension HudInspector where Header == EmptyView {
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
