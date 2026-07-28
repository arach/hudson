/// A deterministic, Foundation-free layout for centered live-level history bars.
public struct HudLevelMeterGeometry: Equatable, Sendable {
    /// The fixed width of every rendered bar when the container can fit one.
    public static let barWidth = 3.0

    /// The fixed space between adjacent bars.
    public static let barSpacing = 2.0

    /// The shortest visible bar when the container has positive height.
    public static let minimumVisibleBarHeight = 2.0

    /// The finite, non-negative normalized container width.
    public let width: Double

    /// The finite, non-negative normalized container height.
    public let height: Double

    /// The vertical centerline shared by every rendered bar.
    public let baseline: Double

    /// Retained bars in chronological order, from oldest to newest.
    public let bars: [HudLevelMeterBarGeometry]

    /// Lays out the newest suffix of `samples` that can fit in the supplied dimensions.
    public init(samples: [HudLevelSample], width: Double, height: Double) {
        self.width = Self.finiteNonNegative(width)
        self.height = Self.finiteNonNegative(height)
        baseline = self.height / 2
        bars = Self.layout(samples: samples, width: self.width, height: self.height, baseline: baseline)
    }

    private static func layout(
        samples: [HudLevelSample],
        width: Double,
        height: Double,
        baseline: Double
    ) -> [HudLevelMeterBarGeometry] {
        guard !samples.isEmpty, width >= barWidth, height > 0 else {
            return []
        }

        let slotWidth = barWidth + barSpacing
        let maximumBarCount = maximumFittingBarCount(width: width, slotWidth: slotWidth)
        let retainedCount = min(samples.count, maximumBarCount)
        guard retainedCount > 0 else {
            return []
        }

        let retainedSamples = samples.suffix(retainedCount)
        let totalWidth = Double(retainedCount) * barWidth + Double(retainedCount - 1) * barSpacing
        let leadingX = max(0, width - totalWidth)
        let minimumHeight = min(minimumVisibleBarHeight, height)

        return retainedSamples.enumerated().map { index, sample in
            let barHeight = min(height, max(minimumHeight, sample.unitValue * height))
            let x = leadingX + Double(index) * slotWidth
            return HudLevelMeterBarGeometry(
                sample: sample,
                x: x,
                y: baseline - barHeight / 2,
                width: barWidth,
                height: barHeight
            )
        }
    }

    private static func finiteNonNegative(_ value: Double) -> Double {
        guard value.isFinite, value > 0 else {
            return 0
        }
        return value
    }

    private static func maximumFittingBarCount(width: Double, slotWidth: Double) -> Int {
        let unboundedCount = width / slotWidth + barSpacing / slotWidth
        guard unboundedCount.isFinite, unboundedCount > 0 else {
            return 0
        }
        if unboundedCount >= Double(Int.max) {
            return Int.max
        }
        return Int(unboundedCount)
    }
}
