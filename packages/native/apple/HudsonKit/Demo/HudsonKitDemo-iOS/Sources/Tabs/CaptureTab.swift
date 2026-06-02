import SwiftUI
import HudsonUI
import HudsonUICapture

struct CaptureTab: View {
    @StateObject private var ocrController = HudOCRCaptureController(
        configuration: HudOCRConfiguration(
            recognitionLevel: .accurate,
            recognitionLanguages: ["en-US"],
            customWords: ["Hudson", "Tailscale", "Termini", "CodeMirror"]
        )
    )

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                    intro
                    HudOCRCaptureView(controller: ocrController)
                    routeCard
                }
                .frame(width: max(0, geometry.size.width - HudSpacing.xl * 2), alignment: .leading)
                .padding(.horizontal, HudSpacing.xl)
                .padding(.top, HudSpacing.lg)
                .padding(.bottom, HudSpacing.huge)
            }
        }
        .onAppear {
            if ocrController.state.phase == .idle {
                ocrController.replaceResult(sampleOCRResult)
            }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Capture")
            Text("A simple OCR surface for photo-picked screenshots, paper notes, QR payload context, and future camera capture.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }

    private var routeCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Capture route")
                HudKVRow("deep link", value: "hudson://capture?mode=ocr")
                HudKVRow("engine", value: "Vision text recognition")
                HudKVRow("input", value: "Photos image data")
                HudDivider()
                HStack(spacing: HudSpacing.md) {
                    HudButton("Sample", icon: "sparkles", style: .secondary) {
                        ocrController.replaceResult(sampleOCRResult)
                    }
                    HudButton("Reset", icon: "arrow.counterclockwise", style: .ghost) {
                        ocrController.reset()
                    }
                }
            }
        }
    }

    private var sampleOCRResult: HudOCRResult {
        HudOCRResult(
            sourceDescription: "demo screenshot",
            recognizedAt: Date(timeIntervalSince1970: 0),
            lines: [
                HudOCRLine(
                    id: "sample-1",
                    text: "hudson://capture?mode=ocr",
                    confidence: 0.98,
                    boundingBox: CGRect(x: 0.08, y: 0.78, width: 0.72, height: 0.08)
                ),
                HudOCRLine(
                    id: "sample-2",
                    text: "Pair local Mac over LAN or Tailnet",
                    confidence: 0.94,
                    boundingBox: CGRect(x: 0.08, y: 0.62, width: 0.78, height: 0.08)
                ),
                HudOCRLine(
                    id: "sample-3",
                    text: "Extract command snippets into the terminal node",
                    confidence: 0.91,
                    boundingBox: CGRect(x: 0.08, y: 0.46, width: 0.84, height: 0.08)
                ),
            ]
        )
    }
}
