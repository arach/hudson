import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudSpeechCache exact request identity")
struct HudSpeechCachePrecisionTests {
    @Test("cancelled providers that ignore cancellation cannot persist", arguments: [HudSpeechCachePolicy.reuse, .fresh])
    func cancelledProvider(_ policy: HudSpeechCachePolicy) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = HudSpeechCache(directory: directory)
        let gate = CacheRegressionGate()
        let job = Task {
            try await cache.synthesize(HudTTSRequest(text: "cancelled"), providerID: .openai, policy: policy) { _, _ in
                await gate.wait()
                return HudTTSResult(audioData: Data([1]), format: .wav, providerID: .openai, voice: "test")
            }
        }
        while !(await gate.entered) { await Task.yield() }
        job.cancel()
        await gate.release()
        do {
            _ = try await job.value
            Issue.record("Cancelled request returned success")
        } catch is CancellationError {} catch { throw error }
        #expect(await cache.stats().entries == 0)
    }

    @Test("cancelled reuse does not leave a joinable finished flight")
    func cancelledReuseDoesNotLeaveJoinableFlight() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = HudSpeechCache(directory: directory)
        let gate = CacheRegressionGate()
        let counter = PrecisionSynthCounter()
        let job = Task {
            try await cache.synthesize(HudTTSRequest(text: "cancelled"), providerID: .openai, policy: .reuse) { _, _ in
                await counter.increment()
                await gate.wait()
                return HudTTSResult(audioData: Data([1]), format: .wav, providerID: .openai, voice: "test")
            }
        }
        while !(await gate.entered) { await Task.yield() }
        job.cancel()
        await gate.release()
        do {
            _ = try await job.value
            Issue.record("Cancelled request returned success")
        } catch is CancellationError {} catch { throw error }

        let replayed = try await cache.synthesize(HudTTSRequest(text: "cancelled"), providerID: .openai, policy: .reuse) { _, _ in
            await counter.increment()
            return HudTTSResult(audioData: Data([2]), format: .wav, providerID: .openai, voice: "test")
        }
        #expect(replayed.cached == false)
        #expect(replayed.audioData == Data([2]))
        #expect(await counter.count == 2)
        #expect(await cache.stats().entries == 1)
    }

    @Test("oversized audio is returned but not persisted")
    func oversized() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = HudSpeechCache(directory: directory, maxBytes: 2)
        let result = try await cache.synthesize(HudTTSRequest(text: "large"), providerID: .openai) { _, _ in
            HudTTSResult(audioData: Data([1, 2, 3]), format: .wav, providerID: .openai, voice: "test")
        }
        #expect(result.audioData.count == 3)
        #expect(await cache.stats().bytes == 0)
    }
    @Test("nearby rates cannot reuse another request")
    func distinctRates() {
        let a = HudTTSRequest(text: "Ready", rate: 1.0000001)
        let b = HudTTSRequest(text: "Ready", rate: 1.0000002)
        #expect(HudSpeechCacheIdentity(request: a, providerID: .openai).digest != HudSpeechCacheIdentity(request: b, providerID: .openai).digest)
    }

    @Test("an omitted voice is distinct from an explicit empty voice")
    func optionalVoice() {
        let a = HudTTSRequest(text: "Ready", voice: nil)
        let b = HudTTSRequest(text: "Ready", voice: "")
        #expect(HudSpeechCacheIdentity(request: a, providerID: .openai).digest != HudSpeechCacheIdentity(request: b, providerID: .openai).digest)
    }
}

private actor CacheRegressionGate {
    private(set) var entered = false
    private var continuation: CheckedContinuation<Void, Never>?
    func wait() async {
        entered = true
        await withCheckedContinuation { continuation = $0 }
    }
    func release() { continuation?.resume(); continuation = nil }
}

private actor PrecisionSynthCounter {
    private(set) var count = 0
    func increment() { count += 1 }
}
