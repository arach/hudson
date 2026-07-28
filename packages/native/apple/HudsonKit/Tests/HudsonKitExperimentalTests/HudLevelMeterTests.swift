import Testing
@testable import HudsonKitExperimental

@Suite("HudLevelMeter")
struct HudLevelMeterTests {
    @Test("bars trail from the newest edge, stay centered vertically, and remain chronological")
    func exactGeometry() {
        let samples = [sample(0), sample(0.5), sample(1)]
        let geometry = HudLevelMeterGeometry(samples: samples, width: 20, height: 10)

        #expect(geometry.width == 20)
        #expect(geometry.height == 10)
        #expect(geometry.baseline == 5)
        #expect(geometry.bars.map(\.sample) == samples)
        #expect(geometry.bars.map(\.x) == [7, 12, 17])
        #expect(geometry.bars.map(\.y) == [4, 2.5, 0])
        #expect(geometry.bars.map(\.width) == [3, 3, 3])
        #expect(geometry.bars.map(\.height) == [2, 5, 10])
    }

    @Test("a fitting suffix drops the oldest samples and keeps the newest trailing")
    func suffixTruncation() {
        let samples = (1...5).map { sample(Double($0) / 10) }
        let geometry = HudLevelMeterGeometry(samples: samples, width: 14, height: 20)

        #expect(geometry.bars.map(\.sample) == Array(samples.suffix(3)))
        #expect(geometry.bars.map(\.x) == [1, 6, 11])
        #expect(geometry.bars.last?.x == 11)
    }

    @Test("minimum visible height distinguishes silence from an empty meter")
    func minimumVisibleHeight() {
        let silence = HudLevelMeterGeometry(samples: [sample(0)], width: 3, height: 1)
        let empty = HudLevelMeterGeometry(samples: [], width: 3, height: 1)

        #expect(silence.bars.count == 1)
        #expect(silence.bars[0].height == 1)
        #expect(silence.bars[0].y == 0)
        #expect(empty.bars.isEmpty)
    }

    @Test("invalid and extreme dimensions stay finite and do not trap")
    func invalidAndExtremeDimensions() {
        let samples = [sample(0.5), sample(1)]
        let invalid = HudLevelMeterGeometry(samples: samples, width: .nan, height: -.infinity)
        #expect(invalid.width == 0)
        #expect(invalid.height == 0)
        #expect(invalid.baseline == 0)
        #expect(invalid.bars.isEmpty)

        let zeroHeight = HudLevelMeterGeometry(samples: samples, width: 20, height: 0)
        #expect(zeroHeight.bars.isEmpty)

        let extreme = HudLevelMeterGeometry(
            samples: samples,
            width: .greatestFiniteMagnitude,
            height: .greatestFiniteMagnitude
        )
        #expect(extreme.bars.count == 2)
        #expect(extreme.width.isFinite)
        #expect(extreme.height.isFinite)
        #expect(extreme.baseline.isFinite)
        #expect(extreme.bars.allSatisfy { $0.x.isFinite && $0.y.isFinite && $0.width.isFinite && $0.height.isFinite })
    }

    @Test("geometry is a Sendable value with logical equality")
    func copyingAndSendable() {
        let original = HudLevelMeterGeometry(samples: [sample(0.4)], width: 20, height: 10)
        let copy = original
        #expect(copy == original)

        func requireSendable<T: Sendable>(_: T.Type) {}
        requireSendable(HudLevelMeterBarGeometry.self)
        requireSendable(HudLevelMeterGeometry.self)
    }

    @Test("accessibility distinguishes empty history from silent samples")
    func accessibilitySnapshot() {
        let empty = HudLevelMeterAccessibility(samples: [])
        #expect(empty.sampleCount == 0)
        #expect(empty.currentPercent == nil)
        #expect(empty.peakPercent == nil)

        let silence = HudLevelMeterAccessibility(samples: [sample(0), sample(0)])
        #expect(silence.sampleCount == 2)
        #expect(silence.currentPercent == 0)
        #expect(silence.peakPercent == 0)

        let levels = HudLevelMeterAccessibility(samples: [sample(0.22), sample(0.76), sample(0.505)])
        #expect(levels.currentPercent == 51)
        #expect(levels.peakPercent == 76)
    }

    @Test("accessibility snapshots are Equatable Sendable values")
    func accessibilityCopyingAndSendable() {
        let original = HudLevelMeterAccessibility(samples: [sample(0.2)])
        #expect(original == HudLevelMeterAccessibility(samples: [sample(0.2)]))

        func requireSendable<T: Sendable>(_: T.Type) {}
        requireSendable(HudLevelMeterAccessibility.self)
    }
}

private func sample(_ unitValue: Double) -> HudLevelSample {
    HudLevelSample(unitValue: unitValue)
}
