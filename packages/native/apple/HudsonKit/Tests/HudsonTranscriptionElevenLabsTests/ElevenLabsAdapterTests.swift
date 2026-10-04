import Foundation
import Testing
import HudsonTranscription
import HudsonTranscriptionCloud
import HudsonTranscriptionElevenLabs

private struct Credentials: HudTranscriptionCredentialResolver {
    func credential(for reference: HudTranscriptionCredentialReference) async throws -> Data { Data("fixture-key".utf8) }
}
private actor Transport: HudTranscriptionHTTPTransport {
    var requests: [URLRequest] = []
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        requests.append(request)
        return .init(status: 200, headers: ["request-id": "scribe-fixture"], body: Data(#"{"text":"Hello there","language_code":"eng","words":[{"text":"Hello","type":"word","start":0.1,"end":0.5,"speaker_id":"speaker_0"},{"text":" ","type":"spacing"},{"text":"there","type":"word","start":0.6,"end":0.9,"speaker_id":"speaker_0"}]}"#.utf8))
    }
}
@Test func scribeReferenceUsesPublicContractAndNormalizesWords() async throws {
    let file = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".wav")
    try Data([0, 1, 2, 3]).write(to: file)
    defer { try? FileManager.default.removeItem(at: file) }
    let transport = Transport()
    let adapter = HudElevenLabsTranscriptionAdapter(credentials: Credentials(), transport: transport)
    let registry = HudTranscriptionRegistry()
    try await registry.register(adapter)
    let config = HudTranscriptionConfiguration(providerID: adapter.descriptor.id, modelID: "scribe_v2", credentialReference: .init(identifier: "fixture"))
    let request = HudTranscriptionRequest(operationID: "op", source: .init(id: "source", kind: "meeting"), audio: .file(file), features: .init(wordTiming: true, speakerLabels: true), duration: 1)
    let candidates = await registry.evaluate(request: request, configurations: [config])
    #expect(candidates.first?.canRun == true)
    let operation = try await adapter.submit(request, configuration: config)
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    #expect(events.first == .accepted(providerRequestID: "scribe-fixture"))
    guard case .completed(let result) = events.last else { Issue.record("Missing result"); return }
    #expect(result.words?.count == 2)
    #expect(result.words?.first?.speakerID == "speaker_0")
    #expect(result.words?.first?.start == 0.1)
    #expect(result.provenance.configurationFingerprint.hasPrefix("sha256:"))
    let requests = await transport.requests
    #expect(requests.count == 1)
    #expect(requests.first?.url?.path == "/v1/speech-to-text")
    let body = String(data: requests.first?.httpBody ?? Data(), encoding: .utf8) ?? ""
    #expect(body.contains("scribe_v2"))
    #expect(body.contains("filename=\"audio.wav\""))
    #expect(!body.contains(file.lastPathComponent))
}
@Test func unsupportedScribeOptionsNeverSubmit() async throws {
    let transport = Transport()
    let adapter = HudElevenLabsTranscriptionAdapter(credentials: Credentials(), transport: transport)
    let config = HudTranscriptionConfiguration(providerID: adapter.descriptor.id, modelID: "scribe_v2")
    let request = HudTranscriptionRequest(operationID: "op", source: .init(id: "source", kind: "recording"), audio: .file(URL(fileURLWithPath: "/fixture.wav")), features: .init(vocabularyHints: ["Hudson"]), duration: 1)
    await #expect(throws: (any Error).self) { _ = try await adapter.submit(request, configuration: config) }
    #expect(await transport.requests.isEmpty)
}
