import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudTTS providers", .serialized)
struct HudTTSProviderTests {
    @Test("default cloud registry includes every built-in adapter once")
    func defaultAdapterRegistry() {
        let adapters = HudTTSProviders.defaultCloudAdapters()
        let providerIDs = adapters.map { $0.providerID }

        #expect(providerIDs == [.openai, .elevenlabs, .groq, .gemini])
        #expect(Set(providerIDs).count == providerIDs.count)
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

    @Test("Groq uses current Orpheus constraints and request fields")
    func groqRequestContract() async throws {
        let session = HudTTSMockURLProtocol.session(body: Data([0x03, 0x04]))
        let adapter = GroqHudTTSProvider(
            endpoint: URL(string: "https://example.test/openai/v1/audio/speech")!
        )
        let longInput = String(repeating: "a", count: 205)

        let result = try await adapter.synthesize(
            HudTTSRequest(
                text: longInput,
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
        #expect((json["input"] as? String)?.count == GroqHudTTSProvider.maximumInputCharacters)
        #expect(json["response_format"] as? String == "mp3")
        #expect(json["speed"] as? Double == 5)
        #expect(result.format == .mp3)
        #expect(result.voice == "autumn")
    }

    @Test("Gemini authenticates by header and wraps returned PCM as WAV")
    func geminiRequestAndPCMContract() async throws {
        let pcm = Data([0x00, 0x01, 0x02, 0x03])
        let responseObject: [String: Any] = [
            "candidates": [[
                "content": [
                    "parts": [[
                        "inlineData": [
                            "mimeType": "audio/L16;codec=pcm;rate=22050",
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
        #expect(littleEndianUInt32(in: result.audioData, at: 24) == 22_050)
        #expect(littleEndianUInt32(in: result.audioData, at: 40) == UInt32(pcm.count))
        #expect(result.audioData.suffix(pcm.count) == pcm)
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

    static func session(
        status: Int = 200,
        body: Data,
        contentType: String = "application/json"
    ) -> URLSession {
        self.status = status
        self.body = body
        self.contentType = contentType
        self.lastRequest = nil
        self.lastBody = nil
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [HudTTSMockURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
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

    override func stopLoading() {}

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
