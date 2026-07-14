import XCTest
@testable import HudsonTerminal

final class HudTerminalInputTranslatorTests: XCTestCase {
    func testNormalizesNewlinesToCarriageReturns() {
        let resolved = HudTerminalInputTranslator.resolvedInput(
            for: "one\ntwo\r\n",
            controlModifierState: .inactive
        )

        XCTAssertEqual(resolved?.payload, "one\rtwo\r")
    }

    func testControlModifierProducesTerminalControlCode() {
        let resolved = HudTerminalInputTranslator.resolvedInput(
            for: "c",
            controlModifierState: .armed
        )

        XCTAssertEqual(resolved?.payload, "\u{03}")
        XCTAssertEqual(resolved?.consumedControl, true)
    }

    func testShiftThenControlUsesUppercaseControlMapping() {
        let resolved = HudTerminalInputTranslator.resolvedInput(
            for: "a",
            controlModifierState: .armed,
            shiftModifierState: .armed
        )

        XCTAssertEqual(resolved?.payload, "\u{01}")
        XCTAssertEqual(resolved?.consumedControl, true)
        XCTAssertEqual(resolved?.consumedShift, true)
    }
}
