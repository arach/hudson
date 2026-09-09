import AVFoundation
import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudSystemSpeechSynthesizer identity")
@MainActor
struct HudSystemSpeechSynthesizerTests {
    @Test("stale didFinish does not complete a newer utterance")
    func staleFinishDoesNotCompleteNewerUtterance() {
        let synthesizer = HudSystemSpeechSynthesizer()
        let stale = AVSpeechUtterance(string: "old")
        let current = AVSpeechUtterance(string: "new")
        var completions = 0

        synthesizer.adopt(stale, completion: { completions += 1 })
        synthesizer.adopt(current, completion: { completions += 1 })
        #expect(synthesizer.isSpeaking)

        synthesizer.finishIfCurrent(stale)
        #expect(synthesizer.isSpeaking)
        #expect(completions == 0)

        synthesizer.finishIfCurrent(current)
        #expect(!synthesizer.isSpeaking)
        #expect(completions == 1)
    }

    @Test("stale didCancel does not clear a newer utterance")
    func staleCancelDoesNotClearNewerUtterance() {
        let synthesizer = HudSystemSpeechSynthesizer()
        let stale = AVSpeechUtterance(string: "old")
        let current = AVSpeechUtterance(string: "new")
        var completions = 0

        synthesizer.adopt(current, completion: { completions += 1 })
        #expect(synthesizer.isSpeaking)

        synthesizer.cancelIfCurrent(stale)
        #expect(synthesizer.isSpeaking)
        #expect(completions == 0)

        synthesizer.cancelIfCurrent(current)
        #expect(!synthesizer.isSpeaking)
        #expect(completions == 0)
    }
}
