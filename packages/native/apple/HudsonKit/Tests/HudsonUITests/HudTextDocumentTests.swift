import Testing
@testable import HudsonUI

@Suite("HudTextDocumentDetector")
struct HudTextDocumentDetectorTests {

    @Test("first-line heading is markdown")
    func firstLineHeadingIsMarkdown() {
        let kind = HudTextDocumentDetector.detectKind(value: "# Session\n\nNotes")
        #expect(kind == .markdown)
    }

    @Test("first-line code fence is markdown")
    func firstLineCodeFenceIsMarkdown() {
        let kind = HudTextDocumentDetector.detectKind(value: "```swift\nlet value = 1\n```")
        #expect(kind == .markdown)
    }
}
