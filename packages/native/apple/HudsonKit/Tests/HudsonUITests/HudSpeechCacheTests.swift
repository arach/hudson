import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudSpeechCache", .serialized)
struct HudSpeechCacheTests {
    @Test("reuse hits after a successful store")
    func reuseHitsAfterStore() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        let first = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }
        let second = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        #expect(first.cached == false)
        #expect(second.cached)
        #expect(second.audioData == first.audioData)
        #expect(second.voice == "alloy")
        #expect(second.wordTimings?.count == 1)
        #expect(await counter.count == 1)
        #expect(await env.cache.stats().hits == 1)
        #expect(await env.cache.stats().misses == 1)
    }

    @Test("every identity field invalidates the cache")
    func everyIdentityFieldInvalidates() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        _ = try await env.cache.synthesize(env.request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        var request = env.request
        request.text = "Hello, world?"
        _ = try await env.cache.synthesize(request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        request = env.request
        request.model = "tts-1-hd"
        _ = try await env.cache.synthesize(request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        request = env.request
        request.voice = "nova"
        _ = try await env.cache.synthesize(request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        request = env.request
        request.rate = 1.25
        _ = try await env.cache.synthesize(request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        request = env.request
        request.instructions = "speak slowly"
        _ = try await env.cache.synthesize(request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        request = env.request
        request.voiceSettings = HudTTSVoiceSettings(stability: 0.4)
        _ = try await env.cache.synthesize(request, providerID: .openai, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        _ = try await env.cache.synthesize(env.request, providerID: .elevenlabs, namespace: "host-a", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        _ = try await env.cache.synthesize(env.request, providerID: .openai, namespace: "host-b", policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        #expect(await counter.count == 9)
    }

    @Test("punctuation and case are distinct identities")
    func punctuationAndCaseAreDistinct() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        for text in ["Hello", "hello", "Hello!", "Hello."] {
            var request = env.request
            request.text = text
            _ = try await env.cache.synthesize(request, providerID: .openai, policy: .reuse) {
                await counter.synthesize($0, $1)
            }
        }
        #expect(await counter.count == 4)
    }

    @Test("fresh synthesizes even when a reusable payload exists")
    func freshBypassesDiskAndInFlightReuse() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        let fresh = try await env.cache.synthesize(env.request, providerID: .openai, policy: .fresh) {
            await counter.synthesize($0, $1, audio: Data("fresh".utf8))
        }
        #expect(fresh.cached == false)
        #expect(fresh.audioData == Data("fresh".utf8))

        let reuse = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }
        #expect(reuse.cached)
        #expect(reuse.audioData == Data("fresh".utf8))
        #expect(await counter.count == 2)
    }

    @Test("corrupt audio is a miss and can regenerate")
    func corruptAudioIsAMiss() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        let audioFiles = try FileManager.default.contentsOfDirectory(
            at: env.directory,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "mp3" }
        let audioURL = try #require(audioFiles.first)
        var bytes = try Data(contentsOf: audioURL)
        bytes.append(0xFF)
        try bytes.write(to: audioURL)

        let regenerated = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data("new".utf8))
        }
        #expect(regenerated.cached == false)
        #expect(regenerated.audioData == Data("new".utf8))
        #expect(await counter.count == 2)
    }

    @Test("truncated sidecar is a miss and can regenerate")
    func truncatedSidecarIsAMiss() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        let sidecars = try FileManager.default.contentsOfDirectory(
            at: env.directory,
            includingPropertiesForKeys: nil
        ).filter { $0.lastPathComponent.hasSuffix(".meta.json") }
        let sidecar = try #require(sidecars.first)
        try Data("{".utf8).write(to: sidecar)

        let regenerated = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data("rebuilt".utf8))
        }
        #expect(regenerated.cached == false)
        #expect(await counter.count == 2)
    }

    @Test("failed synthesis is not cached and can retry")
    func failedSynthesisIsNotCached() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()

        do {
            _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { _, _ in
                await counter.increment()
                throw HudTTSError.synthesisFailed(provider: .openai, message: "boom")
            }
            Issue.record("expected synthesisFailed")
        } catch let HudTTSError.synthesisFailed(_, message) {
            #expect(message == "boom")
        }

        let recovered = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }
        #expect(recovered.cached == false)
        #expect(await counter.count == 2)
        #expect(await env.cache.stats().entries == 1)
    }

    @Test("equal concurrent reuse requests coalesce")
    func concurrentReuseCoalesces() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        let gate = CacheGate()

        let first = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                await gate.markStartedAndWait()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("shared".utf8))
            }
        }
        await gate.waitUntilStarted()

        let second = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("other".utf8))
            }
        }

        await gate.release()
        let firstResult = try await first.value
        let secondResult = try await second.value

        #expect(firstResult.audioData == Data("shared".utf8))
        #expect(secondResult.audioData == Data("shared".utf8))
        #expect(await counter.count == 1)
    }

    @Test("fresh does not join an in-flight reuse request")
    func freshDoesNotJoinInFlightReuse() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        let gate = CacheGate()

        let reuse = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                await gate.markStartedAndWait()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("reuse".utf8))
            }
        }
        await gate.waitUntilStarted()

        let fresh = try await env.cache.synthesize(env.request, providerID: .openai, policy: .fresh) { request, providerID in
            await counter.increment()
            return SynthCounter.result(for: request, providerID: providerID, audio: Data("fresh".utf8))
        }

        await gate.release()
        let reuseResult = try await reuse.value

        #expect(fresh.audioData == Data("fresh".utf8))
        #expect(reuseResult.audioData == Data("reuse".utf8))
        #expect(await counter.count == 2)
    }

    @Test("cancelling the only waiter cancels synthesis and does not cache")
    func cancellationDoesNotCache() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        let gate = CacheGate()

        let task = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                await gate.markStarted()
                try await Task.sleep(nanoseconds: 30_000_000_000)
                return SynthCounter.result(for: request, providerID: providerID)
            }
        }
        await gate.waitUntilStarted()
        task.cancel()

        do {
            _ = try await task.value
            Issue.record("expected CancellationError")
        } catch is CancellationError {
            // expected
        } catch {
            Issue.record("expected CancellationError, got \(error)")
        }

        #expect(await env.cache.stats().entries == 0)
        #expect(await counter.count == 1)
    }

    @Test("bounded eviction removes the oldest payload")
    func boundedEvictionRemovesOldest() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-speech-cache-\(UUID().uuidString)", isDirectory: true)
        let cache = HudSpeechCache(directory: directory, maxBytes: 20)
        let counter = SynthCounter()
        defer { try? FileManager.default.removeItem(at: directory) }

        let first = HudTTSRequest(text: "one", voice: "alloy", model: "tts-1")
        let second = HudTTSRequest(text: "two", voice: "alloy", model: "tts-1")

        _ = try await cache.synthesize(first, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data(repeating: 1, count: 16))
        }
        _ = try await cache.synthesize(second, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data(repeating: 2, count: 16))
        }

        let stats = await cache.stats()
        #expect(stats.entries == 1)
        #expect(stats.bytes == 16)

        let regenerated = try await cache.synthesize(first, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data(repeating: 3, count: 16))
        }
        #expect(regenerated.cached == false)
        #expect(await counter.count == 3)
    }

    @Test("1.0 and 1.000000 rates share an identity")
    func formattedRatesCollide() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        var request = env.request
        request.rate = 1.0
        _ = try await env.cache.synthesize(request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }
        request.rate = 1.000000
        let hit = try await env.cache.synthesize(request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }
        #expect(hit.cached)
        #expect(await counter.count == 1)
    }

    @Test("cancelling one reuse waiter does not cancel shared synthesis")
    func cancellingOneWaiterKeepsSharedWork() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        let gate = CacheGate()

        let first = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                await gate.markStartedAndWait()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("shared".utf8))
            }
        }
        await gate.waitUntilStarted()

        let second = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("other".utf8))
            }
        }
        while await env.cache.stats().misses < 2 {
            await Task.yield()
        }
        second.cancel()
        do {
            _ = try await second.value
            Issue.record("expected CancellationError")
        } catch is CancellationError {
            // expected
        }

        await gate.release()
        let firstResult = try await first.value
        #expect(firstResult.audioData == Data("shared".utf8))
        #expect(await counter.count == 1)
        #expect(await env.cache.stats().entries == 1)

        let hit = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data("late".utf8))
        }
        #expect(hit.cached)
        #expect(hit.audioData == Data("shared".utf8))
        #expect(await counter.count == 1)
    }

    @Test("in-flight reuse started after fresh cannot overwrite the fresh payload")
    func freshWinsOverLaterInFlightReuse() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        let freshGate = CacheGate()
        let reuseGate = CacheGate()

        let fresh = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .fresh) { request, providerID in
                await counter.increment()
                await freshGate.markStartedAndWait()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("fresh".utf8))
            }
        }
        await freshGate.waitUntilStarted()

        let reuse = Task {
            try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) { request, providerID in
                await counter.increment()
                await reuseGate.markStartedAndWait()
                return SynthCounter.result(for: request, providerID: providerID, audio: Data("reuse".utf8))
            }
        }
        await reuseGate.waitUntilStarted()

        await freshGate.release()
        let freshResult = try await fresh.value
        #expect(freshResult.audioData == Data("fresh".utf8))

        await reuseGate.release()
        let reuseResult = try await reuse.value
        #expect(reuseResult.audioData == Data("reuse".utf8))

        let hit = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data("late".utf8))
        }
        #expect(hit.cached)
        #expect(hit.audioData == Data("fresh".utf8))
        #expect(await counter.count == 2)
    }

    @Test("bounded eviction can drop multiple older payloads")
    func boundedEvictionDropsMultipleOlderPayloads() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-speech-cache-\(UUID().uuidString)", isDirectory: true)
        let cache = HudSpeechCache(directory: directory, maxBytes: 30)
        defer { try? FileManager.default.removeItem(at: directory) }

        let first = HudTTSRequest(text: "one", voice: "alloy", model: "tts-1")
        let second = HudTTSRequest(text: "two", voice: "alloy", model: "tts-1")
        let third = HudTTSRequest(text: "three", voice: "alloy", model: "tts-1")

        _ = try await cache.synthesize(first, providerID: .openai, policy: .reuse) { _, _ in
            HudTTSResult(audioData: Data(repeating: 1, count: 12), format: .wav, providerID: .openai, voice: "alloy")
        }
        _ = try await cache.synthesize(second, providerID: .openai, policy: .reuse) { _, _ in
            HudTTSResult(audioData: Data(repeating: 2, count: 12), format: .wav, providerID: .openai, voice: "alloy")
        }
        _ = try await cache.synthesize(third, providerID: .openai, policy: .reuse) { _, _ in
            HudTTSResult(audioData: Data(repeating: 3, count: 20), format: .wav, providerID: .openai, voice: "alloy")
        }

        let stats = await cache.stats()
        #expect(stats.entries == 1)
        #expect(stats.bytes == 20)

        let firstAgain = try await cache.synthesize(first, providerID: .openai, policy: .reuse) { _, _ in
            HudTTSResult(audioData: Data(repeating: 9, count: 12), format: .wav, providerID: .openai, voice: "alloy")
        }
        #expect(firstAgain.cached == false)
        #expect(firstAgain.audioData == Data(repeating: 9, count: 12))
    }

    @Test("malformed sidecars are misses and can regenerate")
    func malformedSidecarsAreMisses() async throws {
        let cases: [(String, (inout [String: Any]) -> Void)] = [
            ("wrong version", { $0["version"] = 2 }),
            ("digest mismatch", { $0["digest"] = String(repeating: "ab", count: 32) }),
            ("unknown format", { $0["format"] = "ogg" }),
            ("file name mismatch", { $0["file"] = "other.mp3" }),
        ]

        for (name, mutate) in cases {
            let env = try CacheTestEnv()
            let counter = SynthCounter()
            _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
                await counter.synthesize($0, $1)
            }
            try mutateSidecar(in: env.directory, mutate: mutate)

            let regenerated = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
                await counter.synthesize($0, $1, audio: Data("rebuilt-\(name)".utf8))
            }
            #expect(regenerated.cached == false, "\(name) should miss")
            #expect(regenerated.audioData == Data("rebuilt-\(name)".utf8), "\(name) should regenerate")
            #expect(await counter.count == 2, "\(name) should synthesize twice")
        }
    }

    @Test("missing audio with an intact sidecar is a miss")
    func missingAudioIsAMiss() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }

        let audioFiles = try FileManager.default.contentsOfDirectory(
            at: env.directory,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "mp3" }
        let audioURL = try #require(audioFiles.first)
        try FileManager.default.removeItem(at: audioURL)

        let regenerated = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data("restored".utf8))
        }
        #expect(regenerated.cached == false)
        #expect(regenerated.audioData == Data("restored".utf8))
        #expect(await counter.count == 2)
    }

    @Test("sidecar identity mismatch is a miss")
    func sidecarIdentityMismatchIsAMiss() async throws {
        let env = try CacheTestEnv()
        let counter = SynthCounter()
        _ = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1)
        }
        try mutateSidecar(in: env.directory) { json in
            guard var identity = json["identity"] as? [String: Any] else { return }
            identity["text"] = "tampered"
            json["identity"] = identity
        }

        let regenerated = try await env.cache.synthesize(env.request, providerID: .openai, policy: .reuse) {
            await counter.synthesize($0, $1, audio: Data("untampered".utf8))
        }
        #expect(regenerated.cached == false)
        #expect(regenerated.audioData == Data("untampered".utf8))
        #expect(await counter.count == 2)
    }
}

private func mutateSidecar(in directory: URL, mutate: (inout [String: Any]) -> Void) throws {
    let sidecars = try FileManager.default.contentsOfDirectory(
        at: directory,
        includingPropertiesForKeys: nil
    ).filter { $0.lastPathComponent.hasSuffix(".meta.json") }
    let sidecar = try #require(sidecars.first)
    let data = try Data(contentsOf: sidecar)
    let object = try JSONSerialization.jsonObject(with: data)
    guard var json = object as? [String: Any] else {
        throw HudSpeechCacheError.io("sidecar was not an object")
    }
    mutate(&json)
    let mutated = try JSONSerialization.data(withJSONObject: json)
    try mutated.write(to: sidecar)
}

private struct CacheTestEnv {
    let directory: URL
    let cache: HudSpeechCache
    let request: HudTTSRequest

    init() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-speech-cache-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        cache = HudSpeechCache(directory: directory, maxBytes: 1024 * 1024)
        request = HudTTSRequest(
            text: "Hello, world",
            voice: "alloy",
            rate: 1.0,
            model: "tts-1",
            instructions: "clear",
            voiceSettings: HudTTSVoiceSettings(stability: 0.5)
        )
    }
}

private actor SynthCounter {
    private(set) var count = 0

    func increment() {
        count += 1
    }

    func synthesize(
        _ request: HudTTSRequest,
        _ providerID: HudTTSProviderID,
        audio: Data = Data("audio".utf8)
    ) -> HudTTSResult {
        count += 1
        return Self.result(for: request, providerID: providerID, audio: audio)
    }

    static func result(
        for request: HudTTSRequest,
        providerID: HudTTSProviderID,
        audio: Data = Data("audio".utf8)
    ) -> HudTTSResult {
        HudTTSResult(
            audioData: audio,
            format: .mp3,
            providerID: providerID,
            voice: request.voice ?? "alloy",
            wordTimings: [
                HudTTSWordTiming(word: "Hello", start: 0, end: 0.4)
            ]
        )
    }
}

private actor CacheGate {
    private var started: CheckedContinuation<Void, Never>?
    private var proceed: CheckedContinuation<Void, Never>?
    private var didStart = false
    private var released = false

    func waitUntilStarted() async {
        if didStart { return }
        await withCheckedContinuation { started = $0 }
    }

    func markStarted() {
        didStart = true
        started?.resume()
        started = nil
    }

    func markStartedAndWait() async {
        markStarted()
        if released { return }
        await withCheckedContinuation { proceed = $0 }
    }

    func release() {
        released = true
        proceed?.resume()
        proceed = nil
    }
}
