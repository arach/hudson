import Foundation
import Testing
import HudsonTranscription
@testable import HudsonTranscriptionFluidAudio

@Test func fluidAudioMissingModelDoesNotDownloadOnReadinessOrSubmit() async throws {
    let missing = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    let adapter = HudFluidAudioTranscriptionAdapter()
    let config = HudTranscriptionConfiguration(providerID: "fluidaudio", modelID: "parakeet-v3", localModel: .init(location: missing.path))
    #expect(try await adapter.readiness(configuration: config).status == .needsDownload)
    #expect(try await adapter.prepare(configuration: config).status == .needsDownload)
    let request = HudTranscriptionRequest(operationID: "fixture", source: .init(id: "source", kind: "recording"), audio: .file(missing.appending(path: "audio.wav")))
    await #expect(throws: (any Error).self) { _ = try await adapter.submit(request, configuration: config) }
    #expect(!FileManager.default.fileExists(atPath: missing.path))
}

@Test func fluidAudioRejectsUnsupportedSpeakerLabelsBeforePreparation() async throws {
    let adapter = HudFluidAudioTranscriptionAdapter()
    let config = HudTranscriptionConfiguration(providerID: "fluidaudio", modelID: "parakeet-v3")
    let request = HudTranscriptionRequest(operationID: "fixture", source: .init(id: "source", kind: "meeting"), audio: .file(URL(fileURLWithPath: "/fixture.wav")), features: .init(speakerLabels: true))
    #expect(adapter.compatibility(request: request, configuration: config).status == .unsupported)
    await #expect(throws: (any Error).self) { _ = try await adapter.submit(request, configuration: config) }
}

@Test func fluidAudioCancellationCannotPublishLateSuccess() async throws {
    let gate = AsyncStream<Void>.makeStream()
    let operation = await HudFluidAudioBatchOperation.start(operationID: "fixture") {
        for await _ in gate.stream { break }
        return .init(transcript: "Late result", completion: .completed,
            provenance: .init(providerID: "fluidaudio", modelID: "parakeet-v3", adapterVersion: "1", configurationFingerprint: "fixture", sourceDigest: "fixture", runID: "fixture", timestamp: Date()))
    }
    await operation.cancel()
    gate.continuation.yield(())
    gate.continuation.finish()
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    #expect(events == [.failed(.cancelled)])
}

@Test func fluidAudioLiveConsumesCallerPCMAndKeepsFinalSeparateFromTerminal() async throws {
    let live = await HudFluidAudioLiveSession.open(deadline: nil) { samples in
        #expect(samples == [-1, 0.5])
        return .init(transcript: "Fixture speech", completion: .completed,
            provenance: .init(providerID: "fluidaudio", modelID: "parakeet-v3", adapterVersion: "1", configurationFingerprint: "fixture", sourceDigest: "", runID: "fixture", timestamp: Date()))
    }
    try await live.send(.init(sequence: 0, bytes: Data([0, 128, 0, 64])))
    try await live.finish()
    var received: [HudTranscriptionLiveEvent] = []
    for await event in live.events { received.append(event) }
    #expect(received.count == 2)
    guard case .finalizedUtterance(let utterance) = received.first,
          case .terminal(let terminal) = received.last,
          case .completed(let result) = terminal.outcome else { Issue.record("Missing live results"); return }
    #expect(utterance.text == result.transcript)
    #expect(utterance.sequence < terminal.sequence)
    #expect(result.provenance.sourceDigest.count == 64)
    #expect(result.provenance.sessionID == live.sessionID.rawValue)
    await #expect(throws: HudTranscriptionError.lateWrite(.sessionTerminal)) { try await live.send(.init(sequence: 1, bytes: Data([0, 0]))) }
}


@MainActor
@Test func cancelledFluidAudioPreparationDoesNotStartModelWork() async throws {
    let adapter = HudFluidAudioTranscriptionAdapter()
    let configuration = HudTranscriptionConfiguration(providerID: "fluidaudio", modelID: "parakeet-v3",
        localModel: .init(location: FileManager.default.temporaryDirectory.appending(path: UUID().uuidString).path))
    let preparation = Task { try await adapter.prepare(configuration: configuration) }
    preparation.cancel()
    await #expect(throws: CancellationError.self) { try await preparation.value }
    #expect(try await adapter.readiness(configuration: configuration).status == .needsDownload)
}


@Test(.timeLimit(.minutes(1)))
func fluidAudioDeadlineEndsOperationBeforeUncooperativeInferenceReturns() async throws {
    let gate = FluidAudioInferenceGate()
    let operation = await HudFluidAudioBatchOperation.start(operationID: "deadline-fixture",
        deadline: Date().addingTimeInterval(0.05)) {
        await gate.wait()
        return .init(transcript: "Late result", completion: .completed,
            provenance: .init(providerID: "fluidaudio", modelID: "parakeet-v3", adapterVersion: "1",
                configurationFingerprint: "fixture", sourceDigest: "fixture", runID: "deadline-fixture", timestamp: Date()))
    }
    var received: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { received.append(event) }
    #expect(received == [.failed(.incompleteAudio)])
    // The stream must terminate before inference is released, even though the
    // inference fixture deliberately ignores task cancellation.
    await gate.release()
    await operation.cancel()
}

private actor FluidAudioInferenceGate {
    private var continuation: CheckedContinuation<Void, Never>?
    private var released = false

    func wait() async {
        guard !released else { return }
        await withCheckedContinuation { continuation = $0 }
    }

    func release() {
        released = true
        continuation?.resume()
        continuation = nil
    }
}

@Test(.timeLimit(.minutes(1)))
func cancelledFluidAudioLiveKeepsNativeLeaseUntilInferenceReturns() async throws {
    let resources = HudTranscriptionLocalResources()
    _ = try await resources.prepare(key: "parakeet-fixture") { 7 }
    let gate = FluidAudioInferenceGate()
    let started = AsyncStream<Void>.makeStream()
    let live = try await makeLeasedFixtureSession(resources: resources, gate: gate, started: started.continuation)
    let finish = Task { try await live.finish() }
    for await _ in started.stream { break }
    await live.cancel()
    #expect(await resources.unloadIfIdle() == false)
    let competing = try await resources.prepare(key: "other-local-model") { 9 }
    #expect(competing.status == .preparing)
    await gate.release()
    await #expect(throws: (any Error).self) { try await finish.value }
    let deadline = ContinuousClock.now.advanced(by: .seconds(2))
    var released = false
    while ContinuousClock.now < deadline {
        if await resources.unloadIfIdle() { released = true; break }
        try await Task.sleep(for: .milliseconds(5))
    }
    #expect(released)
    var events: [HudTranscriptionLiveEvent] = []
    for await event in live.events { events.append(event) }
    #expect(events.count == 1)
    guard case .terminal(let terminal) = events.first,
          case .cancelled = terminal.outcome else {
        Issue.record("Cancelled inference must not publish a late result")
        return
    }
}

private func makeLeasedFixtureSession(
    resources: HudTranscriptionLocalResources,
    gate: FluidAudioInferenceGate,
    started: AsyncStream<Void>.Continuation
) async throws -> HudFluidAudioLiveSession {
    let lease = try await resources.lease(key: "parakeet-fixture", as: Int.self)
    return await HudFluidAudioLiveSession.open(deadline: nil) { [lease] _ in
        try await lease.withValue { value in
            #expect(value == 7)
            started.yield(())
            started.finish()
            await gate.wait()
            try Task.checkCancellation()
            return HudTranscriptionResult(transcript: "Late result", completion: .completed,
                provenance: .init(providerID: "fluidaudio", modelID: "parakeet-v3", adapterVersion: "1",
                    configurationFingerprint: "fixture", sourceDigest: "fixture", runID: "fixture", timestamp: Date()))
        }
    }
}

@Test(.timeLimit(.minutes(1)))
func cancelledIdleFluidAudioLiveReleasesLeaseWhileSessionRemainsRetained() async throws {
    let resources = HudTranscriptionLocalResources()
    _ = try await resources.prepare(key: "parakeet-fixture") { 7 }
    let started = AsyncStream<Void>.makeStream()
    let live = try await makeLeasedFixtureSession(resources: resources, gate: FluidAudioInferenceGate(), started: started.continuation)
    #expect(await resources.unloadIfIdle() == false)
    await live.cancel()
    let deadline = ContinuousClock.now.advanced(by: .seconds(2))
    var released = false
    while ContinuousClock.now < deadline {
        if await resources.unloadIfIdle() { released = true; break }
        try await Task.sleep(for: .milliseconds(5))
    }
    #expect(released)
    await #expect(throws: HudTranscriptionError.sessionAlreadyTerminal) { try await live.finish() }
}
