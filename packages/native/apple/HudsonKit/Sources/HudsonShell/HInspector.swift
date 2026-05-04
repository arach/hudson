import SwiftUI
import HudsonUI

/// Trailing-side inspector panel for `HAppShell`.
///
/// 280pt wide when expanded (matches `HLayout.panelWidth`) and removed
/// from layout when collapsed. Apps should place `HInspectorToggle` in
/// their status bar, toolbar, or other app-owned chrome. Hidden entirely by the shell
/// in compact size class — apps don't need to special-case that here.
///
/// The header slot is meant for a section title or action row; the content
/// slot scrolls.
public struct HInspector<Header: View, Content: View>: View {
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
                HDivider(color: HHairline.standard)

                ScrollView {
                    VStack(alignment: .leading, spacing: HSpacing.xl) {
                        content
                    }
                    .padding(HSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(width: HLayout.panelWidth)
            .frame(maxHeight: .infinity)
            .background(HPalette.chrome)
        }
    }

    private var headerBar: some View {
        HStack(spacing: HSpacing.lg) {
            header
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, HSpacing.lg)
        .frame(height: HLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Convenience inits

extension HInspector where Header == EmptyView {
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
