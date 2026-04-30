import SwiftUI
import HudsonUI

/// Trailing-side inspector panel for `HudsonAppShell`.
///
/// 280pt wide when expanded (matches `HudsonLayout.panelWidth`), 48pt when
/// collapsed (a thin strip with a toggle button). Hidden entirely by the shell
/// in compact size class — apps don't need to special-case that here.
///
/// The header slot is meant for a section title or action row; the content
/// slot scrolls.
public struct HudsonInspector<Header: View, Content: View>: View {
    @Binding public var isCollapsed: Bool
    public let header: Header
    public let content: Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
        VStack(spacing: 0) {
            headerBar
            HudsonDivider(color: HudsonHairline.standard)

            if !isCollapsed {
                ScrollView {
                    VStack(alignment: .leading, spacing: HudsonSpacing.xl) {
                        content
                    }
                    .padding(HudsonSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Spacer(minLength: 0)
            }
        }
        .frame(width: isCollapsed ? 48 : HudsonLayout.panelWidth)
        .frame(maxHeight: .infinity)
        .background(HudsonPalette.chrome)
    }

    private var headerBar: some View {
        HStack(spacing: HudsonSpacing.lg) {
            if !isCollapsed {
                header
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: toggleCollapsed) {
                Image(systemName: isCollapsed ? "sidebar.right" : "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(HudsonPalette.muted)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isCollapsed ? "Open inspector" : "Close inspector")
        }
        .padding(.horizontal, isCollapsed ? 0 : HudsonSpacing.lg)
        .frame(height: HudsonLayout.navHeight)
        .frame(maxWidth: .infinity, alignment: isCollapsed ? .center : .leading)
    }

    private func toggleCollapsed() {
        HudsonInstrumentation.event("Inspector.toggle")
        if reduceMotion {
            isCollapsed.toggle()
        } else {
            withAnimation(HudsonMotion.chromeSpring) {
                isCollapsed.toggle()
            }
        }
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
