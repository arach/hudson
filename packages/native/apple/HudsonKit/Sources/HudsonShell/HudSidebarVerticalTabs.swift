import SwiftUI
import HudsonUI
import HudsonObservability

/// One workspace or document tab rendered in a `HudNavigationSidebar` using
/// the `.verticalTabs` variant.
public struct HudSidebarVerticalTab<Selection: Hashable>: Identifiable, Equatable {
    public let id: Selection
    public let title: String
    public let subtitle: String?
    public let badge: String?
    public let icon: String
    public let accessibilityLabel: String?

    public init(
        id: Selection,
        title: String,
        subtitle: String? = nil,
        badge: String? = nil,
        icon: String = "rectangle.stack",
        accessibilityLabel: String? = nil
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.badge = badge
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
    }

    public static func == (lhs: HudSidebarVerticalTab, rhs: HudSidebarVerticalTab) -> Bool {
        lhs.id == rhs.id
            && lhs.title == rhs.title
            && lhs.subtitle == rhs.subtitle
            && lhs.badge == rhs.badge
            && lhs.icon == rhs.icon
            && lhs.accessibilityLabel == rhs.accessibilityLabel
    }
}

extension HudSidebarVerticalTab: Sendable where Selection: Sendable {}

/// A scrollable vertical-tab region for the flexible middle slot of
/// `HudNavigationSidebar(variant: .verticalTabs, ...)`.
///
/// The 48pt icon rail is stable in both states. The label region clips and fades
/// as the parent sidebar collapses, matching `HudNavigationSidebar` geometry
/// without moving icons. Selection is deliberately neutral; accent is reserved
/// for the live dot so hosts keep Hudson's visual register while retaining the
/// familiar compact desktop-task-sidebar rhythm.
public struct HudSidebarVerticalTabs<Selection: Hashable>: View {
    @Binding private var selection: Selection?

    private let tabs: [HudSidebarVerticalTab<Selection>]
    private let progress: Double
    private let labelWidth: CGFloat
    private let accent: Color?
    private let title: String
    private let createLabel: String
    private let emptyLabel: String
    private let onCreate: (() -> Void)?

    @Environment(\.hudsonAppManifest) private var manifest
    @Environment(\.hudTheme) private var theme
    @State private var hoveredID: Selection?

    public init(
        selection: Binding<Selection?>,
        tabs: [HudSidebarVerticalTab<Selection>],
        progress: Double,
        labelWidth: CGFloat = HudSidebarLayout.labelWidth,
        accent: Color? = nil,
        title: String = "Workspaces",
        createLabel: String = "New workspace",
        emptyLabel: String = "No recent workspaces",
        onCreate: (() -> Void)? = nil
    ) {
        self._selection = selection
        self.tabs = tabs
        self.progress = min(1, max(0, progress))
        self.labelWidth = labelWidth
        self.accent = accent
        self.title = title
        self.createLabel = createLabel
        self.emptyLabel = emptyLabel
        self.onCreate = onCreate
    }

    public var body: some View {
        VStack(spacing: 0) {
            sectionLabel
            if let onCreate {
                createButton(action: onCreate)
            }
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: HudSpacing.xxs) {
                    ForEach(tabs) { tab in
                        tabButton(tab)
                    }
                    if tabs.isEmpty {
                        emptyState
                    }
                }
                .padding(.bottom, HudSpacing.sm)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
    }

    private var resolvedAccent: Color { accent ?? manifest.accent }
    private var labelsVisible: Bool { progress < 0.999 }

    private var sectionLabel: some View {
        HStack(spacing: 0) {
            Color.clear
                .frame(width: HudSidebarLayout.railWidth, height: HudSidebarLayout.sectionHeaderHeight)
            Text(title.uppercased())
                .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                .tracking(HudTracking.wider)
                .foregroundStyle(theme.palette.dim)
                .lineLimit(1)
                .padding(.leading, HudSidebarLayout.labelLeading)
                .frame(
                    width: max(0, labelWidth * CGFloat(1 - progress)),
                    height: HudSidebarLayout.sectionHeaderHeight,
                    alignment: .leading
                )
                .clipped()
                .opacity(labelsVisible ? 1 : 0)
        }
    }

    private func createButton(action: @escaping () -> Void) -> some View {
        Button {
            HudInstrumentation.ui.event("Sidebar.verticalTab.create")
            action()
        } label: {
            HStack(spacing: 0) {
                Image(systemName: "plus")
                    .font(HudFont.ui(HudSidebarLayout.iconSize, weight: .medium))
                    .foregroundStyle(theme.palette.muted)
                    .frame(width: HudSidebarLayout.railWidth, height: HudSidebarLayout.rowHeight)
                Text(createLabel)
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(theme.palette.muted)
                    .lineLimit(1)
                    .padding(.leading, HudSidebarLayout.labelLeading)
                    .frame(
                        width: max(0, labelWidth * CGFloat(1 - progress)),
                        alignment: .leading
                    )
                    .clipped()
                    .opacity(labelsVisible ? 1 : 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(createLabel)
        .accessibilityLabel(createLabel)
    }

    private func tabButton(_ tab: HudSidebarVerticalTab<Selection>) -> some View {
        let isSelected = selection == tab.id
        let isHovered = hoveredID == tab.id

        return Button {
            let changed = selection != tab.id
            HudInstrumentation.ui.event(
                "Sidebar.verticalTab.select",
                metadata: ["changed": changed ? "true" : "false"]
            )
            if changed {
                selection = tab.id
            }
        } label: {
            HStack(spacing: 0) {
                tabIcon(tab, isSelected: isSelected)
                tabLabel(tab, isSelected: isSelected)
            }
            .contentShape(Rectangle())
            .background {
                RoundedRectangle(cornerRadius: theme.radius.standard, style: .continuous)
                    .fill(isSelected || isHovered ? theme.palette.surface : Color.clear)
                    .padding(.horizontal, HudSpacing.xs)
            }
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: theme.radius.standard, style: .continuous)
                        .strokeBorder(theme.hairline.subtle, lineWidth: HudStrokeWidth.thin)
                        .padding(.horizontal, HudSpacing.xs)
                }
            }
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            if hovering {
                hoveredID = tab.id
            } else if hoveredID == tab.id {
                hoveredID = nil
            }
        }
        .help(tab.accessibilityLabel ?? tab.title)
        .accessibilityLabel(tab.accessibilityLabel ?? tab.title)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func tabIcon(_ tab: HudSidebarVerticalTab<Selection>, isSelected: Bool) -> some View {
        ZStack(alignment: .bottomTrailing) {
            Image(systemName: tab.icon)
                .font(HudFont.ui(HudSidebarLayout.iconSize, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                .frame(width: HudIconSize.medium, height: HudIconSize.medium)
            if isSelected {
                Circle()
                    .fill(resolvedAccent)
                    .frame(width: HudDotSize.tiny, height: HudDotSize.tiny)
                    .overlay(
                        Circle()
                            .strokeBorder(theme.palette.chrome, lineWidth: HudStrokeWidth.thin)
                    )
            }
        }
        .frame(width: HudSidebarLayout.railWidth, height: tabRowHeight)
    }

    private func tabLabel(_ tab: HudSidebarVerticalTab<Selection>, isSelected: Bool) -> some View {
        HStack(spacing: HudSpacing.xs) {
            VStack(alignment: .leading, spacing: 1) {
                Text(tab.title)
                    .font(HudFont.ui(HudTextSize.sm, weight: isSelected ? .semibold : .medium))
                    .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                    .lineLimit(1)
                if let subtitle = tab.subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(HudFont.ui(HudTextSize.xxs, weight: .regular))
                        .foregroundStyle(theme.palette.dim)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: HudSpacing.xs)
            if let badge = tab.badge, !badge.isEmpty {
                Text(badge.uppercased())
                    .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                    .foregroundStyle(theme.palette.dim)
                    .lineLimit(1)
            }
        }
        .padding(.leading, HudSidebarLayout.labelLeading)
        .padding(.trailing, HudSpacing.sm)
        .frame(
            width: max(0, labelWidth * CGFloat(1 - progress)),
            height: tabRowHeight,
            alignment: .leading
        )
        .clipped()
        .opacity(labelsVisible ? 1 : 0)
    }

    private var emptyState: some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: HudSidebarLayout.railWidth)
            Text(emptyLabel)
                .font(HudFont.ui(HudTextSize.xs, weight: .regular))
                .foregroundStyle(theme.palette.dim)
                .lineLimit(2)
                .padding(.leading, HudSidebarLayout.labelLeading)
                .frame(
                    width: max(0, labelWidth * CGFloat(1 - progress)),
                    alignment: .leading
                )
                .clipped()
                .opacity(labelsVisible ? 1 : 0)
        }
        .padding(.vertical, HudSpacing.sm)
        .accessibilityHidden(tabs.isEmpty == false)
    }

    private var tabRowHeight: CGFloat { HudLayout.rowHeightRegular }
}
