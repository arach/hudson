import SwiftUI
import HudsonUI

public struct HudExplorerTab: Identifiable, Equatable, Sendable {
    public var document: HudTextDocument
    public var revision: UInt64
    /// Preview tabs are replaced by the next opened file until pinned (double-click or edit).
    public var isPinned: Bool

    public var id: String { document.id }
    public var title: String { document.title }

    public init(document: HudTextDocument, revision: UInt64, isPinned: Bool = false) {
        self.document = document
        self.revision = revision
        self.isPinned = isPinned
    }
}

/// Horizontal tab strip for open files in `HudFileExplorer`.
public struct HudFileExplorerTabBar: View {
    public let tabs: [HudExplorerTab]
    public let activeTabID: String?
    public var onSelect: (String) -> Void
    public var onPin: (String) -> Void
    public var onClose: (String) -> Void

    public init(
        tabs: [HudExplorerTab],
        activeTabID: String?,
        onSelect: @escaping (String) -> Void,
        onPin: @escaping (String) -> Void = { _ in },
        onClose: @escaping (String) -> Void
    ) {
        self.tabs = tabs
        self.activeTabID = activeTabID
        self.onSelect = onSelect
        self.onPin = onPin
        self.onClose = onClose
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: HudSpacing.xs) {
                ForEach(tabs) { tab in
                    tabChip(tab)
                }
            }
            .padding(.horizontal, HudSpacing.sm)
            .padding(.vertical, HudSpacing.xs)
        }
        .frame(height: HudFileExplorerTabMetrics.barHeight)
        .background(HudSurface.chrome)
    }

    private func tabChip(_ tab: HudExplorerTab) -> some View {
        let isActive = tab.id == activeTabID

        return HStack(spacing: HudSpacing.xs) {
            Button {
                onSelect(tab.id)
            } label: {
                Image(systemName: HudFileTreeFilesystem.symbolName(forFileName: tab.title))
                    .font(HudFont.ui(HudTextSize.micro, weight: .medium))
                    .foregroundStyle(isActive ? HudPalette.statusInfo : HudPalette.dim)
                    .frame(width: HudFileExplorerTabMetrics.iconSize, height: HudFileExplorerTabMetrics.iconSize)
            }
            .buttonStyle(.plain)

            Text(tab.title)
                .font(HudFont.mono(HudTextSize.xxs, weight: isActive ? .semibold : .medium))
                .foregroundStyle(isActive ? HudPalette.ink : HudPalette.muted)
                .italic(!tab.isPinned)
                .lineLimit(1)
                .contentShape(Rectangle())
                .onTapGesture { onSelect(tab.id) }
                .simultaneousGesture(
                    TapGesture(count: 2).onEnded { onPin(tab.id) }
                )
                .accessibilityHint(tab.isPinned ? "Pinned tab" : "Preview tab. Double-click title to pin.")

            Button {
                onClose(tab.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(isActive ? HudPalette.muted : HudPalette.dim)
                    .frame(width: HudFileExplorerTabMetrics.closeSize, height: HudFileExplorerTabMetrics.closeSize)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close \(tab.title)")
        }
        .padding(.leading, HudSpacing.md)
        .padding(.trailing, HudSpacing.sm)
        .frame(height: HudFileExplorerTabMetrics.chipHeight)
        .background(
            RoundedRectangle(cornerRadius: HudRadius.tight)
                .fill(isActive ? HudSurface.tintFill(HudPalette.statusInfo) : .clear)
        )
        .overlay(alignment: .bottom) {
            if isActive {
                Rectangle()
                    .fill(HudPalette.statusInfo)
                    .frame(height: HudStrokeWidth.standard)
            }
        }
    }
}

private enum HudFileExplorerTabMetrics {
    static let barHeight: CGFloat = 34
    static let chipHeight: CGFloat = 26
    static let iconSize: CGFloat = 14
    static let closeSize: CGFloat = 16
}