import Foundation
import Testing
@testable import HudsonUI

@Suite("HudAgentReplySpeech")
struct HudAgentReplySpeechTests {
    @MainActor
    @Test("controller returns audio once for each completed reply revision")
    func audioOncePerReplyRevision() async throws {
        let recorder = HudAgentReplySpeechRecorder()
        let controller = HudAgentReplySpeechController(
            synthesizer: HudAgentReplySpeechSynthesizer { request in
                await recorder.record(request)
                return HudAgentReplySpeechAudio(
                    data: Data([1, 2, 3]),
                    format: .mp3,
                    mimeType: "audio/mpeg",
                    provider: "test",
                    voice: "voice-a"
                )
            }
        )

        let firstReply = HudAgentReplySpeechReply(
            id: "reply-1",
            conversationID: "conversation-a",
            revision: "one",
            text: "Hello"
        )
        let secondReply = HudAgentReplySpeechReply(
            id: "reply-1",
            conversationID: "conversation-a",
            revision: "two",
            text: "Hello again"
        )

        let first = try await controller.audioIfNeeded(for: firstReply)
        let duplicate = try await controller.audioIfNeeded(for: firstReply)
        let second = try await controller.audioIfNeeded(for: secondReply)

        #expect(first?.audio.data == Data([1, 2, 3]))
        #expect(duplicate == nil)
        #expect(second?.request.revision == "two")
        #expect(await recorder.count == 2)
    }

    @MainActor
    @Test("priming prevents old conversation history from speaking")
    func primeSkipsCurrentReply() async throws {
        let recorder = HudAgentReplySpeechRecorder()
        let controller = HudAgentReplySpeechController(
            synthesizer: HudAgentReplySpeechSynthesizer { request in
                await recorder.record(request)
                return HudAgentReplySpeechAudio(data: Data([9]), format: .caf)
            }
        )
        let existingReply = HudAgentReplySpeechReply(id: "old", text: "Already visible")

        controller.prime(with: existingReply)
        let output = try await controller.audioIfNeeded(for: existingReply)

        #expect(output == nil)
        #expect(await recorder.count == 0)
    }

    @MainActor
    @Test("incomplete and empty replies are ignored")
    func ignoresIneligibleReplies() async throws {
        let recorder = HudAgentReplySpeechRecorder()
        let controller = HudAgentReplySpeechController(
            synthesizer: HudAgentReplySpeechSynthesizer { request in
                await recorder.record(request)
                return HudAgentReplySpeechAudio(data: Data([4]), format: .wav)
            }
        )

        let incomplete = HudAgentReplySpeechReply(id: "working", text: "Soon", isComplete: false)
        let empty = HudAgentReplySpeechReply(id: "empty", text: "   ")

        #expect(try await controller.audioIfNeeded(for: incomplete) == nil)
        #expect(try await controller.audioIfNeeded(for: empty) == nil)
        #expect(await recorder.count == 0)
    }
}

private actor HudAgentReplySpeechRecorder {
    private var requests: [HudAgentReplySpeechRequest] = []

    var count: Int {
        requests.count
    }

    func record(_ request: HudAgentReplySpeechRequest) {
        requests.append(request)
    }
}
