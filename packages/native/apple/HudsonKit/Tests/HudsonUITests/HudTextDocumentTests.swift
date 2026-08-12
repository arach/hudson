import Testing
@testable import HudsonUI

@Suite("HudTextDocumentDetector")
struct HudTextDocumentDetectorTests {

    @Test("readable document kinds use scalable body typography")
    func readableKindsUseScalableTypography() {
        #expect(HudTextDocumentTypographyPolicy.bodyTextRole(for: .text) == .sm)
        #expect(HudTextDocumentTypographyPolicy.bodyTextRole(for: .markdown) == .sm)
        #expect(HudTextDocumentTypographyPolicy.markdownPreviewRole == .base)
        #expect(HudTextDocumentTypographyPolicy.wrapsEditorLines(for: .text))
        #expect(HudTextDocumentTypographyPolicy.wrapsEditorLines(for: .markdown))
    }

    @Test("geometry-sensitive document kinds retain fixed body typography")
    func geometrySensitiveKindsRetainFixedTypography() {
        #expect(HudTextDocumentTypographyPolicy.bodyTextRole(for: .code) == nil)
        #expect(HudTextDocumentTypographyPolicy.bodyTextRole(for: .raw) == nil)
        #expect(!HudTextDocumentTypographyPolicy.wrapsEditorLines(for: .code))
        #expect(!HudTextDocumentTypographyPolicy.wrapsEditorLines(for: .raw))
    }

    @Test("document headers stack for compact or accessibility layouts")
    func documentHeadersStackForConstrainedLayouts() {
        #expect(!HudTextDocumentHeaderLayoutPolicy.stacksControls(isCompact: false, isAccessibilitySize: false))
        #expect(HudTextDocumentHeaderLayoutPolicy.stacksControls(isCompact: true, isAccessibilitySize: false))
        #expect(HudTextDocumentHeaderLayoutPolicy.stacksControls(isCompact: false, isAccessibilitySize: true))
        #expect(HudTextDocumentHeaderLayoutPolicy.stacksControls(isCompact: true, isAccessibilitySize: true))
    }

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
