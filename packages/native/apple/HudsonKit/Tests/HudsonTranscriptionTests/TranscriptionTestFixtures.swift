import Foundation
import HudsonTranscription

final class FakeTranscriptionAdapter: HudTranscriptionAdapter, @unchecked Sendable {
    let descriptor: HudTranscriptionProviderDescriptor
    var listedModels: [HudTranscriptionModelDescriptor]
    var compatibilityResult: HudTranscriptionCompatibility
    var readinessResult: HudTranscriptionReadiness
    private(set) var compatibilityCalls: [(HudTranscriptionRequest, HudTranscriptionConfiguration)] = []

    init(
        descriptor: HudTranscriptionProviderDescriptor,
        listedModels: [HudTranscriptionModelDescriptor] = [TranscriptionFixtures.model()],
        compatibilityResult: HudTranscriptionCompatibility = .supported,
        readinessResult: HudTranscriptionReadiness = .ready
    ) {
        self.descriptor = descriptor
        self.listedModels = listedModels
        self.compatibilityResult = compatibilityResult
        self.readinessResult = readinessResult
    }

    func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        listedModels
    }

    func compatibility(
        request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) -> HudTranscriptionCompatibility {
        compatibilityCalls.append((request, configuration))
        return compatibilityResult
    }

    func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        readinessResult
    }
}

final class FakeBatchAdapter: HudTranscriptionAdapter, @unchecked Sendable {
    let descriptor: HudTranscriptionProviderDescriptor
    var listedModels: [HudTranscriptionModelDescriptor]
    var compatibilityResult: HudTranscriptionCompatibility
    var readinessResult: HudTranscriptionReadiness
    var providerRequestID: String
    var transcript: String

    init(
        descriptor: HudTranscriptionProviderDescriptor,
        listedModels: [HudTranscriptionModelDescriptor] = [TranscriptionFixtures.model()],
        providerRequestID: String,
        transcript: String = "hello"
    ) {
        self.descriptor = descriptor
        self.listedModels = listedModels
        self.compatibilityResult = .supported
        self.readinessResult = .ready
        self.providerRequestID = providerRequestID
        self.transcript = transcript
    }

    func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        listedModels
    }

    func compatibility(
        request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) -> HudTranscriptionCompatibility {
        compatibilityResult
    }

    func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        readinessResult
    }

    func submit(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionBatchOperation {
        let operation = MemoryBatchOperation(operationID: request.operationID)
        let result = TranscriptionFixtures.result(
            transcript: transcript,
            configuration: configuration,
            providerRequestID: providerRequestID,
            sourceDigest: request.source.digest ?? "digest"
        )
        Task {
            await operation.yield(.accepted(providerRequestID: providerRequestID))
            await operation.yield(.completed(result))
            await operation.finish()
        }
        return operation
    }
}

actor MemoryBatchOperation: HudTranscriptionBatchOperation {
    nonisolated let operationID: HudTranscriptionOperationID
    nonisolated let events: AsyncStream<HudTranscriptionBatchEvent>
    private let continuation: AsyncStream<HudTranscriptionBatchEvent>.Continuation

    init(operationID: HudTranscriptionOperationID) {
        self.operationID = operationID
        let stream = AsyncStream.makeStream(
            of: HudTranscriptionBatchEvent.self,
            bufferingPolicy: .unbounded
        )
        self.events = stream.stream
        self.continuation = stream.continuation
    }

    func yield(_ event: HudTranscriptionBatchEvent) {
        continuation.yield(event)
    }

    func finish() {
        continuation.finish()
    }

    func cancel() async {
        continuation.yield(.cancellation(.requested))
        continuation.yield(.cancellation(.cancelled))
        continuation.finish()
    }
}

enum TranscriptionFixtures {
    static func descriptor(
        id: String = "fake",
        displayName: String = "Fake",
        origin: HudTranscriptionOrigin = .remote
    ) -> HudTranscriptionProviderDescriptor {
        HudTranscriptionProviderDescriptor(
            id: HudTranscriptionProviderID(rawValue: id),
            displayName: displayName,
            adapterVersion: "1.0.0",
            maintainer: HudTranscriptionMaintainer(kind: .custom, name: "Tests"),
            origin: origin,
            platforms: [.macOS, .iOS],
            configurationSchema: [
                HudTranscriptionConfigurationField(
                    key: "model",
                    displayName: "Model",
                    kind: .model,
                    required: true
                ),
            ],
            modelDiscovery: .adapterMetadata
        )
    }

    static func model(
        id: String = "model-1",
        displayName: String = "Model 1",
        supportsBatch: Bool = true,
        supportsLive: Bool = true
    ) -> HudTranscriptionModelDescriptor {
        HudTranscriptionModelDescriptor(
            id: HudTranscriptionModelID(rawValue: id),
            displayName: displayName,
            supportsBatch: supportsBatch,
            supportsLive: supportsLive,
            languages: ["en"],
            timing: .unknown,
            speakers: .unknown,
            limits: HudTranscriptionModelLimits()
        )
    }

    static func configuration(
        providerID: String = "fake",
        modelID: String = "model-1"
    ) -> HudTranscriptionConfiguration {
        HudTranscriptionConfiguration(
            providerID: HudTranscriptionProviderID(rawValue: providerID),
            modelID: HudTranscriptionModelID(rawValue: modelID),
            credentialReference: HudTranscriptionCredentialReference(identifier: "vault.fake")
        )
    }

    static func fileRequest(
        duration: TimeInterval? = 12,
        features: HudTranscriptionRequestedFeatures = HudTranscriptionRequestedFeatures()
    ) -> HudTranscriptionRequest {
        HudTranscriptionRequest(
            operationID: "op-1",
            source: HudTranscriptionSourceIdentity(id: "source-1", kind: "recording", digest: "digest-1"),
            audio: .file(URL(fileURLWithPath: "/tmp/audio.wav")),
            features: features,
            duration: duration
        )
    }

    static func pcmRequest() -> HudTranscriptionRequest {
        HudTranscriptionRequest(
            operationID: "op-live",
            source: HudTranscriptionSourceIdentity(id: "mic-1", kind: "dictation"),
            audio: .pcm(pcmFormat())
        )
    }

    static func pcmFormat() -> HudTranscriptionPCMFormat {
        HudTranscriptionPCMFormat(sampleRate: 16_000, channelCount: 1, bitsPerSample: 16)
    }

    static func provenance(
        configuration: HudTranscriptionConfiguration,
        providerRequestID: String? = nil,
        sourceDigest: String = "digest-1",
        annotationOrigin: HudTranscriptionAnnotationOrigin = .native
    ) -> HudTranscriptionProvenance {
        HudTranscriptionProvenance(
            providerID: configuration.providerID,
            modelID: configuration.modelID,
            adapterVersion: "1.0.0",
            configurationFingerprint: configuration.secretFreeFingerprint,
            sourceDigest: sourceDigest,
            providerRequestID: providerRequestID,
            runID: "run-1",
            timestamp: Date(timeIntervalSince1970: 1_000),
            annotationOrigin: annotationOrigin
        )
    }

    static func result(
        transcript: String = "hello",
        configuration: HudTranscriptionConfiguration = configuration(),
        providerRequestID: String? = nil,
        sourceDigest: String = "digest-1",
        words: [HudTranscriptionWord]? = nil,
        segments: [HudTranscriptionSegment]? = nil,
        speakers: [HudTranscriptionSpeaker]? = nil,
        usage: HudTranscriptionUsage? = nil,
        annotationOrigin: HudTranscriptionAnnotationOrigin = .native
    ) -> HudTranscriptionResult {
        HudTranscriptionResult(
            transcript: transcript,
            segments: segments,
            words: words,
            speakers: speakers,
            completion: .completed,
            provenance: provenance(
                configuration: configuration,
                providerRequestID: providerRequestID,
                sourceDigest: sourceDigest,
                annotationOrigin: annotationOrigin
            ),
            usage: usage
        )
    }
}

func collectStream<Element: Sendable>(_ stream: AsyncStream<Element>) -> Task<[Element], Never> {
    Task {
        var elements: [Element] = []
        for await element in stream {
            elements.append(element)
        }
        return elements
    }
}
