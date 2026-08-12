import SwiftUI
import Testing
@testable import HudsonUI

@Suite("Hud typography")
struct HudTypographyTests {
    @Test("scalable roles preserve the established base-size ladder")
    func rolesPreserveBaseSizes() {
        #expect(
            HudTextRole.allCases.map(\.baseSize) == [
                HudTextSize.micro,
                HudTextSize.xxs,
                HudTextSize.xs,
                HudTextSize.sm,
                HudTextSize.base,
                HudTextSize.md,
                HudTextSize.lgm,
                HudTextSize.lg,
                HudTextSize.xl,
                HudTextSize.xxl,
                HudTextSize.xxxl,
                HudTextSize.hero,
            ]
        )
    }

    @Test("roles use semantic Dynamic Type anchors")
    func rolesUseSemanticAnchors() {
        #expect(HudTextRole.micro.relativeTextStyle == .caption2)
        #expect(HudTextRole.sm.relativeTextStyle == .caption)
        #expect(HudTextRole.base.relativeTextStyle == .footnote)
        #expect(HudTextRole.md.relativeTextStyle == .subheadline)
        #expect(HudTextRole.lg.relativeTextStyle == .callout)
        #expect(HudTextRole.xl.relativeTextStyle == .headline)
        #expect(HudTextRole.xxl.relativeTextStyle == .title2)
        #expect(HudTextRole.xxxl.relativeTextStyle == .title)
        #expect(HudTextRole.hero.relativeTextStyle == .largeTitle)
    }
}
