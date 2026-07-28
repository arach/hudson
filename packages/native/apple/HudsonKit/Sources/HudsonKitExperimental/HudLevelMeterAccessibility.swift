/// A compact, structural accessibility snapshot for live-level history.
public struct HudLevelMeterAccessibility: Equatable, Sendable {
    /// The number of input samples, including samples too old to fit visually.
    public let sampleCount: Int

    /// The newest normalized sample as a whole percentage, or `nil` when empty.
    public let currentPercent: Int?

    /// The maximum normalized sample as a whole percentage, or `nil` when empty.
    public let peakPercent: Int?

    public init(samples: [HudLevelSample]) {
        sampleCount = samples.count
        currentPercent = samples.last.map(Self.percent)
        peakPercent = samples.max { first, second in
            first.unitValue < second.unitValue
        }.map(Self.percent)
    }

    private static func percent(_ sample: HudLevelSample) -> Int {
        Int((sample.unitValue * 100).rounded())
    }
}
