import Foundation
import SwiftUI

#if os(iOS)
import PencilKit
import UIKit
#endif

public enum HudInkToolKind: String, CaseIterable, Identifiable, Sendable {
    case pen
    case marker
    case eraser

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .pen: return "Pen"
        case .marker: return "Marker"
        case .eraser: return "Eraser"
        }
    }

    public var iconName: String {
        switch self {
        case .pen: return "pencil.tip"
        case .marker: return "highlighter"
        case .eraser: return "eraser"
        }
    }
}

public struct HudInkCanvas: View {
    @Binding private var drawingData: Data
    @Binding private var tool: HudInkToolKind

    private let isFingerDrawingEnabled: Bool
    private let minimumHeight: CGFloat

    public init(
        drawingData: Binding<Data>,
        tool: Binding<HudInkToolKind>,
        isFingerDrawingEnabled: Bool = true,
        minimumHeight: CGFloat = 180
    ) {
        self._drawingData = drawingData
        self._tool = tool
        self.isFingerDrawingEnabled = isFingerDrawingEnabled
        self.minimumHeight = minimumHeight
    }

    public var body: some View {
        #if os(iOS)
        HudInkCanvasRepresentable(
            drawingData: $drawingData,
            tool: tool,
            isFingerDrawingEnabled: isFingerDrawingEnabled
        )
        .frame(minHeight: minimumHeight)
        .background(HudSurface.base)
        .overlay(HudGridBackground(step: 18, lineColor: HudHairline.subtle.opacity(HudOpacity.soft)))
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.standard, lineWidth: 1))
        #else
        HudInkUnavailableView(minimumHeight: minimumHeight)
        #endif
    }
}

public struct HudInkPreview: View {
    private let drawingData: Data
    private let minimumHeight: CGFloat

    public init(
        drawingData: Data,
        minimumHeight: CGFloat = 92
    ) {
        self.drawingData = drawingData
        self.minimumHeight = minimumHeight
    }

    public var body: some View {
        #if os(iOS)
        if let image = HudInkRenderer.previewImage(from: drawingData) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .padding(HudSpacing.lg)
                .frame(maxWidth: .infinity, minHeight: minimumHeight, alignment: .center)
                .background(HudSurface.base)
                .clipShape(RoundedRectangle(cornerRadius: HudRadius.tight))
                .overlay(RoundedRectangle(cornerRadius: HudRadius.tight).stroke(HudHairline.subtle, lineWidth: 1))
        } else {
            HudInkEmptyPreview(minimumHeight: minimumHeight)
        }
        #else
        HudInkEmptyPreview(minimumHeight: minimumHeight)
        #endif
    }
}

private struct HudInkEmptyPreview: View {
    let minimumHeight: CGFloat

    var body: some View {
        HStack(spacing: HudSpacing.sm) {
            Image(systemName: "pencil.tip")
            Text("No ink")
        }
        .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
        .foregroundStyle(HudPalette.dim)
        .frame(maxWidth: .infinity, minHeight: minimumHeight)
        .background(HudSurface.base)
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.tight))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.tight).stroke(HudHairline.subtle, lineWidth: 1))
    }
}

private struct HudInkUnavailableView: View {
    let minimumHeight: CGFloat

    var body: some View {
        VStack(spacing: HudSpacing.sm) {
            Image(systemName: "pencil.tip")
            Text("Ink canvas unavailable")
        }
        .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
        .foregroundStyle(HudPalette.dim)
        .frame(maxWidth: .infinity, minHeight: minimumHeight)
        .background(HudSurface.base)
        .clipShape(RoundedRectangle(cornerRadius: HudRadius.standard))
        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.standard, lineWidth: 1))
    }
}

#if os(iOS)
private struct HudInkCanvasRepresentable: UIViewRepresentable {
    @Binding var drawingData: Data
    var tool: HudInkToolKind
    var isFingerDrawingEnabled: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(drawingData: $drawingData)
    }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.delegate = context.coordinator
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.alwaysBounceVertical = false
        canvas.drawingPolicy = isFingerDrawingEnabled ? .anyInput : .pencilOnly
        canvas.tool = pkTool(for: tool)
        context.coordinator.apply(drawingData, to: canvas)
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        canvas.drawingPolicy = isFingerDrawingEnabled ? .anyInput : .pencilOnly
        canvas.tool = pkTool(for: tool)
        context.coordinator.apply(drawingData, to: canvas)
    }

    private func pkTool(for tool: HudInkToolKind) -> PKTool {
        switch tool {
        case .pen:
            return PKInkingTool(.pen, color: UIColor(HudPalette.ink), width: 2.6)
        case .marker:
            return PKInkingTool(.marker, color: UIColor(HudPalette.statusWarn).withAlphaComponent(0.55), width: 10)
        case .eraser:
            return PKEraserTool(.vector)
        }
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        @Binding private var drawingData: Data
        private var lastAppliedData = Data()

        init(drawingData: Binding<Data>) {
            self._drawingData = drawingData
        }

        func apply(_ data: Data, to canvas: PKCanvasView) {
            guard data != lastAppliedData else { return }

            if data.isEmpty {
                canvas.drawing = PKDrawing()
            } else if let drawing = try? PKDrawing(data: data) {
                canvas.drawing = drawing
            }

            lastAppliedData = data
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            let data = canvasView.drawing.dataRepresentation()
            lastAppliedData = data
            drawingData = data
        }
    }
}

private enum HudInkRenderer {
    static func previewImage(from data: Data) -> UIImage? {
        guard !data.isEmpty,
              let drawing = try? PKDrawing(data: data),
              !drawing.bounds.isEmpty else {
            return nil
        }

        let bounds = drawing.bounds.insetBy(dx: -16, dy: -16)
        return drawing.image(from: bounds, scale: UIScreen.main.scale)
    }
}
#endif
