import XCTest
@testable import HudsonKitExperimental

final class HudsonKitExperimentalModuleTests: XCTestCase {
    func testModuleAnchorCompiles() {
        XCTAssertNotNil(HudsonKitExperimentalModule.self)
    }
}
