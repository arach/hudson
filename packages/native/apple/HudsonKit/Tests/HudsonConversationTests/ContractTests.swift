import Foundation
import Testing
@testable import HudsonConversation

@Test("Losing a control event to backpressure is a failure, not a silent drop")
func eventGateOverflow() async {
    let gate = HudConversationEventGate(capacity: 1)
    #expect(gate.yield(.turnComplete))
    // The queue holds one element; a second control event evicts the first.
    #expect(!gate.yield(.turnComplete))
}

@Test("Stale audio may be evicted under backpressure without failing")
func eventGateAudioDrop() async {
    let gate = HudConversationEventGate(capacity: 1)
    let chunk = HudConversationAudioChunk(data: Data([0, 0]), format: .pcm24k, generation: 0, sequence: 1)
    #expect(gate.yield(.assistantAudio(chunk)))
    #expect(gate.yield(.turnComplete))
}

@Test("Fingerprint is stable, secret-free, and configuration-sensitive")
func configurationFingerprint() {
    var configuration = HudConversationConfiguration(
        providerID: "gemini-live-conversation", modelID: "gemini-3.8-live",
        credentialReference: .init(identifier: "gemini-key"))
    let first = configuration.secretFreeFingerprint
    #expect(first == configuration.secretFreeFingerprint)
    #expect(first.hasPrefix("sha256:"))
    configuration.thinkingLevel = .high
    #expect(configuration.secretFreeFingerprint != first)
}

@Test("The catalog preserves an unknown saved model instead of substituting")
func catalogPreservesSavedModel() async throws {
    let adapter = FixtureAdapter(models: [
        .init(id: "gemini-3.8-live", displayName: "Gemini 3.8 Live"),
    ])
    let catalog = HudConversationModelCatalog(adapter: adapter)
    try await catalog.refresh(configuration: configuration())
    let entries = await catalog.entries(savedID: "gemini-3.7-live-retired")
    #expect(entries.count == 2)
    let saved = entries.first { $0.descriptor.id == "gemini-3.7-live-retired" }
    #expect(saved?.available == false)
    #expect(saved?.descriptor.discovered == false)
}

@Test("A failed refresh keeps the previously discovered catalog")
func catalogKeepsPreviousOnFailure() async throws {
    let adapter = FixtureAdapter(models: [.init(id: "gemini-3.8-live", displayName: "Gemini 3.8 Live")])
    let catalog = HudConversationModelCatalog(adapter: adapter)
    try await catalog.refresh(configuration: configuration())
    await adapter.setFailing()
    await #expect(throws: HudConversationError.self) {
        try await catalog.refresh(configuration: configuration())
    }
    let entries = await catalog.entries(savedID: nil)
    #expect(entries.map(\.descriptor.id) == ["gemini-3.8-live"])
}

private func configuration() -> HudConversationConfiguration {
    .init(providerID: "fixture", modelID: "gemini-3.8-live")
}

private final class FixtureAdapter: HudConversationAdapter, @unchecked Sendable {
    let descriptor = HudConversationProviderDescriptor(id: "fixture", displayName: "Fixture", adapterVersion: "0")
    private let state: State
    private actor State {
        var models: [HudConversationModelDescriptor]
        var failing = false
        init(models: [HudConversationModelDescriptor]) { self.models = models }
        func setFailing() { failing = true }
        func current() throws -> [HudConversationModelDescriptor] {
            if failing { throw HudConversationError.discoveryFailed("Fixture failure.") }
            return models
        }
    }

    init(models: [HudConversationModelDescriptor]) { state = State(models: models) }
    func setFailing() async { await state.setFailing() }

    func models(configuration: HudConversationConfiguration) async throws -> [HudConversationModelDescriptor] {
        try await state.current()
    }
    func readiness(configuration: HudConversationConfiguration) async throws -> HudConversationReadiness {
        .init(status: .ready)
    }
    func open(configuration: HudConversationConfiguration,
              tools: [HudConversationToolDeclaration]) async throws -> any HudConversationSession {
        throw HudConversationError.invalidConfiguration("The fixture adapter does not open sessions.")
    }
}
