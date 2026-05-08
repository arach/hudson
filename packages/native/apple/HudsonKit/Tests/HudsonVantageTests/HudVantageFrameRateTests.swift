import XCTest
@testable import HudsonVantage

final class HudVantageFrameRateTests: XCTestCase {
    func testMeterWaitsForSampleIntervalBeforePublishing() {
        var meter = HudVantageFrameRateMeter(sampleInterval: 0.5)
        let start = Date(timeIntervalSince1970: 100)

        XCTAssertNil(meter.recordFrame(at: start))

        for frame in 1...10 {
            let date = start.addingTimeInterval(Double(frame) / 60)
            XCTAssertNil(meter.recordFrame(at: date))
        }
    }

    func testMeterPublishesSmoothedSixtyFPSAfterSampleInterval() throws {
        var meter = HudVantageFrameRateMeter(sampleInterval: 0.5)
        let start = Date(timeIntervalSince1970: 200)
        var sample: HudVantageFrameRateSample?

        XCTAssertNil(meter.recordFrame(at: start))

        for frame in 1...30 {
            let date = start.addingTimeInterval(Double(frame) / 60)
            sample = meter.recordFrame(at: date)
        }

        let published = try XCTUnwrap(sample)
        XCTAssertEqual(published.framesPerSecond, 60, accuracy: 0.5)
        XCTAssertEqual(published.averageFrameDurationMS, 16.67, accuracy: 0.25)
        XCTAssertEqual(published.sampledFrames, 30)
        XCTAssertEqual(published.roundedFramesPerSecond, 60)
    }

    func testMeterReportsSlowerCadence() throws {
        var meter = HudVantageFrameRateMeter(sampleInterval: 0.2)
        let start = Date(timeIntervalSince1970: 300)
        var sample: HudVantageFrameRateSample?

        XCTAssertNil(meter.recordFrame(at: start))

        for frame in 1...6 {
            let date = start.addingTimeInterval(Double(frame) / 30)
            sample = meter.recordFrame(at: date)
        }

        let published = try XCTUnwrap(sample)
        XCTAssertEqual(published.framesPerSecond, 30, accuracy: 0.5)
        XCTAssertEqual(published.averageFrameDurationMS, 33.33, accuracy: 0.25)
    }

    func testMeterIgnoresLongInactiveGaps() throws {
        var meter = HudVantageFrameRateMeter(
            sampleInterval: 0.5,
            maximumFrameDuration: 0.25
        )
        let start = Date(timeIntervalSince1970: 400)
        var sample: HudVantageFrameRateSample?

        XCTAssertNil(meter.recordFrame(at: start))
        XCTAssertNil(meter.recordFrame(at: start.addingTimeInterval(1.5)))

        let resumedAt = start.addingTimeInterval(1.5)
        for frame in 1...30 {
            let date = resumedAt.addingTimeInterval(Double(frame) / 60)
            sample = meter.recordFrame(at: date)
        }

        let published = try XCTUnwrap(sample)
        XCTAssertEqual(published.framesPerSecond, 60, accuracy: 0.5)
        XCTAssertLessThan(published.slowestFrameDurationMS, 20)
    }

    func testResetClearsPendingFrameHistory() {
        var meter = HudVantageFrameRateMeter(sampleInterval: 0.2)
        let start = Date(timeIntervalSince1970: 500)

        XCTAssertNil(meter.recordFrame(at: start))
        XCTAssertNil(meter.recordFrame(at: start.addingTimeInterval(1.0 / 60.0)))

        meter.reset()

        XCTAssertNil(meter.recordFrame(at: start.addingTimeInterval(0.5)))
        XCTAssertNil(meter.recordFrame(at: start.addingTimeInterval(0.51)))
    }
}
