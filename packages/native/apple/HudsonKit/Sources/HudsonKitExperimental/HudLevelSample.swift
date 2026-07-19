/// A normalized, unitless live-level value for experimental HudsonKit mechanics.
public struct HudLevelSample: Equatable, Hashable, Sendable {
    /// A finite value in the closed unit interval.
    public let unitValue: Double

    public init(unitValue: Double) {
        self.unitValue = HudLevelNormalizer.unit(unitValue)
    }
}
