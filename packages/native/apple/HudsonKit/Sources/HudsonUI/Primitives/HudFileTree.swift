import Foundation
import SwiftUI

// MARK: - Entry model

/// Lightweight filesystem entry used by `HudFileTreeBrowser` and `HudFileTree`.
public struct HudFileTreeEntry: Identifiable, Hashable, Sendable {
    public let url: URL
    public let name: String
    public let isDirectory: Bool

    public var id: URL { url }

    public init(url: URL, name: String, isDirectory: Bool) {
        self.url = url
        self.name = name
        self.isDirectory = isDirectory
    }
}

// MARK: - Filesystem helpers

public enum HudFileTreeFilesystem {
    public static let defaultSkippedDirectoryNames: Set<String> = [
        ".build",
        ".git",
        ".swiftpm",
        "DerivedData",
        "node_modules",
    ]

    public static func loadChildren(
        of directoryURL: URL,
        showsHiddenFiles: Bool,
        skippedDirectoryNames: Set<String>
    ) -> [HudFileTreeEntry] {
        let keys: [URLResourceKey] = [.isDirectoryKey, .isHiddenKey]
        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: directoryURL,
            includingPropertiesForKeys: keys,
            options: [.skipsSubdirectoryDescendants, .skipsPackageDescendants]
        ) else {
            return []
        }

        var directories: [HudFileTreeEntry] = []
        var files: [HudFileTreeEntry] = []

        for url in urls {
            let values = try? url.resourceValues(forKeys: Set(keys))
            let isHidden = values?.isHidden ?? false
            if !showsHiddenFiles, isHidden || url.lastPathComponent.hasPrefix(".") {
                continue
            }

            let isDirectory = values?.isDirectory ?? false
            let name = url.lastPathComponent
            if isDirectory, skippedDirectoryNames.contains(name) {
                continue
            }

            let entry = HudFileTreeEntry(url: url, name: name, isDirectory: isDirectory)
            if isDirectory {
                directories.append(entry)
            } else {
                files.append(entry)
            }
        }

        let sort: (HudFileTreeEntry, HudFileTreeEntry) -> Bool = { lhs, rhs in
            lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
        return directories.sorted(by: sort) + files.sorted(by: sort)
    }

    public static func symbolName(forFileName name: String) -> String {
        let ext = (name as NSString).pathExtension.lowercased()
        switch ext {
        case "swift": return "swift"
        case "md", "markdown", "mdx": return "text.book.closed"
        case "json", "jsonc": return "curlybraces"
        case "yaml", "yml", "toml": return "doc.text"
        case "png", "jpg", "jpeg", "gif", "webp", "svg", "heic": return "photo"
        case "ts", "tsx", "js", "jsx", "mjs", "cjs": return "chevron.left.forwardslash.chevron.right"
        case "sh", "bash", "zsh": return "terminal"
        case "plist": return "gear"
        default: return "doc.text"
        }
    }
}

// MARK: - Browser

/// Loads and caches filesystem state for `HudFileTree`.
@MainActor
@Observable
public final class HudFileTreeBrowser {
    public var rootURL: URL
    public var selection: URL?
    public var showsHiddenFiles: Bool
    public var skippedDirectoryNames: Set<String>

    private var childrenByParent: [URL: [HudFileTreeEntry]] = [:]
    private var expandedURLs: Set<URL> = []

    public init(
        rootURL: URL,
        selection: URL? = nil,
        showsHiddenFiles: Bool = false,
        skippedDirectoryNames: Set<String> = HudFileTreeFilesystem.defaultSkippedDirectoryNames
    ) {
        self.rootURL = rootURL.standardizedFileURL
        self.selection = selection
        self.showsHiddenFiles = showsHiddenFiles
        self.skippedDirectoryNames = skippedDirectoryNames
    }

    public func setRoot(_ url: URL, preservingSelection: Bool = false) {
        let normalized = url.standardizedFileURL
        guard normalized != rootURL else { return }
        rootURL = normalized
        childrenByParent.removeAll()
        expandedURLs.removeAll()
        if !preservingSelection {
            selection = nil
        } else if let selection, !selection.path.hasPrefix(normalized.path) {
            self.selection = nil
        }
        _ = children(for: normalized)
    }

    public func refresh() {
        childrenByParent.removeAll()
        _ = children(for: rootURL)
    }

    /// Expands ancestor folders and focuses keyboard selection on `url`.
    public func reveal(_ url: URL) {
        let target = url.standardizedFileURL
        var parent = target.deletingLastPathComponent().standardizedFileURL
        let root = rootURL.standardizedFileURL

        while parent.path.count >= root.path.count, parent.path.hasPrefix(root.path) {
            if parent != root {
                setExpanded(parent, expanded: true)
            }
            if parent == root { break }
            parent = parent.deletingLastPathComponent().standardizedFileURL
        }

        selection = target
    }

    public func isExpanded(_ url: URL) -> Bool {
        expandedURLs.contains(url.standardizedFileURL)
    }

    public func setExpanded(_ url: URL, expanded: Bool) {
        let normalized = url.standardizedFileURL
        if expanded {
            expandedURLs.insert(normalized)
            _ = children(for: normalized)
        } else {
            expandedURLs.remove(normalized)
        }
    }

    public func children(for parentURL: URL) -> [HudFileTreeEntry] {
        let parent = parentURL.standardizedFileURL
        if let cached = childrenByParent[parent] {
            return cached
        }

        let loaded = HudFileTreeFilesystem.loadChildren(
            of: parent,
            showsHiddenFiles: showsHiddenFiles,
            skippedDirectoryNames: skippedDirectoryNames
        )
        childrenByParent[parent] = loaded
        return loaded
    }

    public func symbolName(for entry: HudFileTreeEntry) -> String {
        if entry.isDirectory {
            return isExpanded(entry.url) ? "folder.fill" : "folder"
        }
        return HudFileTreeFilesystem.symbolName(forFileName: entry.name)
    }

    /// Depth-first list of rows currently rendered in the tree.
    public func visibleEntries() -> [HudFileTreeEntry] {
        var rows: [HudFileTreeEntry] = []
        appendVisibleEntries(from: rootURL, into: &rows)
        return rows
    }

    public func entry(for url: URL) -> HudFileTreeEntry? {
        visibleEntries().first { $0.url.standardizedFileURL == url.standardizedFileURL }
    }

    @discardableResult
    public func moveFocus(_ direction: HudFileTreeNavigation) -> HudFileTreeEntry? {
        let rows = visibleEntries()
        guard !rows.isEmpty else {
            selection = nil
            return nil
        }

        let currentIndex = selection.flatMap { selected in
            rows.firstIndex { $0.url.standardizedFileURL == selected.standardizedFileURL }
        }

        switch direction {
        case .down:
            let next = min((currentIndex ?? -1) + 1, rows.count - 1)
            selection = rows[next].url
        case .up:
            let previous = max((currentIndex ?? rows.count) - 1, 0)
            selection = rows[previous].url
        case .right:
            guard let currentIndex, rows.indices.contains(currentIndex) else {
                selection = rows[0].url
                break
            }
            let current = rows[currentIndex]
            if current.isDirectory {
                if !isExpanded(current.url) {
                    setExpanded(current.url, expanded: true)
                } else if currentIndex + 1 < rows.count {
                    selection = rows[currentIndex + 1].url
                }
            }
        case .left:
            guard let currentIndex, rows.indices.contains(currentIndex) else { break }
            let current = rows[currentIndex]
            if current.isDirectory, isExpanded(current.url) {
                setExpanded(current.url, expanded: false)
            } else if let parent = parentURL(of: current.url),
                      let parentEntry = entry(for: parent) {
                selection = parentEntry.url
            }
        case .home:
            selection = rows[0].url
        case .end:
            selection = rows[rows.count - 1].url
        }

        return selection.flatMap { entry(for: $0) }
    }

    @discardableResult
    public func activateSelection() -> HudFileTreeEntry? {
        guard let selection, let entry = entry(for: selection) else { return nil }
        if entry.isDirectory {
            setExpanded(entry.url, expanded: !isExpanded(entry.url))
        }
        return entry
    }

    @discardableResult
    public func applyTypeAhead(_ character: Character) -> HudFileTreeEntry? {
        let lower = String(character).lowercased()
        guard !lower.isEmpty else { return nil }

        let now = Date()
        if let deadline = typeAheadDeadline, now <= deadline,
           !typeAheadBuffer.isEmpty,
           let first = lower.first {
            typeAheadBuffer.append(first)
        } else {
            typeAheadBuffer = lower
        }
        typeAheadDeadline = now.addingTimeInterval(0.8)

        let rows = visibleEntries()
        let start = (selection.flatMap { selected in
            rows.firstIndex { $0.url.standardizedFileURL == selected.standardizedFileURL }
        } ?? -1) + 1

        let matches = rows.enumerated().filter { _, entry in
            entry.name.lowercased().hasPrefix(typeAheadBuffer)
        }

        if let match = matches.first(where: { $0.offset >= start }) ?? matches.first {
            selection = match.element.url
            return match.element
        }

        return nil
    }

    private var typeAheadBuffer = ""
    private var typeAheadDeadline: Date?

    private func parentURL(of url: URL) -> URL? {
        let parent = url.deletingLastPathComponent().standardizedFileURL
        let root = rootURL.standardizedFileURL
        guard parent.path.count >= root.path.count, parent.path.hasPrefix(root.path) else {
            return nil
        }
        return parent == root ? root : parent
    }

    private func appendVisibleEntries(from parentURL: URL, into rows: inout [HudFileTreeEntry]) {
        for entry in children(for: parentURL) {
            rows.append(entry)
            if entry.isDirectory, isExpanded(entry.url) {
                appendVisibleEntries(from: entry.url, into: &rows)
            }
        }
    }
}

public enum HudFileTreeNavigation: Sendable {
    case up
    case down
    case left
    case right
    case home
    case end
}

// MARK: - Tree view

/// Native keyboard-navigable file tree backed by `HudFileTreeBrowser`.
public struct HudFileTree: View {
    @Bindable private var browser: HudFileTreeBrowser
    private var openDocumentURLs: Set<URL>
    private var activeDocumentURL: URL?
    private var onSelect: ((HudFileTreeEntry) -> Void)?

    public init(
        browser: HudFileTreeBrowser,
        openDocumentURLs: Set<URL> = [],
        activeDocumentURL: URL? = nil,
        onSelect: ((HudFileTreeEntry) -> Void)? = nil
    ) {
        self.browser = browser
        self.openDocumentURLs = Set(openDocumentURLs.map(\.standardizedFileURL))
        self.activeDocumentURL = activeDocumentURL?.standardizedFileURL
        self.onSelect = onSelect
    }

    @FocusState private var isFocused: Bool

    public var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(browser.children(for: browser.rootURL)) { entry in
                        HudFileTreeNode(
                            browser: browser,
                            entry: entry,
                            depth: 0,
                            openDocumentURLs: openDocumentURLs,
                            activeDocumentURL: activeDocumentURL,
                            onSelect: onSelect
                        )
                    }
                }
                .padding(.vertical, HudSpacing.sm)
            }
            .background(HudSurface.base)
            .onChange(of: browser.selection) { _, selection in
                guard let selection else { return }
                withAnimation(.easeOut(duration: 0.12)) {
                    proxy.scrollTo(selection, anchor: .center)
                }
            }
        }
        .focusable(true)
        .focused($isFocused)
        .focusEffectDisabled()
        .onAppear {
            isFocused = true
            if browser.selection == nil, let first = browser.visibleEntries().first {
                browser.selection = first.url
            }
        }
        .onKeyPress(.upArrow) {
            browser.moveFocus(.up)
            return .handled
        }
        .onKeyPress(.downArrow) {
            browser.moveFocus(.down)
            return .handled
        }
        .onKeyPress(.leftArrow) {
            browser.moveFocus(.left)
            return .handled
        }
        .onKeyPress(.rightArrow) {
            browser.moveFocus(.right)
            return .handled
        }
        .onKeyPress(.home) {
            browser.moveFocus(.home)
            return .handled
        }
        .onKeyPress(.end) {
            browser.moveFocus(.end)
            return .handled
        }
        .onKeyPress(.return) {
            handleActivation()
            return .handled
        }
        .onKeyPress(.space) {
            handleActivation()
            return .handled
        }
        .onKeyPress { press in
            guard let character = press.characters.first,
                  character.isLetter || character.isNumber || character == "." || character == "_"
            else { return .ignored }

            if browser.applyTypeAhead(character) != nil {
                return .handled
            }
            return .ignored
        }
    }

    private func handleActivation() {
        guard let entry = browser.activateSelection() else { return }
        if !entry.isDirectory {
            onSelect?(entry)
        }
    }
}

private struct HudFileTreeNode: View {
    @Bindable var browser: HudFileTreeBrowser
    let entry: HudFileTreeEntry
    let depth: Int
    let openDocumentURLs: Set<URL>
    let activeDocumentURL: URL?
    var onSelect: ((HudFileTreeEntry) -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var normalizedURL: URL {
        entry.url.standardizedFileURL
    }

    private var isExpanded: Bool {
        browser.isExpanded(entry.url)
    }

    private var isSelected: Bool {
        browser.selection?.standardizedFileURL == normalizedURL
    }

    private var isOpenInEditor: Bool {
        guard !entry.isDirectory else { return false }
        return openDocumentURLs.contains(normalizedURL)
    }

    private var isActiveDocument: Bool {
        guard !entry.isDirectory, let activeDocumentURL else { return false }
        return activeDocumentURL == normalizedURL
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            row

            if entry.isDirectory, isExpanded {
                ForEach(browser.children(for: entry.url)) { child in
                    HudFileTreeNode(
                        browser: browser,
                        entry: child,
                        depth: depth + 1,
                        openDocumentURLs: openDocumentURLs,
                        activeDocumentURL: activeDocumentURL,
                        onSelect: onSelect
                    )
                }
            }
        }
    }

    private var row: some View {
        HStack(spacing: 0) {
            Spacer()
                .frame(width: HudFileTreeMetrics.depthInset(depth: depth))

            chevronSlot

            Button {
                browser.selection = entry.url.standardizedFileURL
                if entry.isDirectory {
                    toggleExpanded()
                } else {
                    onSelect?(entry)
                }
            } label: {
                HStack(spacing: HudFileTreeMetrics.iconToLabelGap) {
                    Image(systemName: browser.symbolName(for: entry))
                        .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                        .foregroundStyle(iconTint)
                        .frame(
                            width: HudFileTreeMetrics.iconSlot,
                            height: HudFileTreeMetrics.iconSlot,
                            alignment: .center
                        )

                    Text(entry.name)
                        .font(HudFont.ui(HudTextSize.sm, weight: rowWeight))
                        .foregroundStyle(labelTint)
                        .lineLimit(1)

                    Spacer(minLength: 0)
                }
                .padding(.leading, HudFileTreeMetrics.chevronToIconGap)
                .padding(.trailing, HudFileTreeMetrics.trailingPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: HudFileTreeMetrics.rowHeight)
                .background(rowBackground)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .id(entry.url)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isSelected)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isOpenInEditor)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isActiveDocument)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isExpanded)
        }
    }

    @ViewBuilder
    private var chevronSlot: some View {
        Group {
            if entry.isDirectory {
                Button {
                    toggleExpanded()
                } label: {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: HudFileTreeMetrics.chevronGlyphSize, weight: .semibold))
                        .foregroundStyle(HudPalette.dim)
                        .frame(
                            width: HudFileTreeMetrics.chevronSlotWidth,
                            height: HudFileTreeMetrics.rowHeight,
                            alignment: .center
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isExpanded ? "Collapse \(entry.name)" : "Expand \(entry.name)")
            } else {
                Color.clear
                    .frame(width: HudFileTreeMetrics.chevronSlotWidth, height: HudFileTreeMetrics.rowHeight)
            }
        }
    }

    private var rowBackground: some View {
        RoundedRectangle(cornerRadius: HudRadius.tight)
            .fill(backgroundFill)
            .padding(.horizontal, HudFileTreeMetrics.rowInset)
    }

    private var backgroundFill: Color {
        if isActiveDocument {
            return HudSurface.tintFill(HudPalette.statusInfo)
        }
        if isOpenInEditor {
            return HudSurface.tintFill(HudPalette.statusInfo).opacity(0.38)
        }
        if isSelected {
            return HudSurface.tintFill(HudPalette.statusInfo).opacity(0.18)
        }
        return .clear
    }

    private var rowWeight: Font.Weight {
        if isActiveDocument || isOpenInEditor {
            return .semibold
        }
        if isSelected {
            return .medium
        }
        return .regular
    }

    private var labelTint: Color {
        if isActiveDocument || isOpenInEditor {
            return HudPalette.ink
        }
        if isSelected {
            return HudPalette.ink.opacity(0.92)
        }
        return HudPalette.muted
    }

    private func toggleExpanded() {
        browser.setExpanded(entry.url, expanded: !isExpanded)
    }

    private var iconTint: Color {
        if isActiveDocument || isOpenInEditor {
            return HudPalette.statusInfo
        }
        if entry.isDirectory {
            return HudPalette.statusInfo.opacity(isSelected ? 1 : 0.82)
        }
        return HudPalette.muted
    }
}

private enum HudFileTreeMetrics {
    static let rowHeight: CGFloat = 22
    static let indentStep: CGFloat = 12
    static let leadingPadding: CGFloat = 6
    static let chevronSlotWidth: CGFloat = 16
    static let chevronGlyphSize: CGFloat = 9
    static let chevronToIconGap: CGFloat = 2
    static let iconSlot: CGFloat = 14
    static let iconToLabelGap: CGFloat = 6
    static let trailingPadding: CGFloat = 8
    static let rowInset: CGFloat = 4

    static func depthInset(depth: Int) -> CGFloat {
        leadingPadding + CGFloat(depth) * indentStep
    }
}