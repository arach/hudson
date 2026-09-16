import Foundation
import Testing
@testable import HudsonTranscription

private actor NativeWorkGate {
    private var continuation: CheckedContinuation<Void, Never>?
    private(set) var started = false
    func work() async {
        await withCheckedContinuation { continuation in
            self.continuation = continuation
            started = true
        }
    }
    func finish() { continuation?.resume(); continuation = nil }
}

@Test func localOwnerEvictsPreviousPreparedModelAndChecksResourceType() async throws {
    let owner = HudTranscriptionLocalResources()
    #expect(try await owner.prepare(key: "first") { 7 }.isReady)
    #expect(try await owner.withResource(key: "first", as: Int.self) { $0 } == 7)
    #expect(try await owner.prepare(key: "second") { "model" }.isReady)
    #expect(await owner.isPrepared(key: "first") == false)
    #expect(await owner.isPrepared(key: "second"))
    await #expect(throws: HudTranscriptionError.self) {
        _ = try await owner.withResource(key: "second", as: Int.self) { $0 }
    }
    #expect(await owner.unloadIfIdle())
    #expect(await owner.isPrepared(key: "second") == false)
}

@Test func localOwnerHoldsCancelledNativeWorkUntilItActuallyReturns() async throws {
    let owner = HudTranscriptionLocalResources()
    let gate = NativeWorkGate()
    #expect(try await owner.prepare(key: "first") { 7 }.isReady)
    let work = Task {
        try await owner.withResource(key: "first", as: Int.self) { value in
            await gate.work() // Deliberately ignores cancellation, like an SDK call.
            return value
        }
    }
    let limit = ContinuousClock.now.advanced(by: .seconds(2))
    while !(await gate.started), ContinuousClock.now < limit {
        try await Task.sleep(for: .milliseconds(5))
    }
    #expect(await gate.started)
    work.cancel()
    #expect(await owner.unloadIfIdle() == false)
    #expect(try await owner.prepare(key: "second") { 9 }.status == .preparing)
    await #expect(throws: HudTranscriptionError.self) {
        _ = try await owner.withResource(key: "first", as: Int.self) { $0 }
    }
    await gate.finish()
    await #expect(throws: CancellationError.self) { _ = try await work.value }
    #expect(try await owner.prepare(key: "second") { 9 }.isReady)
}

@Test func localSessionLeasePreventsEvictionUntilReleased() async throws {
    let owner = HudTranscriptionLocalResources()
    #expect(try await owner.prepare(key: "live") { 7 }.isReady)
    var lease: HudTranscriptionLocalResources.Lease<Int>? = try await owner.lease(key: "live", as: Int.self)
    #expect(await lease?.withValue { $0 } == 7)
    #expect(await owner.unloadIfIdle() == false)
    #expect(try await owner.prepare(key: "other") { 9 }.status == .preparing)
    lease = nil
    let limit = ContinuousClock.now.advanced(by: .seconds(2))
    while !(await owner.unloadIfIdle()), ContinuousClock.now < limit {
        try await Task.sleep(for: .milliseconds(5))
    }
    #expect(await owner.isPrepared(key: "live") == false)
}
