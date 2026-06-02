import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins
import HudsonUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// QR code primitive. Generates via CoreImage's `CIQRCodeGenerator`, recolors
/// via `CIFalseColor`, and renders as a sharp `Image` using `.interpolation(.none)`
/// so the underlying pixel grid stays crisp at any size. Cross-platform (iOS + macOS).
public struct HudQRCode: View {
    public enum ErrorCorrection: String, Sendable {
        /// ~7% recoverable damage. Smallest QR for the same content.
        case low = "L"
        /// ~15% recoverable. Default — good balance.
        case medium = "M"
        /// ~25% recoverable.
        case quartile = "Q"
        /// ~30% recoverable. Largest QR for the same content; pick when the
        /// code will be printed, photographed, or shown over an embedded logo.
        case high = "H"
    }

    private let content: String
    private let size: CGFloat
    private let foreground: Color
    private let background: Color
    private let errorCorrection: ErrorCorrection

    public init(
        _ content: String,
        size: CGFloat = HudLayout.qrCodeDefault,
        foreground: Color = HudPalette.ink,
        background: Color = HudPalette.surface,
        errorCorrection: ErrorCorrection = .medium
    ) {
        self.content = content
        self.size = size
        self.foreground = foreground
        self.background = background
        self.errorCorrection = errorCorrection
    }

    public var body: some View {
        Group {
            if let cgImage = generate() {
                Image(decorative: cgImage, scale: 1)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: size, height: size)
            } else {
                Rectangle()
                    .fill(background)
                    .frame(width: size, height: size)
                    .overlay(
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(HudPalette.statusError)
                    )
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("QR code")
        .accessibilityValue(content)
    }

    private func generate() -> CGImage? {
        guard !content.isEmpty,
              let data = content.data(using: .utf8) else { return nil }

        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = errorCorrection.rawValue
        guard let output = filter.outputImage else { return nil }

        let colored = output.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": ciColor(foreground),
            "inputColor1": ciColor(background)
        ])

        return CIContext().createCGImage(colored, from: colored.extent)
    }

    private func ciColor(_ color: Color) -> CIColor {
        #if canImport(UIKit)
        return CIColor(color: UIColor(color))
        #elseif canImport(AppKit)
        if let resolved = NSColor(color).usingColorSpace(.deviceRGB),
           let ci = CIColor(color: resolved) {
            return ci
        }
        return CIColor.black
        #endif
    }
}
