/// Caller-time coalescing for normalized live-level samples.
public struct HudLevelCoalescer: Equatable, Sendable {
    /// The minimum elapsed time between emitted samples.
    public let minimumInterval: Duration

    private var lastEmissionElapsed: Duration?
    private var lastSeenElapsed: Duration?
    private var pendingPeak: HudLevelSample?

    public init(minimumInterval: Duration) {
        self.minimumInterval = minimumInterval < .zero ? .zero : minimumInterval
    }

    /// Observes one sample at caller-supplied monotonic elapsed session time.
    public mutating func observe(
        _ sample: HudLevelSample,
        elapsed: Duration
    ) -> HudLevelSample? {
        guard minimumInterval > .zero else {
            pendingPeak = nil
            lastEmissionElapsed = elapsed
            lastSeenElapsed = elapsed
            return sample
        }

        if let lastSeenElapsed, elapsed < lastSeenElapsed {
            pendingPeak = nil
            self.lastEmissionElapsed = elapsed
            self.lastSeenElapsed = elapsed
            return sample
        }

        lastSeenElapsed = elapsed

        guard let lastEmissionElapsed else {
            self.lastEmissionElapsed = elapsed
            return sample
        }

        if elapsed - lastEmissionElapsed >= minimumInterval {
            let emitted = peak(between: pendingPeak, and: sample)
            pendingPeak = nil
            self.lastEmissionElapsed = elapsed
            return emitted
        }

        pendingPeak = peak(between: pendingPeak, and: sample)
        return nil
    }

    /// Returns a held peak without changing the elapsed-time emission boundary.
    public mutating func flush() -> HudLevelSample? {
        defer { pendingPeak = nil }
        return pendingPeak
    }

    /// Clears elapsed-time and pending-peak state.
    public mutating func reset() {
        lastEmissionElapsed = nil
        lastSeenElapsed = nil
        pendingPeak = nil
    }

    private func peak(
        between first: HudLevelSample?,
        and second: HudLevelSample
    ) -> HudLevelSample {
        guard let first else {
            return second
        }

        return first.unitValue >= second.unitValue ? first : second
    }
}
