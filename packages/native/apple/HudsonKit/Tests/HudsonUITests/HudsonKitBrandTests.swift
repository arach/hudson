import SwiftUI
import XCTest
@testable import HudsonUI

final class HudsonKitBrandTests: XCTestCase {
    func testMarkPreservesCanonicalPanelsAndNegativeSpace() {
        let path = HudsonKitMark().path(in: CGRect(x: 0, y: 0, width: 64, height: 64))

        XCTAssertEqual(path.boundingRect, CGRect(x: 0, y: 0, width: 64, height: 64))
        XCTAssertTrue(path.contains(CGPoint(x: 8, y: 8)))
        XCTAssertTrue(path.contains(CGPoint(x: 56, y: 56)))
        XCTAssertFalse(path.contains(CGPoint(x: 21, y: 26)))
        XCTAssertFalse(path.contains(CGPoint(x: 43, y: 38)))
        XCTAssertFalse(path.contains(CGPoint(x: 32, y: 32)))
    }
}
