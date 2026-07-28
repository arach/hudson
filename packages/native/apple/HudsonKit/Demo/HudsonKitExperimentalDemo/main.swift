import HudsonKitExperimental

print("unit(-0.25) = \(HudLevelNormalizer.unit(-0.25))")
print("unit(0.5) = \(HudLevelNormalizer.unit(0.5))")
print("unit(1.25) = \(HudLevelNormalizer.unit(1.25))")
print("linear(-100, -80...0) = \(HudLevelNormalizer.linear(-100, from: -80, to: 0))")
print("linear(-40, -80...0) = \(HudLevelNormalizer.linear(-40, from: -80, to: 0))")
print("linear(10, -80...0) = \(HudLevelNormalizer.linear(10, from: -80, to: 0))")

var coalescer = HudLevelCoalescer(minimumInterval: .seconds(1))
var history = HudLevelHistory(capacity: 2)
let events: [(label: String, elapsed: Duration, sample: HudLevelSample)] = [
    ("0s", .zero, HudLevelSample(unitValue: 0.2)),
    ("0.2s", .seconds(0.2), HudLevelSample(unitValue: 0.8)),
    ("1s", .seconds(1), HudLevelSample(unitValue: 0.4)),
    ("1.2s", .seconds(1.2), HudLevelSample(unitValue: 0.3)),
    ("2s", .seconds(2), HudLevelSample(unitValue: 0.9)),
]

for event in events {
    if let emitted = coalescer.observe(event.sample, elapsed: event.elapsed) {
        history.append(emitted)
        print("coalesced(\(event.label), \(event.sample.unitValue)) = \(emitted.unitValue)")
    } else {
        print("coalesced(\(event.label), \(event.sample.unitValue)) = held")
    }
}

print("history(capacity: \(history.capacity)) = \(history.samples.map(\.unitValue))")
