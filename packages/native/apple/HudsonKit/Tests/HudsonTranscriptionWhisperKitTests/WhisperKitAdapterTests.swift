import Foundation
import Testing
import HudsonTranscription
@testable import HudsonTranscriptionWhisperKit

private actor FixtureRuntime: HudWhisperKitRuntime {
    private let transcript: HudWhisperKitTranscript
    private let transcribeGate: AsyncStream<Void>?
    private let loadGate: AsyncStream<Void>?
    private(set) var loadCount = 0
    private(set) var transcribeCount = 0
    private(set) var sawLoadCancellation = false

    init(
        transcript: HudWhisperKitTranscript,
        gate: AsyncStream<Void>? = nil,
        loadGate: AsyncStream<Void>? = nil
    ) {
        self.transcript = transcript
        self.transcribeGate = gate
        self.loadGate = loadGate
    }

    func load(modelFolder: URL) async throws -> HudWhisperKitSessionHandle {
        loadCount += 1
        let transcript = self.transcript
        let transcribeGate = self.transcribeGate
        do {
            if let loadGate {
                for await _ in loadGate { break }
            }
            try Task.checkCancellation()
        } catch is CancellationError {
            sawLoadCancellation = true
            throw CancellationError()
        }
        if Task.isCancelled {
            sawLoadCancellation = true
            throw CancellationError()
        }
        let fingerprint = HudWhisperKitLocalModels.configFingerprint(at: modelFolder)
        return HudWhisperKitSessionHandle(configFingerprint: fingerprint) { _ in
            await self.markTranscribe()
            if let transcribeGate {
                for await _ in transcribeGate { break }
            }
            try Task.checkCancellation()
            return transcript
        }
    }

    private func markTranscribe() {
        transcribeCount += 1
    }
}

private func makeModelFolder() throws -> URL {
    let folder = FileManager.default.temporaryDirectory.appending(path: "whisperkit-fixture-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    for name in HudWhisperKitLocalModels.requiredModelNames {
        try FileManager.default.createDirectory(
            at: folder.appending(path: "\(name).mlmodelc"),
            withIntermediateDirectories: true
        )
    }
    for name in HudWhisperKitLocalModels.requiredTokenizerNames {
        try Data("{}".utf8).write(to: folder.appending(path: name))
    }
    try Data(#"{"model_type":"whisper"}"#.utf8).write(to: folder.appending(path: "config.json"))
    return folder
}

private func makeAudioFile() throws -> URL {
    let file = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".wav")
    try Data([0, 1, 2, 3, 4, 5, 6, 7]).write(to: file)
    return file
}

private func configuration(modelFolder: URL, modelID: String = "openai_whisper-tiny") -> HudTranscriptionConfiguration {
    HudTranscriptionConfiguration(
        providerID: "whisperkit-reference",
        modelID: .init(rawValue: modelID),
        localModel: .init(location: modelFolder.path)
    )
}

private func fileRequest(
    audio: URL,
    operationID: String = "fixture",
    features: HudTranscriptionRequestedFeatures = .init(wordTiming: true),
    deadline: Date? = nil
) -> HudTranscriptionRequest {
    HudTranscriptionRequest(
        operationID: .init(rawValue: operationID),
        source: .init(id: "source", kind: "recording"),
        audio: .file(audio),
        features: features,
        deadline: deadline
    )
}

private func waitUntil(timeout: Duration = .seconds(1), _ condition: @escaping () async -> Bool) async throws {
    let limit = ContinuousClock.now.advanced(by: timeout)
    while ContinuousClock.now < limit {
        if await condition() { return }
        try await Task.sleep(for: .milliseconds(10))
    }
    Issue.record("Timed out waiting for fixture condition")
}

@Test func preparingAnotherModelWaitsForActiveInferenceBeforeEvictingIdleCache() async throws {
    let firstFolder = try makeModelFolder()
    let secondFolder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: firstFolder)
        try? FileManager.default.removeItem(at: secondFolder)
        try? FileManager.default.removeItem(at: audio)
    }
    let gate = AsyncStream<Void>.makeStream()
    let runtime = FixtureRuntime(transcript: nativeTranscript(), gate: gate.stream)
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let first = configuration(modelFolder: firstFolder)
    let second = configuration(modelFolder: secondFolder)
    #expect(try await adapter.prepare(configuration: first).isReady)
    let operation = try await adapter.submit(fileRequest(audio: audio), configuration: first)
    try await waitUntil { await runtime.transcribeCount == 1 }
    #expect(try await adapter.prepare(configuration: second).status == .preparing)
    #expect(try await adapter.readiness(configuration: first).isReady)
    #expect(await runtime.loadCount == 1)
    gate.continuation.finish()
    var completed = false
    for await event in operation.events {
        if case .completed(let result) = event {
            completed = result.transcript == "Hello there"
        }
    }
    #expect(completed)
    #expect(try await adapter.prepare(configuration: second).isReady)
    #expect(try await adapter.readiness(configuration: first).status == .unconfigured)
    #expect(try await adapter.prepare(configuration: first).isReady)
    #expect(await runtime.loadCount == 3)
    #expect(try await adapter.readiness(configuration: second).status == .unconfigured)
}

private func nativeTranscript() -> HudWhisperKitTranscript {
    HudWhisperKitTranscript(windows: [
        HudWhisperKitWindow(
            text: "Hello there",
            language: "en",
            segments: [
                HudWhisperKitNativeSegment(
                    text: "Hello there",
                    start: 0.1,
                    end: 0.9,
                    words: [
                        HudWhisperKitNativeWord(text: "Hello", start: 0.1, end: 0.4, confidence: 0.9),
                        HudWhisperKitNativeWord(text: "there", start: 0.5, end: 0.9, confidence: 0.8)
                    ]
                )
            ]
        )
    ])
}

@Test func whisperKitDescriptorIsLocalCustomReference() async throws {
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: FixtureRuntime(transcript: nativeTranscript()))
    #expect(adapter.descriptor.id.rawValue == "whisperkit-reference")
    #expect(adapter.descriptor.origin == .local)
    #expect(adapter.descriptor.maintainer.kind == .custom)
    #expect(adapter.descriptor.modelDiscovery == .adapterMetadata)
}

@Test func whisperKitRejectsUnsupportedFeaturesAndLiveInput() async throws {
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: FixtureRuntime(transcript: nativeTranscript()))
    let config = configuration(modelFolder: FileManager.default.temporaryDirectory)
    let audio = URL(fileURLWithPath: "/fixture.wav")
    let speakers = HudTranscriptionRequest(
        operationID: "fixture",
        source: .init(id: "source", kind: "meeting"),
        audio: .file(audio),
        features: .init(speakerLabels: true)
    )
    #expect(adapter.compatibility(request: speakers, configuration: config).status == .unsupported)
    await #expect(throws: (any Error).self) { _ = try await adapter.submit(speakers, configuration: config) }

    let vocabulary = HudTranscriptionRequest(
        operationID: "fixture",
        source: .init(id: "source", kind: "recording"),
        audio: .file(audio),
        features: .init(vocabularyHints: ["Hudson"])
    )
    #expect(adapter.compatibility(request: vocabulary, configuration: config).status == .unsupported)

    let clean = HudTranscriptionRequest(
        operationID: "fixture",
        source: .init(id: "source", kind: "recording"),
        audio: .file(audio),
        features: .init(style: .clean)
    )
    #expect(adapter.compatibility(request: clean, configuration: config).status == .unsupported)

    let live = HudTranscriptionRequest(
        operationID: "fixture",
        source: .init(id: "source", kind: "dictation"),
        audio: .pcm(.init(sampleRate: 16000, channelCount: 1, bitsPerSample: 16))
    )
    #expect(adapter.compatibility(request: live, configuration: config).status == .unsupported)
    await #expect(throws: HudTranscriptionError.self) {
        _ = try await adapter.openLive(live, configuration: config)
    }
}

@Test func whisperKitMissingModelDoesNotDownloadOnReadinessOrSubmit() async throws {
    let missing = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    let runtime = FixtureRuntime(transcript: nativeTranscript())
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: missing)
    #expect(try await adapter.readiness(configuration: config).status == .needsDownload)
    #expect(try await adapter.prepare(configuration: config).status == .needsDownload)
    let request = fileRequest(audio: missing.appending(path: "audio.wav"))
    await #expect(throws: (any Error).self) { _ = try await adapter.submit(request, configuration: config) }
    #expect(!FileManager.default.fileExists(atPath: missing.path))
    #expect(await runtime.loadCount == 0)
    #expect(await runtime.transcribeCount == 0)
}

@Test func whisperKitReadinessInspectsAssetsAndLoadedConfig() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let runtime = FixtureRuntime(transcript: nativeTranscript())
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    let before = try await adapter.readiness(configuration: config)
    #expect(before.status == .unconfigured)
    #expect(before.isReady == false)
    #expect(try await adapter.prepare(configuration: config).status == .ready)
    #expect(try await adapter.readiness(configuration: config).status == .ready)
    #expect(await runtime.loadCount == 1)

    try FileManager.default.removeItem(at: folder.appending(path: "AudioEncoder.mlmodelc"))
    let after = try await adapter.readiness(configuration: config)
    #expect(after.status == .needsDownload)
    #expect(after.isReady == false)
    #expect(try await adapter.prepare(configuration: config).status == .needsDownload)
    await #expect(throws: HudTranscriptionError.self) {
        _ = try await adapter.submit(fileRequest(audio: audio), configuration: config)
    }
    #expect(await runtime.transcribeCount == 0)
    #expect(await runtime.loadCount == 1)
}

@Test func whisperKitNormalizesNativeTimestampsAndSourceDigest() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: FixtureRuntime(transcript: nativeTranscript()))
    let config = configuration(modelFolder: folder)
    #expect(try await adapter.prepare(configuration: config).isReady)
    let operation = try await adapter.submit(fileRequest(audio: audio), configuration: config)
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    #expect(events.count == 1)
    guard case .completed(let result) = events.first else { Issue.record("Missing result"); return }
    #expect(result.transcript == "Hello there")
    #expect(result.language == "en")
    #expect(result.speakers == nil)
    #expect(result.segments?.count == 1)
    #expect(result.segments?.first?.start == 0.1)
    #expect(result.segments?.first?.end == 0.9)
    #expect(result.segments?.first?.confidence == nil)
    #expect(result.segments?.first?.annotationOrigin == .native)
    #expect(result.words?.count == 2)
    #expect(result.words?.first?.text == "Hello")
    #expect(result.words?.first?.start == 0.1)
    #expect(result.words?.first?.confidence == 0.9)
    #expect(result.words?.first?.speakerID == nil)
    #expect(result.words?.first?.annotationOrigin == .native)
    #expect(result.provenance.providerID.rawValue == "whisperkit-reference")
    #expect(result.provenance.modelID.rawValue == "openai_whisper-tiny")
    #expect(result.provenance.adapterVersion == "1")
    #expect(result.provenance.configurationFingerprint.hasPrefix("sha256:"))
    #expect(result.provenance.sourceDigest.count == 64)
    #expect(result.provenance.annotationOrigin == .native)
    #expect(FileManager.default.fileExists(atPath: audio.path))
    let listed = try await adapter.models(configuration: config)
    #expect(listed.contains { $0.id.rawValue == "openai_whisper-tiny" && $0.supportsLive == false })
}

@Test func whisperKitLeavesMissingWordAnnotationsNil() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let transcript = HudWhisperKitTranscript(windows: [
        HudWhisperKitWindow(
            text: "Hello",
            language: nil,
            segments: [HudWhisperKitNativeSegment(text: "Hello", start: 0, end: 0.4, words: nil)]
        )
    ])
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: FixtureRuntime(transcript: transcript))
    let config = configuration(modelFolder: folder)
    _ = try await adapter.prepare(configuration: config)
    let operation = try await adapter.submit(
        fileRequest(audio: audio, features: .init(wordTiming: true)),
        configuration: config
    )
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    guard case .completed(let result) = events.first else { Issue.record("Missing result"); return }
    #expect(result.words == nil)
    #expect(result.language == nil)
    #expect(result.speakers == nil)
    #expect(result.segments?.first?.start == 0)
}

@Test func whisperKitCancellationCannotPublishLateSuccess() async throws {
    let gate = AsyncStream<Void>.makeStream()
    let operation = await HudWhisperKitBatchOperation.start(operationID: "fixture") {
        for await _ in gate.stream { break }
        return .init(
            transcript: "Late result",
            completion: .completed,
            provenance: .init(
                providerID: "whisperkit-reference",
                modelID: "openai_whisper-tiny",
                adapterVersion: "1",
                configurationFingerprint: "fixture",
                sourceDigest: "fixture",
                runID: "fixture",
                timestamp: Date()
            )
        )
    }
    await operation.cancel()
    gate.continuation.yield(())
    gate.continuation.finish()
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    #expect(events == [.failed(.cancelled)])
}

@Test func whisperKitAdapterCancelDoesNotLeaveStaleSuccess() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let gate = AsyncStream<Void>.makeStream()
    let runtime = FixtureRuntime(transcript: nativeTranscript(), gate: gate.stream)
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    #expect(try await adapter.prepare(configuration: config).isReady)
    let operation = try await adapter.submit(fileRequest(audio: audio), configuration: config)
    await operation.cancel()
    gate.continuation.yield(())
    gate.continuation.finish()
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    #expect(events == [.failed(.cancelled)])
    #expect(FileManager.default.fileExists(atPath: audio.path))
}

@Test func whisperKitUnknownModelDoesNotSubstitute() async throws {
    let folder = try makeModelFolder()
    defer { try? FileManager.default.removeItem(at: folder) }
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: FixtureRuntime(transcript: nativeTranscript()))
    let config = configuration(modelFolder: folder, modelID: "openai_whisper-medium")
    let models = try await adapter.models(configuration: config)
    #expect(!models.contains { $0.id.rawValue == "openai_whisper-medium" })
    #expect(try await adapter.readiness(configuration: config).status == .unavailable)
    let request = fileRequest(audio: folder.appending(path: "audio.wav"))
    #expect(adapter.compatibility(request: request, configuration: config).status == .unsupported)
}

@Test func whisperKitErrorsDoNotExposePaths() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    struct ExplodingRuntime: HudWhisperKitRuntime {
        func load(modelFolder: URL) async throws -> HudWhisperKitSessionHandle {
            HudWhisperKitSessionHandle(configFingerprint: HudWhisperKitLocalModels.configFingerprint(at: modelFolder)) { request in
                throw NSError(
                    domain: "WhisperKit",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "failed at \(request.audioPath)"]
                )
            }
        }
    }
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: ExplodingRuntime())
    let config = configuration(modelFolder: folder)
    _ = try await adapter.prepare(configuration: config)
    let operation = try await adapter.submit(fileRequest(audio: audio), configuration: config)
    var events: [HudTranscriptionBatchEvent] = []
    for await event in operation.events { events.append(event) }
    guard case .failed(let error) = events.first else { Issue.record("Missing failure"); return }
    let text = error.errorDescription ?? ""
    #expect(!text.contains(audio.path))
    #expect(!text.contains(folder.path))
    #expect(text == "WhisperKit could not transcribe this recording.")
    #expect(FileManager.default.fileExists(atPath: audio.path))
}

@Test func whisperKitPrepareCancellationDoesNotMarkReady() async throws {
    let folder = try makeModelFolder()
    defer { try? FileManager.default.removeItem(at: folder) }
    let gate = AsyncStream<Void>.makeStream()
    let runtime = FixtureRuntime(transcript: nativeTranscript(), loadGate: gate.stream)
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    let prepareTask = Task {
        try await adapter.prepare(configuration: config)
    }
    try await waitUntil { await runtime.loadCount == 1 }
    prepareTask.cancel()
    gate.continuation.yield(())
    gate.continuation.finish()
    var prepareBecameReady = false
    do {
        let readiness = try await prepareTask.value
        prepareBecameReady = readiness.isReady
        #expect(readiness.status != .ready)
    } catch is CancellationError {
        prepareBecameReady = false
    } catch let error as HudTranscriptionError {
        #expect(error == .cancelled)
        prepareBecameReady = false
    }
    #expect(prepareBecameReady == false)
    let after = try await adapter.readiness(configuration: config)
    #expect(after.isReady == false)
    #expect(after.status != .ready)
    #expect(await runtime.sawLoadCancellation)
    #expect(await runtime.loadCount == 1)
}

@Test func whisperKitDeletedModelIsRejectedOnPrepareAndSubmit() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let runtime = FixtureRuntime(transcript: nativeTranscript())
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    #expect(try await adapter.prepare(configuration: config).isReady)
    try FileManager.default.removeItem(at: folder)
    let prepared = try await adapter.prepare(configuration: config)
    #expect(prepared.status == .needsDownload)
    #expect(prepared.isReady == false)
    #expect(try await adapter.readiness(configuration: config).status == .needsDownload)
    do {
        _ = try await adapter.submit(fileRequest(audio: audio), configuration: config)
        Issue.record("submit should reject a deleted local model")
    } catch let error as HudTranscriptionError {
        guard case .notReady(let readiness) = error else {
            Issue.record("expected notReady, got \(error)")
            return
        }
        #expect(readiness.isReady == false)
        #expect(readiness.status == .needsDownload)
    }
    #expect(await runtime.transcribeCount == 0)
    #expect(await runtime.loadCount == 1)
}

@Test func whisperKitStaleConfigIsRejectedOnPrepareAndSubmitUntilReloaded() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let runtime = FixtureRuntime(transcript: nativeTranscript())
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    #expect(try await adapter.prepare(configuration: config).isReady)
    try Data(#"{"model_type":"whisper","revision":"stale"}"#.utf8).write(
        to: folder.appending(path: "config.json")
    )
    #expect(try await adapter.readiness(configuration: config).isReady == false)
    do {
        _ = try await adapter.submit(fileRequest(audio: audio), configuration: config)
        Issue.record("submit should reject a stale loaded model")
    } catch let error as HudTranscriptionError {
        guard case .notReady(let readiness) = error else {
            Issue.record("expected notReady, got \(error)")
            return
        }
        #expect(readiness.isReady == false)
    }
    #expect(await runtime.transcribeCount == 0)
    #expect(try await adapter.prepare(configuration: config).isReady)
    #expect(await runtime.loadCount == 2)
}

@Test func whisperKitDeadlineCancelsQueuedInference() async throws {
    let folder = try makeModelFolder()
    let audio = try makeAudioFile()
    defer {
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.removeItem(at: audio)
    }
    let gate = AsyncStream<Void>.makeStream()
    let runtime = FixtureRuntime(transcript: nativeTranscript(), gate: gate.stream)
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    #expect(try await adapter.prepare(configuration: config).isReady)
    let first = try await adapter.submit(
        fileRequest(audio: audio, operationID: "first"),
        configuration: config
    )
    try await waitUntil { await runtime.transcribeCount == 1 }
    let queued = try await adapter.submit(
        fileRequest(audio: audio, operationID: "queued", deadline: Date().addingTimeInterval(0.15)),
        configuration: config
    )
    try await Task.sleep(for: .milliseconds(350))
    var queuedEvents: [HudTranscriptionBatchEvent] = []
    for await event in queued.events { queuedEvents.append(event) }
    #expect(queuedEvents == [.failed(.incompleteAudio)])
    #expect(await runtime.transcribeCount == 1)
    gate.continuation.yield(())
    gate.continuation.finish()
    var firstEvents: [HudTranscriptionBatchEvent] = []
    for await event in first.events { firstEvents.append(event) }
    guard case .completed = firstEvents.first else {
        Issue.record("held inference should complete after the queued deadline")
        return
    }
    #expect(await runtime.transcribeCount == 1)
    #expect(FileManager.default.fileExists(atPath: audio.path))
}

@Test func whisperKitRequiresCompleteTokenizerAndInvalidatesChangedContent() async throws {
    let folder = try makeModelFolder()
    defer { try? FileManager.default.removeItem(at: folder) }
    let runtime = FixtureRuntime(transcript: nativeTranscript())
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime)
    let config = configuration(modelFolder: folder)
    let tokenizerConfig = folder.appending(path: "tokenizer_config.json")
    try FileManager.default.removeItem(at: tokenizerConfig)
    #expect(try await adapter.prepare(configuration: config).status == .needsDownload)
    #expect(await runtime.loadCount == 0)
    try Data("invalid JSON".utf8).write(to: tokenizerConfig)
    #expect(try await adapter.prepare(configuration: config).status == .needsDownload)
    #expect(await runtime.loadCount == 0)
    try Data("{}".utf8).write(to: tokenizerConfig)
    #expect(try await adapter.prepare(configuration: config).isReady)
    try Data(#"{"changed":true}"#.utf8).write(to: tokenizerConfig)
    #expect(!(try await adapter.readiness(configuration: config).isReady))
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HUDSON_WHISPERKIT_MODEL_DIR"] != nil
    && ProcessInfo.processInfo.environment["HUDSON_TRANSCRIPTION_ACCEPTANCE_AUDIO"] != nil))
func nativeWhisperKitTranscribesAuthorizedFixture() async throws {
    let environment = ProcessInfo.processInfo.environment
    let folder = URL(fileURLWithPath: try #require(environment["HUDSON_WHISPERKIT_MODEL_DIR"]))
    let audio = URL(fileURLWithPath: try #require(environment["HUDSON_TRANSCRIPTION_ACCEPTANCE_AUDIO"]))
    let adapter = HudWhisperKitTranscriptionAdapter()
    let config = configuration(modelFolder: folder)
    #expect(try await adapter.prepare(configuration: config).isReady)
    let operation = try await adapter.submit(fileRequest(audio: audio, deadline: Date().addingTimeInterval(120)), configuration: config)
    var result: HudTranscriptionResult?
    for await event in operation.events {
        if case .completed(let completed) = event { result = completed }
        else { Issue.record("Native acceptance failed: \(event)") }
    }
    let transcript = try #require(result)
    #expect(transcript.transcript.localizedStandardContains("purple"))
    #expect(transcript.transcript.localizedStandardContains("lantern"))
    #expect(transcript.transcript.localizedStandardContains("table"))
    #expect(transcript.provenance.providerID.rawValue == "whisperkit-reference")
    #expect(transcript.words?.isEmpty == false)
}


@Test func whisperKitNativeTokenizerRejectsInvalidLocalContent() async throws {
    let folder = try makeModelFolder()
    defer { try? FileManager.default.removeItem(at: folder) }
    // Syntactically valid JSON passes readiness inspection, but is not a tokenizer.
    #expect(HudWhisperKitLocalModels.hasTokenizer(in: folder))
    await #expect(throws: (any Error).self) {
        _ = try await HudWhisperKitLocalTokenizer.load(from: folder)
    }
    try FileManager.default.removeItem(at: folder.appending(path: "tokenizer_config.json"))
    await #expect(throws: (any Error).self) {
        _ = try await HudWhisperKitLocalTokenizer.load(from: folder)
    }
}

@Test func whisperKitPreparationRespectsAnotherLocalEnginesLease() async throws {
    let folder = try makeModelFolder()
    defer { try? FileManager.default.removeItem(at: folder) }
    let resources = HudTranscriptionLocalResources()
    _ = try await resources.prepare(key: "another-engine") { 7 }
    var lease: HudTranscriptionLocalResources.Lease<Int>? = try await resources.lease(key: "another-engine", as: Int.self)
    let runtime = FixtureRuntime(transcript: nativeTranscript())
    let adapter = HudWhisperKitTranscriptionAdapter(runtime: runtime, resources: resources)
    let config = configuration(modelFolder: folder)
    #expect(lease != nil)
    #expect(try await adapter.prepare(configuration: config).status == .preparing)
    #expect(await runtime.loadCount == 0)
    #expect(await resources.isPrepared(key: "another-engine"))
    lease = nil
    try await waitUntil { await resources.unloadIfIdle() }
    #expect(try await adapter.prepare(configuration: config).isReady)
    #expect(await runtime.loadCount == 1)
    #expect(await resources.isPrepared(key: "another-engine") == false)
    _ = try await resources.prepare(key: "another-engine") { 9 }
    #expect(try await adapter.readiness(configuration: config).status == .unconfigured)
}
