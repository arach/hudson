import CoreGraphics
import XCTest
@testable import HudsonCanvas

final class HudCanvasStateTests: XCTestCase {
    func testInitializationClampsScale() {
        let low = HudCanvasState(scale: 0.0001, minimumScale: 0.1, maximumScale: 4)
        let high = HudCanvasState(scale: 10, minimumScale: 0.1, maximumScale: 4)

        XCTAssertEqual(low.scale, 0.1)
        XCTAssertEqual(high.scale, 4)
    }

    func testWorldAndViewportConversionRoundTrip() {
        let state = HudCanvasState(
            pan: CGSize(width: 50, height: -20),
            scale: 2,
            viewportSize: CGSize(width: 800, height: 600)
        )
        let world = CGPoint(x: -30, y: 120)
        let viewport = state.viewportPoint(fromWorldPoint: world)

        XCTAssertEqual(viewport.x, -10, accuracy: 0.001)
        XCTAssertEqual(viewport.y, 220, accuracy: 0.001)
        XCTAssertEqual(state.worldPoint(fromViewportPoint: viewport).x, world.x, accuracy: 0.001)
        XCTAssertEqual(state.worldPoint(fromViewportPoint: viewport).y, world.y, accuracy: 0.001)
    }

    func testVisibleWorldRectUsesCurrentPanAndScale() {
        let state = HudCanvasState(
            pan: CGSize(width: 100, height: 50),
            scale: 2,
            viewportSize: CGSize(width: 800, height: 600)
        )

        let rect = state.visibleWorldRect

        XCTAssertEqual(rect.minX, -50, accuracy: 0.001)
        XCTAssertEqual(rect.minY, -25, accuracy: 0.001)
        XCTAssertEqual(rect.width, 400, accuracy: 0.001)
        XCTAssertEqual(rect.height, 300, accuracy: 0.001)
    }

    func testAnchoredZoomKeepsWorldPointUnderCursor() {
        let state = HudCanvasState(
            pan: CGSize(width: 20, height: -10),
            scale: 1,
            viewportSize: CGSize(width: 800, height: 600)
        )
        let anchor = CGPoint(x: 300, y: 240)
        let before = state.worldPoint(fromViewportPoint: anchor)
        let zoomed = state.zoomed(to: 2.5, around: anchor)
        let after = zoomed.worldPoint(fromViewportPoint: anchor)

        XCTAssertEqual(after.x, before.x, accuracy: 0.001)
        XCTAssertEqual(after.y, before.y, accuracy: 0.001)
        XCTAssertEqual(zoomed.scale, 2.5)
    }

    func testFitHandlesNegativeWorldCoordinates() {
        let state = HudCanvasState(
            scale: 1,
            viewportSize: CGSize(width: 1000, height: 700)
        )
        let rect = CGRect(x: -500, y: -200, width: 1000, height: 500)
        let fitted = state.fitting(rect, padding: 50)

        XCTAssertEqual(fitted.scale, 0.9, accuracy: 0.001)
        XCTAssertEqual(fitted.visibleWorldRect.midX, rect.midX, accuracy: 0.001)
        XCTAssertEqual(fitted.visibleWorldRect.midY, rect.midY, accuracy: 0.001)
    }

    func testResetAndReplay() {
        let state = HudCanvasState(
            pan: CGSize(width: 200, height: -80),
            scale: 3,
            minimumScale: 0.5,
            maximumScale: 4
        )

        let reset = state.reset()
        XCTAssertEqual(reset.pan, .zero)
        XCTAssertEqual(reset.scale, 1)

        let replay = state.replaying(panX: -30, panY: 44, scale: 10)
        XCTAssertEqual(replay.pan.width, -30)
        XCTAssertEqual(replay.pan.height, 44)
        XCTAssertEqual(replay.scale, 4)
    }

    func testCenterOnWorldPoint() {
        let state = HudCanvasState(
            scale: 2,
            viewportSize: CGSize(width: 800, height: 600)
        )
        let centered = state.centered(on: CGPoint(x: 100, y: -50))

        XCTAssertEqual(centered.viewportPoint(fromWorldPoint: CGPoint(x: 100, y: -50)).x, 400, accuracy: 0.001)
        XCTAssertEqual(centered.viewportPoint(fromWorldPoint: CGPoint(x: 100, y: -50)).y, 300, accuracy: 0.001)
    }
}
