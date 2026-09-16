import Foundation
import Testing
import HudsonTranscription
@testable import HudsonTranscriptionCloud

private actor OpenRouterFixtureTransport: HudTranscriptionHTTPTransport {
    var requests: [URLRequest] = []
    let status: Int
    init(status: Int = 200) { self.status = status }
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        requests.append(request)
        return .init(status: status, headers: ["x-generation-id": "generation-fixture"],
            body: Data(#"{"text":"Hello.","words":[{"word":"Hello.","start":0.1,"end":0.5,"speaker":2}],"usage":{"seconds":3,"cost":0.001}}"#.utf8))
    }
}

@Test func openRouterMAIEncodesAudioAndPreservesReceipt() async throws {
    let transport = OpenRouterFixtureTransport()
    let response = try await HudOpenRouterMAIClient(transport: transport).transcribe(
        audio: Data([1, 2, 3]), format: "wav", credential: " fixture ",
        features: .init(wordTiming: true, speakerLabels: true), timeout: 90)
    let request = try #require(await transport.requests.first)
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture")
    #expect(request.timeoutInterval == 60)
    let data = try #require(request.httpBody)
    let object = try JSONSerialization.jsonObject(with: data)
    let body = try #require(object as? [String: Any])
    #expect(body["model"] as? String == "microsoft/mai-transcribe-2")
    #expect((body["input_audio"] as? [String: String])?["data"] == "AQID")
    #expect(body["timestamp_granularities"] as? [String] == ["segment", "word"])
    let config = HudTranscriptionConfiguration(providerID: "openrouter-mai", modelID: "microsoft/mai-transcribe-2")
    let result = response.result(configuration: config, digest: "digest", operationID: "operation")
    #expect(result.provenance.providerRequestID == "generation-fixture")
    #expect(result.words?.first?.speakerID == "2")
    #expect(result.usage?.billedAudioSeconds == 3)
}

@Test func openRouterMAIRejectsWithoutRetryAndKeepsGenerationID() async throws {
    let transport = OpenRouterFixtureTransport(status: 503)
    await #expect(throws: HudTranscriptionHTTPError.rejected(status: 503, requestID: "generation-fixture")) {
        _ = try await HudOpenRouterMAIClient(transport: transport).transcribe(
            audio: Data([1]), format: "wav", credential: "fixture", features: .init(), timeout: 10)
    }
    #expect(await transport.requests.count == 1)
}
