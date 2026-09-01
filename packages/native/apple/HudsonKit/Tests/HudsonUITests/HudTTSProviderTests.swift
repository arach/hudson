import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudTTS providers", .serialized)
struct HudTTSProviderTests {
    @Test("default cloud registry excludes Edge Read Aloud")
    func defaultAdapterRegistryExcludesEdgeReadAloud() {
        let adapters = HudTTSProviders.defaultCloudAdapters()
        let providerIDs = adapters.map { $0.providerID }

        #expect(providerIDs == [.openai, .elevenlabs, .groq, .gemini])
        #expect(!providerIDs.contains(.edgeReadAloud))
        #expect(Set(providerIDs).count == providerIDs.count)
    }

    @Test("Edge Read Aloud is available only by explicit opt-in")
    func edgeReadAloudIsExplicitOptIn() {
        let optedIn = HudTTSProviders.defaultCloudAdapters() + [HudTTSProviders.EdgeReadAloud()]
        #expect(optedIn.map(\.providerID).contains(.edgeReadAloud))
        #expect(optedIn.filter { $0.providerID == .edgeReadAloud }.count == 1)
    }

    @MainActor
    @Test("default HudTTS selectable providers omit Edge Read Aloud")
    func defaultHudTTSDoesNotSelectEdgeReadAloud() async {
        let tts = HudTTS(credentialSource: StaticTTSCredentialSource())
        let statuses = await tts.providerStatuses()
        #expect(!statuses.contains { $0.id == .edgeReadAloud })
    }

    @Test("Edge synthesis error mapping preserves CancellationError")
    func edgeReadAloudMappedErrorPreservesCancellation() {
        let mapped = EdgeReadAloudHudTTSProvider.mappedSynthesisError(CancellationError())
        #expect(mapped is CancellationError)
    }

    @Test("Edge synthesis error mapping normalizes URLError cancelled")
    func edgeReadAloudMappedErrorNormalizesURLErrorCancelled() {
        let mapped = EdgeReadAloudHudTTSProvider.mappedSynthesisError(URLError(.cancelled))
        #expect(mapped is CancellationError)
    }

    @Test("Edge synthesis error mapping normalizes NSURLErrorCancelled")
    func edgeReadAloudMappedErrorNormalizesNSURLErrorCancelled() {
        let nsError = NSError(domain: NSURLErrorDomain, code: NSURLErrorCancelled)
        let mapped = EdgeReadAloudHudTTSProvider.mappedSynthesisError(nsError)
        #expect(mapped is CancellationError)
    }

    @Test("Edge synthesis error mapping does not wrap HudTTSError")
    func edgeReadAloudMappedErrorPreservesHudTTSError() {
        let mapped = EdgeReadAloudHudTTSProvider.mappedSynthesisError(HudTTSError.emptyInput)
        guard case .emptyInput = mapped as? HudTTSError else {
            Issue.record("Expected emptyInput, got \(mapped)")
            return
        }
    }

    @Test("Edge synthesis error mapping wraps unexpected errors as networkUnavailable")
    func edgeReadAloudMappedErrorWrapsUnexpected() {
        struct Boom: Error {}
        let mapped = EdgeReadAloudHudTTSProvider.mappedSynthesisError(Boom())
        guard case let .networkUnavailable(provider, message) = mapped as? HudTTSError else {
            Issue.record("Expected networkUnavailable, got \(mapped)")
            return
        }
        #expect(provider == .edgeReadAloud)
        #expect(message.contains("unavailable"))
    }

    @Test("Edge Read Aloud cancelled synthesis stays CancellationError")
    func edgeReadAloudPreservesCancellation() async {
        let task = Task {
            try await EdgeReadAloudHudTTSProvider().synthesize(
                HudTTSRequest(text: "Hello"),
                context: context(session: .shared)
            )
        }
        task.cancel()

        do {
            _ = try await task.value
            Issue.record("Expected CancellationError")
        } catch is CancellationError {
            // Expected: cancellation must not become networkUnavailable.
        } catch let HudTTSError.networkUnavailable(_, message) {
            Issue.record("Cancellation was translated into networkUnavailable: \(message)")
        } catch {
            Issue.record("Expected CancellationError, got \(error)")
        }
    }

    @Test("Edge in-flight URLSession cancellation stays CancellationError")
    func edgeReadAloudInFlightURLSessionCancellation() async {
        let session = HudTTSMockURLProtocol.hangingSession()
        let task = Task {
            try await session.data(from: URL(string: "https://example.test/readaloud")!)
        }
        await HudTTSMockURLProtocol.waitUntilStarted()
        task.cancel()

        do {
            _ = try await task.value
            Issue.record("Expected in-flight URLSession cancellation to throw")
        } catch {
            let mapped = EdgeReadAloudHudTTSProvider.mappedSynthesisError(error)
            #expect(
                mapped is CancellationError,
                "in-flight URLSession error \(error) mapped to \(mapped)"
            )
        }
    }

    @Test("Edge Read Aloud chunks stay UTF-8 and XML safe")
    func edgeReadAloudChunking() {
        let text = String(repeating: "Résumé & analysis <evidence> ", count: 400)
        let chunks = EdgeReadAloudHudTTSProvider.escapedChunks(text)

        #expect(chunks.count > 1)
        #expect(chunks.allSatisfy { $0.utf8.count <= EdgeReadAloudHudTTSProvider.maximumTextBytes })
        #expect(chunks.allSatisfy { chunk in
            !chunk.contains("&") || chunk.split(separator: "&").dropFirst().allSatisfy { $0.contains(";") }
        })
        #expect(chunks.joined().contains("Résumé &amp; analysis &lt;evidence&gt;"))
    }

    @Test("Edge Read Aloud parses binary audio frames")
    func edgeReadAloudBinaryFrame() throws {
        let headers = Data("Path:audio\r\nContent-Type:audio/mpeg".utf8)
        let payload = Data([0x49, 0x44, 0x33, 0x04])
        let length = UInt16(headers.count + 2)
        var frame = Data([UInt8(length >> 8), UInt8(length & 0xff)])
        frame.append(headers)
        frame.append(Data("\r\n".utf8))
        frame.append(payload)

        let parsed = try EdgeReadAloudHudTTSProvider.parseBinaryFrame(frame)
        #expect(parsed.path == "audio")
        #expect(parsed.contentType == "audio/mpeg")
        #expect(parsed.payload == payload)
    }

    @Test("Edge Read Aloud security token is stable inside a five-minute window")
    func edgeReadAloudGECTimeBucket() {
        let start = Date(timeIntervalSince1970: 1_700_000_001)
        let sameBucket = Date(timeIntervalSince1970: 1_700_000_099)
        let laterBucket = Date(timeIntervalSince1970: 1_700_000_401)

        let first = EdgeReadAloudHudTTSProvider.secMSGEC(at: start)
        #expect(first.count == 64)
        #expect(first.allSatisfy { $0.isHexDigit && (!$0.isLetter || $0.isUppercase) })
        #expect(EdgeReadAloudHudTTSProvider.secMSGEC(at: sameBucket) == first)
        #expect(EdgeReadAloudHudTTSProvider.secMSGEC(at: laterBucket) != first)
    }

    @MainActor
    @Test("Edge Read Aloud manual live latency probe")
    func edgeReadAloudLiveProbe() async throws {
        guard ProcessInfo.processInfo.environment["HUDSON_EDGE_TTS_LIVE"] == "1" else {
            return
        }
        let text = "The passage argues that expertise changes as markets, technologies, and founders change."
        let started = Date()
        let result = try await EdgeReadAloudHudTTSProvider().synthesize(
            HudTTSRequest(text: text),
            context: context(session: .shared)
        )
        let elapsedMilliseconds = Int(Date().timeIntervalSince(started) * 1_000)
        print("HUDSON_EDGE_TTS_LIVE latency_ms=\(elapsedMilliseconds) bytes=\(result.audioData.count)")
        #expect(result.format == .mp3)
        #expect(result.audioData.count > 1_000)

        let timings = try #require(result.wordTimings)
        let spokenWords = text
            .components(separatedBy: .whitespaces)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { !$0.isEmpty }
        #expect(timings.map(\.word) == spokenWords)
        #expect(timings.allSatisfy { $0.start >= 0 && $0.end >= $0.start })
        #expect(zip(timings, timings.dropFirst()).allSatisfy { $0.start <= $1.start })
        for timing in timings {
            print("HUDSON_EDGE_TTS_LIVE word=\(timing.word) start=\(timing.start) end=\(timing.end)")
        }
        if let dumpDirectory = ProcessInfo.processInfo.environment["HUDSON_EDGE_TTS_DUMP_DIR"] {
            let url = URL(fileURLWithPath: dumpDirectory).appendingPathComponent("edge-live-probe.mp3")
            try result.audioData.write(to: url)
            print("HUDSON_EDGE_TTS_LIVE audio=\(url.path)")
        }

        let player = HudSpeechPlayer()
        try player.play(data: result.audioData, format: result.format)
        #expect(player.isPlaying)
        player.stop()
    }

    @Test("Edge Read Aloud parses word boundaries from metadata frames")
    func edgeReadAloudWordBoundaryMetadata() {
        // Frame recorded from a real Read Aloud session (2026-08-27), body
        // reformatted onto one line; the service pretty-prints the JSON.
        let frame = "X-RequestId:86B8A25408E04BC59A2DB79FD5138DD6\r\n"
            + "Content-Type:application/json; charset=utf-8\r\n"
            + "Path:audio.metadata\r\n"
            + "\r\n"
            + #"{"Metadata":[{"Type":"WordBoundary","Data":{"Offset":1000000,"Duration":750000,"text":{"Text":"The","Length":3,"BoundaryType":"WordBoundary"}}},{"Type":"WordBoundary","Data":{"Offset":1875000,"Duration":5000000,"text":{"Text":"passage","Length":7,"BoundaryType":"WordBoundary"}}},{"Type":"SentenceBoundary","Data":{"Offset":1000000,"Duration":5875000,"text":{"Text":"The passage","Length":11,"BoundaryType":"SentenceBoundary"}}}]}"#

        let timings = EdgeReadAloudHudTTSProvider.wordTimings(fromMetadataFrame: frame)

        #expect(timings == [
            HudTTSWordTiming(word: "The", start: 0.1, end: 0.175),
            HudTTSWordTiming(word: "passage", start: 0.1875, end: 0.6875),
        ])
    }

    @Test("Edge Read Aloud metadata parsing is lenient about malformed frames")
    func edgeReadAloudMalformedMetadata() {
        #expect(EdgeReadAloudHudTTSProvider.wordTimings(fromMetadataFrame: "Path:audio.metadata\r\n\r\nnot json").isEmpty)
        #expect(EdgeReadAloudHudTTSProvider.wordTimings(fromMetadataFrame: "no header boundary").isEmpty)
        #expect(EdgeReadAloudHudTTSProvider.wordTimings(
            fromMetadataFrame: "Path:audio.metadata\r\n\r\n{\"Metadata\":[{\"Type\":\"WordBoundary\"}]}"
        ).isEmpty)
    }

    @MainActor
    @Test("HudTTS routes custom cloud providers and forwards request options")
    func routesCustomCloudProvider() async throws {
        let recorder = TTSRequestRecorder()
        let tts = HudTTS(
            credentialSource: StaticTTSCredentialSource(),
            adapters: [RecordingTTSAdapter(recorder: recorder)]
        )

        let result = try await tts.synthesize(
            "  Hello Hudson  ",
            providerID: .groq,
            voice: "autumn",
            rate: 1.25,
            model: "orpheus-test",
            instructions: "Speak warmly"
        )
        let request = try #require(await recorder.lastRequest())

        #expect(request.text == "Hello Hudson")
        #expect(request.voice == "autumn")
        #expect(request.rate == 1.25)
        #expect(request.model == "orpheus-test")
        #expect(request.instructions == "Speak warmly")
        #expect(result.providerID == .groq)
    }

    @MainActor
    @Test("HudTTS preserves unknown-provider errors through generic routing")
    func preservesUnknownProviderError() async {
        let tts = HudTTS(
            credentialSource: StaticTTSCredentialSource(),
            adapters: []
        )

        do {
            _ = try await tts.synthesize("Hello", providerID: "missing-provider")
            Issue.record("Expected unknownProvider")
        } catch let HudTTSError.unknownProvider(provider) {
            #expect(provider == "missing-provider")
        } catch {
            Issue.record("Expected unknownProvider, got \(error)")
        }
    }

    @Test("OpenAI and ElevenLabs forward trimmed model overrides")
    func existingAdapterOverrides() async throws {
        let openAISession = HudTTSMockURLProtocol.session(body: Data([0x01]))
        let openAI = OpenAIHudTTSProvider(
            endpoint: URL(string: "https://example.test/v1/audio/speech")!
        )
        _ = try await openAI.synthesize(
            HudTTSRequest(
                text: "Hello",
                voice: "alloy",
                model: "  gpt-4o-mini-tts-test  ",
                instructions: "  Calm and direct.  "
            ),
            context: context(session: openAISession)
        )

        let openAIBody = try #require(HudTTSMockURLProtocol.lastBody)
        let openAIJSON = try #require(
            JSONSerialization.jsonObject(with: openAIBody) as? [String: Any]
        )
        #expect(openAIJSON["model"] as? String == "gpt-4o-mini-tts-test")
        #expect(openAIJSON["instructions"] as? String == "Calm and direct.")

        let elevenLabsSession = HudTTSMockURLProtocol.session(body: Data([0x02]))
        let elevenLabs = ElevenLabsHudTTSProvider()
        _ = try await elevenLabs.synthesize(
            HudTTSRequest(text: "Hello", model: "  eleven_flash_v2_5  "),
            context: context(session: elevenLabsSession)
        )

        let elevenLabsBody = try #require(HudTTSMockURLProtocol.lastBody)
        let elevenLabsJSON = try #require(
            JSONSerialization.jsonObject(with: elevenLabsBody) as? [String: Any]
        )
        #expect(elevenLabsJSON["model_id"] as? String == "eleven_flash_v2_5")
    }

    @Test("ElevenLabs can request assembler-ready 16 kHz WAV")
    func elevenLabsWAVOutput() async throws {
        let session = HudTTSMockURLProtocol.session(body: Data([0x52, 0x49, 0x46, 0x46]))
        let elevenLabs = ElevenLabsHudTTSProvider(outputFormat: .wav_16000)
        let result = try await elevenLabs.synthesize(
            HudTTSRequest(text: "Hello", voice: "voice-id"),
            context: context(session: session)
        )

        let request = try #require(HudTTSMockURLProtocol.lastRequest)
        let url = try #require(request.url)
        let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))
        #expect(components.queryItems?.contains(URLQueryItem(name: "output_format", value: "wav_16000")) == true)
        #expect(request.value(forHTTPHeaderField: "Accept") == "audio/wav")
        #expect(result.format == .wav)
    }

    @Test("ElevenLabs honors expressive voice settings and exact requested pace")
    func elevenLabsVoiceSettings() async throws {
        let session = HudTTSMockURLProtocol.session(body: Data([0x01]))
        let elevenLabs = ElevenLabsHudTTSProvider()
        _ = try await elevenLabs.synthesize(
            HudTTSRequest(
                text: "Move this explanation along.",
                rate: 1.12,
                voiceSettings: HudTTSVoiceSettings(
                    stability: 0.42,
                    similarityBoost: 0.81,
                    style: 0.24,
                    useSpeakerBoost: false
                )
            ),
            context: context(session: session)
        )

        let body = try #require(HudTTSMockURLProtocol.lastBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let settings = try #require(json["voice_settings"] as? [String: Any])
        #expect(settings["stability"] as? Double == 0.42)
        #expect(settings["similarity_boost"] as? Double == 0.81)
        #expect(settings["style"] as? Double == 0.24)
        #expect(settings["use_speaker_boost"] as? Bool == false)
        #expect(settings["speed"] as? Double == 1.12)
    }

    @Test("Groq uses current Orpheus constraints and request fields")
    func groqRequestContract() async throws {
        let session = HudTTSMockURLProtocol.session(body: Data([0x03, 0x04]))
        let adapter = GroqHudTTSProvider(
            endpoint: URL(string: "https://example.test/openai/v1/audio/speech")!
        )
        let maximumInput = String(
            repeating: "a",
            count: GroqHudTTSProvider.maximumInputCharacters
        )

        let result = try await adapter.synthesize(
            HudTTSRequest(
                text: maximumInput,
                rate: 12,
                model: "  canopylabs/orpheus-test  "
            ),
            context: context(session: session)
        )

        let sentRequest = try #require(HudTTSMockURLProtocol.lastRequest)
        let body = try #require(HudTTSMockURLProtocol.lastBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(sentRequest.value(forHTTPHeaderField: "Authorization") == "Bearer test-key")
        #expect(json["model"] as? String == "canopylabs/orpheus-test")
        #expect(json["voice"] as? String == "autumn")
        #expect(json["input"] as? String == maximumInput)
        #expect(json["response_format"] as? String == "wav")
        #expect(json["speed"] as? Double == 5)
        #expect(result.format == .wav)
        #expect(result.voice == "autumn")
    }

    @Test("Groq rejects over-limit text instead of silently truncating it")
    func groqRejectsOverLimitInput() async {
        let session = HudTTSMockURLProtocol.session(body: Data([0x03, 0x04]))
        let adapter = GroqHudTTSProvider(
            endpoint: URL(string: "https://example.test/openai/v1/audio/speech")!
        )
        let overLimitInput = String(
            repeating: "a",
            count: GroqHudTTSProvider.maximumInputCharacters + 1
        )

        do {
            _ = try await adapter.synthesize(
                HudTTSRequest(text: overLimitInput),
                context: context(session: session)
            )
            Issue.record("Expected Groq synthesisFailed")
        } catch let HudTTSError.synthesisFailed(provider, message) {
            #expect(provider == .groq)
            #expect(message.contains("at most 200 characters"))
            #expect(HudTTSMockURLProtocol.lastRequest == nil)
        } catch {
            Issue.record("Expected Groq synthesisFailed, got \(error)")
        }
    }

    @Test("Gemini authenticates by header and wraps returned PCM as WAV")
    func geminiRequestAndPCMContract() async throws {
        let pcm = Data([0x00, 0x01, 0x02, 0x03])
        let responseObject: [String: Any] = [
            "candidates": [[
                "content": [
                    "parts": [[
                        "inlineData": [
                            "mimeType": "audio/L16;codec=pcm;rate=22050;channels=2",
                            "data": pcm.base64EncodedString(),
                        ],
                    ]],
                ],
            ]],
        ]
        let responseBody = try JSONSerialization.data(withJSONObject: responseObject)
        let session = HudTTSMockURLProtocol.session(body: responseBody)

        let result = try await GeminiHudTTSProvider().synthesize(
            HudTTSRequest(
                text: "Hello Hudson",
                voice: "Kore",
                model: "  custom/model  ",
                instructions: "  Say warmly:  "
            ),
            context: context(session: session)
        )

        let sentRequest = try #require(HudTTSMockURLProtocol.lastRequest)
        let sentURL = try #require(sentRequest.url)
        #expect(sentRequest.value(forHTTPHeaderField: "x-goog-api-key") == "test-key")
        #expect(sentURL.query == nil)
        #expect(sentURL.absoluteString.contains("custom%2Fmodel:generateContent"))

        let body = try #require(HudTTSMockURLProtocol.lastBody)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        let contents = try #require(json["contents"] as? [[String: Any]])
        let parts = try #require(contents.first?["parts"] as? [[String: Any]])
        #expect(parts.first?["text"] as? String == "Say warmly:\n\nHello Hudson")
        let generation = try #require(json["generationConfig"] as? [String: Any])
        let speech = try #require(generation["speechConfig"] as? [String: Any])
        let voice = try #require(speech["voiceConfig"] as? [String: Any])
        let prebuilt = try #require(voice["prebuiltVoiceConfig"] as? [String: Any])
        #expect(prebuilt["voiceName"] as? String == "Kore")

        #expect(result.format == .wav)
        #expect(String(data: result.audioData.prefix(4), encoding: .utf8) == "RIFF")
        #expect(littleEndianUInt16(in: result.audioData, at: 22) == 2)
        #expect(littleEndianUInt32(in: result.audioData, at: 24) == 22_050)
        #expect(littleEndianUInt32(in: result.audioData, at: 40) == UInt32(pcm.count))
        #expect(result.audioData.suffix(pcm.count) == pcm)
    }

    @Test("Gemini rejects malformed PCM metadata and incomplete frames")
    func rejectsMalformedGeminiPCM() {
        expectUnsupportedPCM(
            Data([0x00, 0x01]),
            mimeType: "audio/L16;codec=pcm;rate=not-a-number"
        )
        expectUnsupportedPCM(
            Data([0x00, 0x01, 0x02]),
            mimeType: "audio/L16;codec=pcm;rate=24000"
        )
        expectUnsupportedPCM(
            Data([0x00, 0x01]),
            mimeType: "audio/L16;codec=pcm;rate=24000;channels=0"
        )
    }

    @Test("cloud adapters preserve provider HTTP error messages")
    func providerHTTPErrorMessages() async {
        let groqBody = Data("{\"error\":{\"message\":\"slow down\"}}".utf8)
        let groqSession = HudTTSMockURLProtocol.session(status: 429, body: groqBody)
        do {
            _ = try await GroqHudTTSProvider().synthesize(
                HudTTSRequest(text: "Hello"),
                context: context(session: groqSession)
            )
            Issue.record("Expected Groq providerRejectedRequest")
        } catch let HudTTSError.providerRejectedRequest(provider, status, message) {
            #expect(provider == .groq)
            #expect(status == 429)
            #expect(message == "Groq TTS: slow down")
        } catch {
            Issue.record("Expected Groq providerRejectedRequest, got \(error)")
        }

        let geminiBody = Data("{\"error\":{\"message\":\"invalid voice\"}}".utf8)
        let geminiSession = HudTTSMockURLProtocol.session(status: 400, body: geminiBody)
        do {
            _ = try await GeminiHudTTSProvider().synthesize(
                HudTTSRequest(text: "Hello"),
                context: context(session: geminiSession)
            )
            Issue.record("Expected Gemini providerRejectedRequest")
        } catch let HudTTSError.providerRejectedRequest(provider, status, message) {
            #expect(provider == .gemini)
            #expect(status == 400)
            #expect(message == "Gemini TTS: invalid voice")
        } catch {
            Issue.record("Expected Gemini providerRejectedRequest, got \(error)")
        }
    }

    private func context(session: URLSession) -> HudTTSAdapterContext {
        HudTTSAdapterContext(
            credentialSource: StaticTTSCredentialSource(),
            urlSession: session,
            requestTimeout: 5
        )
    }

    private func littleEndianUInt32(in data: Data, at offset: Int) -> UInt32 {
        UInt32(data[offset])
            | (UInt32(data[offset + 1]) << 8)
            | (UInt32(data[offset + 2]) << 16)
            | (UInt32(data[offset + 3]) << 24)
    }

    private func littleEndianUInt16(in data: Data, at offset: Int) -> UInt16 {
        UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)
    }

    private func expectUnsupportedPCM(_ audio: Data, mimeType: String) {
        do {
            _ = try GeminiHudTTSProvider.pcmWAV(audio: audio, mimeType: mimeType)
            Issue.record("Expected unsupported Gemini PCM metadata")
        } catch let HudTTSError.synthesisFailed(provider, _) {
            #expect(provider == .gemini)
        } catch {
            Issue.record("Expected synthesisFailed, got \(error)")
        }
    }
}

private struct StaticTTSCredentialSource: HudTTSCredentialSource {
    func get(_ key: String) async throws -> Data? {
        Data("test-key".utf8)
    }
}

private actor TTSRequestRecorder {
    private var request: HudTTSRequest?

    func record(_ request: HudTTSRequest) {
        self.request = request
    }

    func lastRequest() -> HudTTSRequest? {
        request
    }
}

private struct RecordingTTSAdapter: HudTTSProviderAdapter {
    let recorder: TTSRequestRecorder

    var providerID: HudTTSProviderID { .groq }
    var displayName: String { "Recording" }
    var credentialKey: String? { nil }
    var defaultVoice: String { "autumn" }

    func isAvailable(context: HudTTSAdapterContext) async -> Bool { true }

    func synthesize(
        _ request: HudTTSRequest,
        context: HudTTSAdapterContext
    ) async throws -> HudTTSResult {
        await recorder.record(request)
        return HudTTSResult(
            audioData: Data([0x01]),
            format: .mp3,
            providerID: providerID,
            voice: request.voice ?? defaultVoice
        )
    }
}

private final class HudTTSMockURLProtocol: URLProtocol {
    nonisolated(unsafe) static var status = 200
    nonisolated(unsafe) static var body = Data()
    nonisolated(unsafe) static var contentType = "application/json"
    nonisolated(unsafe) static var lastRequest: URLRequest?
    nonisolated(unsafe) static var lastBody: Data?
    nonisolated(unsafe) static var hangUntilCancelled = false
    nonisolated(unsafe) static var didStartLoading = false
    nonisolated(unsafe) static var startedContinuation: CheckedContinuation<Void, Never>?
    private static let lock = NSLock()

    static func session(
        status: Int = 200,
        body: Data,
        contentType: String = "application/json"
    ) -> URLSession {
        resetHangState()
        self.status = status
        self.body = body
        self.contentType = contentType
        self.lastRequest = nil
        self.lastBody = nil
        return makeSession()
    }

    static func hangingSession() -> URLSession {
        resetHangState()
        hangUntilCancelled = true
        return makeSession()
    }

    static func waitUntilStarted() async {
        await withCheckedContinuation { continuation in
            lock.lock()
            if didStartLoading {
                lock.unlock()
                continuation.resume()
            } else {
                startedContinuation = continuation
                lock.unlock()
            }
        }
    }

    private static func resetHangState() {
        lock.lock()
        hangUntilCancelled = false
        didStartLoading = false
        startedContinuation = nil
        lock.unlock()
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [HudTTSMockURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        if Self.hangUntilCancelled {
            Self.lock.lock()
            Self.didStartLoading = true
            let continuation = Self.startedContinuation
            Self.startedContinuation = nil
            Self.lock.unlock()
            continuation?.resume()
            return
        }
        Self.lastRequest = request
        Self.lastBody = request.httpBody ?? request.httpBodyStream.flatMap(Self.read)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: Self.status,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": Self.contentType]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {
        guard Self.hangUntilCancelled else { return }
        client?.urlProtocol(self, didFailWithError: URLError(.cancelled))
    }

    private static func read(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count > 0 {
                data.append(buffer, count: count)
            } else {
                break
            }
        }
        return data
    }
}
