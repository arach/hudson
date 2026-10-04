import Foundation
import Testing
import HudsonTranscription
@testable import HudsonTranscriptionCloud

private struct GeminiCredentials: HudTranscriptionCredentialResolver {
    func credential(for reference: HudTranscriptionCredentialReference) async throws -> Data { Data("fixture".utf8) }
}
private actor GeminiAdapterFixture: HudTranscriptionHTTPTransport {
    var requests: [URLRequest] = []
    var events: [HudGeminiUploadEvent] = []
    let status: String
    let deletionStatus: Int
    init(status: String = "completed", deletionStatus: Int = 200) { self.status = status; self.deletionStatus = deletionStatus }
    func record(_ event: HudGeminiUploadEvent) { events.append(event) }
    func send(_ request: URLRequest) async throws -> HudTranscriptionHTTPResponse {
        requests.append(request)
        if request.httpMethod == "DELETE" { return .init(status: deletionStatus, body: Data()) }
        switch request.url?.path {
        case "/upload/v1beta/files": return .init(status: 200, headers: ["x-goog-upload-url": "https://example.com/upload/session"], body: Data())
        case "/upload/session": return .init(status: 200, body: Data(#"{"file":{"name":"files/fixture","uri":"https://example.com/files/fixture","state":"ACTIVE"}}"#.utf8))
        case "/v1beta/interactions":
            let response: [String: Any] = ["id": "interaction-1", "model": "gemini-3.5-transcribe-actual", "status": status,
                "outputs": [["type": "text", "text": "Hello.", "annotations": [["type": "word_info", "text": "Hello.", "start_offset": "0.25s", "end_offset": "0.75s", "speaker": "spk_1"]]]]]
            return .init(status: 200, body: try JSONSerialization.data(withJSONObject: response))
        default: throw HudTranscriptionHTTPError.invalidResponse
        }
    }
}

private func runGeminiFixture(_ fixture: GeminiAdapterFixture, failOwnership: Bool = false, failAllLedgerWrites: Bool = false) async throws -> [HudTranscriptionBatchEvent] {
    let file = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".wav")
    try Data([0, 1, 2, 3]).write(to: file)
    defer { try? FileManager.default.removeItem(at: file) }
    let adapter = HudGeminiTranscriptionAdapter(credentials: GeminiCredentials(), transport: fixture, uploadEvent: { event in
        if failAllLedgerWrites { throw HudTranscriptionError.invalidRequest("Fixture ledger unavailable") }
        if failOwnership, case .created = event { throw HudTranscriptionError.invalidRequest("Fixture persistence failure") }
        await fixture.record(event)
    })
    let config = HudTranscriptionConfiguration(providerID: "gemini-file", modelID: "gemini-3.5-transcribe", endpoint: URL(string: "https://example.com"), credentialReference: .init(identifier: "fixture"))
    let request = HudTranscriptionRequest(operationID: "operation", source: .init(id: "source", kind: "recording"), audio: .file(file), features: .init(wordTiming: true, speakerLabels: true), duration: 1)
    let operation = try await adapter.submit(request, configuration: config)
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    return events
}

@Test func geminiRejectsFortyFiveMinuteMeetingBeforeUpload() async throws {
    let fixture = GeminiAdapterFixture()
    let adapter = HudGeminiTranscriptionAdapter(credentials: GeminiCredentials(), transport: fixture,
        uploadEvent: { await fixture.record($0) })
    let config = HudTranscriptionConfiguration(providerID: "gemini-file", modelID: "gemini-3.5-transcribe",
        endpoint: URL(string: "https://example.com"), credentialReference: .init(identifier: "fixture"))
    // This nonexistent file proves validation precedes file access and upload.
    let file = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".wav")
    var request = HudTranscriptionRequest(operationID: "long-meeting",
        source: .init(id: "meeting", kind: "meeting"), audio: .file(file),
        features: .init(wordTiming: true, speakerLabels: true), duration: 2700)
    let check = adapter.compatibility(request: request, configuration: config)
    #expect(check.status == .unsupported)
    #expect(check.reasons.contains { $0.code == .durationExceeded })
    await #expect(throws: (any Error).self) {
        _ = try await adapter.submit(request, configuration: config)
    }
    #expect(await fixture.requests.isEmpty)
    #expect(await fixture.events.isEmpty)

    // The annotation limit must not accidentally become the plain-text limit.
    request.features = .init()
    #expect(adapter.compatibility(request: request, configuration: config).status == .supported)
    request.features = .init(wordTiming: true, speakerLabels: true)
    request.duration = 1800
    #expect(adapter.compatibility(request: request, configuration: config).status == .supported)
    request.duration = 1800.001
    #expect(adapter.compatibility(request: request, configuration: config).status == .unsupported)
}

@Test func geminiAdapterPreservesActualModelAndDeletesOwnedUpload() async throws {
    let fixture = GeminiAdapterFixture()
    let events = try await runGeminiFixture(fixture)
    #expect(events.first == .accepted(providerRequestID: "interaction-1"))
    guard case .completed(let result) = events.last else { Issue.record("Missing completed result"); return }
    #expect(result.transcript == "Hello.")
    #expect(result.words?.first?.start == 0.25)
    #expect(result.words?.first?.end == 0.75)
    #expect(result.words?.first?.speakerID == "spk_1")
    #expect(result.provenance.modelID.rawValue == "gemini-3.5-transcribe-actual")
    #expect(result.provenance.sourceDigest.count == 64)
    #expect(await fixture.events == [.created(operationID: "operation", name: "files/fixture"), .deleted(operationID: "operation", name: "files/fixture")])
    #expect(await fixture.requests.count == 4)
}

@Test func geminiCleanupFailureDoesNotDiscardTranscript() async throws {
    let fixture = GeminiAdapterFixture(deletionStatus: 503)
    let events = try await runGeminiFixture(fixture)
    guard case .completed = events.last else { Issue.record("Cleanup failure discarded completed transcript"); return }
    #expect(await fixture.events.last == .cleanupRequired(operationID: "operation", name: "files/fixture"))
    #expect(await fixture.requests.count == 4)
}

@Test func geminiIncompleteInteractionIsNotReportedAsSuccess() async throws {
    let fixture = GeminiAdapterFixture(status: "in_progress")
    let events = try await runGeminiFixture(fixture)
    guard case .failed = events.last else { Issue.record("Incomplete interaction became a completed transcript"); return }
    #expect(await fixture.events.last == .deleted(operationID: "operation", name: "files/fixture"))
}

@Test func geminiOwnershipFailureDeletesUploadBeforeAnyTranscription() async throws {
    let fixture = GeminiAdapterFixture()
    let events = try await runGeminiFixture(fixture, failOwnership: true)
    guard case .failed = events.last else { Issue.record("Ownership failure became success"); return }
    let requests = await fixture.requests
    #expect(!requests.contains { $0.url?.path == "/v1beta/interactions" })
    #expect(requests.last?.httpMethod == "DELETE")
    #expect(await fixture.events.last == .deleted(operationID: "operation", name: "files/fixture"))
}

@Test func geminiUnrecordableCleanupRemainsUnknown() async throws {
    let fixture = GeminiAdapterFixture(deletionStatus: 503)
    let events = try await runGeminiFixture(fixture, failAllLedgerWrites: true)
    #expect(events.last == .failed(.remoteOutcomeUnknown(providerRequestID: nil)))
    let requests = await fixture.requests
    #expect(!requests.contains { $0.url?.path == "/v1beta/interactions" })
    #expect(requests.last?.httpMethod == "DELETE")
}
