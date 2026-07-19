/// Pure normalization helpers for unitless live-level values.
public enum HudLevelNormalizer {
    /// Returns a finite value clamped to the closed unit interval.
    public static func unit(_ value: Double) -> Double {
        guard value.isFinite else {
            return 0
        }

        let normalized = min(max(value, 0), 1)
        return normalized == 0 ? 0 : normalized
    }

    /// Normalizes `value` between finite, ordered, non-degenerate bounds.
    public static func linear(
        _ value: Double,
        from lowerBound: Double,
        to upperBound: Double
    ) -> Double {
        let lower = lowerBound
        let upper = upperBound
        guard value.isFinite,
              lower.isFinite,
              upper.isFinite,
              lower < upper
        else {
            return 0
        }

        if value <= lower {
            return 0
        }
        if value >= upper {
            return 1
        }

        let span = upper - lower
        let offset = value - lower
        if span.isFinite, offset.isFinite {
            return unit(offset / span)
        }

        let scale = max(abs(lower), abs(upper))
        guard scale.isFinite, scale > 0 else {
            return 0
        }

        let scaledValue = value / scale
        let scaledLower = lower / scale
        let scaledUpper = upper / scale
        return unit((scaledValue - scaledLower) / (scaledUpper - scaledLower))
    }
}
