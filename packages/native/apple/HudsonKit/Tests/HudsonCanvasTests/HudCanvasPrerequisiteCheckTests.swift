import XCTest
@testable import HudsonCanvas

final class HudCanvasPrerequisiteCheckTests: XCTestCase {
    func testPrerequisiteStatusLabelsAreStable() {
        XCTAssertEqual(
            HudCanvasPrerequisiteStatus.allCases.map(\.label),
            ["READY", "MISSING", "PERMISSION", "RUNNING", "FAILED"]
        )
    }

    func testOnlyRunningPrerequisiteStatusPulses() {
        XCTAssertEqual(
            HudCanvasPrerequisiteStatus.allCases.filter(\.pulses),
            [.running]
        )
    }
}
