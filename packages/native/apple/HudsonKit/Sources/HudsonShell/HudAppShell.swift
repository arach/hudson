import SwiftUI
import HudsonUI

/// Top-level app chassis for HudsonKit.
///
/// `HudAppShell` composes the chrome of a Hudson app: a leading rail, a
/// trailing inspector, top/bottom drawers, a content surface, and a status bar.
/// Apps own state and render into slots; the shell handles divider lines,
/// background, and responsive collapse. Conceptual counterpart to the web
/// `AppShell` in `packages/web/hudsonkit/src/components/AppShell.tsx`.
///
/// Layout (regular size class):
/// ```
/// +----------------------------------+
/// |             topDrawer            |
/// +--+----------------------+--------+
/// |  |                      |        |
/// |L |       content        |   T    |
/// |  |                      |        |
/// +--+----------------------+--------+
/// |           bottomDrawer           |
/// +----------------------------------+
/// |            statusBar             |
/// +----------------------------------+
/// ```
///
/// In compact size class the trailing slot is hidden by the shell; the leading
/// slot is rendered as-is and the rail itself decides whether to collapse to a
/// hamburger.
public struct HudAppShell<
    Leading: View,
    Trailing: View,
    TopDrawer: View,
    BottomDrawer: View,
    Content: View,
    StatusBar: View
>: View {
    private let leading: Leading
    private let trailing: Trailing
    private let topDrawer: TopDrawer
    private let bottomDrawer: BottomDrawer
    private let content: Content
    private let statusBar: StatusBar
    private let showsStatusFooter: Bool

    @Environment(\.hudTheme) private var theme

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    public init(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder topDrawer: () -> TopDrawer,
        @ViewBuilder bottomDrawer: () -> BottomDrawer,
        @ViewBuilder content: () -> Content,
        showsStatusFooter: Bool = true,
        @ViewBuilder statusBar: () -> StatusBar
    ) {
        self.leading = leading()
        self.trailing = trailing()
        self.topDrawer = topDrawer()
        self.bottomDrawer = bottomDrawer()
        self.content = content()
        self.statusBar = statusBar()
        self.showsStatusFooter = showsStatusFooter
    }

    public var body: some View {
        ZStack {
            theme.palette.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                topDrawer

                HStack(alignment: .top, spacing: 0) {
                    leading
                        .fixedSize(horizontal: true, vertical: false)

                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                    if !isCompact {
                        trailing
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                bottomDrawer

                if showsStatusFooter {
                    HudDivider(color: theme.hairline.subtle)
                    statusBar
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var isCompact: Bool {
        #if os(iOS)
        return sizeClass == .compact
        #else
        return false
        #endif
    }
}

// MARK: - Convenience inits

extension HudAppShell where TopDrawer == EmptyView, BottomDrawer == EmptyView {
    /// Shell without top/bottom drawer slots — the common case for M3a.
    public init(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder content: () -> Content,
        showsStatusFooter: Bool = true,
        @ViewBuilder statusBar: () -> StatusBar
    ) {
        self.init(
            leading: leading,
            trailing: trailing,
            topDrawer: { EmptyView() },
            bottomDrawer: { EmptyView() },
            content: content,
            showsStatusFooter: showsStatusFooter,
            statusBar: statusBar
        )
    }
}

extension HudAppShell where StatusBar == EmptyView {
    /// Shell without a status footer — skips the bottom divider and bar entirely.
    public init(
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder topDrawer: () -> TopDrawer,
        @ViewBuilder bottomDrawer: () -> BottomDrawer,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            leading: leading,
            trailing: trailing,
            topDrawer: topDrawer,
            bottomDrawer: bottomDrawer,
            content: content,
            showsStatusFooter: false,
            statusBar: { EmptyView() }
        )
    }
}

extension HudAppShell where Leading == EmptyView, Trailing == EmptyView, TopDrawer == EmptyView, BottomDrawer == EmptyView, StatusBar == EmptyView {
    /// Bare shell — content only. Useful for previews and apps that have no
    /// chrome (takeover flows, single-purpose surfaces).
    public init(@ViewBuilder content: () -> Content) {
        self.init(
            leading: { EmptyView() },
            trailing: { EmptyView() },
            topDrawer: { EmptyView() },
            bottomDrawer: { EmptyView() },
            content: content,
            showsStatusFooter: false,
            statusBar: { EmptyView() }
        )
    }
}

// MARK: - Internal divider

/// Vertical hairline used between shell columns. Kept private to the shell so
/// the rule treatment stays consistent across leading/trailing transitions.
private struct HudShellVRule: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        Rectangle()
            .fill(theme.hairline.subtle)
            .frame(width: HudStrokeWidth.thin)
            .frame(maxHeight: .infinity)
    }
}
