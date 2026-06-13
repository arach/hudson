import SwiftUI
import HudsonUI
import HudsonUIWeb

/// Demo-local explorer split that adapts tree/preview layout to the content
/// area width. Uses the same primitives as `HudFileExplorer` but keeps
/// responsive policy in the Lab app.
struct DemoResponsiveFileExplorer: View {
    @Bindable var model: HudFileExplorerModel
    var onSave: ((HudTextDocument) -> Void)?

    @State private var usesStackedLayout: Bool?
    private let stackedReleaseGap: CGFloat = 48

    var body: some View {
        GeometryReader { geometry in
            explorerLayout(for: geometry.size)
                .onAppear { syncStackedLayout(for: geometry.size.width) }
                .onChange(of: geometry.size.width) { _, width in
                    syncStackedLayout(for: width)
                }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func syncStackedLayout(for width: CGFloat) {
        if let usesStackedLayout {
            if usesStackedLayout {
                if width >= DemoLayout.explorerStackedBreakpoint + stackedReleaseGap {
                    self.usesStackedLayout = false
                }
            } else if width < DemoLayout.explorerStackedBreakpoint {
                self.usesStackedLayout = true
            }
        } else {
            usesStackedLayout = width < DemoLayout.explorerStackedBreakpoint
        }
    }

    private func stackedLayoutActive(for width: CGFloat) -> Bool {
        usesStackedLayout ?? (width < DemoLayout.explorerStackedBreakpoint)
    }

    @ViewBuilder
    private func explorerLayout(for size: CGSize) -> some View {
        #if os(macOS)
        if stackedLayoutActive(for: size.width) {
            stackedLayout(treeHeight: min(DemoLayout.explorerTreeStackedHeight, size.height * 0.38))
        } else {
            let treeWidths = resolvedTreeWidths(for: size.width)
            let previewMin = resolvedPreviewMinWidth(for: size.width)

            HSplitView {
                treePane
                    .frame(
                        minWidth: treeWidths.min,
                        idealWidth: treeWidths.ideal,
                        maxWidth: treeWidths.max
                    )
                previewPane
                    .frame(minWidth: previewMin, maxHeight: .infinity)
                    .layoutPriority(1)
            }
        }
        #else
        VStack(spacing: 0) {
            treePane
                .frame(maxHeight: min(240, size.height * 0.38))
            HudDivider()
            previewPane
        }
        #endif
    }

    private func stackedLayout(treeHeight: CGFloat) -> some View {
        VStack(spacing: 0) {
            treePane
                .frame(height: treeHeight)
            HudDivider()
            previewPane
        }
    }

    private func resolvedTreeWidths(for totalWidth: CGFloat) -> (min: CGFloat, ideal: CGFloat, max: CGFloat) {
        let treeMinWidth: CGFloat = 240
        let treeIdealWidth: CGFloat = 280
        let treeMaxWidth: CGFloat = 340

        guard totalWidth < DemoLayout.explorerSplitBreakpoint else {
            return (treeMinWidth, treeIdealWidth, treeMaxWidth)
        }

        let scale = max(0.55, totalWidth / DemoLayout.explorerSplitBreakpoint)
        return (
            treeMinWidth * scale,
            treeIdealWidth * scale,
            treeMaxWidth * scale
        )
    }

    private func resolvedPreviewMinWidth(for totalWidth: CGFloat) -> CGFloat {
        if totalWidth >= DemoLayout.explorerSplitBreakpoint {
            return DemoLayout.explorerPreviewMinWidth
        }
        return max(DemoLayout.explorerPreviewMinWidthCompact, totalWidth * 0.42)
    }

    private var treePane: some View {
        HudFileTree(
            browser: model.browser,
            openDocumentURLs: model.openDocumentURLs,
            activeDocumentURL: model.openDocumentURL
        ) { entry in
            model.open(entry)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var previewPane: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !model.tabs.isEmpty {
                HudFileExplorerTabBar(
                    tabs: model.tabs,
                    activeTabID: model.activeTabID,
                    onSelect: { model.selectTab(id: $0) },
                    onPin: { model.pinTab(id: $0) },
                    onClose: { model.closeTab(id: $0) }
                )
                HudDivider()
            }

            if let loadError = model.loadError {
                HudBadge(loadError, tint: HudPalette.statusWarn)
                    .padding(.horizontal, HudSpacing.lg)
                    .padding(.vertical, HudSpacing.sm)
            }

            HudCodeMirror(
                document: model.document,
                documentRevision: model.documentRevision,
                mode: $model.documentMode,
                emptyStateTitle: "No file selected",
                emptyStateSubtitle: "Choose a file from the file tree. Use arrow keys to move, Return to open.",
                emptyStateIcon: "doc.text.magnifyingglass",
                tintHex: "#5eead4",
                onChange: { model.updateActiveDocumentText($0) },
                onSave: { text in
                    guard let document = model.document else { return }
                    var updated = document
                    updated.value = text
                    if let onSave {
                        onSave(updated)
                    } else {
                        try? model.save(updated)
                    }
                }
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(HudSurface.base)
    }

}