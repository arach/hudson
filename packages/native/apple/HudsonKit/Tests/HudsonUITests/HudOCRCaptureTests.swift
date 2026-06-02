import CoreGraphics
import Foundation
import Testing
@testable import HudsonUICapture

@Suite("HudOCRFormatting")
struct HudOCRFormattingTests {

    @Test("language tags fall back to English")
    func languageTagsFallback() {
        #expect(HudOCRFormatting.normalizedLanguageTags(["", "  "]) == ["en-US"])
        #expect(HudOCRFormatting.normalizedLanguageTags([" en-US ", "fr-FR"]) == ["en-US", "fr-FR"])
    }

    @Test("minimum text height is clamped to Vision range")
    func minimumTextHeightClamps() {
        #expect(HudOCRFormatting.clampedMinimumTextHeight(-1) == 0)
        #expect(HudOCRFormatting.clampedMinimumTextHeight(0.32) == 0.32)
        #expect(HudOCRFormatting.clampedMinimumTextHeight(4) == 1)
    }

    @Test("confidence is formatted as percentage")
    func confidenceFormats() {
        #expect(HudOCRFormatting.formattedConfidence(-1) == "0%")
        #expect(HudOCRFormatting.formattedConfidence(0.936) == "94%")
        #expect(HudOCRFormatting.formattedConfidence(2) == "100%")
    }

    @Test("lines sort top to bottom then left to right")
    func readingOrderSorts() {
        let lines = [
            HudOCRLine(id: "bottom", text: "bottom", confidence: 1, boundingBox: CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.05)),
            HudOCRLine(id: "top-right", text: "right", confidence: 1, boundingBox: CGRect(x: 0.7, y: 0.8, width: 0.2, height: 0.05)),
            HudOCRLine(id: "top-left", text: "left", confidence: 1, boundingBox: CGRect(x: 0.1, y: 0.82, width: 0.2, height: 0.05)),
        ]

        #expect(HudOCRFormatting.readingOrder(lines).map(\.id) == ["top-left", "top-right", "bottom"])
    }
}

@Suite("HudOCRResult")
struct HudOCRResultTests {

    @Test("result joins text and averages confidence")
    func resultSummaries() {
        let result = HudOCRResult(lines: [
            HudOCRLine(id: "one", text: "Hudson", confidence: 0.8),
            HudOCRLine(id: "two", text: "Capture", confidence: 1),
        ])

        #expect(result.text == "Hudson\nCapture")
        #expect(result.lineCount == 2)
        #expect(result.averageConfidence == 0.9)
        #expect(!result.isEmpty)
    }
}

@Suite("HudOCRConfiguration")
struct HudOCRConfigurationTests {

    @Test("configuration normalizes inputs")
    func configurationNormalizes() {
        let configuration = HudOCRConfiguration(
            recognitionLevel: .fast,
            recognitionLanguages: ["", " en-US "],
            minimumTextHeight: -0.3,
            customWords: [" Hudson ", "", "Termini"]
        )

        #expect(configuration.recognitionLevel == .fast)
        #expect(configuration.recognitionLanguages == ["en-US"])
        #expect(configuration.minimumTextHeight == 0)
        #expect(configuration.customWords == ["Hudson", "Termini"])
    }
}

@Suite("HudOCRCaptureController")
struct HudOCRCaptureControllerTests {

    @MainActor
    @Test("controller can accept preview results and reset")
    func controllerPreviewState() {
        let controller = HudOCRCaptureController()
        let result = HudOCRResult(lines: [
            HudOCRLine(id: "one", text: "Ready", confidence: 1)
        ])

        controller.replaceResult(result)
        #expect(controller.state.phase == .complete)
        #expect(controller.state.recognizedText == "Ready")

        controller.reset()
        #expect(controller.state.phase == .idle)
        #expect(controller.state.recognizedText.isEmpty)
    }
}
