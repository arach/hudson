import Foundation
import Testing
@testable import HudsonTranscriptionCloud

private actor MAIFixtureTransport: HudTranscriptionHTTPTransport {
    var requests: [URLRequest] = []
    let response: HudTranscriptionHTTPResponse
    init(response: HudTranscriptionHTTPResponse) { self.response = response }
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        requests.append(request)
        return response
    }
}

@Test func maiUsesRequiredModelAndPreservesMissingAnnotations() async throws {
    let transport = MAIFixtureTransport(response: .init(status: 200, headers: ["apim-request-id": "fixture-run"], body: Data(#"{"combinedPhrases":[{"text":"Hello world."}],"phrases":[{"text":"Hello world."}]}"#.utf8)))
    let client = HudMAITranscriptionClient(endpoint: try .init(URL(string: "https://example.com")!), transport: transport)
    let receipt = try await client.transcribe(audio: Data([1, 2, 3]), filename: "fixture.wav", mimeType: "audio/wav", credential: "fixture-only", options: .init(language: "en", vocabulary: ["Hudson"], wordTimestamps: true))
    #expect(receipt.response.text == "Hello world.")
    #expect(receipt.response.phrases?.first?.offsetMilliseconds == nil)
    #expect(receipt.response.phrases?.first?.confidence == nil)
    #expect(receipt.providerRequestID == "fixture-run")
    let requests = await transport.requests
    #expect(requests.count == 1)
    let request = try #require(requests.first)
    #expect(request.url?.path == "/speechtotext/transcriptions:transcribe")
    #expect(request.url?.query == "api-version=2025-10-15")
    let body = String(decoding: try #require(request.httpBody), as: UTF8.self)
    #expect(body.contains("MAI-Transcribe-2"))
    #expect(body.contains("\"timestamps\":\"word\""))
    #expect(body.contains("Hudson"))
    #expect(!body.contains("fixture-only"))
}

@Test func maiDoesNotRetryFailedSubmission() async throws {
    let transport = MAIFixtureTransport(response: .init(status: 503, body: Data("private vendor details".utf8)))
    let client = HudMAITranscriptionClient(endpoint: try .init(URL(string: "https://example.com")!), transport: transport)
    await #expect(throws: HudTranscriptionHTTPError.rejected(status: 503, requestID: nil)) {
        _ = try await client.transcribe(audio: Data([1]), filename: "f.wav", mimeType: "audio/wav", credential: "fixture", options: .init())
    }
    #expect(await transport.requests.count == 1)
}
