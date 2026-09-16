import Foundation
import Testing
import HudsonTranscription
@testable import HudsonTranscriptionCloud

private struct MAICredentials: HudTranscriptionCredentialResolver {
    func credential(for reference: HudTranscriptionCredentialReference) async throws -> Data { Data("fixture".utf8) }
}
private actor MAIAdapterTransport: HudTranscriptionHTTPTransport {
    var count = 0
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        count += 1
        return .init(status: 200, headers: ["apim-request-id": "accepted-fixture"], body: Data(#"{"combinedPhrases":[{"text":"Hello."}],"phrases":[{"text":"Hello.","offsetMilliseconds":120,"durationMilliseconds":500,"speaker":2,"words":[{"text":"Hello.","offsetMilliseconds":120,"durationMilliseconds":500}]}]}"#.utf8))
    }
}

@Test func maiAdapterNormalizesResultAndEmitsAcceptedBeforeCompleted() async throws {
    let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("wav")
    try Data([0, 1, 2, 3]).write(to: file)
    defer { try? FileManager.default.removeItem(at: file) }
    let transport = MAIAdapterTransport()
    let adapter = HudMAITranscriptionAdapter(credentials: MAICredentials(), transport: transport)
    let config = HudTranscriptionConfiguration(providerID: "microsoft-mai", modelID: "MAI-Transcribe-2", endpoint: URL(string: "https://example.com"), credentialReference: .init(identifier: "fixture-key"))
    let request = HudTranscriptionRequest(operationID: "operation", source: .init(id: "source", kind: "recording"), audio: .file(file), features: .init(wordTiming: true, speakerLabels: true), duration: 1)
    let operation = try await adapter.submit(request, configuration: config)
    var received: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { received.append(event) }
    #expect(received.count == 2)
    #expect(received.first == .accepted(providerRequestID: "accepted-fixture"))
    guard case .completed(let result) = received.last else { Issue.record("Missing completed result"); return }
    #expect(result.words?.first?.start == 0.12)
    #expect(result.words?.first?.end == 0.62)
    #expect(result.words?.first?.speakerID == "2")
    #expect(result.provenance.sourceDigest.count == 64)
    #expect(result.provenance.modelID == "MAI-Transcribe-2")
    #expect(await transport.count == 1)
}

@Test func maiAdapterRejectsLongDiarizationBeforeNetwork() async throws {
    let transport = MAIAdapterTransport()
    let adapter = HudMAITranscriptionAdapter(credentials: MAICredentials(), transport: transport)
    let config = HudTranscriptionConfiguration(providerID: "microsoft-mai", modelID: "MAI-Transcribe-2")
    let request = HudTranscriptionRequest(operationID: "operation", source: .init(id: "source", kind: "meeting"), audio: .file(URL(fileURLWithPath: "/fixture.wav")), features: .init(speakerLabels: true), duration: 2700)
    #expect(adapter.compatibility(request: request, configuration: config).status == .unsupported)
    await #expect(throws: (any Error).self) { _ = try await adapter.submit(request, configuration: config) }
    #expect(await transport.count == 0)
}
