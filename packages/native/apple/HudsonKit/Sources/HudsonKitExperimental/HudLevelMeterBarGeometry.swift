/// One centered bar in a deterministic live-level meter layout.
public struct HudLevelMeterBarGeometry: Equatable, Sendable {
    /// The normalized sample represented by this bar.
    public let sample: HudLevelSample

    /// The leading horizontal coordinate in the meter's local coordinate space.
    public let x: Double

    /// The top vertical coordinate in the meter's local coordinate space.
    public let y: Double

    /// The finite, non-negative bar width.
    public let width: Double

    /// The finite, non-negative bar height.
    public let height: Double

    init(sample: HudLevelSample, x: Double, y: Double, width: Double, height: Double) {
        self.sample = sample
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}
