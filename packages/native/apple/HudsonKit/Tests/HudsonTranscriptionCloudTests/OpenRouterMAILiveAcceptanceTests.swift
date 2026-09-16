import Foundation
import Testing
import HudsonTranscription
import HudsonTranscriptionCloud

private struct LiveCredentials: HudTranscriptionCredentialResolver {
    func credential(for reference: HudTranscriptionCredentialReference) async throws -> Data {
        guard let value = ProcessInfo.processInfo.environment[reference.identifier], !value.isEmpty else {
            throw HudTranscriptionError.notReady(.init(status: .needsCredential))
        }
        return Data(value.utf8)
    }
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HUDSON_OPENROUTER_MAI_ACCEPTANCE_AUDIO"] != nil))
func openRouterMAILiveFileAcceptance() async throws {
    let environment = ProcessInfo.processInfo.environment
    let file = URL(fileURLWithPath: try #require(environment["HUDSON_OPENROUTER_MAI_ACCEPTANCE_AUDIO"]))
    let adapter = HudMAITranscriptionAdapter(route: .openRouter, credentials: LiveCredentials())
    let configuration = HudTranscriptionConfiguration(providerID: adapter.descriptor.id,
        modelID: "microsoft/mai-transcribe-2", credentialReference: .init(identifier: "OPENROUTER_API_KEY"))
    let request = HudTranscriptionRequest(operationID: .init(rawValue: UUID().uuidString),
        source: .init(id: "generated-speech", kind: "acceptance"), audio: .file(file),
        features: .init(wordTiming: true, speakerLabels: true), duration: 2.158186,
        deadline: Date().addingTimeInterval(90))
    let operation = try await adapter.submit(request, configuration: configuration)
    var completed: HudTranscriptionResult?
    for await event in operation.events {
        switch event {
        case .completed(let result): completed = result
        case .failed(let error): throw error
        default: break
        }
    }
    let result = try #require(completed)
    #expect(result.completion == .completed)
    for word in ["purple", "lantern", "table"] {
        #expect(result.transcript.localizedStandardContains(word))
    }
    #expect(result.provenance.sourceDigest.count == 64)
    #expect(result.provenance.runID == request.operationID.rawValue)
    #expect(result.provenance.providerRequestID != nil)
    #expect(result.usage?.billedAudioSeconds != nil)
    #expect(result.words?.isEmpty == false)
    #expect(result.words?.contains(where: { $0.speakerID != nil }) == true)
    if let output = environment["HUDSON_ACCEPTANCE_RESULT_PATH"] {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(result).write(to: URL(fileURLWithPath: output), options: .atomic)
    }
}
