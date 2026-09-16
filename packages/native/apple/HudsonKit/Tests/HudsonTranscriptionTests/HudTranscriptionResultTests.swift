import Foundation
import HudsonTranscription
import Testing

@Suite("HudTranscription results")
struct HudTranscriptionResultTests {
    @Test("absent optional annotations stay missing after round-trip")
    func absentOptionalAnnotations() throws {
        let result = TranscriptionFixtures.result(transcript: "hello there")
        #expect(result.words == nil)
        #expect(result.segments == nil)
        #expect(result.speakers == nil)
        #expect(result.usage == nil)
        #expect(result.language == nil)
        #expect(result.provenance.providerRequestID == nil)

        let decoded = try JSONDecoder().decode(
            HudTranscriptionResult.self,
            from: JSONEncoder().encode(result)
        )
        #expect(decoded.transcript == "hello there")
        #expect(decoded.words == nil)
        #expect(decoded.segments == nil)
        #expect(decoded.speakers == nil)
        #expect(decoded.usage == nil)
        #expect(decoded.language == nil)
        #expect(decoded.provenance.annotationOrigin == .native)
    }

    @Test("missing timestamps and confidence remain optional on present words")
    func missingWordFieldsStayNil() throws {
        let word = HudTranscriptionWord(text: "hello", annotationOrigin: .derived)
        #expect(word.start == nil)
        #expect(word.end == nil)
        #expect(word.confidence == nil)
        #expect(word.speakerID == nil)

        let result = TranscriptionFixtures.result(
            words: [word],
            annotationOrigin: .derived
        )
        let decoded = try JSONDecoder().decode(
            HudTranscriptionResult.self,
            from: JSONEncoder().encode(result)
        )
        let decodedWord = try #require(decoded.words?.first)
        #expect(decodedWord.text == "hello")
        #expect(decodedWord.start == nil)
        #expect(decodedWord.confidence == nil)
        #expect(decodedWord.annotationOrigin == .derived)
        #expect(decoded.provenance.annotationOrigin == .derived)
    }
}
