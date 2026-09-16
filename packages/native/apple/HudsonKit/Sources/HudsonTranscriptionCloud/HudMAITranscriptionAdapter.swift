import Foundation
import CryptoKit
import HudsonTranscription

public struct HudMAITranscriptionAdapter: HudTranscriptionAdapter {
    private let credentials: any HudTranscriptionCredentialResolver
    private let transport: any HudTranscriptionHTTPTransport
    public enum Route: Sendable { case azure, openRouter }
    private let route: Route
    private var modelID: String { route == .azure ? HudMAITranscriptionClient.model : "microsoft/mai-transcribe-2" }
    public var descriptor: HudTranscriptionProviderDescriptor {
        if route == .openRouter {
            return .init(id: "openrouter-mai", displayName: "MAI via OpenRouter", adapterVersion: "1",
                maintainer: .init(kind: .maintained, name: "Hudson"), origin: .remote,
                platforms: [.macOS, .iOS], configurationSchema: [
                    .init(key: "credentialReference", displayName: "OpenRouter API key", kind: .credentialReference, required: true)
                ], modelDiscovery: .adapterMetadata)
        }
        return HudTranscriptionProviderDescriptor(
        id: "microsoft-mai", displayName: "Microsoft MAI", adapterVersion: "1",
        maintainer: .init(kind: .maintained, name: "Hudson"), origin: .remote,
        platforms: [.macOS, .iOS], configurationSchema: [
            .init(key: "endpoint", displayName: "Azure Speech endpoint", kind: .endpoint, required: true),
            .init(key: "credentialReference", displayName: "Speech resource key", kind: .credentialReference, required: true)
        ], modelDiscovery: .adapterMetadata)
    }

    public init(route: Route = .azure, credentials: any HudTranscriptionCredentialResolver, transport: any HudTranscriptionHTTPTransport = HudTranscriptionURLSessionTransport()) {
        self.route = route
        self.credentials = credentials
        self.transport = transport
    }

    public func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        [.init(id: .init(rawValue: modelID), displayName: "MAI-Transcribe-2", supportsBatch: true, supportsLive: false,
               timing: .word, speakers: .diarization, inputFormats: ["wav", "mp3", "flac"],
               limits: .init(maximumFileDuration: .seconds(7200)),
               evidence: .init(documentationURL: URL(string: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe"), notes: "Documented capabilities; live account access is not tested. Diarization is unreliable at 15 minutes and longer."))]
    }

    public func compatibility(request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) -> HudTranscriptionCompatibility {
        func reject(_ code: HudTranscriptionCompatibilityReasonCode, _ explanation: String) -> HudTranscriptionCompatibility {
            .unsupported([.init(code: code, message: explanation, userExplanation: explanation)])
        }
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == modelID else {
            return reject(.unknownModel, "Select MAI-Transcribe-2 for this adapter.")
        }
        guard case .file(let file) = request.audio, file.isFileURL else { return reject(.modeUnsupported, "MAI supports audio files here.") }
        guard Self.mimeTypes[file.pathExtension.lowercased()] != nil else { return reject(.formatUnsupported, "Use WAV, MP3, or FLAC audio.") }
        guard request.features.languageHints.count <= 1 else { return reject(.languageUnsupported, "MAI accepts one language hint.") }
        guard let duration = request.duration, duration.isFinite, duration >= 0 else {
            let explanation = "Measure the recording duration before submitting it."
            return .unverified([.init(code: .limitUnverified, message: explanation, userExplanation: explanation)])
        }
        guard duration < 7200 else { return reject(.durationExceeded, "MAI requires audio shorter than two hours.") }
        if request.features.speakerLabels && duration >= 900 {
            return reject(.durationExceeded, "MAI diarization is unreliable at 15 minutes and longer. Choose another engine or turn off speaker labels.")
        }
        if let deadline = request.deadline, deadline <= Date() { return reject("deadline-expired", "The transcription deadline has passed.") }
        return .supported
    }

    public func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == modelID else { return .unavailable("The selected MAI model is unavailable.") }
        guard route == .openRouter || configuration.endpoint.flatMap({ try? HudTranscriptionEndpoint($0) }) != nil else {
            return .init(status: .unconfigured, reason: "Configure an HTTPS Azure Speech endpoint.")
        }
        guard let reference = configuration.credentialReference else { return .init(status: .needsCredential) }
        let data = try await credentials.credential(for: reference)
        guard let value = String(data: data, encoding: .utf8), !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return .init(status: .needsCredential) }
        return .init(status: .ready, reason: "Configured locally. Account access is checked on submission.")
    }

    public func submit(_ request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) async throws -> any HudTranscriptionBatchOperation {
        let compatibility = compatibility(request: request, configuration: configuration)
        guard compatibility.status == .supported else { throw HudTranscriptionError.invalidRequest(compatibility.reasons.first?.userExplanation ?? "Unsupported request.") }
        let ready = try await readiness(configuration: configuration)
        guard ready.isReady else { throw HudTranscriptionError.notReady(ready) }
        guard case .file(let file) = request.audio,
              let reference = configuration.credentialReference, let mime = Self.mimeTypes[file.pathExtension.lowercased()] else {
            throw HudTranscriptionError.invalidRequest("Incomplete transcription configuration.")
        }
        let credentialData = try await credentials.credential(for: reference)
        guard let credential = String(data: credentialData, encoding: .utf8) else { throw HudTranscriptionError.notReady(.init(status: .needsCredential)) }
        return await HudRemoteTranscriptionOperation.start(operationID: request.operationID) { operation in
            try Task.checkCancellation()
            let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size < 250_000_000 else { throw HudTranscriptionError.invalidRequest("MAI requires a nonempty audio file smaller than 250 MB.") }
            let audio = try Data(contentsOf: file, options: .mappedIfSafe)
            let digest = SHA256.hash(data: audio).map { String(format: "%02x", $0) }.joined()
            let remaining = request.deadline?.timeIntervalSinceNow ?? 120
            guard remaining > 0 else { throw HudTranscriptionError.invalidRequest("The transcription deadline has passed.") }
            try await operation.willSubmit()
            if route == .openRouter {
                let response = try await HudOpenRouterMAIClient(transport: transport).transcribe(
                    audio: audio, format: file.pathExtension.lowercased(), credential: credential,
                    features: request.features, timeout: remaining)
                if let id = response.requestID { await operation.accepted(id) }
                return response.result(configuration: configuration, digest: digest, operationID: request.operationID)
            }
            guard let endpoint = configuration.endpoint else { throw HudTranscriptionError.invalidRequest("Missing Azure endpoint.") }
            let client = HudMAITranscriptionClient(endpoint: try .init(endpoint), transport: transport)
            let receipt = try await client.transcribe(audio: audio, filename: file.lastPathComponent, mimeType: mime, credential: credential.trimmingCharacters(in: .whitespacesAndNewlines), options: .init(language: request.features.languageHints.first, vocabulary: request.features.vocabularyHints, diarization: request.features.speakerLabels, wordTimestamps: request.features.wordTiming, clean: request.features.style == .clean || request.features.smartFormatting), timeout: remaining)
            if let id = receipt.providerRequestID { await operation.accepted(id) }
            func seconds(_ milliseconds: Double?) -> Double? { milliseconds.map { $0 / 1000 } }
            func end(_ offset: Double?, _ duration: Double?) -> Double? {
                guard let offset, let duration else { return nil }
                return (offset + duration) / 1000
            }
            let segments = receipt.response.phrases?.map {
                HudTranscriptionSegment(text: $0.text, start: seconds($0.offsetMilliseconds), end: end($0.offsetMilliseconds, $0.durationMilliseconds), speakerID: $0.speaker.map(String.init), confidence: $0.confidence)
            }
            let words = receipt.response.phrases?.flatMap { phrase in
                (phrase.words ?? []).map { HudTranscriptionWord(text: $0.text, start: seconds($0.offsetMilliseconds), end: end($0.offsetMilliseconds, $0.durationMilliseconds), speakerID: phrase.speaker.map(String.init)) }
            }
            return HudTranscriptionResult(transcript: receipt.response.text, segments: segments, words: words?.isEmpty == false ? words : nil,
                language: receipt.response.phrases?.first?.locale, completion: .completed,
                provenance: .init(providerID: configuration.providerID, modelID: configuration.modelID, adapterVersion: descriptor.adapterVersion, configurationFingerprint: configuration.secretFreeFingerprint, sourceDigest: digest, providerRequestID: receipt.providerRequestID, runID: request.operationID.rawValue, timestamp: Date()))
        }
    }

    private static let mimeTypes = ["wav": "audio/wav", "mp3": "audio/mpeg", "flac": "audio/flac"]
}
