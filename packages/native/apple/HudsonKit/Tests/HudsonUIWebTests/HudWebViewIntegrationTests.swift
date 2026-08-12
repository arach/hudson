import Testing
@testable import HudsonUIWeb

@Suite("HudWebViewIntegration")
@MainActor
struct HudWebViewIntegrationTests {
    @Test("reply completion is one-shot")
    func replyCompletesOnce() {
        var completions: [(Any?, String?)] = []
        var finishCount = 0
        let reply = HudWebViewReply(
            completion: { completions.append(($0, $1)) },
            didFinish: { finishCount += 1 }
        )

        reply.succeed("ok")
        reply.fail("late")
        reply.cancel()

        #expect(completions.count == 1)
        #expect(completions.first?.0 as? String == "ok")
        #expect(completions.first?.1 == nil)
        #expect(finishCount == 1)
        #expect(reply.isPending == false)
    }

    @Test("cancellation resolves a pending reply exactly once")
    func cancellationCompletesOnce() {
        var errors: [String?] = []
        let reply = HudWebViewReply(
            completion: { _, error in errors.append(error) },
            didFinish: {}
        )

        reply.cancel()
        reply.cancel()

        #expect(errors == ["cancelled"])
    }
}
