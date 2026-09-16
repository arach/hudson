import Foundation
import CryptoKit
import HudsonTranscription

/// The host records upload ownership separately from transcript completion.
public enum HudGeminiUploadEvent: Sendable, Equatable {
    case created(operationID: HudTranscriptionOperationID, name: String)
    case deleted(operationID: HudTranscriptionOperationID, name: String)
    case cleanupRequired(operationID: HudTranscriptionOperationID, name: String)
}

/// Dedicated file transcription. Conversational Live is a separate capability profile.
public struct HudGeminiTranscriptionAdapter: HudTranscriptionAdapter {
    public static let model = "gemini-3.5-transcribe"
    private let credentials: any HudTranscriptionCredentialResolver
    private let transport: any HudTranscriptionHTTPTransport
    private let uploadEvent: @Sendable (HudGeminiUploadEvent) async throws -> Void
    public let descriptor = HudTranscriptionProviderDescriptor(
        id: "gemini-file", displayName: "Gemini transcription", adapterVersion: "1",
        maintainer: .init(kind: .maintained, name: "Hudson"), origin: .remote,
        platforms: [.macOS, .iOS], configurationSchema: [
            .init(key: "credentialReference", displayName: "Gemini API key", kind: .credentialReference, required: true)
        ], modelDiscovery: .adapterMetadata)

    /// The callback lets the host persist outstanding cleanup even after cancellation.
    public init(credentials: any HudTranscriptionCredentialResolver,
                transport: any HudTranscriptionHTTPTransport = HudTranscriptionURLSessionTransport(),
                uploadEvent: @escaping @Sendable (HudGeminiUploadEvent) async throws -> Void) {
        self.credentials = credentials
        self.transport = transport
        self.uploadEvent = uploadEvent
    }

    public func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        [.init(id: .init(rawValue: Self.model), displayName: "Gemini 3.5 Transcribe", supportsBatch: true, supportsLive: false,
               timing: .word, speakers: .diarization, inputFormats: Self.mimeTypes.keys.sorted(),
               limits: .init(maximumFileDuration: .seconds(3600), maximumSpeakers: .value(8)),
               evidence: .init(documentationURL: URL(string: "https://ai.google.dev/gemini-api/docs/transcribe"),
                               notes: "Annotation mode is limited to 30 minutes. Attribution for three or more speakers is experimental. Account access is checked on submission."))]
    }

    public func compatibility(request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) -> HudTranscriptionCompatibility {
        func reject(_ code: HudTranscriptionCompatibilityReasonCode, _ reason: String) -> HudTranscriptionCompatibility {
            .unsupported([.init(code: code, message: reason, userExplanation: reason)])
        }
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == Self.model else {
            return reject(.unknownModel, "Select the dedicated Gemini file transcription model.")
        }
        guard case .file(let file) = request.audio, file.isFileURL else { return reject(.modeUnsupported, "This Gemini adapter transcribes recordings.") }
        guard Self.mimeTypes[file.pathExtension.lowercased()] != nil else { return reject(.formatUnsupported, "Choose a supported audio file format.") }
        let annotated = request.features.wordTiming || request.features.speakerLabels
        if annotated && (request.features.style == .clean || request.features.smartFormatting || !request.features.vocabularyHints.isEmpty) {
            return reject(.featureCombination, "Gemini cannot combine speaker labels or word timing with vocabulary hints or smart transcription.")
        }
        guard request.features.vocabularyHints.count <= 1000 else { return reject(.featureCombination, "Gemini accepts at most 1,000 vocabulary hints.") }
        guard let duration = request.duration, duration.isFinite, duration >= 0 else {
            let reason = "Measure the recording duration before submitting it."
            return .unverified([.init(code: .limitUnverified, message: reason, userExplanation: reason)])
        }
        guard duration <= (annotated ? 1800 : 3600) else {
            return reject(.durationExceeded, annotated ? "Gemini annotations support recordings up to 30 minutes." : "Gemini transcription supports recordings up to 60 minutes.")
        }
        if let deadline = request.deadline, deadline <= Date() { return reject("deadline-expired", "The transcription deadline has passed.") }
        return .supported
    }

    public func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == Self.model else { return .unavailable("The selected Gemini model is unavailable.") }
        guard (try? endpoint(configuration)) != nil else { return .init(status: .unconfigured, reason: "Configure an HTTPS Gemini endpoint.") }
        guard let reference = configuration.credentialReference else { return .init(status: .needsCredential) }
        let data = try await credentials.credential(for: reference)
        guard let key = String(data: data, encoding: .utf8), !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return .init(status: .needsCredential) }
        return .init(status: .ready, reason: "Configured locally. Account access is checked on submission.")
    }

    public func submit(_ request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) async throws -> any HudTranscriptionBatchOperation {
        let check = compatibility(request: request, configuration: configuration)
        guard check.status == .supported else { throw HudTranscriptionError.invalidRequest(check.reasons.first?.userExplanation ?? "Unsupported transcription request.") }
        let ready = try await readiness(configuration: configuration)
        guard ready.isReady else { throw HudTranscriptionError.notReady(ready) }
        guard case .file(let url) = request.audio, let reference = configuration.credentialReference,
              let mime = Self.mimeTypes[url.pathExtension.lowercased()] else { throw HudTranscriptionError.invalidRequest("Incomplete transcription configuration.") }
        let data = try await credentials.credential(for: reference)
        guard let key = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty else { throw HudTranscriptionError.notReady(.init(status: .needsCredential)) }
        let client = HudGeminiFileClient(endpoint: try endpoint(configuration), transport: transport)
        return await HudRemoteTranscriptionOperation.start(operationID: request.operationID) { operation in
            try Task.checkCancellation()
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size < 250_000_000 else { throw HudTranscriptionError.invalidRequest("This adapter accepts nonempty audio files smaller than 250 MB.") }
            let audio = try Data(contentsOf: url, options: .mappedIfSafe)
            let digest = SHA256.hash(data: audio).map { String(format: "%02x", $0) }.joined()
            let deadline = request.deadline ?? Date().addingTimeInterval(600)
            guard deadline > Date() else { throw HudTranscriptionError.invalidRequest("The transcription deadline has passed.") }
            // Upload is a remote side effect even before the transcription request exists.
            try await operation.willSubmit()
            var uploaded = try await client.upload(audio: audio, mimeType: mime, displayName: "transcription-" + request.operationID.rawValue, credential: key, timeout: max(0.001, min(120, deadline.timeIntervalSinceNow)))
            let name = uploaded.name
            do {
                try await uploadEvent(.created(operationID: request.operationID, name: name))
                while uploaded.state == "PROCESSING" {
                    try Task.checkCancellation()
                    guard deadline > Date() else { throw HudTranscriptionError.invalidRequest("The transcription deadline has passed.") }
                    try await Task.sleep(for: .seconds(1))
                    uploaded = try await client.file(name: name, credential: key, timeout: max(0.001, min(120, deadline.timeIntervalSinceNow)))
                }
                try Task.checkCancellation()
                guard deadline > Date() else { throw HudTranscriptionError.invalidRequest("The transcription deadline has passed.") }
                let response = try await client.transcribe(file: uploaded, mimeType: mime, model: Self.model, credential: key,
                    languages: request.features.languageHints, vocabulary: request.features.vocabularyHints,
                    speakers: request.features.speakerLabels, wordTimestamps: request.features.wordTiming,
                    clean: request.features.style == .clean || request.features.smartFormatting, timeout: max(0.001, min(120, deadline.timeIntervalSinceNow)))
                if let id = response.id { await operation.accepted(id) }
                let words = response.words.map { annotation in
                    HudTranscriptionWord(text: annotation.text ?? "", start: Self.seconds(annotation.start_offset), end: Self.seconds(annotation.end_offset), speakerID: annotation.speaker)
                }
                let result = HudTranscriptionResult(transcript: response.text, words: words.isEmpty ? nil : words, completion: .completed,
                    provenance: .init(providerID: configuration.providerID, modelID: .init(rawValue: response.model ?? Self.model), adapterVersion: descriptor.adapterVersion,
                        configurationFingerprint: configuration.secretFreeFingerprint, sourceDigest: digest, providerRequestID: response.id,
                        runID: request.operationID.rawValue, timestamp: Date()))
                try await cleanup(client: client, name: name, key: key, operationID: request.operationID)
                return result
            } catch {
                do {
                    try await cleanup(client: client, name: name, key: key, operationID: request.operationID)
                } catch {
                    // Neither durable ownership nor durable cleanup can be proven.
                    throw HudTranscriptionError.remoteOutcomeUnknown(providerRequestID: nil)
                }
                throw error
            }
        }
    }

    private func cleanup(client: HudGeminiFileClient, name: String, key: String, operationID: HudTranscriptionOperationID) async throws {
        // Cleanup outlives cancellation of the transcription task; the host retains failures.
        let removed = await Task.detached {
            do { try await client.deleteFile(name: name, credential: key); return true }
            catch { return false }
        }.value
        try await uploadEvent(removed ? .deleted(operationID: operationID, name: name) : .cleanupRequired(operationID: operationID, name: name))
    }

    private func endpoint(_ configuration: HudTranscriptionConfiguration) throws -> HudTranscriptionEndpoint {
        guard let url = configuration.endpoint ?? URL(string: HudGeminiFileClient.defaultBaseURL) else { throw HudTranscriptionHTTPError.invalidEndpoint }
        return try .init(url)
    }

    private static func seconds(_ value: String?) -> Double? {
        guard let value, value.hasSuffix("s"), let seconds = Double(value.dropLast()), seconds.isFinite, seconds >= 0 else { return nil }
        return seconds
    }

    private static let mimeTypes = ["wav": "audio/wav", "mp3": "audio/mpeg", "flac": "audio/flac", "m4a": "audio/mp4", "aac": "audio/aac", "ogg": "audio/ogg", "aiff": "audio/aiff"]
}
