import SwiftUI

/// Deterministic two-column layout for a leading sidebar and trailing content.
///
/// This is the HudsonKit counterpart to Talkie's `SidebarColumns`: a plain
/// SwiftUI `HStack`, not `NavigationSplitView`, so compact sidebar widths stay
/// under the app's control and are not clamped by AppKit's split-view sidebar
/// behavior.
public struct HudSidebarColumns<Sidebar: View, Content: View>: View {
    private let isHidden: Bool
    private let sidebar: () -> Sidebar
    private let content: () -> Content

    public init(
        isHidden: Bool = false,
        @ViewBuilder sidebar: @escaping () -> Sidebar,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isHidden = isHidden
        self.sidebar = sidebar
        self.content = content
    }

    public var body: some View {
        HStack(spacing: 0) {
            if !isHidden {
                sidebar()
                    .fixedSize(horizontal: true, vertical: false)
                    .transition(
                        .asymmetric(
                            insertion: .move(edge: .leading).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        )
                    )
            }

            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
