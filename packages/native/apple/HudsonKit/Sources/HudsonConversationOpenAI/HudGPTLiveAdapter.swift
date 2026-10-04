import Foundation
import HudsonConversation

/// OpenAI GPT-Live over WebSocket, per the current /v1/live/sessions product.
/// This is not the legacy Realtime API; do not reuse its event names.
/// Contract sources: developers.openai.com guides live, voice-websockets, live-delegation.
public struct HudGPTLiveAdapter: HudConversationAdapter {
    public typealias HTTPTransport = @Sendable (URLRequest) async throws -> (Data, Int)

    public static let providerID: HudConversationProviderID = "openai-gpt-live"

    public let descriptor = HudConversationProviderDescriptor(
        id: HudGPTLiveAdapter.providerID,
        displayName: "OpenAI GPT-Live",
        adapterVersion: "1",
        documentationURL: URL(string: "https://developers.openai.com/api/docs/guides/live"),
        preferredInputAudio: .pcm24k)

    private let credentials: any HudConversationCredentialResolver
    private let socketFactory: HudConversationSocketFactory
    private let http: HTTPTransport
    private let socketURL: URL
    private let modelsURL: URL

    public init(
        credentials: any HudConversationCredentialResolver,
        socketFactory: @escaping HudConversationSocketFactory = { HudConversationURLSocket(request: $0) },
        http: @escaping HTTPTransport = HudGPTLiveAdapter.urlSessionTransport,
        socketURL: URL = URL(string: "wss://api.openai.com/v1/live/sessions")!,
        modelsURL: URL = URL(string: "https://api.openai.com/v1/models")!
    ) {
        self.credentials = credentials
        self.socketFactory = socketFactory
        self.http = http
        self.socketURL = socketURL
        self.modelsURL = modelsURL
    }

    public static let urlSessionTransport: HTTPTransport = { request in
        let (data, response) = try await URLSession.shared.data(for: request)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }

    /// Provider discovery: the account's model list filtered to GPT-Live
    /// identifiers. No hand-maintained allowlist; an empty result is an empty
    /// result, not a fallback to a guessed model.
    public func models(configuration: HudConversationConfiguration) async throws -> [HudConversationModelDescriptor] {
        let key = try await resolvedKey(configuration)
        var request = URLRequest(url: modelsURL)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let (data, status) = try await http(request)
        guard status == 200,
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rows = body["data"] as? [[String: Any]] else {
            throw HudConversationError.discoveryFailed("The OpenAI model list request did not succeed.")
        }
        return rows.compactMap { row in
            guard let id = row["id"] as? String, id.hasPrefix("gpt-live"),
                  !id.hasPrefix("gpt-live-transcribe") else { return nil }
            return HudConversationModelDescriptor(
                id: .init(rawValue: id), displayName: id,
                toolCalling: .supported, configurableThinking: .unsupported,
                notes: "Delegated backend work continues independently of speech interruption.")
        }
    }

    public func readiness(configuration: HudConversationConfiguration) async throws -> HudConversationReadiness {
        if let problem = validate(configuration) { return .init(status: .unavailable, reason: problem) }
        guard configuration.credentialReference != nil else {
            return .init(status: .needsCredential, reason: "Add an OpenAI API key to use GPT-Live.")
        }
        guard (try? await resolvedKey(configuration)) != nil else {
            return .init(status: .needsCredential, reason: "The referenced OpenAI API key is not available.")
        }
        return .init(status: .ready, reason: "Configured locally. Account access is verified when a session opens.")
    }

    public func open(configuration: HudConversationConfiguration,
                     tools: [HudConversationToolDeclaration]) async throws -> any HudConversationSession {
        if let problem = validate(configuration) { throw HudConversationError.invalidConfiguration(problem) }
        // Delegation problems are local configuration errors; no socket is
        // opened for a session that cannot be started.
        let delegation = try HudGPTLiveSession.delegationConfiguration(
            configuration: configuration, tools: tools)
        let key = try await resolvedKey(configuration)
        var request = URLRequest(url: socketURL)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let socket = try await socketFactory(request)
        let session = HudGPTLiveSession(
            socket: socket, configuration: configuration, tools: tools, delegation: delegation)
        do {
            try await session.start()
        } catch {
            await socket.close()
            throw error
        }
        return session
    }

    private func validate(_ configuration: HudConversationConfiguration) -> String? {
        if configuration.providerID != descriptor.id { return "The selected provider is not GPT-Live." }
        if configuration.thinkingLevel != nil { return "GPT-Live does not take a thinking level." }
        if configuration.credentialKind != .apiKey {
            return "GPT-Live sockets use a server-held API key. Browsers connect through a host backend instead."
        }
        if ![16000, 24000].contains(configuration.inputAudio.sampleRate) {
            return "GPT-Live PCM sessions use 24000 or 16000 samples per second."
        }
        return nil
    }

    private func resolvedKey(_ configuration: HudConversationConfiguration) async throws -> String {
        guard let reference = configuration.credentialReference else {
            throw HudConversationError.notReady(.init(status: .needsCredential))
        }
        let data = try await credentials.credential(for: reference)
        guard let key = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !key.isEmpty else {
            throw HudConversationError.notReady(.init(status: .needsCredential))
        }
        return key
    }
}
