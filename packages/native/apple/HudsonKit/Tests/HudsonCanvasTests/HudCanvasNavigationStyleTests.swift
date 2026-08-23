import Foundation
import Testing
import HudsonCanvas
@testable import HudsonCanvasSurface

@Suite("Hudson Canvas navigation styles")
struct HudCanvasNavigationStyleTests {
    @Test("Embeddable Canvas keeps the standard navigation style by default")
    func defaultStyle() {
        let configuration = HudCanvasConfiguration()
        #expect(configuration.navigationStyle == .standard)
    }

    @Test("Canvas hosts can opt into vertical tabs")
    func verticalTabsOptIn() {
        let configuration = HudCanvasConfiguration(navigationStyle: .verticalTabs)
        #expect(configuration.navigationStyle == .verticalTabs)
    }

    @Test("Full-height Canvas hosts use an explicit native window treatment")
    func fullHeightWindowStyle() {
        #expect(HudCanvasHostWindowStyle.allCases == [.standard, .fullHeightSidebar])
        _ = HudCanvasHostWindowBridge(style: .fullHeightSidebar)
    }

    @Test("Selecting a recent scene promotes it without duplicating it")
    func scenePromotion() {
        let alpha = tab(id: "/tmp/alpha.json", title: "Alpha", timestamp: 1)
        let beta = tab(id: "/tmp/beta.json", title: "Beta", timestamp: 2)

        let promoted = CanvasSceneTab.promoting(beta, in: [alpha, beta])

        #expect(promoted.map(\.id) == [beta.id, alpha.id])
        #expect(promoted.count == 2)
    }

    @Test("Recent scene promotion enforces the Canvas cap")
    func scenePromotionCap() {
        let tabs = (0...CanvasSceneTab.recentsCap).map { index in
            tab(id: "/tmp/\(index).json", title: "Workspace \(index)", timestamp: index)
        }
        let newest = tab(id: "/tmp/newest.json", title: "Newest", timestamp: 99)

        let promoted = CanvasSceneTab.promoting(newest, in: tabs)

        #expect(promoted.first?.id == newest.id)
        #expect(promoted.count == CanvasSceneTab.recentsCap)
    }

    private func tab(id: String, title: String, timestamp: Int) -> CanvasSceneTab {
        CanvasSceneTab(
            manifestPath: id,
            title: title,
            subtitle: nil,
            badge: nil,
            accent: nil,
            appliedAt: Date(timeIntervalSince1970: TimeInterval(timestamp))
        )
    }
}
