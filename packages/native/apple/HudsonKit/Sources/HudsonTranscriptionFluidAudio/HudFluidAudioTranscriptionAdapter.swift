import Foundation
import CryptoKit
import FluidAudio
import HudsonTranscription

/// Direct in-process FluidAudio implementation. Capture remains owned by the caller.
public actor HudFluidAudioTranscriptionAdapter: HudTranscriptionAdapter {
    public nonisolated let descriptor = HudTranscriptionProviderDescriptor(
        id: "fluidaudio", displayName: "Parakeet (FluidAudio)", adapterVersion: "1",
        maintainer: .init(kind: .maintained, name: "Hudson"), origin: .local,
        platforms: [.macOS, .iOS], configurationSchema: [
            .init(key: "localModel", displayName: "Model directory", kind: .localModelLocation, required: false)
        ], modelDiscovery: .adapterMetadata)
    private let resources: HudTranscriptionLocalResources

    public init(resources: HudTranscriptionLocalResources = .init()) {
        self.resources = resources
    }

    public func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        ["parakeet-v3", "parakeet-v2"].map { id in
            .init(id: .init(rawValue: id), displayName: id == "parakeet-v3" ? "Parakeet V3" : "Parakeet V2", supportsBatch: true, supportsLive: true,
                  timing: .word, speakers: .none, inputFormats: ["wav", "mp3", "m4a", "flac", "aiff", "caf", "pcm16le-mono-16000"],
                  limits: .init(maximumSessionDuration: .seconds(120)),
                  evidence: .init(documentationURL: URL(string: "https://github.com/FluidInference/FluidAudio"), notes: "Direct FluidAudio 0.15.6 implementation. Word timings are aggregated from native token timings."))
        }
    }

    public nonisolated func compatibility(request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) -> HudTranscriptionCompatibility {
        func reject(_ code: HudTranscriptionCompatibilityReasonCode, _ reason: String) -> HudTranscriptionCompatibility {
            .unsupported([.init(code: code, message: reason, userExplanation: reason)])
        }
        guard configuration.providerID == descriptor.id, Self.version(configuration) != nil else { return reject(.unknownModel, "Choose a supported Parakeet model.") }
        switch request.audio {
        case .file(let file):
            guard file.isFileURL else { return reject(.formatUnsupported, "Choose a local audio file.") }
        case .pcm(let format):
            guard format.sampleRate == 16000, format.channelCount == 1, format.bitsPerSample == 16, !format.isFloat else { return reject(.formatUnsupported, "Provide mono PCM16 little-endian audio at 16 kHz.") }
            if let duration = request.duration, !duration.isFinite || duration < 0 || duration > 120 { return reject(.durationExceeded, "Local live dictation is limited to two minutes per session.") }
        }
        guard !request.features.speakerLabels else { return reject(.featureCombination, "This Parakeet path does not label speakers.") }
        guard request.features.languageHints.isEmpty, request.features.vocabularyHints.isEmpty,
              request.features.style != .clean, !request.features.smartFormatting else {
            return reject(.featureCombination, "This Parakeet path uses automatic recognition without hints or text rewriting.")
        }
        if let deadline = request.deadline, deadline <= Date() { return reject("deadline-expired", "The transcription deadline has passed.") }
        return .supported
    }

    public func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        guard configuration.providerID == descriptor.id, let version = Self.version(configuration) else { return .unavailable("The selected FluidAudio model is unavailable.") }
        let key = configuration.secretFreeFingerprint
        if let status = await resources.preparationStatus(key: key) { return status }
        let directory = Self.directory(configuration, version: version)
        return HudFluidAudioLocalModels.exist(at: directory, version: version)
            ? .init(status: .unconfigured, reason: "Model files are available. Prepare the model to load it.")
            : .init(status: .needsDownload, reason: "Download or select the Parakeet model before transcribing.")
    }

    public func prepare(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        try Task.checkCancellation()
        guard configuration.providerID == descriptor.id, let version = Self.version(configuration) else { return .unavailable("The selected FluidAudio model is unavailable.") }
        let key = configuration.secretFreeFingerprint
        let directory = Self.directory(configuration, version: version)
        guard HudFluidAudioLocalModels.exist(at: directory, version: version) else { return .init(status: .needsDownload, reason: "Select a downloaded model directory. This preparation path does not download models.") }
        do {
            return try await resources.prepare(key: key) {
                try await HudFluidAudioLocalModels.load(from: directory, version: version)
            }
        } catch {
            if error is CancellationError || Task.isCancelled { throw CancellationError() }
            return .failed("FluidAudio could not load the selected model files.")
        }
    }

    public func submit(_ request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) async throws -> any HudTranscriptionBatchOperation {
        let compatible = compatibility(request: request, configuration: configuration)
        guard compatible.status == .supported else { throw HudTranscriptionError.invalidRequest(compatible.reasons.first?.userExplanation ?? "Unsupported audio request.") }
        guard await resources.isPrepared(key: configuration.secretFreeFingerprint) else { throw HudTranscriptionError.notReady(try await readiness(configuration: configuration)) }
        guard case .file(let file) = request.audio else { throw HudTranscriptionError.unsupportedMode(.batch) }
        let resources = resources
        return await HudFluidAudioBatchOperation.start(operationID: request.operationID, deadline: request.deadline) {
            try Task.checkCancellation()
            let source = try Data(contentsOf: file, options: .mappedIfSafe)
            let digest = SHA256.hash(data: source).map { String(format: "%02x", $0) }.joined()
            return try await resources.withResource(key: configuration.secretFreeFingerprint, as: AsrModels.self) { models in
                let manager = AsrManager(config: .default)
                try await manager.loadModels(models)
                var decoder = TdtDecoderState.make(decoderLayers: await manager.decoderLayerCount)
                let response = try await manager.transcribe(file, decoderState: &decoder)
                try Task.checkCancellation()
                if let deadline = request.deadline, deadline <= Date() { throw HudTranscriptionError.incompleteAudio }
                let words = response.tokenTimings.map { buildWordTimings(from: $0).map {
                    HudTranscriptionWord(text: $0.word, start: $0.startTime, end: $0.endTime, annotationOrigin: .derived)
                } }
                return .init(transcript: response.text, words: words?.isEmpty == false ? words : nil, completion: .completed,
                    provenance: .init(providerID: configuration.providerID, modelID: configuration.modelID, adapterVersion: "1",
                        configurationFingerprint: configuration.secretFreeFingerprint, sourceDigest: digest,
                        runID: request.operationID.rawValue, timestamp: Date()))
            }
        }
    }

    public func openLive(_ request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) async throws -> any HudTranscriptionLiveSession {
        let check = compatibility(request: request, configuration: configuration)
        guard check.status == .supported else { throw HudTranscriptionError.invalidRequest(check.reasons.first?.userExplanation ?? "Unsupported live request.") }
        guard case .pcm = request.audio else { throw HudTranscriptionError.unsupportedMode(.live) }
        guard await resources.isPrepared(key: configuration.secretFreeFingerprint) else { throw HudTranscriptionError.notReady(try await readiness(configuration: configuration)) }
        let lease = try await resources.lease(key: configuration.secretFreeFingerprint, as: AsrModels.self)
        let manager = try await lease.withValue { models in
            let manager = AsrManager(config: .default)
            try await manager.loadModels(models)
            return manager
        }
        return await HudFluidAudioLiveSession.open(deadline: request.deadline) { [lease] samples in
            try await lease.withValue { _ in
                var decoder = TdtDecoderState.make(decoderLayers: await manager.decoderLayerCount)
                let response = try await manager.transcribe(samples, decoderState: &decoder)
                try Task.checkCancellation()
                let words = response.tokenTimings.map { buildWordTimings(from: $0).map {
                    HudTranscriptionWord(text: $0.word, start: $0.startTime, end: $0.endTime, annotationOrigin: .derived)
                } }
                return .init(transcript: response.text, words: words?.isEmpty == false ? words : nil, completion: .completed,
                    provenance: .init(providerID: configuration.providerID, modelID: configuration.modelID, adapterVersion: "1",
                        configurationFingerprint: configuration.secretFreeFingerprint, sourceDigest: "",
                        runID: request.operationID.rawValue, timestamp: Date()))
            }
        }
    }

    private nonisolated static func version(_ configuration: HudTranscriptionConfiguration) -> AsrModelVersion? {
        switch configuration.modelID.rawValue { case "parakeet-v3": .v3; case "parakeet-v2": .v2; default: nil }
    }

    private nonisolated static func directory(_ configuration: HudTranscriptionConfiguration, version: AsrModelVersion) -> URL {
        if let location = configuration.localModel?.location { return URL(fileURLWithPath: location, isDirectory: true) }
        return AsrModels.defaultCacheDirectory(for: version)
    }
}
