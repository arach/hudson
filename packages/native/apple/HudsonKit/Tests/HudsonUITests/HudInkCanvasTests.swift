import SwiftUI
import Testing
@testable import HudsonUI

@Suite("HudInkCanvas")
struct HudInkCanvasTests {
    @Test("background variants expose graph-paper and transparent")
    func backgroundCases() {
        #expect(HudInkCanvasBackground.allCases.contains(.graphPaper))
        #expect(HudInkCanvasBackground.allCases.contains(.transparent))
        #expect(HudInkCanvasBackground.allCases.count == 2)
    }

    @Test("only the transparent variant lets content show through")
    func transparencyFlag() {
        #expect(HudInkCanvasBackground.graphPaper.isTransparent == false)
        #expect(HudInkCanvasBackground.transparent.isTransparent == true)
    }

    @MainActor
    @Test("canvas builds with the default and transparent backgrounds")
    func constructsBothVariants() {
        let data = Binding.constant(Data())
        let tool = Binding.constant(HudInkToolKind.pen)

        // Default keeps the existing graph-paper card for current consumers.
        _ = HudInkCanvas(drawingData: data, tool: tool).body
        // Additive transparent overlay variant for layering ink over content.
        _ = HudInkCanvas(drawingData: data, tool: tool, background: .transparent).body
    }
}
