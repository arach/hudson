import Testing
@testable import HudsonUIAudio

@Suite("Installed Kokoro utterances")
struct HudSystemSpeechChunkingTests {
    @Test func preservesLongTextAndBoundsEveryPiece() {
        let text = Array(repeating: "A clear sentence stays readable.", count: 80).joined(separator: " ")
        let pieces = HudSystemSpeechChunking.pieces(text, voiceIdentifier: "app.voice.com.kokorovoice.af_bella")
        #expect(pieces.count > 1)
        #expect(pieces.allSatisfy { !$0.isEmpty && $0.count <= 300 })
        #expect(pieces.joined(separator: " ") == text)
    }
    @Test func leavesAppleVoicesUnsplit() {
        let text = String(repeating: "Read this. ", count: 100).trimmingCharacters(in: .whitespaces)
        #expect(HudSystemSpeechChunking.pieces(text, voiceIdentifier: "com.apple.voice.test") == [text])
    }
    @Test func splitsUnbrokenUnicodeWithoutLoss() {
        let text = String(repeating: "海", count: 1000)
        let pieces = HudSystemSpeechChunking.pieces(text, voiceIdentifier: "com.kokorovoice.test")
        #expect(pieces.allSatisfy { $0.count <= 300 })
        #expect(pieces.joined() == text)
    }
}
