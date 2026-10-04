import Foundation
import HudsonConversation

/// Gemini Live conversational sessions (BidiGenerateContent). Distinct from
/// the transcription-only Gemini adapters; conversational output never routes
/// through them.
///
/// Model rules enforced here rather than silently adjusted:
/// - gemini-3.8-live: no thinking level; tool results may carry scheduling;
///   blocking tool declarations are allowed.
/// - gemini-3.8-live-extended-thinking: thinking level low/medium/high only;
///   tools must be non-blocking (a blocking declaration is a hard error);
///   result scheduling is unsupported and rejected.
public struct HudGeminiConversationAdapter: HudConversationAdapter {
    public typealias HTTPTransport = @Sendable (URLRequest) async throws -> (Data, Int)

    public static let providerID: HudConversationProviderID = "gemini-live-conversation"
    static let extendedThinkingSuffix = "extended-thinking"

    public let descriptor = HudConversationProviderDescriptor(
        id: HudGeminiConversationAdapter.providerID,
        displayName: "Gemini Live",
        adapterVersion: "1",
        documentationURL: URL(string: "https://ai.google.dev/gemini-api/docs/live-api"),
        preferredInputAudio: .pcm16k)

    private let credentials: any HudConversationCredentialResolver
    private let socketFactory: HudConversationSocketFactory
    private let http: HTTPTransport
    private let host: String

    public init(
        credentials: any HudConversationCredentialResolver,
        socketFactory: @escaping HudConversationSocketFactory = { HudConversationURLSocket(request: $0) },
        http: @escaping HTTPTransport = HudGeminiConversationAdapter.urlSessionTransport,
        host: String = "generativelanguage.googleapis.com"
    ) {
        self.credentials = credentials
        self.socketFactory = socketFactory
        self.http = http
        self.host = host
    }

    public static let urlSessionTransport: HTTPTransport = { request in
        let (data, response) = try await URLSession.shared.data(for: request)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }

    /// Provider discovery: the v1beta model list filtered to models that
    /// support bidiGenerateContent, following pagination to the end. A later
    /// page failure fails the refresh; a partial list is never published.
    /// Requires an API key; ephemeral tokens are session credentials and
    /// cannot list models.
    public func models(configuration: HudConversationConfiguration) async throws -> [HudConversationModelDescriptor] {
        guard configuration.credentialKind == .apiKey else {
            throw HudConversationError.discoveryFailed(
                "Model discovery needs an API key; ephemeral tokens only open sessions.")
        }
        let key = try await resolvedCredential(configuration)
        var descriptors: [HudConversationModelDescriptor] = []
        var seenIDs: Set<String> = []
        var pageToken: String?
        var seenTokens: Set<String> = []
        repeat {
            guard var components = URLComponents(string: "https://\(host)/v1beta/models") else {
                throw HudConversationError.discoveryFailed("Invalid discovery endpoint.")
            }
            var query = [URLQueryItem(name: "pageSize", value: "200")]
            if let pageToken { query.append(URLQueryItem(name: "pageToken", value: pageToken)) }
            components.queryItems = query
            guard let url = components.url else {
                throw HudConversationError.discoveryFailed("Invalid discovery endpoint.")
            }
            var request = URLRequest(url: url)
            request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
            let (data, status) = try await http(request)
            guard status == 200,
                  let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let rows = body["models"] as? [[String: Any]] else {
                throw HudConversationError.discoveryFailed("The Gemini model list request did not succeed.")
            }
            for row in rows {
                guard let name = row["name"] as? String,
                      let methods = row["supportedGenerationMethods"] as? [String],
                      methods.contains("bidiGenerateContent") else { continue }
                let id = name.hasPrefix("models/") ? String(name.dropFirst("models/".count)) : name
                guard seenIDs.insert(id).inserted else { continue }
                descriptors.append(descriptor(id: id, displayName: row["displayName"] as? String))
            }
            pageToken = body["nextPageToken"] as? String
            if let pageToken {
                guard seenTokens.insert(pageToken).inserted else {
                    throw HudConversationError.discoveryFailed("The Gemini model list repeated a page.")
                }
            }
        } while pageToken != nil
        return descriptors
    }

    /// Capability metadata only for models whose behavior is documented;
    /// discovery alone proves an identifier exists, not what it supports.
    private func descriptor(id: String, displayName: String?) -> HudConversationModelDescriptor {
        switch id {
        case "gemini-3.8-live":
            return .init(id: .init(rawValue: id), displayName: displayName ?? id,
                         toolCalling: .supported, configurableThinking: .unsupported,
                         notes: "Audio response modality is required and proactive audio is always enabled.")
        case "gemini-3.8-live-" + Self.extendedThinkingSuffix:
            return .init(id: .init(rawValue: id), displayName: displayName ?? id,
                         toolCalling: .supported, configurableThinking: .supported,
                         notes: "Reasons while speaking. Tools must be non-blocking; result scheduling is unsupported.")
        default:
            return .init(id: .init(rawValue: id), displayName: displayName ?? id,
                         toolCalling: .unknown, configurableThinking: .unknown)
        }
    }

    public func readiness(configuration: HudConversationConfiguration) async throws -> HudConversationReadiness {
        if let problem = validate(configuration, tools: []) { return .init(status: .unavailable, reason: problem) }
        guard configuration.credentialReference != nil else {
            return .init(status: .needsCredential, reason: "Add a Gemini API key or a host-minted session token.")
        }
        guard (try? await resolvedCredential(configuration)) != nil else {
            return .init(status: .needsCredential, reason: "The referenced Gemini credential is not available.")
        }
        return .init(status: .ready, reason: "Configured locally. Account access is verified when a session opens.")
    }

    public func open(configuration: HudConversationConfiguration,
                     tools: [HudConversationToolDeclaration]) async throws -> any HudConversationSession {
        if let problem = validate(configuration, tools: tools) {
            throw HudConversationError.invalidConfiguration(problem)
        }
        let credential = try await resolvedCredential(configuration)
        var request: URLRequest
        switch configuration.credentialKind {
        case .apiKey:
            // A long-lived key never rides the URL, where it would land in
            // connection logs; it goes in the handshake header.
            let path = "wss://\(host)/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
            guard let url = URL(string: path) else { throw HudConversationError.connectionFailed }
            request = URLRequest(url: url)
            request.setValue(credential, forHTTPHeaderField: "x-goog-api-key")
        case .ephemeralToken:
            // Short-lived tokens use the constrained endpoint. The token rides
            // the documented `Authorization: Token` header rather than the
            // URL, which lands in connection logs.
            let path = "wss://\(host)/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained"
            guard let url = URL(string: path) else { throw HudConversationError.connectionFailed }
            request = URLRequest(url: url)
            request.setValue("Token \(credential)", forHTTPHeaderField: "Authorization")
        }
        let socket = try await socketFactory(request)
        let session = HudGeminiConversationSession(socket: socket, configuration: configuration, tools: tools)
        do {
            try await session.start()
        } catch {
            await socket.close()
            throw error
        }
        return session
    }

    static func isExtendedThinking(_ modelID: HudConversationModelID) -> Bool {
        modelID.rawValue.hasSuffix(extendedThinkingSuffix)
    }

    private func validate(_ configuration: HudConversationConfiguration,
                          tools: [HudConversationToolDeclaration]) -> String? {
        if configuration.providerID != descriptor.id { return "The selected provider is not Gemini Live." }
        let extended = Self.isExtendedThinking(configuration.modelID)
        if extended {
            if tools.contains(where: { $0.behavior == .blocking }) {
                return "Extended thinking requires non-blocking tools; blocking mode returns a hard provider error."
            }
        } else if configuration.thinkingLevel != nil {
            return "This model does not take a thinking level. Choose the extended-thinking model instead."
        }
        return nil
    }

    private func resolvedCredential(_ configuration: HudConversationConfiguration) async throws -> String {
        guard let reference = configuration.credentialReference else {
            throw HudConversationError.notReady(.init(status: .needsCredential))
        }
        let data = try await credentials.credential(for: reference)
        guard let value = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            throw HudConversationError.notReady(.init(status: .needsCredential))
        }
        return value
    }
}
