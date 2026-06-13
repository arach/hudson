import Foundation
import SwiftUI
import HudsonUI

// MARK: - Model

/// Filesystem-backed state for `HudFileExplorer`.
///
/// Owns the file tree browser, tabbed documents, and read/edit mode. Toolbar
/// chrome, root shortcuts, and save affordances stay in the host.
@MainActor
@Observable
public final class HudFileExplorerModel {
    public var browser: HudFileTreeBrowser
    public var tabs: [HudExplorerTab] = []
    public var activeTabID: String?
    public var documentMode: HudTextDocumentMode = .edit
    public var loadError: String?

    private var nextRevision: UInt64 = 0

    public var document: HudTextDocument? {
        activeTab?.document
    }

    public var documentRevision: UInt64 {
        activeTab?.revision ?? 0
    }

    public var openDocumentURL: URL? {
        activeTabID.map { URL(fileURLWithPath: $0) }
    }

    public var openDocumentURLs: Set<URL> {
        Set(tabs.map { URL(fileURLWithPath: $0.id).standardizedFileURL })
    }

    private var activeTab: HudExplorerTab? {
        guard let activeTabID else { return nil }
        return tabs.first { $0.id == activeTabID }
    }

    public init(
        rootURL: URL,
        showsHiddenFiles: Bool = false,
        skippedDirectoryNames: Set<String> = HudFileTreeFilesystem.defaultSkippedDirectoryNames
    ) {
        browser = HudFileTreeBrowser(
            rootURL: rootURL,
            showsHiddenFiles: showsHiddenFiles,
            skippedDirectoryNames: skippedDirectoryNames
        )
    }

    public func setRoot(_ url: URL, clearDocument: Bool = true) {
        if clearDocument {
            tabs.removeAll()
            activeTabID = nil
            loadError = nil
        }
        browser.setRoot(url)
    }

    public func open(_ entry: HudFileTreeEntry) {
        loadError = nil
        guard !entry.isDirectory else { return }

        browser.reveal(entry.url)

        if let existingID = tabs.first(where: { $0.id == entry.url.path })?.id {
            activeTabID = existingID
            return
        }

        nextRevision &+= 1
        let revision = nextRevision
        let document = loadDocument(from: entry)

        if let previewIndex = tabs.firstIndex(where: { !$0.isPinned }) {
            tabs[previewIndex] = HudExplorerTab(document: document, revision: revision)
            activeTabID = document.id
        } else {
            let tab = HudExplorerTab(document: document, revision: revision)
            tabs.append(tab)
            activeTabID = tab.id
        }
    }

    /// Pins a tab so tree navigation opens new files in a separate tab.
    public func pinTab(id: String) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        tabs[index].isPinned = true
    }

    private func loadDocument(from entry: HudFileTreeEntry) -> HudTextDocument {
        do {
            let value = try String(contentsOf: entry.url, encoding: .utf8)
            return HudTextDocumentDetector.makeDocument(
                id: entry.url.path,
                title: entry.name,
                uri: entry.url.path,
                value: value
            )
        } catch {
            loadError = "Cannot preview \(entry.name)"
            return HudTextDocumentDetector.makeDocument(
                id: entry.url.path,
                title: entry.name,
                uri: entry.url.path,
                kind: .raw,
                value: "Binary or unsupported encoding.",
                isReadOnly: true
            )
        }
    }

    public func selectTab(id: String) {
        guard tabs.contains(where: { $0.id == id }) else { return }
        activeTabID = id
        browser.reveal(URL(fileURLWithPath: id))
    }

    public func closeTab(id: String) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        tabs.remove(at: index)

        if activeTabID == id {
            if tabs.isEmpty {
                activeTabID = nil
            } else {
                let nextIndex = min(index, tabs.count - 1)
                activeTabID = tabs[nextIndex].id
                if let activeTabID {
                    browser.reveal(URL(fileURLWithPath: activeTabID))
                }
            }
        }
    }

    public func updateActiveDocumentText(_ text: String) {
        guard let activeTabID,
              let index = tabs.firstIndex(where: { $0.id == activeTabID })
        else { return }
        tabs[index].document.value = text
        tabs[index].isPinned = true
    }

    public func saveDocument() throws {
        guard let document else { return }
        try save(document)
    }

    public func save(_ doc: HudTextDocument) throws {
        guard let uri = doc.uri else { return }
        try doc.value.write(to: URL(fileURLWithPath: uri), atomically: true, encoding: .utf8)
        if let index = tabs.firstIndex(where: { $0.id == doc.id }) {
            tabs[index].document.value = doc.value
        }
        loadError = nil
    }

    public func relativePath(for uri: String, relativeTo root: URL? = nil) -> String {
        let rootPath = (root ?? browser.rootURL).path
        if uri.hasPrefix(rootPath + "/") {
            return String(uri.dropFirst(rootPath.count + 1))
        }
        if uri.hasPrefix(rootPath) {
            return String(uri.dropFirst(rootPath.count))
        }
        return uri
    }
}

// MARK: - Explorer

/// Chromeless IDE layout: `HudFileTree` beside a CodeMirror editor.
///
/// The tree and editor panes ship without cards, headers, or window decoration.
/// Mount toolbar, breadcrumbs, and file actions above this view in the host.
public struct HudFileExplorer: View {
    @Bindable private var model: HudFileExplorerModel

    private var emptyStateTitle: String
    private var emptyStateSubtitle: String
    private var emptyStateIcon: String
    private var treeMinWidth: CGFloat
    private var treeIdealWidth: CGFloat
    private var treeMaxWidth: CGFloat
    private var codeTintHex: String
    private var onSave: ((HudTextDocument) -> Void)?

    public init(
        model: HudFileExplorerModel,
        emptyStateTitle: String = "No file selected",
        emptyStateSubtitle: String = "Choose a file from the file tree. Use arrow keys to move, Return to open.",
        emptyStateIcon: String = "doc.text.magnifyingglass",
        treeMinWidth: CGFloat = 240,
        treeIdealWidth: CGFloat = 280,
        treeMaxWidth: CGFloat = 340,
        codeTintHex: String = "#5eead4",
        onSave: ((HudTextDocument) -> Void)? = nil
    ) {
        self.model = model
        self.emptyStateTitle = emptyStateTitle
        self.emptyStateSubtitle = emptyStateSubtitle
        self.emptyStateIcon = emptyStateIcon
        self.treeMinWidth = treeMinWidth
        self.treeIdealWidth = treeIdealWidth
        self.treeMaxWidth = treeMaxWidth
        self.codeTintHex = codeTintHex
        self.onSave = onSave
    }

    public var body: some View {
        #if os(macOS)
        HSplitView {
            treePane
                .frame(minWidth: treeMinWidth, idealWidth: treeIdealWidth, maxWidth: treeMaxWidth)
            previewPane
                .frame(minWidth: 420, maxHeight: .infinity)
                .layoutPriority(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        #else
        VStack(spacing: 0) {
            treePane
                .frame(maxHeight: 240)
            HudDivider()
            previewPane
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        #endif
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

            editorSurface
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(HudSurface.base)
    }

    private var editorSurface: some View {
        HudCodeMirror(
            document: model.document,
            documentRevision: model.documentRevision,
            mode: $model.documentMode,
            emptyStateTitle: emptyStateTitle,
            emptyStateSubtitle: emptyStateSubtitle,
            emptyStateIcon: emptyStateIcon,
            tintHex: codeTintHex,
            onChange: { model.updateActiveDocumentText($0) },
            onSave: { text in
                guard let document = model.document else { return }
                var updated = document
                updated.value = text
                if let onSave {
                    onSave(updated)
                } else {
                    try model.save(updated)
                }
            }
        )
    }
}