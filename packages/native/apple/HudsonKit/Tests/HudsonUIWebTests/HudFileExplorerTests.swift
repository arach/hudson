import Foundation
import Testing
@testable import HudsonUI
@testable import HudsonUIWeb

@Suite("HudFileExplorerModel")
struct HudFileExplorerTests {

    @MainActor
    @Test("opening a file creates a tab and re-opening focuses it")
    func tabsReuseOpenFiles() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-explorer-tabs-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let fileURL = root.appendingPathComponent("alpha.swift")
        try "let a = 1".write(to: fileURL, atomically: true, encoding: .utf8)

        let model = HudFileExplorerModel(rootURL: root)
        let entry = HudFileTreeEntry(url: fileURL, name: "alpha.swift", isDirectory: false)

        model.open(entry)
        #expect(model.tabs.count == 1)
        #expect(model.activeTabID == fileURL.path)
        #expect(model.document?.title == "alpha.swift")

        model.open(entry)
        #expect(model.tabs.count == 1)
        #expect(model.activeTabID == fileURL.path)
    }

    @MainActor
    @Test("preview tab cycles until pinned")
    func previewTabCyclesUntilPinned() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-explorer-preview-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let first = root.appendingPathComponent("one.swift")
        let second = root.appendingPathComponent("two.swift")
        let third = root.appendingPathComponent("three.swift")
        try "1".write(to: first, atomically: true, encoding: .utf8)
        try "2".write(to: second, atomically: true, encoding: .utf8)
        try "3".write(to: third, atomically: true, encoding: .utf8)

        let model = HudFileExplorerModel(rootURL: root)
        model.open(HudFileTreeEntry(url: first, name: "one.swift", isDirectory: false))
        model.open(HudFileTreeEntry(url: second, name: "two.swift", isDirectory: false))

        #expect(model.tabs.count == 1)
        #expect(model.activeTabID == second.path)
        #expect(model.tabs[0].isPinned == false)

        model.pinTab(id: second.path)
        model.open(HudFileTreeEntry(url: third, name: "three.swift", isDirectory: false))

        #expect(model.tabs.count == 2)
        #expect(model.activeTabID == third.path)
        #expect(model.tabs.contains(where: { $0.id == second.path && $0.isPinned }))
    }

    @MainActor
    @Test("editing pins the active preview tab")
    func editingPinsPreviewTab() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-explorer-edit-pin-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let fileURL = root.appendingPathComponent("alpha.swift")
        try "let a = 1".write(to: fileURL, atomically: true, encoding: .utf8)

        let model = HudFileExplorerModel(rootURL: root)
        model.open(HudFileTreeEntry(url: fileURL, name: "alpha.swift", isDirectory: false))
        #expect(model.tabs[0].isPinned == false)

        model.updateActiveDocumentText("let a = 2")
        #expect(model.tabs[0].isPinned == true)
    }

    @MainActor
    @Test("closing the active tab selects a neighbor")
    func closeTabSelectsNeighbor() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-explorer-close-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let first = root.appendingPathComponent("one.swift")
        let second = root.appendingPathComponent("two.swift")
        try "1".write(to: first, atomically: true, encoding: .utf8)
        try "2".write(to: second, atomically: true, encoding: .utf8)

        let model = HudFileExplorerModel(rootURL: root)
        model.open(HudFileTreeEntry(url: first, name: "one.swift", isDirectory: false))
        model.pinTab(id: first.path)
        model.open(HudFileTreeEntry(url: second, name: "two.swift", isDirectory: false))
        #expect(model.activeTabID == second.path)

        model.closeTab(id: second.path)
        #expect(model.tabs.count == 1)
        #expect(model.activeTabID == first.path)
    }
}