import Foundation
import CryptoKit
import HudsonTranscription

/// Optional local DIY example. Parakeet remains the preferred on-device engine.
public actor HudWhisperKitTranscriptionAdapter: HudTranscriptionAdapter {
    public nonisolated let descriptor = HudTranscriptionProviderDescriptor(
        id: "whisperkit-reference",
        displayName: "WhisperKit",
        adapterVersion: "1",
        maintainer: .init(kind: .custom, name: "Hudson reference integration"),
        origin: .local,
        platforms: [.macOS, .iOS],
        configurationSchema: [
            .init(key: "localModel", displayName: "Model directory", kind: .localModelLocation, required: true)
        ],
        modelDiscovery: .adapterMetadata
    )
    private let runtime: any HudWhisperKitRuntime
    private let resources: HudTranscriptionLocalResources
    private var inferenceTail: Task<Void, Never> = Task {}

    public init(runtime: any HudWhisperKitRuntime = HudWhisperKitNativeRuntime(), resources: HudTranscriptionLocalResources = .init()) {
        self.runtime = runtime
        self.resources = resources
    }

    public func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        Self.catalog
    }

    public nonisolated func compatibility(
        request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) -> HudTranscriptionCompatibility {
        func reject(_ code: HudTranscriptionCompatibilityReasonCode, _ reason: String) -> HudTranscriptionCompatibility {
            .unsupported([.init(code: code, message: reason, userExplanation: reason)])
        }
        guard configuration.providerID == descriptor.id, Self.knownModel(configuration.modelID) else {
            return reject(.unknownModel, "Choose a supported WhisperKit model.")
        }
        switch request.audio {
        case .file(let file):
            guard file.isFileURL else { return reject(.formatUnsupported, "Choose a local audio file.") }
            let ext = file.pathExtension.lowercased()
            guard ext.isEmpty || Self.inputFormats.contains(ext) else {
                return reject(.formatUnsupported, "Use WAV, MP3, M4A, FLAC, AIFF, or CAF audio.")
            }
        case .pcm:
            return reject(.modeUnsupported, "This WhisperKit reference adapter transcribes audio files. Live input is unpublished.")
        }
        guard !request.features.speakerLabels else {
            return reject(.featureCombination, "This WhisperKit reference path does not label speakers.")
        }
        guard request.features.vocabularyHints.isEmpty,
              request.features.style != .clean,
              !request.features.smartFormatting else {
            return reject(.featureCombination, "This WhisperKit reference path does not rewrite text or apply vocabulary hints.")
        }
        guard request.features.languageHints.count <= 1 else {
            return reject(.languageUnsupported, "WhisperKit accepts one language hint.")
        }
        if let deadline = request.deadline, deadline <= Date() {
            return reject("deadline-expired", "The transcription deadline has passed.")
        }
        return .supported
    }

    public func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        let probed = Date()
        guard configuration.providerID == descriptor.id, Self.knownModel(configuration.modelID) else {
            return .unavailable("The selected WhisperKit model is unavailable.", lastProbe: probed)
        }
        guard let directory = HudWhisperKitLocalModels.directory(configuration) else {
            return .init(status: .needsDownload, reason: "Select a local WhisperKit model directory before transcribing.", lastProbe: probed)
        }
        if HudWhisperKitLocalModels.exist(at: directory),
           let status = await resources.preparationStatus(key: Self.resourceKey(configuration, directory: directory)) {
            return status
        }
        guard HudWhisperKitLocalModels.exist(at: directory) else {
            return .init(
                status: .needsDownload,
                reason: "The selected folder is missing compiled Whisper model files. This adapter does not download models.",
                lastProbe: probed
            )
        }
        return .init(status: .unconfigured, reason: "Model files are available. Prepare the model to load it.", lastProbe: probed)
    }

    public func prepare(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        let probed = Date()
        guard configuration.providerID == descriptor.id, Self.knownModel(configuration.modelID) else {
            return .unavailable("The selected WhisperKit model is unavailable.", lastProbe: probed)
        }
        guard let directory = HudWhisperKitLocalModels.directory(configuration) else {
            return .init(status: .needsDownload, reason: "Select a local WhisperKit model directory before transcribing.", lastProbe: probed)
        }
        guard HudWhisperKitLocalModels.exist(at: directory) else {
            return .init(
                status: .needsDownload,
                reason: "Select a downloaded model directory. This preparation path does not download models.",
                lastProbe: probed
            )
        }
        try Task.checkCancellation()
        let runtime = self.runtime
        do {
            return try await resources.prepare(key: Self.resourceKey(configuration, directory: directory)) {
                let handle = try await runtime.load(modelFolder: directory)
                guard HudWhisperKitLocalModels.matches(handle, at: directory) else {
                    throw HudTranscriptionError.notReady(.init(status: .needsDownload,
                        reason: "The local model files changed while loading. Prepare the model again."))
                }
                return handle
            }
        } catch is CancellationError {
            throw HudTranscriptionError.cancelled
        } catch let error as HudTranscriptionError {
            if case .notReady(let readiness) = error { return readiness }
            if error == .cancelled { throw error }
            return .failed("WhisperKit could not load the selected model files.", lastProbe: Date())
        } catch {
            return .failed("WhisperKit could not load the selected model files.", lastProbe: Date())
        }
    }

    public func submit(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionBatchOperation {
        let compatible = compatibility(request: request, configuration: configuration)
        guard compatible.status == .supported else {
            throw HudTranscriptionError.invalidRequest(compatible.reasons.first?.userExplanation ?? "Unsupported audio request.")
        }
        guard let directory = HudWhisperKitLocalModels.directory(configuration),
              HudWhisperKitLocalModels.exist(at: directory),
              await resources.isPrepared(key: Self.resourceKey(configuration, directory: directory)) else {
            throw HudTranscriptionError.notReady(try await readiness(configuration: configuration))
        }
        guard case .file(let file) = request.audio else {
            throw HudTranscriptionError.unsupportedMode(.batch)
        }
        let language = request.features.languageHints.first
        let wordTimestamps = request.features.wordTiming
        let adapterVersion = descriptor.adapterVersion
        let deadline = request.deadline
        return await HudWhisperKitBatchOperation.start(operationID: request.operationID, deadline: deadline) { [weak self] in
            try Task.checkCancellation()
            try whisperKitThrowIfDeadlinePassed(deadline)
            let source = try Data(contentsOf: file, options: .mappedIfSafe)
            let digest = SHA256.hash(data: source).map { String(format: "%02x", $0) }.joined()
            try Task.checkCancellation()
            try whisperKitThrowIfDeadlinePassed(deadline)
            guard let self else { throw HudTranscriptionError.cancelled }
            let transcript = try await self.transcribeSerialized(
                key: Self.resourceKey(configuration, directory: directory),
                directory: directory,
                request: HudWhisperKitTranscribeRequest(
                    audioPath: file.path,
                    language: language,
                    wordTimestamps: wordTimestamps
                ),
                deadline: deadline
            )
            try Task.checkCancellation()
            try whisperKitThrowIfDeadlinePassed(deadline)
            return Self.normalize(
                transcript,
                request: request,
                configuration: configuration,
                adapterVersion: adapterVersion,
                sourceDigest: digest
            )
        }
    }

    public func openLive(
        _ request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration
    ) async throws -> any HudTranscriptionLiveSession {
        throw HudTranscriptionError.unsupportedMode(.live)
    }

    private nonisolated static func resourceKey(_ configuration: HudTranscriptionConfiguration, directory: URL) -> String {
        configuration.secretFreeFingerprint + "|" + HudWhisperKitLocalModels.configFingerprint(at: directory)
    }

    private func transcribeSerialized(
        key: String,
        directory: URL,
        request: HudWhisperKitTranscribeRequest,
        deadline: Date?
    ) async throws -> HudWhisperKitTranscript {
        try whisperKitThrowIfDeadlinePassed(deadline)
        let resources = resources
        let previous = inferenceTail
        let task = Task<HudWhisperKitTranscript, any Error> {
            await previous.value
            try Task.checkCancellation()
            try whisperKitThrowIfDeadlinePassed(deadline)
            return try await resources.withResource(key: key, as: HudWhisperKitSessionHandle.self) { handle in
                guard HudWhisperKitLocalModels.matches(handle, at: directory) else {
                    throw HudTranscriptionError.notReady(.init(status: .needsDownload,
                        reason: "The local model files changed. Prepare the model again."))
                }
                return try await handle.transcribe(request)
            }
        }
        inferenceTail = Task { _ = try? await task.value }
        do {
            return try await whisperKitAwaitCancellable(task)
        } catch is CancellationError {
            task.cancel()
            throw CancellationError()
        } catch let error as HudTranscriptionError {
            task.cancel()
            throw error
        } catch {
            task.cancel()
            throw HudTranscriptionError.invalidRequest("WhisperKit could not transcribe this recording.")
        }
    }

    nonisolated static func normalize(
        _ transcript: HudWhisperKitTranscript,
        request: HudTranscriptionRequest,
        configuration: HudTranscriptionConfiguration,
        adapterVersion: String,
        sourceDigest: String
    ) -> HudTranscriptionResult {
        let text = transcript.windows
            .map { $0.text }
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let nativeSegments = transcript.windows.flatMap(\.segments)
        let segments: [HudTranscriptionSegment]? = nativeSegments.isEmpty ? nil : nativeSegments.map {
            HudTranscriptionSegment(text: $0.text, start: $0.start, end: $0.end, annotationOrigin: .native)
        }
        let nativeWords = request.features.wordTiming ? nativeSegments.compactMap(\.words).flatMap { $0 } : []
        let words: [HudTranscriptionWord]? = nativeWords.isEmpty ? nil : nativeWords.map {
            HudTranscriptionWord(
                text: $0.text,
                start: $0.start,
                end: $0.end,
                confidence: $0.confidence,
                annotationOrigin: .native
            )
        }
        let language = transcript.windows.compactMap(\.language).first { !$0.isEmpty }
        return HudTranscriptionResult(
            transcript: text,
            segments: segments,
            words: words,
            language: language,
            completion: .completed,
            provenance: .init(
                providerID: configuration.providerID,
                modelID: configuration.modelID,
                adapterVersion: adapterVersion,
                configurationFingerprint: configuration.secretFreeFingerprint,
                sourceDigest: sourceDigest,
                runID: request.operationID.rawValue,
                timestamp: Date()
            )
        )
    }

    private static let inputFormats: Set<String> = ["wav", "mp3", "m4a", "flac", "aiff", "aif", "caf"]

    private static let catalog: [HudTranscriptionModelDescriptor] = [
        "openai_whisper-tiny",
        "openai_whisper-base",
        "openai_whisper-small",
        "distil-whisper_distil-large-v3"
    ].map { id in
        .init(
            id: .init(rawValue: id),
            displayName: displayName(id),
            supportsBatch: true,
            supportsLive: false,
            timing: .word,
            speakers: .none,
            inputFormats: ["wav", "mp3", "m4a", "flac", "aiff", "caf"],
            constraints: [
                .init(code: .modeUnsupported, message: "Live input is unpublished on this reference adapter."),
                .init(code: .featureCombination, message: "Speaker labels, vocabulary hints, and clean formatting are not implemented.")
            ],
            evidence: .init(
                documentationURL: URL(string: "https://github.com/argmaxinc/WhisperKit"),
                notes: "Optional local reference adapter using WhisperKit 0.18.0. File transcription only. Preparation loads a caller-selected local model folder and does not download."
            )
        )
    }

    private static func knownModel(_ id: HudTranscriptionModelID) -> Bool {
        catalog.contains { $0.id == id }
    }

    private static func displayName(_ id: String) -> String {
        switch id {
        case "openai_whisper-tiny": return "Whisper Tiny"
        case "openai_whisper-base": return "Whisper Base"
        case "openai_whisper-small": return "Whisper Small"
        case "distil-whisper_distil-large-v3": return "Distil Whisper Large v3"
        default: return id
        }
    }
}

fileprivate func whisperKitThrowIfDeadlinePassed(_ deadline: Date?) throws {
    if let deadline, deadline <= Date() {
        throw HudTranscriptionError.incompleteAudio
    }
}

fileprivate func whisperKitAwaitCancellable<T: Sendable>(_ task: Task<T, any Error>) async throws -> T {
    try await withTaskCancellationHandler {
        try await task.value
    } onCancel: {
        task.cancel()
    }
}
