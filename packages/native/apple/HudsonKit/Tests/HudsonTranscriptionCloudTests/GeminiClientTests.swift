import Foundation
import Testing
@testable import HudsonTranscriptionCloud

private actor GeminiFixtureTransport: HudTranscriptionHTTPTransport {
    var requests: [URLRequest] = []
    var responses: [HudTranscriptionHTTPResponse]
    init(_ responses: [HudTranscriptionHTTPResponse]) { self.responses = responses }
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        requests.append(request)
        guard !responses.isEmpty else { throw HudTranscriptionHTTPError.invalidResponse }
        return responses.removeFirst()
    }
}

@Test func geminiUploadThenDedicatedInteractionAndDeletion() async throws {
    let fixture = GeminiFixtureTransport([
        .init(status: 200, headers: ["x-goog-upload-url": "https://example.com/upload/session?token=fixture"], body: Data()),
        .init(status: 200, body: Data(#"{"file":{"name":"files/fixture","uri":"https://example.com/files/fixture","state":"ACTIVE"}}"#.utf8)),
        .init(status: 200, body: Data(#"{"id":"interaction-fixture","model":"gemini-3.5-transcribe","status":"completed","steps":[{"type":"model_output","content":[{"type":"text","text":"Hello","annotations":[{"type":"word_info","text":"Hello","start_offset":"0s","end_offset":"1s","speaker":"spk_1"}]}]}]}"#.utf8)),
        .init(status: 200, body: Data())
    ])
    let client = HudGeminiFileClient(endpoint: try .init(URL(string: "https://example.com")!), transport: fixture)
    let file = try await client.upload(audio: Data([0, 1, 2]), mimeType: "audio/wav", displayName: "fixture", credential: "fixture-key")
    let result = try await client.transcribe(file: file, mimeType: "audio/wav", model: "gemini-3.5-transcribe", credential: "fixture-key", speakers: true, wordTimestamps: true)
    #expect(result.text == "Hello")
    #expect(result.words.first?.speaker == "spk_1")
    #expect(result.words.first?.start_offset == "0s")
    try await client.deleteFile(name: file.name, credential: "fixture-key")
    let requests = await fixture.requests
    #expect(requests.count == 4)
    #expect(requests[1].value(forHTTPHeaderField: "x-goog-api-key") == nil)
    #expect(requests[1].httpBody == Data([0, 1, 2]))
    #expect(requests[2].url?.path == "/v1beta/interactions")
    #expect(requests[3].httpMethod == "DELETE")
}

@Test func geminiRejectsConflictsWithoutSubmission() async throws {
    let fixture = GeminiFixtureTransport([])
    let client = HudGeminiFileClient(endpoint: try .init(URL(string: "https://example.com")!), transport: fixture)
    let file = try JSONDecoder().decode(HudGeminiFileClient.UploadedFile.self, from: Data(#"{"name":"files/fixture","uri":"https://example.com/files/fixture","state":"ACTIVE"}"#.utf8))
    await #expect(throws: HudTranscriptionHTTPError.incompatibleOptions) {
        _ = try await client.transcribe(file: file, mimeType: "audio/wav", model: "gemini-3.5-transcribe", credential: "fixture", vocabulary: ["Hudson"], speakers: true)
    }
    #expect(await fixture.requests.isEmpty)
}

@Test func geminiRejectsUploadRedirectToAnotherHost() async throws {
    let fixture = GeminiFixtureTransport([.init(status: 200, headers: ["x-goog-upload-url": "https://other.example/upload"], body: Data())])
    let client = HudGeminiFileClient(endpoint: try .init(URL(string: "https://example.com")!), transport: fixture)
    await #expect(throws: HudTranscriptionHTTPError.invalidResponse) {
        _ = try await client.upload(audio: Data([1]), mimeType: "audio/wav", displayName: "fixture", credential: "fixture")
    }
    #expect(await fixture.requests.count == 1)
}
