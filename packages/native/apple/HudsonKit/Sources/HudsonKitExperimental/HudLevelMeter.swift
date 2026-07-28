#if canImport(SwiftUI)
import SwiftUI

/// A data-driven SwiftUI rendering of centered live-level history bars.
public struct HudLevelMeter: View {
    private let samples: [HudLevelSample]
    private let tint: Color
    private let accessibilityLabel: String

    /// Creates a meter from a chronological sample snapshot.
    public init(samples: [HudLevelSample], tint: Color, accessibilityLabel: String) {
        self.samples = samples
        self.tint = tint
        self.accessibilityLabel = accessibilityLabel
    }

    /// Creates a meter from a bounded chronological history snapshot.
    public init(history: HudLevelHistory, tint: Color, accessibilityLabel: String) {
        self.init(samples: history.samples, tint: tint, accessibilityLabel: accessibilityLabel)
    }

    public var body: some View {
        Canvas { context, size in
            let geometry = HudLevelMeterGeometry(
                samples: samples,
                width: Double(size.width),
                height: Double(size.height)
            )

            for bar in geometry.bars {
                let rectangle = CGRect(
                    x: bar.x,
                    y: bar.y,
                    width: bar.width,
                    height: bar.height
                )
                let radius = min(rectangle.width, rectangle.height) / 2
                context.fill(
                    RoundedRectangle(cornerRadius: radius).path(in: rectangle),
                    with: .color(tint)
                )
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(accessibilityValue)
    }

    private var accessibilityValue: String {
        let snapshot = HudLevelMeterAccessibility(samples: samples)
        guard let currentPercent = snapshot.currentPercent,
              let peakPercent = snapshot.peakPercent
        else {
            return "No level samples"
        }

        let sampleSummary = snapshot.sampleCount == 1
            ? "1 sample"
            : "\(snapshot.sampleCount) samples"
        return "Current \(currentPercent) percent, peak \(peakPercent) percent, \(sampleSummary)"
    }
}
#endif
