import SwiftUI
import HudsonUI

/// Controls which side columns the status bar spans beneath.
///
/// `.fullWidth` preserves the original shell anatomy. `.besideLeading` gives
/// only the leading column the complete window edge. `.betweenSidebars` gives
/// both side columns the complete edge and keeps the status bar in the center.
public enum HudAppShellStatusBarSpan: String, CaseIterable, Identifiable, Sendable {
    case fullWidth
    case besideLeading
    case betweenSidebars

    public var id: String { rawValue }
}

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
/// With `statusBarSpan: .besideLeading`, the leading column owns the complete
/// window edge and the remaining chrome forms its sibling column:
/// ```
/// +------+---------------------------+
/// |      | topDrawer                 |
/// |      +---------------------------+
/// | lead | content        | trailing |
/// |      +---------------------------+
/// |      | bottomDrawer               |
/// |      +---------------------------+
/// |      | statusBar                  |
/// +------+---------------------------+
/// ```
///
/// With `statusBarSpan: .betweenSidebars`, both side columns own the full
/// height while drawers, content, and status form the center column:
/// ```
/// +------+----------------------+----------+
/// |      | topDrawer            |          |
/// |      +----------------------|          |
/// | lead | content              | trailing |
/// |      +----------------------|          |
/// |      | bottomDrawer         |          |
/// |      +----------------------|          |
/// |      | statusBar            |          |
/// +------+----------------------+----------+
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
    private let statusBarSpan: HudAppShellStatusBarSpan
    private let leading: Leading
    private let trailing: Trailing
    private let topDrawer: TopDrawer
    private let bottomDrawer: BottomDrawer
    private let content: Content
    private let statusBar: StatusBar

    @Environment(\.hudTheme) private var theme

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    public init(
        statusBarSpan: HudAppShellStatusBarSpan = .fullWidth,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder topDrawer: () -> TopDrawer,
        @ViewBuilder bottomDrawer: () -> BottomDrawer,
        @ViewBuilder content: () -> Content,
        @ViewBuilder statusBar: () -> StatusBar
    ) {
        self.statusBarSpan = statusBarSpan
        self.leading = leading()
        self.trailing = trailing()
        self.topDrawer = topDrawer()
        self.bottomDrawer = bottomDrawer()
        self.content = content()
        self.statusBar = statusBar()
    }

    public var body: some View {
        ZStack {
            theme.palette.bg.ignoresSafeArea()
            shellContent
        }
    }

    @ViewBuilder
    private var shellContent: some View {
        switch statusBarSpan {
        case .fullWidth:
            VStack(spacing: 0) {
                topDrawer
                HStack(spacing: 0) {
                    leading
                    mainContentRow
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                bottomDrawer
                statusBarRegion
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .besideLeading:
            HStack(spacing: 0) {
                leading
                    .frame(maxHeight: .infinity)
                VStack(spacing: 0) {
                    topDrawer
                    mainContentRow
                    bottomDrawer
                    statusBarRegion
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .betweenSidebars:
            HStack(spacing: 0) {
                leading
                    .frame(maxHeight: .infinity, alignment: .top)
                VStack(spacing: 0) {
                    topDrawer
                    content
                        .frame(
                            maxWidth: .infinity,
                            maxHeight: .infinity,
                            alignment: .topLeading
                        )
                    bottomDrawer
                    statusBarRegion
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if !isCompact {
                    trailing
                        .frame(maxHeight: .infinity, alignment: .top)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var mainContentRow: some View {
        HStack(spacing: 0) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            if !isCompact {
                trailing
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var statusBarRegion: some View {
        VStack(spacing: 0) {
            HudDivider(color: theme.hairline.subtle)
            statusBar
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
        statusBarSpan: HudAppShellStatusBarSpan = .fullWidth,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
        @ViewBuilder content: () -> Content,
        @ViewBuilder statusBar: () -> StatusBar
    ) {
        self.init(
            statusBarSpan: statusBarSpan,
            leading: leading,
            trailing: trailing,
            topDrawer: { EmptyView() },
            bottomDrawer: { EmptyView() },
            content: content,
            statusBar: statusBar
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
