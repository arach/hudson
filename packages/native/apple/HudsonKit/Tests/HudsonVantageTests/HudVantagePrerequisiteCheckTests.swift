import XCTest
@testable import HudsonVantage

final class HudVantagePrerequisiteCheckTests: XCTestCase {
    func testPrerequisiteStatusLabelsAreStable() {
        XCTAssertEqual(
            HudVantagePrerequisiteStatus.allCases.map(\.label),
            ["READY", "MISSING", "PERMISSION", "RUNNING", "FAILED"]
        )
    }

    func testOnlyRunningPrerequisiteStatusPulses() {
        XCTAssertEqual(
            HudVantagePrerequisiteStatus.allCases.filter(\.pulses),
            [.running]
        )
    }
}
