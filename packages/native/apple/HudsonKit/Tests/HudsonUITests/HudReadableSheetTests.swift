import SwiftUI
import Testing
@testable import HudsonUI

@Suite("Hud readable sheet")
struct HudReadableSheetTests {
    @Test("standard text sizes retain the medium-first sheet")
    func standardSizesUseStandardPresentation() {
        #expect(HudReadableSheetPolicy.presentation(for: .large) == .standard)
        #expect(HudReadableSheetPolicy.presentation(for: .xxxLarge) == .standard)
    }

    @Test("accessibility text sizes require the large sheet")
    func accessibilitySizesUseLargePresentation() {
        #expect(HudReadableSheetPolicy.presentation(for: .accessibility1) == .accessibility)
        #expect(HudReadableSheetPolicy.presentation(for: .accessibility5) == .accessibility)
    }
}
