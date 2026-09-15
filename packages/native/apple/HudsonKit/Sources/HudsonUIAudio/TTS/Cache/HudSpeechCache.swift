import CryptoKit
import Foundation

/// Whether a cache call may reuse a stored or in-flight result.
public enum HudSpeechCachePolicy: Sendable, Equatable {
    /// Return a valid disk hit, or join an in-flight equal `.reuse` request.
    case reuse
    /// Always call the synthesis closure. Never read disk and never join an
    /// in-flight `.reuse` request. A successful result overwrites the stored payload.
    case fresh
}

/// Disk-backed identity for one synthesis request.
///
/// Text, voice, model, and instructions are stored exactly as supplied.
/// Optional values retain presence as well as content. Credentials must not
/// appear in `namespace` or any other field.
public struct HudSpeechCacheIdentity: Sendable, Equatable, Hashable {
    public var text: String
    public var providerID: HudTTSProviderID
    public var model: String?
    public var voice: String?
    public var rate: Double
    public var instructions: String?
    public var voiceSettings: HudTTSVoiceSettings?
    public var namespace: String?

    public init(
        request: HudTTSRequest,
        providerID: HudTTSProviderID,
        namespace: String? = nil
    ) {
        self.text = request.text
        self.providerID = providerID
        self.model = request.model
        self.voice = request.voice
        self.rate = request.rate
        self.instructions = request.instructions
        self.voiceSettings = request.voiceSettings
        self.namespace = namespace
    }
}

public struct HudSpeechCacheStats: Sendable, Equatable {
    public var hits: Int
    public var misses: Int
    public var entries: Int
    public var bytes: Int
}

public enum HudSpeechCacheError: Error, LocalizedError, Equatable {
    case emptyAudio
    case io(String)

    public var errorDescription: String? {
        switch self {
        case .emptyAudio:
            return "Speech cache refused to store empty audio."
        case .io(let message):
            return message
        }
    }
}

/// Actor-owned speech cache for `HudTTSResult` payloads.
///
/// The cache does not read credentials or call providers. Pass a closure that
/// forwards to `HudTTSClient.synthesize` (or any adapter):
///
/// ```swift
/// let cache = HudSpeechCache(directory: dir, maxBytes: 50 * 1024 * 1024)
/// let result = try await cache.synthesize(
///     request,
///     providerID: .openai,
///     policy: .reuse
/// ) { request, providerID in
///     try await client.synthesize(request, providerID: providerID)
/// }
/// ```
///
/// Identity includes exact text, provider, model, voice, rate, instructions,
/// voice settings, and an optional `namespace` for host or account separation.
public actor HudSpeechCache {
    public static let defaultMaxBytes = 100 * 1024 * 1024

    public static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Speech", isDirectory: true)
    }

    private let directory: URL
    private let maxBytes: Int
    private let fileManager: FileManager
    private var hits = 0
    private var misses = 0
    private var index: [String: IndexRecord] = [:]
    private var inFlight: [String: InFlight] = [:]
    private var latestWrite: [String: UUID] = [:]
    private var latestFresh: [String: UUID] = [:]

    public init(directory: URL, maxBytes: Int = HudSpeechCache.defaultMaxBytes) {
        self.directory = directory
        self.maxBytes = max(1, maxBytes)
        self.fileManager = .default
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        self.index = Self.loadIndex(from: directory)
    }

    public func stats() -> HudSpeechCacheStats {
        HudSpeechCacheStats(
            hits: hits,
            misses: misses,
            entries: index.count,
            bytes: index.values.reduce(0) { $0 + $1.byteCount }
        )
    }

    /// Synthesize `request` through `synthesize`, optionally reusing a stored result.
    ///
    /// A cancelled `.reuse` waiter does not cancel shared work until every waiter
    /// has cancelled. Failed or cancelled synthesis is not written to disk.
    public func synthesize(
        _ request: HudTTSRequest,
        providerID: HudTTSProviderID,
        namespace: String? = nil,
        policy: HudSpeechCachePolicy = .reuse,
        synthesize: @escaping @Sendable (HudTTSRequest, HudTTSProviderID) async throws -> HudTTSResult
    ) async throws -> HudTTSResult {
        try Task.checkCancellation()
        let identity = HudSpeechCacheIdentity(
            request: request,
            providerID: providerID,
            namespace: namespace
        )
        let digest = identity.digest
        let waiterID = UUID()

        if policy == .reuse {
            if var cached = loadValid(digest: digest, identity: identity) {
                hits += 1
                cached.cached = true
                return cached
            }
            misses += 1

            if let flight = inFlight[digest] {
                return try await waitForInFlight(
                    digest: digest,
                    workID: flight.id,
                    waiterID: waiterID,
                    work: flight.task,
                    identity: identity
                )
            }
        }

        let workID = UUID()
        latestWrite[digest] = workID
        if policy == .fresh {
            latestFresh[digest] = workID
        }
        let work = Task {
            try await synthesize(request, providerID)
        }
        if policy == .reuse {
            inFlight[digest] = InFlight(id: workID, task: work, waiters: [waiterID])
        }

        return try await finish(
            digest: digest,
            workID: workID,
            waiterID: waiterID,
            work: work,
            identity: identity,
            persist: true,
            freshWork: policy == .fresh
        )
    }

    private func waitForInFlight(
        digest: String,
        workID: UUID,
        waiterID: UUID,
        work: Task<HudTTSResult, Error>,
        identity: HudSpeechCacheIdentity
    ) async throws -> HudTTSResult {
        if inFlight[digest] == nil, var cached = loadValid(digest: digest, identity: identity) {
            hits += 1
            cached.cached = true
            return cached
        }
        if var flight = inFlight[digest], flight.id == workID {
            flight.waiters.insert(waiterID)
            inFlight[digest] = flight
        }

        return try await finish(
            digest: digest,
            workID: workID,
            waiterID: waiterID,
            work: work,
            identity: identity,
            persist: true
        )
    }

    private func finish(
        digest: String,
        workID: UUID,
        waiterID: UUID,
        work: Task<HudTTSResult, Error>,
        identity: HudSpeechCacheIdentity?,
        persist: Bool,
        freshWork: Bool = false
    ) async throws -> HudTTSResult {
        do {
            let waiter = SpeechCacheWaiter()
            let result = try await withTaskCancellationHandler {
                try await withCheckedThrowingContinuation { continuation in
                    waiter.install(continuation)
                    Task { waiter.resolve(await work.result) }
                }
            } onCancel: {
                // Task.value does not stop waiting when its caller is cancelled.
                // Complete only this waiter; surviving callers still own the work.
                waiter.resolve(.failure(CancellationError()))
                if freshWork {
                    work.cancel()
                }
                Task {
                    await self.abandonWaiter(
                        digest: digest,
                        workID: workID,
                        waiterID: waiterID,
                        cancelWorkIfLast: true
                    )
                }
            }

            try Task.checkCancellation()
            var stored = result
            stored.cached = false
            guard !stored.audioData.isEmpty else { throw HudSpeechCacheError.emptyAudio }
            if persist, let identity, shouldPersist(digest: digest, workID: workID, freshWork: freshWork) {
                try store(digest: digest, identity: identity, result: stored)
                latestWrite[digest] = nil
            }
            completeWork(digest: digest, workID: workID)

            if Task.isCancelled {
                throw CancellationError()
            }
            return stored
        } catch {
            abandonWaiter(
                digest: digest,
                workID: workID,
                waiterID: waiterID,
                cancelWorkIfLast: true
            )
            throw error
        }
    }

    private func shouldPersist(digest: String, workID: UUID, freshWork: Bool) -> Bool {
        if freshWork {
            return latestFresh[digest] == workID
        }
        return latestWrite[digest] == workID
    }

    /// Drop one waiter. The last reuse waiter cancels shared work. Idempotent
    /// so `onCancel` and the `finish` catch path can both run.
    private func abandonWaiter(
        digest: String,
        workID: UUID,
        waiterID: UUID,
        cancelWorkIfLast: Bool
    ) {
        if var flight = inFlight[digest], flight.id == workID {
            flight.waiters.remove(waiterID)
            if flight.waiters.isEmpty {
                if cancelWorkIfLast {
                    flight.task.cancel()
                }
                inFlight[digest] = nil
                releaseWriteClaim(digest: digest, workID: workID)
            } else {
                inFlight[digest] = flight
            }
            return
        }
        releaseWriteClaim(digest: digest, workID: workID)
    }

    private func completeWork(digest: String, workID: UUID) {
        if let flight = inFlight[digest], flight.id == workID {
            inFlight[digest] = nil
        }
        if latestFresh[digest] == workID {
            latestFresh[digest] = nil
        }
    }

    /// Give an in-flight reuse the write slot when a newer claim is abandoned.
    private func releaseWriteClaim(digest: String, workID: UUID) {
        if latestFresh[digest] == workID {
            latestFresh[digest] = nil
        }
        guard latestWrite[digest] == workID else { return }
        if let flight = inFlight[digest] {
            latestWrite[digest] = flight.id
        } else {
            latestWrite[digest] = nil
        }
    }

    private func loadValid(digest: String, identity: HudSpeechCacheIdentity) -> HudTTSResult? {
        let metaURL = sidecarURL(digest)
        let audioURL = audioURL(digest, formatHint: index[digest]?.format)
        guard
            let payload = try? Data(contentsOf: metaURL),
            let sidecar = try? Self.makeDecoder().decode(Sidecar.self, from: payload)
        else {
            removeEntry(digest)
            return nil
        }

        guard sidecar.version == 1, sidecar.digest == digest else {
            removeEntry(digest)
            return nil
        }
        guard sidecar.identity.digest == digest, sidecar.identity == StoredIdentity(identity) else {
            removeEntry(digest)
            return nil
        }
        guard let format = HudTTSAudioFormat(rawValue: sidecar.format) else {
            removeEntry(digest)
            return nil
        }

        guard sidecar.file == "\(digest).\(format.rawValue)" else {
            removeEntry(digest)
            return nil
        }
        let resolvedAudioURL = directory.appendingPathComponent("\(digest).\(format.rawValue)")
        guard
            let audio = try? Data(contentsOf: resolvedAudioURL),
            !audio.isEmpty,
            audio.count == sidecar.byteCount,
            Self.sha256Hex(audio) == sidecar.audioSHA256
        else {
            removeEntry(digest)
            return nil
        }

        if index[digest] == nil {
            index[digest] = IndexRecord(
                digest: digest,
                file: sidecar.file,
                format: sidecar.format,
                byteCount: sidecar.byteCount,
                createdAt: sidecar.createdAt
            )
            persistIndex()
        }

        _ = audioURL
        return HudTTSResult(
            audioData: audio,
            format: format,
            providerID: HudTTSProviderID(rawValue: sidecar.providerID),
            voice: sidecar.voice,
            wordTimings: sidecar.wordTimings?.map {
                HudTTSWordTiming(word: $0.word, start: $0.start, end: $0.end)
            },
            cached: true
        )
    }

    private func store(
        digest: String,
        identity: HudSpeechCacheIdentity,
        result: HudTTSResult
    ) throws {
        guard !result.audioData.isEmpty else {
            throw HudSpeechCacheError.emptyAudio
        }
        guard result.audioData.count <= maxBytes else {
            removeEntry(digest)
            persistIndex()
            return
        }

        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        let fileName = "\(digest).\(result.format.rawValue)"
        let audioURL = directory.appendingPathComponent(fileName)
        let metaURL = sidecarURL(digest)
        let createdAt = Date()
        let sidecar = Sidecar(
            version: 1,
            digest: digest,
            identity: StoredIdentity(identity),
            format: result.format.rawValue,
            voice: result.voice,
            providerID: result.providerID.rawValue,
            audioSHA256: Self.sha256Hex(result.audioData),
            byteCount: result.audioData.count,
            createdAt: createdAt,
            file: fileName,
            wordTimings: result.wordTimings?.map {
                StoredTiming(word: $0.word, start: $0.start, end: $0.end)
            }
        )

        let metaData = try Self.makeEncoder().encode(sidecar)

        try writeAtomically(result.audioData, to: audioURL)
        try writeAtomically(metaData, to: metaURL)
        try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: audioURL.path)
        try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: metaURL.path)

        index[digest] = IndexRecord(
            digest: digest,
            file: fileName,
            format: result.format.rawValue,
            byteCount: result.audioData.count,
            createdAt: createdAt
        )
        evictIfNeeded(keeping: digest)
        persistIndex()
    }

    private func evictIfNeeded(keeping kept: String) {
        var bytes = index.values.reduce(0) { $0 + $1.byteCount }
        guard bytes > maxBytes else { return }

        let oldest = index.values
            .filter { $0.digest != kept }
            .sorted { $0.createdAt < $1.createdAt }

        for record in oldest {
            guard bytes > maxBytes else { break }
            bytes -= record.byteCount
            removeEntry(record.digest)
        }
    }

    private func removeEntry(_ digest: String) {
        index.removeValue(forKey: digest)
        try? fileManager.removeItem(at: sidecarURL(digest))
        for format in [HudTTSAudioFormat.mp3, .wav, .caf] {
            let orphan = directory.appendingPathComponent("\(digest).\(format.rawValue)")
            try? fileManager.removeItem(at: orphan)
        }
    }

    private func persistIndex() {
        let payload = IndexFile(version: 1, entries: index)
        guard let data = try? Self.makeEncoder().encode(payload) else { return }
        let url = indexURL
        try? writeAtomically(data, to: url)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }

    private func writeAtomically(_ data: Data, to url: URL) throws {
        let temp = url.appendingPathExtension("tmp")
        if fileManager.fileExists(atPath: temp.path) {
            try fileManager.removeItem(at: temp)
        }
        try data.write(to: temp, options: [.atomic])
        if fileManager.fileExists(atPath: url.path) {
            _ = try fileManager.replaceItemAt(url, withItemAt: temp)
        } else {
            try fileManager.moveItem(at: temp, to: url)
        }
    }

    private var indexURL: URL {
        directory.appendingPathComponent("index.json")
    }

    private func sidecarURL(_ digest: String) -> URL {
        directory.appendingPathComponent("\(digest).meta.json")
    }

    private func audioURL(_ digest: String, formatHint: String?) -> URL {
        let ext = formatHint ?? HudTTSAudioFormat.wav.rawValue
        return directory.appendingPathComponent("\(digest).\(ext)")
    }

    private static func loadIndex(from directory: URL) -> [String: IndexRecord] {
        let url = directory.appendingPathComponent("index.json")
        guard
            let data = try? Data(contentsOf: url),
            let decoded = try? makeDecoder().decode(IndexFile.self, from: data),
            decoded.version == 1
        else {
            return [:]
        }
        return decoded.entries.filter { digest, record in
            digest.count == 64 && digest.allSatisfy({ "0123456789abcdef".contains($0) })
                && record.digest == digest
                && HudTTSAudioFormat(rawValue: record.format) != nil
                && record.file == "\(digest).\(record.format)"
                && record.byteCount > 0
        }
    }

    static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}

extension HudSpeechCacheIdentity {
    var digest: String {
        StoredIdentity(self).digest
    }
}

private struct InFlight {
    let id: UUID
    let task: Task<HudTTSResult, Error>
    var waiters: Set<UUID>
}

private struct IndexFile: Codable {
    var version: Int
    var entries: [String: IndexRecord]
}

private struct IndexRecord: Codable {
    var digest: String
    var file: String
    var format: String
    var byteCount: Int
    var createdAt: Date
}

private struct Sidecar: Codable {
    var version: Int
    var digest: String
    var identity: StoredIdentity
    var format: String
    var voice: String
    var providerID: String
    var audioSHA256: String
    var byteCount: Int
    var createdAt: Date
    var file: String
    var wordTimings: [StoredTiming]?
}

private struct StoredTiming: Codable {
    var word: String
    var start: TimeInterval
    var end: TimeInterval
}

private struct StoredIdentity: Codable, Equatable {
    var text: String
    var providerID: String
    var model: String?
    var voice: String?
    var rate: String
    var instructions: String?
    var voiceSettings: String
    var namespace: String?

    init(_ identity: HudSpeechCacheIdentity) {
        text = identity.text
        providerID = identity.providerID.rawValue
        model = identity.model
        voice = identity.voice
        rate = String(identity.rate.bitPattern, radix: 16)
        instructions = identity.instructions
        voiceSettings = identity.voiceSettings.canonicalDigest
        namespace = identity.namespace
    }

    var digest: String {
        let payload = [
            "v2",
            "namespace=\(namespace.jsonLiteral)",
            "provider=\(providerID.jsonLiteral)",
            "model=\(model.jsonLiteral)",
            "voice=\(voice.jsonLiteral)",
            "rate=\(rate)",
            "instructions=\(instructions.jsonLiteral)",
            "voiceSettings=\(voiceSettings.jsonLiteral)",
            "text=\(text.jsonLiteral)",
        ].joined(separator: "\n")
        return HudSpeechCache.sha256Hex(Data(payload.utf8))
    }
}

private extension HudTTSVoiceSettings? {
    var canonicalDigest: String {
        guard let settings = self else { return "null" }
        var parts: [String] = []
        if let stability = settings.stability {
            parts.append("stability=\(String(stability.bitPattern, radix: 16))")
        }
        if let similarityBoost = settings.similarityBoost {
            parts.append("similarityBoost=\(String(similarityBoost.bitPattern, radix: 16))")
        }
        if let style = settings.style {
            parts.append("style=\(String(style.bitPattern, radix: 16))")
        }
        if let useSpeakerBoost = settings.useSpeakerBoost {
            parts.append("useSpeakerBoost=\(useSpeakerBoost ? "true" : "false")")
        }
        return "settings:" + parts.joined(separator: ",")
    }
}

private extension String {
    var jsonLiteral: String {
        let encoded = try? JSONEncoder().encode(self)
        return encoded.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }
}

private extension Optional where Wrapped == String {
    var jsonLiteral: String {
        switch self {
        case .none: return "null"
        case .some(let value): return value.jsonLiteral
        }
    }
}

// Cancellation may arrive before continuation registration or concurrently with
// synthesis completion. Deliver exactly one result across either ordering.
private final class SpeechCacheWaiter: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<HudTTSResult, Error>?
    private var result: Result<HudTTSResult, Error>?

    func install(_ continuation: CheckedContinuation<HudTTSResult, Error>) {
        lock.lock()
        if let result {
            lock.unlock()
            continuation.resume(with: result)
        } else {
            self.continuation = continuation
            lock.unlock()
        }
    }

    func resolve(_ result: Result<HudTTSResult, Error>) {
        lock.lock()
        guard self.result == nil else { lock.unlock(); return }
        self.result = result
        let continuation = self.continuation
        self.continuation = nil
        lock.unlock()
        continuation?.resume(with: result)
    }
}
