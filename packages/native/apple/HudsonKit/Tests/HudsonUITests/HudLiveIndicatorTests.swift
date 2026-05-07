import Testing
import HudsonLive
@testable import HudsonUI

@Suite("HudLiveIndicator")
struct HudLiveIndicatorTests {

    @Test("auto chrome stays ghost for healthy receiving statuses")
    func autoChromeGhostHealthy() {
        for status in [HudLiveStatus.connecting, .replaying, .live] {
            #expect(!HudLiveIndicator.resolvedShowsPill(chrome: .auto, status: status))
        }
    }

    @Test("auto chrome promotes to pill for attention-required statuses")
    func autoChromePillAttention() {
        for status in [HudLiveStatus.stale, .error, .offline] {
            #expect(HudLiveIndicator.resolvedShowsPill(chrome: .auto, status: status))
        }
    }

    @Test("paused renders ghost under auto chrome")
    func autoChromePaused() {
        // Paused is user-initiated, not an alarm - keep it quiet.
        #expect(!HudLiveIndicator.resolvedShowsPill(chrome: .auto, status: .paused))
    }

    @Test("explicit pill always renders chrome")
    func explicitPillAlways() {
        for status in HudLiveStatus.allCases {
            #expect(HudLiveIndicator.resolvedShowsPill(chrome: .pill, status: status))
        }
    }

    @Test("explicit ghost never renders chrome")
    func explicitGhostNever() {
        for status in HudLiveStatus.allCases {
            #expect(!HudLiveIndicator.resolvedShowsPill(chrome: .ghost, status: status))
        }
    }

    @Test("legacy two-arg init keeps chrome at auto for source compatibility")
    func legacyInitDefaultsChromeToAuto() {
        let source = HudLiveSourceDescriptor(
            id: "vantage.diff.packages",
            label: "Packages Diff",
            kind: "diff",
            status: .live
        )
        let indicator = HudLiveIndicator(source: source, displayMode: .compact)
        #expect(indicator.chrome == .auto)
    }
}
