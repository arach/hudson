import Foundation
import CryptoKit
import HudsonTranscription
import HudsonTranscriptionCloud

/// Remote DIY reference: depends only on the public contract and reusable transport.
/// No special registration or selection branches are required by the host.
public struct HudElevenLabsTranscriptionAdapter: HudTranscriptionAdapter {
    private let credentials: any HudTranscriptionCredentialResolver
    private let transport: any HudTranscriptionHTTPTransport
    private static let defaultEndpoint = URL(string: "https://api.elevenlabs.io")!
    private static let conversionPath = "v1/speech-to-text"
    public let descriptor = HudTranscriptionProviderDescriptor(
        id: "elevenlabs-reference", displayName: "ElevenLabs Scribe", adapterVersion: "1",
        maintainer: .init(kind: .custom, name: "Hudson reference integration"), origin: .remote,
        platforms: [.macOS, .iOS], configurationSchema: [
            .init(key: "credentialReference", displayName: "ElevenLabs API key", kind: .credentialReference, required: true)
        ], modelDiscovery: .adapterMetadata)

    public init(credentials: any HudTranscriptionCredentialResolver,
                transport: any HudTranscriptionHTTPTransport = HudTranscriptionURLSessionTransport()) {
        self.credentials = credentials
        self.transport = transport
    }

    public func models(configuration: HudTranscriptionConfiguration) async throws -> [HudTranscriptionModelDescriptor] {
        [.init(id: "scribe_v2", displayName: "Scribe v2", supportsBatch: true, supportsLive: false,
               timing: .word, speakers: .diarization, inputFormats: ["wav", "mp3", "flac", "m4a"],
               evidence: .init(documentationURL: URL(string: "https://elevenlabs.io/docs/api-reference/speech-to-text/convert"),
                              notes: "Remote reference adapter. Standard provider retention applies. Adapter limits files to 250 MB; account access is checked on submission."))]
    }

    public func compatibility(request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) -> HudTranscriptionCompatibility {
        func reject(_ reason: HudTranscriptionCompatibilityReasonCode, _ text: String) -> HudTranscriptionCompatibility {
            .unsupported([.init(code: reason, message: text, userExplanation: text)])
        }
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == "scribe_v2" else {
            return reject(.unknownModel, "Select Scribe v2 for this reference adapter.")
        }
        guard case .file(let file) = request.audio, file.isFileURL else {
            return reject(.modeUnsupported, "This reference adapter transcribes audio files.")
        }
        guard Self.mimeTypes[file.pathExtension.lowercased()] != nil else {
            return reject(.formatUnsupported, "Use WAV, MP3, FLAC, or M4A audio.")
        }
        guard request.features.languageHints.count <= 1 else {
            return reject(.languageUnsupported, "Scribe accepts one language hint.")
        }
        guard request.features.vocabularyHints.isEmpty, !request.features.smartFormatting else {
            return reject("unsupported-options", "This reference adapter does not yet expose keyterms or smart formatting.")
        }
        if let duration = request.duration, !duration.isFinite || duration < 0.1 {
            return reject(.durationExceeded, "Scribe requires at least 100 milliseconds of audio.")
        }
        if let deadline = request.deadline, deadline <= Date() {
            return reject("deadline-expired", "The transcription deadline has passed.")
        }
        return .supported
    }

    public func readiness(configuration: HudTranscriptionConfiguration) async throws -> HudTranscriptionReadiness {
        guard configuration.providerID == descriptor.id, configuration.modelID.rawValue == "scribe_v2" else {
            return .unavailable("The selected Scribe model is unavailable.")
        }
        guard (try? HudTranscriptionEndpoint(configuration.endpoint ?? Self.defaultEndpoint)) != nil else {
            return .init(status: .unconfigured, reason: "Configure a secure provider endpoint.")
        }
        guard let reference = configuration.credentialReference else { return .init(status: .needsCredential) }
        let bytes = try await credentials.credential(for: reference)
        guard let key = String(data: bytes, encoding: .utf8), !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .init(status: .needsCredential)
        }
        return .init(status: .ready, reason: "Configured locally. Account access is checked on submission.")
    }

    public func submit(_ request: HudTranscriptionRequest, configuration: HudTranscriptionConfiguration) async throws -> any HudTranscriptionBatchOperation {
        let compatible = compatibility(request: request, configuration: configuration)
        guard compatible.status == .supported else {
            throw HudTranscriptionError.invalidRequest(compatible.reasons.first?.userExplanation ?? "Unsupported request.")
        }
        let ready = try await readiness(configuration: configuration)
        guard ready.isReady else { throw HudTranscriptionError.notReady(ready) }
        guard case .file(let file) = request.audio, let reference = configuration.credentialReference,
              let mime = Self.mimeTypes[file.pathExtension.lowercased()] else {
            throw HudTranscriptionError.invalidRequest("Incomplete configuration.")
        }
        let keyData = try await credentials.credential(for: reference)
        guard let key = String(data: keyData, encoding: .utf8) else { throw HudTranscriptionError.notReady(.init(status: .needsCredential)) }
        let endpoint = try HudTranscriptionEndpoint(configuration.endpoint ?? Self.defaultEndpoint)
        return await HudRemoteTranscriptionOperation.start(operationID: request.operationID) { operation in
            try Task.checkCancellation()
            let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size < 250_000_000 else {
                throw HudTranscriptionError.invalidRequest("This adapter requires a nonempty file smaller than 250 MB.")
            }
            let audio = try Data(contentsOf: file)
            guard audio.count < 250_000_000 else { throw HudTranscriptionError.invalidRequest("The audio file exceeds the adapter limit.") }
            var multipart = HudTranscriptionMultipart()
            try multipart.append(name: "model_id", text: configuration.modelID.rawValue)
            try multipart.append(name: "diarize", text: request.features.speakerLabels ? "true" : "false")
            try multipart.append(name: "timestamps_granularity", text: request.features.wordTiming || request.features.speakerLabels ? "word" : "none")
            try multipart.append(name: "tag_audio_events", text: "false")
            try multipart.append(name: "no_verbatim", text: request.features.style == .clean ? "true" : "false")
            try multipart.append(name: "webhook", text: "false")
            if let language = request.features.languageHints.first { try multipart.append(name: "language_code", text: language) }
            // A neutral upload filename avoids sending the user's local recording name.
            try multipart.append(name: "file", filename: "audio." + file.pathExtension.lowercased(), mimeType: mime, data: audio)
            var networkRequest = URLRequest(url: try endpoint.url(path: Self.conversionPath))
            networkRequest.httpMethod = "POST"
            networkRequest.timeoutInterval = request.deadline?.timeIntervalSinceNow ?? 120
            guard networkRequest.timeoutInterval > 0 else { throw HudTranscriptionError.invalidRequest("The transcription deadline has passed.") }
            networkRequest.setValue(key.trimmingCharacters(in: .whitespacesAndNewlines), forHTTPHeaderField: "xi-api-key")
            networkRequest.setValue(multipart.contentType, forHTTPHeaderField: "Content-Type")
            networkRequest.httpBody = multipart.encoded()
            try await operation.willSubmit()
            let response = try await transport.send(networkRequest)
            if let id = response.requestID { await operation.accepted(id) }
            try response.requireSuccess()
            let result = try JSONDecoder().decode(Response.self, from: response.body)
            let words = result.words?.filter { $0.type == "word" }.map {
                HudTranscriptionWord(text: $0.text, start: $0.start, end: $0.end,
                                     speakerID: request.features.speakerLabels ? $0.speaker_id : nil)
            }
            let digest = SHA256.hash(data: audio).map { value in
                let hex = String(value, radix: 16)
                return hex.count == 1 ? "0" + hex : hex
            }.joined()
            return HudTranscriptionResult(transcript: result.text,
                words: words?.isEmpty == false ? words : nil, language: result.language_code,
                completion: .completed,
                provenance: .init(providerID: configuration.providerID, modelID: configuration.modelID,
                    adapterVersion: descriptor.adapterVersion, configurationFingerprint: configuration.secretFreeFingerprint,
                    sourceDigest: digest, providerRequestID: response.requestID, runID: request.operationID.rawValue, timestamp: Date()))
        }
    }

    private static let mimeTypes = ["wav": "audio/wav", "mp3": "audio/mpeg", "flac": "audio/flac", "m4a": "audio/mp4"]
    private struct Response: Decodable {
        let text: String
        let language_code: String?
        let words: [Word]?
    }
    private struct Word: Decodable {
        let text: String
        let type: String?
        let start: Double?
        let end: Double?
        let speaker_id: String?
    }
}
