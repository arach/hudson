import Testing
@testable import HudsonKitExperimental

@Suite("HudLevelSample")
struct HudLevelSampleTests {
    @Test("unit normalization clamps finite edges and canonicalizes negative zero")
    func unitNormalization() {
        #expect(HudLevelNormalizer.unit(-0.25) == 0)
        #expect(HudLevelNormalizer.unit(-0.0).sign == .plus)
        #expect(HudLevelNormalizer.unit(0.25) == 0.25)
        #expect(HudLevelNormalizer.unit(1.25) == 1)
    }

    @Test("unit normalization rejects non-finite input")
    func unitRejectsNonFiniteInput() {
        #expect(HudLevelNormalizer.unit(.nan) == 0)
        #expect(HudLevelNormalizer.unit(.infinity) == 0)
        #expect(HudLevelNormalizer.unit(-.infinity) == 0)
    }

    @Test("linear normalization preserves the golden decibel range")
    func goldenLinearRange() {
        #expect(HudLevelNormalizer.linear(-100, from: -80, to: 0) == 0)
        #expect(HudLevelNormalizer.linear(-80, from: -80, to: 0) == 0)
        #expect(HudLevelNormalizer.linear(-40, from: -80, to: 0) == 0.5)
        #expect(HudLevelNormalizer.linear(0, from: -80, to: 0) == 1)
        #expect(HudLevelNormalizer.linear(10, from: -80, to: 0) == 1)
    }

    @Test("linear normalization supports custom ranges")
    func customLinearRange() {
        #expect(HudLevelNormalizer.linear(15, from: 10, to: 30) == 0.25)
        #expect(HudLevelNormalizer.linear(20, from: 10, to: 30) == 0.5)
        #expect(
            HudLevelNormalizer.linear(
                0,
                from: -Double.greatestFiniteMagnitude,
                to: Double.greatestFiniteMagnitude
            ) == 0.5
        )
    }

    @Test("linear normalization rejects invalid inputs and bounds")
    func invalidLinearInputs() {
        #expect(HudLevelNormalizer.linear(.nan, from: 0, to: 1) == 0)
        #expect(HudLevelNormalizer.linear(.infinity, from: 0, to: 1) == 0)
        #expect(HudLevelNormalizer.linear(-.infinity, from: 0, to: 1) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: .nan, to: 1) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: -.infinity, to: 1) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: .infinity, to: 1) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: 0, to: .nan) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: 0, to: .infinity) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: 1, to: 0) == 0)
        #expect(HudLevelNormalizer.linear(0.5, from: 4, to: 4) == 0)
    }

    @Test("sample preserves its normalized invariant")
    func sampleInvariant() {
        #expect(HudLevelSample(unitValue: -0.0).unitValue == 0)
        #expect(HudLevelSample(unitValue: -0.0).unitValue.sign == .plus)
        #expect(HudLevelSample(unitValue: 0.75).unitValue == 0.75)
        #expect(HudLevelSample(unitValue: 2).unitValue == 1)
        #expect(HudLevelSample(unitValue: .nan).unitValue == 0)
    }

    @Test("sample is Sendable")
    func sampleIsSendable() {
        func requireSendable<T: Sendable>(_: T.Type) {}
        requireSendable(HudLevelSample.self)
    }
}
