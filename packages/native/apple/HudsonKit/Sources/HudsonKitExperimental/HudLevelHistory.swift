/// A bounded chronological ring of normalized live-level samples.
public struct HudLevelHistory: Equatable, Sendable {
    /// The maximum number of samples retained by this history.
    public let capacity: Int

    private var storage: [HudLevelSample?]
    private var oldestIndex = 0

    /// The number of retained samples.
    public private(set) var count = 0

    public init(capacity requestedCapacity: Int) {
        capacity = max(0, requestedCapacity)
        storage = Array(repeating: nil, count: capacity)
    }

    /// Retained samples ordered from oldest to newest.
    public var samples: [HudLevelSample] {
        guard capacity > 0, count > 0 else {
            return []
        }

        return (0..<count).compactMap { offset in
            storage[(oldestIndex + offset) % capacity]
        }
    }

    /// The most recently appended sample, when one is retained.
    public var latest: HudLevelSample? {
        guard capacity > 0, count > 0 else {
            return nil
        }

        return storage[(oldestIndex + count - 1) % capacity]
    }

    /// Appends a sample, replacing the oldest retained sample when full.
    public mutating func append(_ sample: HudLevelSample) {
        guard capacity > 0 else {
            return
        }

        if count < capacity {
            storage[(oldestIndex + count) % capacity] = sample
            count += 1
        } else {
            storage[oldestIndex] = sample
            oldestIndex = (oldestIndex + 1) % capacity
        }
    }

    /// Removes all retained samples while preserving the fixed capacity.
    public mutating func removeAll() {
        storage = Array(repeating: nil, count: capacity)
        oldestIndex = 0
        count = 0
    }

    public static func == (lhs: HudLevelHistory, rhs: HudLevelHistory) -> Bool {
        lhs.capacity == rhs.capacity && lhs.samples == rhs.samples
    }
}
