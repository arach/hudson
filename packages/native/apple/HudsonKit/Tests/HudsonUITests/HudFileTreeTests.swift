import Foundation
import Testing
@testable import HudsonUI

@Suite("HudFileTreeBrowser")
struct HudFileTreeTests {

    @Test("directories sort before files")
    func directoriesSortBeforeFiles() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-file-tree-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        try "beta".write(to: root.appendingPathComponent("beta.txt"), atomically: true, encoding: .utf8)
        try FileManager.default.createDirectory(
            at: root.appendingPathComponent("alpha", isDirectory: true),
            withIntermediateDirectories: true
        )

        let children = HudFileTreeFilesystem.loadChildren(
            of: root,
            showsHiddenFiles: false,
            skippedDirectoryNames: []
        )

        #expect(children.count == 2)
        #expect(children[0].name == "alpha")
        #expect(children[0].isDirectory)
        #expect(children[1].name == "beta.txt")
        #expect(!children[1].isDirectory)
    }

    @Test("hidden files are skipped by default")
    func hiddenFilesSkippedByDefault() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-file-tree-hidden-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        try "secret".write(to: root.appendingPathComponent(".env"), atomically: true, encoding: .utf8)
        try "visible".write(to: root.appendingPathComponent("README.md"), atomically: true, encoding: .utf8)

        let children = HudFileTreeFilesystem.loadChildren(
            of: root,
            showsHiddenFiles: false,
            skippedDirectoryNames: []
        )

        #expect(children.count == 1)
        #expect(children[0].name == "README.md")
    }

    @Test("swift files use the swift symbol")
    func swiftSymbolName() {
        #expect(HudFileTreeFilesystem.symbolName(forFileName: "HudFileTree.swift") == "swift")
        #expect(HudFileTreeFilesystem.symbolName(forFileName: "notes.md") == "text.book.closed")
    }

    @MainActor
    @Test("visible entries follow expansion state")
    func visibleEntriesRespectExpansion() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-file-tree-visible-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let folder = root.appendingPathComponent("folder", isDirectory: true)
        let nested = folder.appendingPathComponent("nested", isDirectory: true)
        try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
        try "one".write(to: root.appendingPathComponent("one.txt"), atomically: true, encoding: .utf8)
        try "two".write(to: folder.appendingPathComponent("two.txt"), atomically: true, encoding: .utf8)

        let browser = HudFileTreeBrowser(rootURL: root)
        #expect(browser.visibleEntries().map(\.name) == ["folder", "one.txt"])

        browser.setExpanded(folder, expanded: true)
        #expect(browser.visibleEntries().map(\.name) == ["folder", "nested", "two.txt", "one.txt"])
    }

    @MainActor
    @Test("keyboard navigation moves selection through visible rows")
    func keyboardNavigationMovesSelection() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-file-tree-nav-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        try "alpha".write(to: root.appendingPathComponent("alpha.txt"), atomically: true, encoding: .utf8)
        try "beta".write(to: root.appendingPathComponent("beta.txt"), atomically: true, encoding: .utf8)

        let browser = HudFileTreeBrowser(rootURL: root)
        browser.selection = browser.visibleEntries().first?.url

        browser.moveFocus(.down)
        #expect(browser.entry(for: browser.selection!)?.name == "beta.txt")

        browser.moveFocus(.up)
        #expect(browser.entry(for: browser.selection!)?.name == "alpha.txt")
    }

    @MainActor
    @Test("reveal expands ancestors and selects the target file")
    func revealExpandsAncestors() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-file-tree-reveal-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let folder = root.appendingPathComponent("folder", isDirectory: true)
        let nested = folder.appendingPathComponent("nested", isDirectory: true)
        try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
        let file = nested.appendingPathComponent("leaf.swift")
        try "let x = 1".write(to: file, atomically: true, encoding: .utf8)

        let browser = HudFileTreeBrowser(rootURL: root)
        browser.reveal(file)

        #expect(browser.isExpanded(folder))
        #expect(browser.isExpanded(nested))
        #expect(browser.selection == file.standardizedFileURL)
    }

    @MainActor
    @Test("browser tracks expanded folders")
    func browserExpandedState() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-file-tree-expand-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let child = root.appendingPathComponent("child", isDirectory: true)
        try FileManager.default.createDirectory(at: child, withIntermediateDirectories: true)

        let browser = HudFileTreeBrowser(rootURL: root)
        #expect(!browser.isExpanded(child))
        browser.setExpanded(child, expanded: true)
        #expect(browser.isExpanded(child))
        browser.setExpanded(child, expanded: false)
        #expect(!browser.isExpanded(child))
    }
}