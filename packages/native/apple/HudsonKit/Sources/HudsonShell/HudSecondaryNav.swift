import SwiftUI
import HudsonUI

// MARK: - Items & entries

public struct HudSecondaryNavItem<Selection: Hashable>: Identifiable, Equatable {
    public let id: Selection
    public let title: String
    public let icon: String

    public init(id: Selection, title: String, icon: String) {
        self.id = id
        self.title = title
        self.icon = icon
    }

    public static func == (lhs: HudSecondaryNavItem<Selection>, rhs: HudSecondaryNavItem<Selection>) -> Bool {
        lhs.id == rhs.id
    }
}

extension HudSecondaryNavItem: Sendable where Selection: Sendable {}

public enum HudSecondaryNavEntry<Selection: Hashable>: Identifiable {
    case item(HudSecondaryNavItem<Selection>)
    case section(id: String, title: String)

    public var id: String {
        switch self {
        case .item(let item): return "item-\(String(describing: item.id))"
        case .section(let id, _): return "section-\(id)"
        }
    }
}

// MARK: - Column

/// Thin, expandable secondary navigation for settings and inspector-like surfaces.
public struct HudSecondaryNav<Selection: Hashable>: View {
    @Binding private var selection: Selection
    private let entries: [HudSecondaryNavEntry<Selection>]
    @ObservedObject private var state: HudSecondaryNavState
    private let title: String

    @Environment(\.hudsonAppManifest) private var manifest
    @Environment(\.hudTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dragPreviewColumnWidth: CGFloat?
    @State private var isDragging = false

    public init(
        selection: Binding<Selection>,
        entries: [HudSecondaryNavEntry<Selection>],
        state: HudSecondaryNavState,
        title: String = "Settings"
    ) {
        self._selection = selection
        self.entries = entries
        self._state = ObservedObject(wrappedValue: state)
        self.title = title
    }

    public var body: some View {
        columnBody
            .frame(width: layoutWidth, alignment: .leading)
            .frame(maxHeight: .infinity)
            .overlay(alignment: .trailing) {
                edgeHandle
                    .alignmentGuide(.trailing) { dimensions in
                        dimensions[.trailing] - dimensions.width / 2
                    }
            }
            .overlay(alignment: .trailing) {
                resizePreviewEdge
            }
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(accent.opacity(isDragging && dragPreviewColumnWidth == nil ? 0.42 : 0))
                    .frame(width: HudStrokeWidth.standard)
                    .allowsHitTesting(false)
                    .animation(HudMotion.ifAllowed(.easeOut(duration: 0.12), reduceMotion: reduceMotion), value: isDragging)
            }
            .transaction { transaction in
                if isDragging {
                    transaction.animation = nil
                    transaction.disablesAnimations = true
                }
            }
            .onChange(of: isDragging) { _, dragging in
                if !dragging {
                    dragPreviewColumnWidth = nil
                }
            }
            .onChange(of: state.isCompact) { _, _ in
                if !isDragging {
                    dragPreviewColumnWidth = nil
                }
            }
            .animation(reduceMotion || isDragging ? nil : HudMotion.chromeResize, value: state.isCompact)
    }

    private var accent: Color { manifest.accent }

    /// Committed width only — preview never changes layout (matches primary sidebar).
    private var committedColumnWidth: CGFloat {
        clampedCommittedWidth(state.columnWidth)
    }

    private var layoutWidth: CGFloat {
        state.isCompact ? HudSecondaryNavLayout.compactWidth : committedColumnWidth
    }

    private var resizePreviewOffset: CGFloat? {
        guard let dragPreviewColumnWidth else { return nil }
        let previewWidth = clampedPreviewWidth(dragPreviewColumnWidth)
        return previewWidth - layoutWidth
    }

    private var columnBody: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: theme.hairline.subtle)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: state.isCompact ? .center : .leading, spacing: state.isCompact ? HudSpacing.xs : HudSecondaryNavLayout.sectionTopGap) {
                    Spacer().frame(height: HudSpacing.xs)
                    entryList
                }
                .padding(.horizontal, state.isCompact ? HudSpacing.xs : HudSpacing.sm)
                .padding(.bottom, HudSpacing.sm)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.palette.surface)
        .overlay(alignment: .trailing) {
            HudDivider(color: theme.hairline.subtle, axis: .vertical)
                .frame(width: HudStrokeWidth.thin)
                .allowsHitTesting(false)
        }
    }

    private var header: some View {
        Button(action: toggleCompact) {
            HStack(spacing: 0) {
                Image(systemName: "gearshape.fill")
                    .font(HudFont.ui(HudTextSize.sm))
                    .foregroundStyle(theme.palette.muted)
                    .frame(width: HudIconSize.medium, alignment: .center)
                    .padding(.leading, HudSpacing.xs)
                    .padding(.trailing, state.isCompact ? 0 : HudSpacing.sm)

                if state.labelsVisible {
                    Text(title)
                        .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(theme.palette.ink)
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    Image(systemName: "sidebar.left")
                        .font(HudFont.ui(HudTextSize.xs))
                        .foregroundStyle(theme.palette.dim)
                        .padding(.trailing, HudSpacing.xs)
                }
            }
            .frame(height: HudSecondaryNavLayout.headerHeight)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, HudSpacing.sm)
            .padding(.top, HudSecondaryNavLayout.headerTopPadding)
            .padding(.bottom, HudSecondaryNavLayout.headerBottomPadding)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(state.isCompact ? "Expand settings menu" : "Collapse settings menu")
        .accessibilityLabel(title)
    }

    @ViewBuilder
    private var entryList: some View {
        ForEach(entries) { entry in
            switch entry {
            case .section(_, let title):
                if state.sectionHeadersVisible {
                    HudSectionLabel(title, tint: theme.palette.dim)
                        .padding(.leading, HudSpacing.sm)
                        .padding(.bottom, HudSpacing.xxs)
                }
            case .item(let item):
                HudSecondaryNavRow(
                    icon: item.icon,
                    title: item.title,
                    isSelected: selection == item.id,
                    isCompact: state.isCompact,
                    accent: accent
                ) {
                    selection = item.id
                }
            }
        }
    }

    private var edgeHandle: some View {
        HudSidebarEdgeHandle(
            isCompact: state.isCompact,
            activationDistance: 6,
            currentWidth: state.isCompact ? 0 : committedColumnWidth,
            minWidth: HudSecondaryNavLayout.minExpandedWidth,
            maxWidth: HudSecondaryNavLayout.maxExpandedWidth,
            collapseWidth: HudSecondaryNavLayout.collapseWidth,
            visualOffset: resizePreviewOffset ?? 0,
            reduceMotion: reduceMotion,
            accent: accent,
            accessibilityLabel: "Resize settings navigation",
            isDragging: $isDragging,
            onToggle: toggleCompact,
            onResize: { width in
                dragPreviewColumnWidth = clampedPreviewWidth(width)
            },
            onResizeEnded: { width in
                commitColumnWidth(clampedCommittedWidth(width))
            },
            onCollapse: { restoreWidth in
                commitColumnWidth(clampedCommittedWidth(restoreWidth), compact: true)
            },
            onExpand: { width in
                commitColumnWidth(
                    clampedCommittedWidth(max(width, HudSecondaryNavLayout.minExpandedWidth)),
                    compact: false
                )
            }
        )
    }

    @ViewBuilder
    private var resizePreviewEdge: some View {
        if let resizePreviewOffset {
            Rectangle()
                .fill(HudSurface.tintStrong(accent))
                .frame(width: HudStrokeWidth.standard)
                .offset(x: resizePreviewOffset)
                .allowsHitTesting(false)
        }
    }

    private func toggleCompact() {
        setCompact(!state.isCompact)
    }

    private func setCompact(_ compact: Bool) {
        if reduceMotion {
            state.setCompact(compact)
        } else {
            withAnimation(HudMotion.chromeResize) {
                state.setCompact(compact)
            }
        }
    }

    /// Defer commits until after the gesture/update cycle (avoids re-entrancy during drag end).
    private func commitColumnWidth(_ width: CGFloat, compact: Bool? = nil) {
        Task { @MainActor in
            state.setColumnWidth(width)
            if let compact {
                setCompact(compact)
            }
        }
    }

    private func clampedCommittedWidth(_ width: CGFloat) -> CGFloat {
        guard width.isFinite else {
            return HudSecondaryNavLayout.defaultExpandedWidth
        }
        return min(
            HudSecondaryNavLayout.maxExpandedWidth,
            max(HudSecondaryNavLayout.minExpandedWidth, width)
        )
    }

    private func clampedPreviewWidth(_ width: CGFloat) -> CGFloat {
        guard width.isFinite else { return 0 }
        return min(HudSecondaryNavLayout.maxExpandedWidth, max(0, width))
    }
}

// MARK: - Row

private struct HudSecondaryNavRow: View {
    let icon: String
    let title: String
    let isSelected: Bool
    let isCompact: Bool
    let accent: Color
    let action: () -> Void

    @Environment(\.hudTheme) private var theme
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 0) {
                if !isCompact {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(isSelected ? accent : .clear)
                        .frame(width: HudSecondaryNavLayout.leftAccentWidth)
                        .padding(.vertical, 2)
                }

                HStack(spacing: isCompact ? 0 : HudSpacing.sm) {
                    Image(systemName: icon)
                        .font(.system(size: isCompact ? HudSecondaryNavLayout.compactRowIconSize : HudSecondaryNavLayout.rowIconSize))
                        .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                        .frame(width: HudIconSize.small, height: isCompact ? HudIconSize.small : nil, alignment: .center)

                    if !isCompact {
                        Text(title.uppercased())
                            .font(HudFont.mono(9, weight: .medium))
                            .tracking(0.6)
                            .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                            .lineLimit(1)

                        Spacer(minLength: 0)
                    }
                }
                .padding(.leading, isCompact ? 0 : HudSpacing.xs)
                .padding(.trailing, isCompact ? 0 : HudSpacing.sm)
            }
            .padding(.vertical, HudSecondaryNavLayout.rowVerticalPadding)
            .frame(maxWidth: .infinity, alignment: isCompact ? .center : .leading)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(
                        isSelected
                            ? HudSurface.tintFill(accent)
                            : (isHovered ? HudSurface.hover : .clear)
                    )
            )
            .overlay(alignment: .bottom) {
                if isCompact {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(isSelected ? accent : .clear)
                        .frame(
                            width: HudSecondaryNavLayout.compactAccentBarWidth,
                            height: HudSecondaryNavLayout.compactAccentBarHeight
                        )
                        .padding(.bottom, 1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
        .onHover { isHovered = $0 }
    }
}