import Testing
@testable import HudsonKitExperimental

@Suite("HudLevelHistory")
struct HudLevelHistoryTests {
    @Test("ring wrap preserves chronological order")
    func ringWrapOrder() {
        var history = HudLevelHistory(capacity: 3)
        history.append(sample(0.1))
        history.append(sample(0.2))
        history.append(sample(0.3))
        history.append(sample(0.4))

        #expect(history.samples == [sample(0.2), sample(0.3), sample(0.4)])
        #expect(history.latest == sample(0.4))
        #expect(history.count == 3)
    }

    @Test("zero negative and one capacity histories retain the documented amount")
    func capacities() {
        var zero = HudLevelHistory(capacity: 0)
        zero.append(sample(0.5))
        #expect(zero.capacity == 0)
        #expect(zero.samples == [])
        #expect(zero.latest == nil)
        #expect(zero.count == 0)

        var negative = HudLevelHistory(capacity: -2)
        negative.append(sample(0.5))
        #expect(negative.capacity == 0)
        #expect(negative.samples == [])

        var one = HudLevelHistory(capacity: 1)
        one.append(sample(0.2))
        one.append(sample(0.8))
        #expect(one.samples == [sample(0.8)])
        #expect(one.latest == sample(0.8))
        #expect(one.count == 1)
    }

    @Test("latest count and removeAll reflect logical contents")
    func removal() {
        var history = HudLevelHistory(capacity: 2)
        #expect(history.latest == nil)
        history.append(sample(0.3))
        history.append(sample(0.6))
        #expect(history.count == 2)
        #expect(history.latest == sample(0.6))

        history.removeAll()
        #expect(history.count == 0)
        #expect(history.samples == [])
        #expect(history.latest == nil)
        #expect(history.capacity == 2)
    }

    @Test("history equality is logical and value copies are independent")
    func copyingAndEquality() {
        var original = HudLevelHistory(capacity: 2)
        original.append(sample(0.2))
        var copy = original
        #expect(copy == original)

        copy.append(sample(0.8))
        #expect(copy != original)
        #expect(original.samples == [sample(0.2)])

        var differentCapacity = HudLevelHistory(capacity: 3)
        differentCapacity.append(sample(0.2))
        #expect(differentCapacity != original)
    }

    @Test("history is Sendable")
    func historyIsSendable() {
        func requireSendable<T: Sendable>(_: T.Type) {}
        requireSendable(HudLevelHistory.self)
    }
}

@Suite("HudLevelCoalescer")
struct HudLevelCoalescerTests {
    @Test("first observation emits immediately and later observations retain the peak")
    func firstAndPeak() {
        var coalescer = HudLevelCoalescer(minimumInterval: .seconds(1))
        #expect(coalescer.observe(sample(0.2), elapsed: .zero) == sample(0.2))
        #expect(coalescer.observe(sample(0.8), elapsed: .seconds(0.2)) == nil)
        #expect(coalescer.observe(sample(0.4), elapsed: .seconds(1)) == sample(0.8))
    }

    @Test("a long jump emits at most one sample")
    func longJump() {
        var coalescer = HudLevelCoalescer(minimumInterval: .seconds(1))
        #expect(coalescer.observe(sample(0.2), elapsed: .zero) == sample(0.2))
        #expect(coalescer.observe(sample(0.7), elapsed: .seconds(0.1)) == nil)
        #expect(coalescer.observe(sample(0.1), elapsed: .seconds(10)) == sample(0.7))
        #expect(coalescer.observe(sample(0.5), elapsed: .seconds(10.1)) == nil)
    }

    @Test("flush returns and clears the pending peak without resetting elapsed state")
    func flushing() {
        var coalescer = HudLevelCoalescer(minimumInterval: .seconds(1))
        #expect(coalescer.observe(sample(0.2), elapsed: .zero) == sample(0.2))
        #expect(coalescer.observe(sample(0.8), elapsed: .seconds(0.2)) == nil)
        #expect(coalescer.flush() == sample(0.8))
        #expect(coalescer.flush() == nil)
        #expect(coalescer.observe(sample(0.5), elapsed: .seconds(0.5)) == nil)
    }

    @Test("reset clears pending and elapsed state")
    func resetting() {
        var coalescer = HudLevelCoalescer(minimumInterval: .seconds(1))
        #expect(coalescer.observe(sample(0.2), elapsed: .zero) == sample(0.2))
        #expect(coalescer.observe(sample(0.8), elapsed: .seconds(0.2)) == nil)
        coalescer.reset()
        #expect(coalescer.observe(sample(0.4), elapsed: .seconds(0.5)) == sample(0.4))
        #expect(coalescer.flush() == nil)
    }

    @Test("regressive elapsed from a pending window clears old state and emits immediately")
    func regressiveElapsed() {
        var coalescer = HudLevelCoalescer(minimumInterval: .seconds(1))
        #expect(coalescer.observe(sample(0.2), elapsed: .seconds(10)) == sample(0.2))
        #expect(coalescer.observe(sample(0.8), elapsed: .seconds(10.8)) == nil)
        #expect(coalescer.observe(sample(0.3), elapsed: .seconds(10.5)) == sample(0.3))
        #expect(coalescer.observe(sample(0.4), elapsed: .seconds(11.5)) == sample(0.4))
    }

    @Test("zero and negative intervals pass through every observation")
    func nonPositiveIntervals() {
        var zero = HudLevelCoalescer(minimumInterval: .zero)
        #expect(zero.minimumInterval == .zero)
        #expect(zero.observe(sample(0.2), elapsed: .seconds(2)) == sample(0.2))
        #expect(zero.observe(sample(0.8), elapsed: .seconds(1)) == sample(0.8))

        var negative = HudLevelCoalescer(minimumInterval: .seconds(-1))
        #expect(negative.minimumInterval == .zero)
        #expect(negative.observe(sample(0.3), elapsed: .seconds(2)) == sample(0.3))
        #expect(negative.observe(sample(0.9), elapsed: .seconds(1)) == sample(0.9))
    }

    @Test("coalescer is Sendable")
    func coalescerIsSendable() {
        func requireSendable<T: Sendable>(_: T.Type) {}
        requireSendable(HudLevelCoalescer.self)
    }
}

private func sample(_ unitValue: Double) -> HudLevelSample {
    HudLevelSample(unitValue: unitValue)
}
