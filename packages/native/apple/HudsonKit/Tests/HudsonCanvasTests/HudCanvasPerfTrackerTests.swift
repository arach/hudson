import XCTest
@testable import HudsonCanvas

final class HudCanvasPerfTrackerTests: XCTestCase {
    func testCountersIncrementNamedEvents() {
        var tracker = HudCanvasPerfTracker()

        tracker.increment("control.command")
        tracker.increment("control.command", by: 4)
        tracker.increment("surface.frame")

        let snapshot = tracker.snapshot(capturedAt: Date(timeIntervalSince1970: 10))

        XCTAssertEqual(snapshot.counters["control.command"], 5)
        XCTAssertEqual(snapshot.counters["surface.frame"], 1)
        XCTAssertEqual(snapshot.counters["missing"], 0)
        XCTAssertEqual(tracker.counter("control.command"), 5)
    }

    func testTimingSamplesAreRecordedInOrder() {
        var tracker = HudCanvasPerfTracker()
        let firstDate = Date(timeIntervalSince1970: 100)
        let secondDate = Date(timeIntervalSince1970: 101)

        let first = tracker.recordTiming(
            "restore",
            durationMS: 2.5,
            recordedAt: firstDate
        )
        let second = tracker.recordTiming(
            "restore",
            durationMS: 5.25,
            recordedAt: secondDate
        )

        XCTAssertEqual(first.durationMS, 2.5)
        XCTAssertEqual(second.durationMS, 5.25)
        XCTAssertEqual(
            tracker.samples(named: "restore").map(\.durationMS),
            [2.5, 5.25]
        )
        XCTAssertEqual(
            tracker.snapshot(capturedAt: Date(timeIntervalSince1970: 110)).timingSamples.map(\.recordedAt),
            [firstDate, secondDate]
        )
    }

    func testResetClearsCountersAndTimingSamples() {
        var tracker = HudCanvasPerfTracker()
        tracker.increment("control.command")
        tracker.recordTiming("status", durationMS: 1.25)

        XCTAssertFalse(tracker.isEmpty)

        tracker.reset()

        let snapshot = tracker.snapshot(capturedAt: Date(timeIntervalSince1970: 20))
        XCTAssertTrue(tracker.isEmpty)
        XCTAssertTrue(snapshot.counters.isEmpty)
        XCTAssertTrue(snapshot.timingSamples.isEmpty)
        XCTAssertEqual(snapshot.counters["control.command"], 0)
    }

    func testSetStoresCounterGaugeValues() {
        var tracker = HudCanvasPerfTracker()

        tracker.increment("surface.nodeCount", by: 9)
        tracker.set("surface.nodeCount", to: 3)

        XCTAssertEqual(tracker.counter("surface.nodeCount"), 3)
    }

    func testTimingSamplesAreCappedToLatestSamples() {
        var tracker = HudCanvasPerfTracker(timingSampleLimit: 2)

        tracker.recordTiming("first", durationMS: 1)
        tracker.recordTiming("second", durationMS: 2)
        tracker.recordTiming("third", durationMS: 3)

        XCTAssertEqual(
            tracker.snapshot().timingSamples.map(\.name),
            ["second", "third"]
        )
    }

    func testSnapshotEncodesAndDecodesPerfPayload() throws {
        var counters = HudCanvasPerfCounters()
        counters.increment("control.command", by: 2)
        counters.increment("surface.frame")

        let snapshot = HudCanvasPerfSnapshot(
            counters: counters,
            timingSamples: [
                HudCanvasPerfTimingSample(
                    name: "restore",
                    durationMS: 3.75,
                    recordedAt: Date(timeIntervalSince1970: 200)
                )
            ],
            capturedAt: Date(timeIntervalSince1970: 210)
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        XCTAssertEqual(object["schemaVersion"] as? Int, 1)

        let encodedCounters = try XCTUnwrap(object["counters"] as? [String: Any])
        XCTAssertEqual(encodedCounters["control.command"] as? Int, 2)
        XCTAssertEqual(encodedCounters["surface.frame"] as? Int, 1)

        let encodedSamples = try XCTUnwrap(object["timingSamples"] as? [[String: Any]])
        XCTAssertEqual(encodedSamples.first?["name"] as? String, "restore")
        XCTAssertEqual(encodedSamples.first?["durationMS"] as? Double, 3.75)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(HudCanvasPerfSnapshot.self, from: data)

        XCTAssertEqual(decoded.counters["control.command"], 2)
        XCTAssertEqual(decoded.counters["surface.frame"], 1)
        XCTAssertEqual(decoded.timingSamples.first?.name, "restore")
        XCTAssertEqual(decoded.timingSamples.first?.durationMS, 3.75)
        XCTAssertEqual(decoded.capturedAt, Date(timeIntervalSince1970: 210))
    }
}
