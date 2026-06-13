import SwiftUI
import HudsonUI
import HudsonUIWeb

struct ExplorerTab: View {
    @Bindable var model: HudFileExplorerModel
    @State private var contentWidth: CGFloat = DemoLayout.explorerToolbarCompactBreakpoint

    var shellCompact: Bool = false

    private var toolbarCompact: Bool {
        shellCompact || contentWidth < DemoLayout.explorerToolbarCompactBreakpoint
    }

    var body: some View {
        VStack(spacing: 0) {
            explorerToolbar
            HudDivider()

            DemoResponsiveFileExplorer(model: model) { doc in
                do {
                    try model.save(doc)
                } catch {
                    model.loadError = "Cannot save \(doc.title)"
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            GeometryReader { geometry in
                Color.clear
                    .preference(key: ExplorerContentWidthKey.self, value: geometry.size.width)
            }
        }
        .onPreferenceChange(ExplorerContentWidthKey.self) { contentWidth = $0 }
    }

    private var explorerToolbar: some View {
        HStack(spacing: HudSpacing.lg) {
            HudSectionLabel("Explorer", tint: HudPalette.statusInfo)

            if !toolbarCompact {
                HStack(spacing: HudSpacing.xs) {
                    rootButton("Hudson", icon: "folder", root: DemoResources.repositoryRoot)
                    rootButton("HudsonKit", icon: "folder.fill", root: DemoResources.kitRoot)
                    rootButton("HudsonUI", icon: "square.stack.3d.up", root: DemoResources.hudsonUIRoot)
                }
            } else {
                rootMenu
            }

            Spacer(minLength: HudSpacing.md)

            if !toolbarCompact {
                Text(model.browser.rootURL.path)
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.dim)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            HudButton("Refresh", icon: "arrow.clockwise", style: .ghost) {
                model.browser.refresh()
            }
        }
        .padding(.horizontal, toolbarCompact ? HudSpacing.lg : HudSpacing.xxl)
        .padding(.vertical, HudSpacing.lg)
    }

    private var rootMenu: some View {
        Menu {
            rootMenuItem("Hudson", root: DemoResources.repositoryRoot)
            rootMenuItem("HudsonKit", root: DemoResources.kitRoot)
            rootMenuItem("HudsonUI", root: DemoResources.hudsonUIRoot)
        } label: {
            Image(systemName: "folder")
                .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                .foregroundStyle(HudPalette.muted)
                .frame(width: HudLayout.rowHeightCompact, height: HudLayout.rowHeightCompact)
                .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .help(model.browser.rootURL.path)
    }

    private func rootMenuItem(_ title: String, root: URL) -> some View {
        let isActive = model.browser.rootURL.standardizedFileURL == root.standardizedFileURL
        return Button {
            model.setRoot(root)
        } label: {
            if isActive {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }

    private func rootButton(_ title: String, icon: String, root: URL) -> some View {
        let isActive = model.browser.rootURL.standardizedFileURL == root.standardizedFileURL
        return HudButton(title, icon: icon, style: isActive ? .secondary : .ghost) {
            model.setRoot(root)
        }
    }

}

private struct ExplorerContentWidthKey: PreferenceKey {
    static let defaultValue: CGFloat = DemoLayout.explorerToolbarCompactBreakpoint

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}