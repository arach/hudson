import Foundation
import Testing
@testable import HudsonVoice

@Suite("HudPendingUtteranceStore")
struct HudPendingUtterancesTests {
    private func makeStore() -> (HudPendingUtteranceStore, URL) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("hudson-pending-\(UUID().uuidString)", isDirectory: true)
        return (HudPendingUtteranceStore(directory: directory), directory)
    }

    private func makeRecording(_ contents: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("capture-\(UUID().uuidString)")
            .appendingPathExtension("caf")
        try Data(contents.utf8).write(to: url)
        return url
    }

    @Test("held audio survives, and the original is not left behind")
    func adoptMovesTheRecording() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        let recording = try makeRecording("one")
        let held = try store.adopt(recording)

        #expect(FileManager.default.fileExists(atPath: held.path))
        #expect(!FileManager.default.fileExists(atPath: recording.path))
        #expect(store.count == 1)
        #expect(try Data(contentsOf: held) == Data("one".utf8))
    }

    @Test("replays utterances in the order they were spoken")
    func pendingIsChronological() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        let base = Date(timeIntervalSince1970: 1_700_000_000)
        // Adopted out of order on purpose: capture time, not arrival, defines order.
        try store.adopt(makeRecording("second"), capturedAt: base.addingTimeInterval(1))
        try store.adopt(makeRecording("third"), capturedAt: base.addingTimeInterval(2))
        try store.adopt(makeRecording("first"), capturedAt: base)

        let spoken = try store.pending().map { try String(decoding: Data(contentsOf: $0.url), as: UTF8.self) }
        #expect(spoken == ["first", "second", "third"])
    }

    @Test("sub-second captures still sort correctly")
    func pendingOrdersWithinTheSameSecond() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        let base = Date(timeIntervalSince1970: 1_700_000_000)
        try store.adopt(makeRecording("b"), capturedAt: base.addingTimeInterval(0.500))
        try store.adopt(makeRecording("a"), capturedAt: base.addingTimeInterval(0.125))
        try store.adopt(makeRecording("c"), capturedAt: base.addingTimeInterval(0.875))

        let spoken = try store.pending().map { try String(decoding: Data(contentsOf: $0.url), as: UTF8.self) }
        #expect(spoken == ["a", "b", "c"])
    }

    @Test("a new store sees what a previous one held")
    func heldAudioOutlivesTheStore() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        try store.adopt(makeRecording("survivor"))

        let relaunched = HudPendingUtteranceStore(directory: directory)
        #expect(relaunched.count == 1)
    }

    @Test("discard retires exactly one utterance")
    func discardRemovesOnlyItsOwn() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        let base = Date(timeIntervalSince1970: 1_700_000_000)
        try store.adopt(makeRecording("keep"), capturedAt: base.addingTimeInterval(1))
        let first = try store.adopt(makeRecording("drop"), capturedAt: base)

        store.discard(first)

        let remaining = try store.pending().map { try String(decoding: Data(contentsOf: $0.url), as: UTF8.self) }
        #expect(remaining == ["keep"])
    }

    @Test("capture context survives with the audio")
    func contextRoundTrips() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        let base = Date(timeIntervalSince1970: 1_700_000_000)
        try store.adopt(makeRecording("one"), capturedAt: base, context: "lane:3")
        try store.adopt(makeRecording("two"), capturedAt: base.addingTimeInterval(1), context: nil)

        let held = store.pending()
        #expect(held.map(\.context) == ["lane:3", nil])
    }

    @Test("a context that cannot survive a filename is dropped, not mangled")
    func contextIsSanitized() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        try store.adopt(makeRecording("one"), context: "lane/3 ~ with spaces")
        // Separator, slash and spaces are stripped; what remains still parses.
        #expect(store.pending().first?.context == "lane3withspaces")
    }

    @Test("context never breaks capture ordering")
    func contextDoesNotDisturbOrder() throws {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        let base = Date(timeIntervalSince1970: 1_700_000_000)
        try store.adopt(makeRecording("first"), capturedAt: base, context: "zzz")
        try store.adopt(makeRecording("second"), capturedAt: base.addingTimeInterval(1), context: "aaa")

        let spoken = try store.pending().map { try String(decoding: Data(contentsOf: $0.url), as: UTF8.self) }
        #expect(spoken == ["first", "second"])
    }

    @Test("an empty store reports nothing pending")
    func emptyStoreIsQuiet() {
        let (store, directory) = makeStore()
        defer { try? FileManager.default.removeItem(at: directory) }

        #expect(store.pending().isEmpty)
        #expect(store.count == 0)
    }
}
