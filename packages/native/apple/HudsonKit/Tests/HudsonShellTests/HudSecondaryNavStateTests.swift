import CoreGraphics
import XCTest
@testable import HudsonShell

@MainActor
final class HudSecondaryNavStateTests: XCTestCase {
    func testSetColumnWidthDoesNotRecurseOnRepeatedAssign() {
        let state = HudSecondaryNavState(storageKey: "test.secondaryNav.\(UUID().uuidString)")

        for width in stride(from: CGFloat(140), through: CGFloat(360), by: 1) {
            state.setColumnWidth(width)
        }

        XCTAssertEqual(state.columnWidth, 360)
    }

    func testSetColumnWidthIgnoresNonFiniteInput() {
        let state = HudSecondaryNavState(
            storageKey: "test.secondaryNav.\(UUID().uuidString)",
            columnWidth: 200
        )

        state.setColumnWidth(.nan)
        XCTAssertEqual(state.columnWidth, 200)

        state.setColumnWidth(.infinity)
        XCTAssertEqual(state.columnWidth, 200)
    }

    func testSetColumnWidthClampsToBounds() {
        let state = HudSecondaryNavState(storageKey: "test.secondaryNav.\(UUID().uuidString)")

        state.setColumnWidth(40)
        XCTAssertEqual(state.columnWidth, HudSecondaryNavLayout.minExpandedWidth)

        state.setColumnWidth(900)
        XCTAssertEqual(state.columnWidth, HudSecondaryNavLayout.maxExpandedWidth)
    }
}