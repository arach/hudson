import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import Vision
import HudsonUI

#if os(iOS)
import PhotosUI
import UIKit
#elseif os(macOS)
import AppKit
#endif

public enum HudOCRPhase: Equatable, Sendable {
    case idle
    case processing
    case complete
    case failed
}

public enum HudOCRRecognitionLevel: String, CaseIterable, Identifiable, Sendable {
    case fast
    case accurate

    public var id: String { rawValue }

    var visionLevel: VNRequestTextRecognitionLevel {
        switch self {
        case .fast: return .fast
        case .accurate: return .accurate
        }
    }
}

public struct HudOCRConfiguration: Equatable, Sendable {
    public var recognitionLevel: HudOCRRecognitionLevel
    public var recognitionLanguages: [String]
    public var usesLanguageCorrection: Bool
    public var minimumTextHeight: Float
    public var customWords: [String]

    public init(
        recognitionLevel: HudOCRRecognitionLevel = .accurate,
        recognitionLanguages: [String] = ["en-US"],
        usesLanguageCorrection: Bool = true,
        minimumTextHeight: Float = 0,
        customWords: [String] = []
    ) {
        self.recognitionLevel = recognitionLevel
        self.recognitionLanguages = HudOCRFormatting.normalizedLanguageTags(recognitionLanguages)
        self.usesLanguageCorrection = usesLanguageCorrection
        self.minimumTextHeight = HudOCRFormatting.clampedMinimumTextHeight(minimumTextHeight)
        self.customWords = customWords
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}

public struct HudOCRLine: Equatable, Identifiable, Sendable {
    public var id: String
    public var text: String
    public var confidence: Float
    public var boundingBox: CGRect

    public init(
        id: String,
        text: String,
        confidence: Float,
        boundingBox: CGRect = .zero
    ) {
        self.id = id
        self.text = text
        self.confidence = max(0, min(1, confidence))
        self.boundingBox = HudOCRFormatting.clampedBoundingBox(boundingBox)
    }
}

public struct HudOCRResult: Equatable, Sendable {
    public var sourceDescription: String
    public var recognizedAt: Date
    public var lines: [HudOCRLine]

    public init(
        sourceDescription: String = "image",
        recognizedAt: Date = Date(),
        lines: [HudOCRLine] = []
    ) {
        self.sourceDescription = sourceDescription
        self.recognizedAt = recognizedAt
        self.lines = HudOCRFormatting.readingOrder(lines)
    }

    public var text: String {
        lines
            .map(\.text)
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }

    public var lineCount: Int {
        lines.count
    }

    public var isEmpty: Bool {
        lines.isEmpty || text.isEmpty
    }

    public var averageConfidence: Float {
        guard !lines.isEmpty else { return 0 }
        let total = lines.reduce(Float(0)) { $0 + $1.confidence }
        return total / Float(lines.count)
    }
}

public struct HudOCRState: Equatable, Sendable {
    public var phase: HudOCRPhase
    public var result: HudOCRResult?
    public var errorMessage: String?

    public init(
        phase: HudOCRPhase = .idle,
        result: HudOCRResult? = nil,
        errorMessage: String? = nil
    ) {
        self.phase = phase
        self.result = result
        self.errorMessage = errorMessage
    }

    public var isProcessing: Bool {
        phase == .processing
    }

    public var recognizedText: String {
        result?.text ?? ""
    }
}

public enum HudOCRError: Error, Equatable, LocalizedError, Sendable {
    case unsupportedImageData
    case noCGImage
    case recognitionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .unsupportedImageData:
            return "The selected image could not be decoded."
        case .noCGImage:
            return "The image does not expose pixels for OCR."
        case .recognitionFailed(let message):
            return message
        }
    }
}

public enum HudOCRFormatting {
    public static func normalizedLanguageTags(_ tags: [String]) -> [String] {
        let normalized = tags
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return normalized.isEmpty ? ["en-US"] : normalized
    }

    public static func clampedMinimumTextHeight(_ value: Float) -> Float {
        max(0, min(1, value))
    }

    public static func clampedBoundingBox(_ rect: CGRect) -> CGRect {
        CGRect(
            x: max(0, min(1, rect.origin.x)),
            y: max(0, min(1, rect.origin.y)),
            width: max(0, min(1, rect.width)),
            height: max(0, min(1, rect.height))
        )
    }

    public static func formattedConfidence(_ value: Float) -> String {
        let percent = Int((max(0, min(1, value)) * 100).rounded())
        return "\(percent)%"
    }

    public static func readingOrder(_ lines: [HudOCRLine]) -> [HudOCRLine] {
        lines.sorted { lhs, rhs in
            let yDelta = abs(lhs.boundingBox.midY - rhs.boundingBox.midY)
            if yDelta > 0.04 {
                return lhs.boundingBox.midY > rhs.boundingBox.midY
            }
            return lhs.boundingBox.minX < rhs.boundingBox.minX
        }
    }
}

public struct HudOCRRecognizer: Sendable {
    public var configuration: HudOCRConfiguration

    public init(configuration: HudOCRConfiguration = HudOCRConfiguration()) {
        self.configuration = configuration
    }

    public func recognize(
        cgImage: CGImage,
        orientation: CGImagePropertyOrientation = .up,
        sourceDescription: String = "image",
        recognizedAt: Date = Date()
    ) async throws -> HudOCRResult {
        let configuration = configuration
        return try await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = configuration.recognitionLevel.visionLevel
            request.recognitionLanguages = configuration.recognitionLanguages
            request.usesLanguageCorrection = configuration.usesLanguageCorrection
            request.minimumTextHeight = configuration.minimumTextHeight
            request.customWords = configuration.customWords

            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation)
            do {
                try handler.perform([request])
            } catch {
                throw HudOCRError.recognitionFailed(error.localizedDescription)
            }

            let lines = (request.results ?? []).enumerated().compactMap { index, observation -> HudOCRLine? in
                guard let candidate = observation.topCandidates(1).first else { return nil }
                let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { return nil }
                return HudOCRLine(
                    id: "ocr-line-\(index)",
                    text: text,
                    confidence: candidate.confidence,
                    boundingBox: observation.boundingBox
                )
            }

            return HudOCRResult(
                sourceDescription: sourceDescription,
                recognizedAt: recognizedAt,
                lines: lines
            )
        }.value
    }
}

@MainActor
public final class HudOCRCaptureController: ObservableObject {
    @Published public private(set) var state: HudOCRState
    public var configuration: HudOCRConfiguration

    public init(
        configuration: HudOCRConfiguration = HudOCRConfiguration(),
        state: HudOCRState = HudOCRState()
    ) {
        self.configuration = configuration
        self.state = state
    }

    public func recognize(
        cgImage: CGImage,
        orientation: CGImagePropertyOrientation = .up,
        sourceDescription: String = "image"
    ) async {
        state = HudOCRState(phase: .processing, result: state.result)
        do {
            let result = try await HudOCRRecognizer(configuration: configuration).recognize(
                cgImage: cgImage,
                orientation: orientation,
                sourceDescription: sourceDescription
            )
            state = HudOCRState(phase: .complete, result: result)
        } catch {
            state = HudOCRState(phase: .failed, result: state.result, errorMessage: error.localizedDescription)
        }
    }

    public func recognizeImageData(_ data: Data, sourceDescription: String = "selected image") async {
        do {
            let image = try HudOCRPlatformImage(data: data)
            await recognize(
                cgImage: image.cgImage,
                orientation: image.orientation,
                sourceDescription: sourceDescription
            )
        } catch {
            state = HudOCRState(phase: .failed, result: state.result, errorMessage: error.localizedDescription)
        }
    }

    public func replaceResult(_ result: HudOCRResult) {
        state = HudOCRState(phase: .complete, result: result)
    }

    public func fail(_ message: String) {
        state = HudOCRState(phase: .failed, result: state.result, errorMessage: message)
    }

    public func reset() {
        state = HudOCRState()
    }
}

public struct HudOCRCaptureView: View {
    @ObservedObject private var controller: HudOCRCaptureController
    @State private var selectedItem: HudOCRPhotoPickerItem?

    public init(controller: HudOCRCaptureController) {
        self.controller = controller
    }

    public var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                header
                actions
                bodyContent
            }
        }
        #if os(iOS)
        .task(id: selectedItem) {
            await loadSelectedPhoto()
        }
        #endif
    }

    private var header: some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: "text.viewfinder")
                .font(HudFont.ui(HudTextSize.xl, weight: .semibold))
                .foregroundStyle(phaseTint)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                Text("Capture OCR")
                    .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text("Vision-backed text extraction from an image surface.")
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
            }

            Spacer(minLength: HudSpacing.md)
            HudBadge(phaseLabel, tint: phaseTint)
        }
    }

    private var actions: some View {
        HStack(spacing: HudSpacing.md) {
            photoPicker
            HudButton("Clear", icon: "xmark", style: .ghost) {
                controller.reset()
            }
            .disabled(controller.state.phase == .idle)
        }
    }

    @ViewBuilder
    private var photoPicker: some View {
        #if os(iOS)
        PhotosPicker(selection: $selectedItem, matching: .images) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: "photo.on.rectangle")
                    .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                Text("Pick image")
                    .font(HudFont.mono(HudTextSize.xs, weight: .semibold))
                    .tracking(0)
            }
            .foregroundStyle(HudPalette.accent)
            .padding(.horizontal, HudSpacing.xl)
            .frame(minHeight: HudLayout.rowHeightCompact)
            .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.tint(HudPalette.accent)))
            .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudSurface.tintStrong(HudPalette.accent), lineWidth: HudStrokeWidth.standard))
        }
        .disabled(controller.state.isProcessing)
        #else
        HudButton("iOS picker", icon: "photo.on.rectangle", style: .secondary) {}
            .disabled(true)
        #endif
    }

    @ViewBuilder
    private var bodyContent: some View {
        if controller.state.isProcessing {
            HudInset {
                HStack(spacing: HudSpacing.md) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Reading text from image…")
                        .font(HudFont.ui(HudTextSize.sm))
                        .foregroundStyle(HudPalette.muted)
                }
            }
        } else if let message = controller.state.errorMessage {
            HudEmptyState(
                title: "OCR failed",
                subtitle: message,
                icon: "exclamationmark.triangle"
            )
        } else if let result = controller.state.result {
            resultView(result)
        } else {
            HudEmptyState(
                title: "No image selected",
                subtitle: "Pick an image from Photos to extract readable text.",
                icon: "text.viewfinder"
            )
        }
    }

    private func resultView(_ result: HudOCRResult) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HStack(spacing: HudSpacing.md) {
                HudKVRow("lines", value: "\(result.lineCount)")
                HudKVRow("confidence", value: HudOCRFormatting.formattedConfidence(result.averageConfidence))
            }

            HudInset {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HStack {
                        HudSectionLabel("Text")
                        Spacer(minLength: HudSpacing.md)
                        HudButton("Copy", icon: "doc.on.doc", style: .ghost) {
                            HudOCRClipboard.copy(result.text)
                        }
                        .disabled(result.text.isEmpty)
                    }
                    Text(result.text.isEmpty ? "No text found." : result.text)
                        .font(HudFont.mono(HudTextSize.xs))
                        .foregroundStyle(result.text.isEmpty ? HudPalette.dim : HudPalette.ink)
                        .textSelection(.enabled)
                }
            }

            if !result.lines.isEmpty {
                VStack(spacing: HudSpacing.sm) {
                    ForEach(result.lines.prefix(4)) { line in
                        HStack(spacing: HudSpacing.md) {
                            Text(HudOCRFormatting.formattedConfidence(line.confidence))
                                .font(HudFont.mono(HudTextSize.xxs, weight: .medium))
                                .foregroundStyle(HudPalette.dim)
                            Text(line.text)
                                .font(HudFont.ui(HudTextSize.xs))
                                .foregroundStyle(HudPalette.muted)
                                .lineLimit(2)
                            Spacer(minLength: HudSpacing.md)
                        }
                        .padding(.horizontal, HudSpacing.md)
                        .padding(.vertical, HudSpacing.sm)
                        .background(RoundedRectangle(cornerRadius: HudRadius.standard).fill(HudSurface.inset))
                        .overlay(RoundedRectangle(cornerRadius: HudRadius.standard).stroke(HudHairline.subtle, lineWidth: HudStrokeWidth.thin))
                    }
                }
            }
        }
    }

    private var phaseLabel: String {
        switch controller.state.phase {
        case .idle: return "READY"
        case .processing: return "READING"
        case .complete: return "TEXT"
        case .failed: return "ERROR"
        }
    }

    private var phaseTint: Color {
        switch controller.state.phase {
        case .idle: return HudPalette.statusInfo
        case .processing: return HudPalette.accent
        case .complete: return HudPalette.statusOk
        case .failed: return HudPalette.statusError
        }
    }

    #if os(iOS)
    private func loadSelectedPhoto() async {
        guard let selectedItem else { return }
        do {
            guard let data = try await selectedItem.loadTransferable(type: Data.self) else {
                throw HudOCRError.unsupportedImageData
            }
            await controller.recognizeImageData(data)
        } catch {
            controller.fail(error.localizedDescription)
        }
    }
    #endif
}

#if os(iOS)
private typealias HudOCRPhotoPickerItem = PhotosPickerItem
#else
private typealias HudOCRPhotoPickerItem = String
#endif

private enum HudOCRClipboard {
    static func copy(_ text: String) {
        #if os(iOS)
        UIPasteboard.general.string = text
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        #endif
    }
}

private struct HudOCRPlatformImage {
    var cgImage: CGImage
    var orientation: CGImagePropertyOrientation

    init(data: Data) throws {
        #if os(iOS)
        guard let image = UIImage(data: data) else {
            throw HudOCRError.unsupportedImageData
        }
        guard let cgImage = image.cgImage else {
            throw HudOCRError.noCGImage
        }
        self.cgImage = cgImage
        self.orientation = CGImagePropertyOrientation(image.imageOrientation)
        #elseif os(macOS)
        guard let image = NSImage(data: data) else {
            throw HudOCRError.unsupportedImageData
        }
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            throw HudOCRError.noCGImage
        }
        self.cgImage = cgImage
        self.orientation = .up
        #else
        throw HudOCRError.unsupportedImageData
        #endif
    }
}

#if os(iOS)
private extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .upMirrored: self = .upMirrored
        case .down: self = .down
        case .downMirrored: self = .downMirrored
        case .left: self = .left
        case .leftMirrored: self = .leftMirrored
        case .right: self = .right
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
#endif
