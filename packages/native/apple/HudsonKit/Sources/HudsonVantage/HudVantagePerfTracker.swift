import Foundation

public struct HudVantagePerfCounters: Codable, Hashable, Sendable {
    public private(set) var values: [String: Int]

    public init(_ values: [String: Int] = [:]) {
        self.values = values
    }

    public subscript(_ name: String) -> Int {
        values[name, default: 0]
    }

    public var isEmpty: Bool {
        values.isEmpty
    }

    public mutating func increment(_ name: String, by amount: Int = 1) {
        values[name, default: 0] += amount
    }

    public mutating func set(_ name: String, to value: Int) {
        values[name] = value
    }

    public mutating func reset(_ name: String) {
        values.removeValue(forKey: name)
    }

    public mutating func resetAll(keepingCapacity: Bool = false) {
        values.removeAll(keepingCapacity: keepingCapacity)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        values = try container.decode([String: Int].self)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(values)
    }

    public func hash(into hasher: inout Hasher) {
        for key in values.keys.sorted() {
            hasher.combine(key)
            hasher.combine(values[key])
        }
    }
}

public struct HudVantagePerfTimingSample: Codable, Hashable, Sendable {
    public var name: String
    public var durationMS: Double
    public var recordedAt: Date

    public init(
        name: String,
        durationMS: Double,
        recordedAt: Date = Date()
    ) {
        self.name = name
        self.durationMS = max(0, durationMS)
        self.recordedAt = recordedAt
    }
}

public struct HudVantagePerfSnapshot: Codable, Hashable, Sendable {
    public var schemaVersion: Int
    public var counters: HudVantagePerfCounters
    public var timingSamples: [HudVantagePerfTimingSample]
    public var capturedAt: Date

    public init(
        schemaVersion: Int = 1,
        counters: HudVantagePerfCounters = HudVantagePerfCounters(),
        timingSamples: [HudVantagePerfTimingSample] = [],
        capturedAt: Date = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.counters = counters
        self.timingSamples = timingSamples
        self.capturedAt = capturedAt
    }
}

public struct HudVantagePerfTracker: Sendable {
    private var counters: HudVantagePerfCounters
    private var timingSamples: [HudVantagePerfTimingSample]

    public init(
        counters: HudVantagePerfCounters = HudVantagePerfCounters(),
        timingSamples: [HudVantagePerfTimingSample] = []
    ) {
        self.counters = counters
        self.timingSamples = timingSamples
    }

    public var isEmpty: Bool {
        counters.isEmpty && timingSamples.isEmpty
    }

    public func counter(_ name: String) -> Int {
        counters[name]
    }

    public func samples(named name: String? = nil) -> [HudVantagePerfTimingSample] {
        guard let name else {
            return timingSamples
        }
        return timingSamples.filter { $0.name == name }
    }

    public mutating func increment(_ name: String, by amount: Int = 1) {
        counters.increment(name, by: amount)
    }

    @discardableResult
    public mutating func recordTiming(
        _ name: String,
        durationMS: Double,
        recordedAt: Date = Date()
    ) -> HudVantagePerfTimingSample {
        let sample = HudVantagePerfTimingSample(
            name: name,
            durationMS: durationMS,
            recordedAt: recordedAt
        )
        timingSamples.append(sample)
        return sample
    }

    public mutating func reset() {
        counters.resetAll()
        timingSamples.removeAll()
    }

    public func snapshot(capturedAt: Date = Date()) -> HudVantagePerfSnapshot {
        HudVantagePerfSnapshot(
            counters: counters,
            timingSamples: timingSamples,
            capturedAt: capturedAt
        )
    }
}
