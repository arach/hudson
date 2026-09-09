import Testing
@testable import HudsonCanvasSurface

@Suite("Hudson Canvas presentation metrics")
struct HudCanvasPresentationMetricsTests {
    @Test("terminal chrome stays in a compact desktop range")
    func compactTerminalChrome() {
        #expect(HudCanvasMetrics.terminalTitleBarHeight >= 26)
        #expect(HudCanvasMetrics.terminalTitleBarHeight <= 30)
        #expect(HudCanvasMetrics.terminalTrafficLightSize < HudCanvasMetrics.terminalTitleBarHeight / 2)
    }

    @Test("floating controls keep compact visuals inside full titlebar hit targets")
    func compactFloatingControls() {
        #expect(HudCanvasMetrics.canvasControlSize >= 20)
        #expect(HudCanvasMetrics.canvasControlSize < HudCanvasMetrics.canvasControlHitSize)
        #expect(HudCanvasMetrics.canvasControlHitSize <= HudCanvasMetrics.terminalTitleBarHeight)
        #expect(
            HudCanvasMetrics.canvasControlDividerHeight
                < HudCanvasMetrics.canvasControlHitSize
        )
    }

    @Test("zoom and command readouts do not dominate compact controls")
    func compactControlReadouts() {
        #expect(HudCanvasMetrics.commandButtonWidth <= HudCanvasMetrics.zoomLabelWidth)
        #expect(
            HudCanvasMetrics.zoomLabelWidth
                <= HudCanvasMetrics.canvasControlSize + HudCanvasMetrics.canvasControlGap * 3
        )
    }

    @Test("selected terminal depth remains stronger than inactive depth")
    func selectedTerminalDepth() {
        #expect(
            HudCanvasMetrics.terminalCardSelectedShadowRadius
                > HudCanvasMetrics.terminalCardShadowRadius
        )
    }
}
