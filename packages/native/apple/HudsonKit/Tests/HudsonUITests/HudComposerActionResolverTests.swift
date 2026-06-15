import Testing
@testable import HudsonUI

@Suite("HudComposerActionResolver")
struct HudComposerActionResolverTests {
    typealias R = HudComposerActionResolver

    @Test("idle + empty: primary disabled, return and escape are no-ops")
    func idleEmpty() {
        #expect(R.primaryKind(phase: .idle, hasText: false) == .sendDisabled)
        #expect(R.primaryAction(phase: .idle, hasText: false) == nil)
        #expect(R.returnAction(phase: .idle, hasText: false) == nil)
        #expect(R.commandReturnAction(phase: .idle, hasText: false) == nil)
        #expect(R.escapeAction(phase: .idle) == nil)
    }

    @Test("idle + text: send on primary, return, and command-return")
    func idleText() {
        #expect(R.primaryKind(phase: .idle, hasText: true) == .send)
        #expect(R.primaryAction(phase: .idle, hasText: true) == .submit)
        #expect(R.returnAction(phase: .idle, hasText: true) == .submit)
        #expect(R.commandReturnAction(phase: .idle, hasText: true) == .submit)
    }

    @Test("streaming + empty: stop on primary, return, and escape")
    func streamingEmpty() {
        #expect(R.primaryKind(phase: .streaming, hasText: false) == .stop)
        #expect(R.primaryAction(phase: .streaming, hasText: false) == .stop)
        #expect(R.returnAction(phase: .streaming, hasText: false) == .stop)
        #expect(R.escapeAction(phase: .streaming) == .stop)
    }

    @Test("streaming + text: queue on primary/return, steer on command-return, stop on escape")
    func streamingText() {
        #expect(R.primaryKind(phase: .streaming, hasText: true) == .queue)
        #expect(R.primaryAction(phase: .streaming, hasText: true) == .queue)
        #expect(R.returnAction(phase: .streaming, hasText: true) == .queue)
        #expect(R.commandReturnAction(phase: .streaming, hasText: true) == .steer)
        #expect(R.escapeAction(phase: .streaming) == .stop)
    }
}
