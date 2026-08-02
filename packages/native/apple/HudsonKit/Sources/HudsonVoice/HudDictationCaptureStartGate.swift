/// Serializes the permission-awaiting phase of microphone capture.
///
/// `AVAudioEngine` permits one tap per input bus and reports duplicate taps as
/// an Objective-C precondition failure rather than a recoverable Swift error.
/// Tokens let a delayed permission callback prove it still owns the pending
/// start before it touches the audio engine.
struct HudDictationCaptureStartGate {
    private(set) var isStarting = false
    private var generation: UInt = 0

    mutating func begin() -> UInt? {
        guard !isStarting else { return nil }
        generation &+= 1
        isStarting = true
        return generation
    }

    func isCurrent(_ candidate: UInt) -> Bool {
        isStarting && candidate == generation
    }

    @discardableResult
    mutating func finish(_ candidate: UInt) -> Bool {
        guard isCurrent(candidate) else { return false }
        isStarting = false
        return true
    }

    @discardableResult
    mutating func cancelIfStarting() -> Bool {
        guard isStarting else { return false }
        invalidate()
        return true
    }

    mutating func invalidate() {
        generation &+= 1
        isStarting = false
    }
}
