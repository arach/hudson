import Foundation
import Testing
@testable import HudsonLive

@Suite("HudLive")
struct HudLiveTests {
    @Test("event cursor defaults to id")
    func eventCursorDefaultsToID() {
        let event = HudLiveEvent(
            id: "codex:abc:10",
            sourceID: "scout.tail.codex",
            kind: "assistant",
            summary: "thinking"
        )

        #expect(event.cursor == "codex:abc:10")
    }

    @Test("source descriptor records received events")
    func descriptorReceivingEvent() {
        let source = HudLiveSourceDescriptor(
            id: "vantage.diff.packages",
            label: "Packages Diff",
            kind: "diff",
            status: .connecting
        )
        let timestamp = Date(timeIntervalSince1970: 42)
        let event = HudLiveEvent(
            id: "file:packages:42",
            sourceID: source.id,
            timestamp: timestamp,
            kind: "file.changed",
            summary: "packages diff updated"
        )

        let updated = source.receiving(event)

        #expect(updated.status == .live)
        #expect(updated.cursor == event.cursor)
        #expect(updated.lastEventAt == timestamp)
        #expect(updated.lastEventSummary == "packages diff updated")
    }

    @Test("status groups receiving and attention states")
    func statusGroups() {
        #expect(HudLiveStatus.connecting.isReceiving)
        #expect(HudLiveStatus.replaying.isReceiving)
        #expect(HudLiveStatus.live.isReceiving)
        #expect(!HudLiveStatus.paused.isReceiving)

        #expect(HudLiveStatus.stale.requiresAttention)
        #expect(HudLiveStatus.error.requiresAttention)
        #expect(HudLiveStatus.offline.requiresAttention)
        #expect(!HudLiveStatus.live.requiresAttention)
    }
}
