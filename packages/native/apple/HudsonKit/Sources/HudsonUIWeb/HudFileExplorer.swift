import Foundation
import SwiftUI
import HudsonUI

// MARK: - Model

/// Filesystem-backed state for `HudFileExplorer`.
///
/// Owns the file tree browser, active document, and read/edit mode. Toolbar
/// chrome, root shortcuts, and save affordances stay in the host.
@MainActor
@Observable
public final class HudFileExplorerModel {
    public var browser: HudFileTreeBrowser
    public var document: HudTextDocument?
    public var documentMode: HudTextDocumentMode = .read
    public var loadError: String?

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
            document = nil
            loadError = nil
        }
        browser.setRoot(url)
    }

    public func open(_ entry: HudFileTreeEntry) {
        loadError = nil
        guard !entry.isDirectory else { return }

        do {
            let value = try String(contentsOf: entry.url, encoding: .utf8)
            document = HudTextDocumentDetector.makeDocument(
                id: entry.url.path,
                title: entry.name,
                uri: entry.url.path,
                value: value
            )
            if documentMode == .edit {
                documentMode = .read
            }
        } catch {
            loadError = "Cannot preview \(entry.name)"
            document = HudTextDocumentDetector.makeDocument(
                id: entry.url.path,
                title: entry.name,
                uri: entry.url.path,
                kind: .raw,
                value: "Binary or unsupported encoding.",
                isReadOnly: true
            )
        }
    }

    public func saveDocument() throws {
        guard let document else { return }
        try save(document)
    }

    public func save(_ doc: HudTextDocument) throws {
        guard let uri = doc.uri else { return }
        try doc.value.write(to: URL(fileURLWithPath: uri), atomically: true, encoding: .utf8)
        if self.document?.id == doc.id {
            self.document?.value = doc.value
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

/// Chromeless IDE layout: `HudFileTree` beside a code or markdown preview.
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
        HudFileTree(browser: model.browser) { entry in
            model.open(entry)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var previewPane: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let loadError = model.loadError {
                HudBadge(loadError, tint: HudPalette.statusWarn)
                    .padding(.horizontal, HudSpacing.lg)
                    .padding(.vertical, HudSpacing.sm)
            }

            if let document = model.document, document.kind == .markdown {
                HudTextDocumentSurface(
                    document: binding(for: document),
                    mode: $model.documentMode,
                    showHeader: false,
                    showsChrome: false,
                    onSave: onSave
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HudCodeMirror(
                    document: model.document,
                    mode: $model.documentMode,
                    emptyStateTitle: emptyStateTitle,
                    emptyStateSubtitle: emptyStateSubtitle,
                    emptyStateIcon: emptyStateIcon,
                    tintHex: codeTintHex,
                    onChange: { model.document?.value = $0 },
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
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(HudSurface.base)
    }

    private func binding(for document: HudTextDocument) -> Binding<HudTextDocument> {
        Binding(
            get: { model.document ?? document },
            set: { model.document = $0 }
        )
    }
}