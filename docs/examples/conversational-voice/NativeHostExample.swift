// Native host wiring for a conversational voice session, end to end.
//
// This file compiles against HudsonConversation, HudsonConversationHost and
// both provider adapters. It is documentation that type-checks: every symbol
// used here exists, so the guide cannot drift from the API the way prose can.
//
// What it does NOT do: open a socket, touch a microphone or speaker, or call a
// provider. `makeHostSession` builds a configured `HudConversationHostSession`
// and returns it without running. `run()` is the only call that would contact
// a provider, and it is left to the caller.
//
// Credentials are supplied by the caller as a `HudConversationCredentialResolver`
// (`HudVault` in a real host). No secret appears here.

import Foundation
import HudsonConversation
import HudsonConversationGemini
import HudsonConversationHost
import HudsonConversationOpenAI

// MARK: - A local, harmless tool

/// A pure, local tool: it reads its arguments and computes an answer. No file
/// system, no network, no shared mutable state — nothing a provider could
/// steer into an effect. Provider messages are data; the handler is host code
/// selected by name, never anything the provider supplies.
enum WordCountTool {
    static let name = "count_words"

    /// JSON Schema for the arguments, as the declaration carries it.
    static let parametersJSONSchema: Data = {
        let schema: [String: Any] = [
            "type": "object",
            "properties": ["text": ["type": "string", "description": "Text to count words in."]],
            "required": ["text"],
        ]
        // A literal schema this shape always encodes; an empty object is a safe
        // floor if it somehow does not, since the declaration is optional.
        return (try? JSONSerialization.data(withJSONObject: schema)) ?? Data("{}".utf8)
    }()

    static var declaration: HudConversationToolDeclaration {
        HudConversationToolDeclaration(
            name: name,
            description: "Count the words in a piece of text.",
            parametersJSONSchema: parametersJSONSchema,
            // Non-blocking works on both Gemini models; extended thinking
            // requires it and rejects blocking declarations outright.
            behavior: .nonBlocking)
    }

    /// Validate before computing. The dispatcher already rejects non-object
    /// arguments, but a handler must not assume its own fields are well formed
    /// — the model chooses them, and it gets them wrong.
    ///
    /// Rejections throw `HudConversationToolFailure`, which is the **only**
    /// error type whose message reaches the model. The dispatcher maps every
    /// other error to the fixed string "The tool failed.", so a `LocalizedError`
    /// with a carefully worded description would be silently discarded — host
    /// internals must not leak into provider context by accident.
    static func validate(_ argumentsJSON: Data) throws -> String {
        guard let object = try JSONSerialization.jsonObject(with: argumentsJSON) as? [String: Any] else {
            throw HudConversationToolFailure("Arguments must be a JSON object.")
        }
        guard let raw = object["text"] else {
            throw HudConversationToolFailure("Argument 'text' is required.")
        }
        guard let text = raw as? String else {
            throw HudConversationToolFailure("Argument 'text' must be a string.")
        }
        guard text.count <= 10_000 else {
            throw HudConversationToolFailure(
                "Argument 'text' is limited to 10000 characters; received \(text.count).")
        }
        return text
    }

    /// Returns JSON, which is what the dispatcher's handler contract expects.
    static func handle(_ call: HudConversationToolCall) throws -> Data {
        let text = try validate(call.argumentsJSON)
        let words = text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
        return try JSONSerialization.data(withJSONObject: ["words": words])
    }
}

// MARK: - Transcript sink

/// One main-actor consumer appends deltas in stream enqueue order. Callbacks
/// enqueue synchronously, without creating a task for each delta. Concurrent
/// producers have no intrinsic order beyond the order their yields are queued.
@MainActor
public final class TranscriptLog: ObservableObject {
    @Published public private(set) var user = ""
    @Published public private(set) var assistant = ""

    private enum Delta: Sendable {
        case user(String)
        case assistant(String)
    }

    nonisolated private let continuation: AsyncStream<Delta>.Continuation
    private var consumer: Task<Void, Never>?

    public init() {
        // Do not drop transcript fragments: losing one corrupts append-only text.
        let (stream, continuation) = AsyncStream<Delta>.makeStream()
        self.continuation = continuation
        consumer = Task { @MainActor [weak self] in
            for await delta in stream {
                guard !Task.isCancelled, let self else { break }
                switch delta {
                case .user(let text): self.appendUser(text)
                case .assistant(let text): self.appendAssistant(text)
                }
            }
        }
    }

    deinit {
        continuation.finish()
        consumer?.cancel()
    }

    public func appendUser(_ delta: String) { user += delta }
    public func appendAssistant(_ delta: String) { assistant += delta }

    nonisolated public func transcripts() -> HudConversationHostSession.Transcripts {
        let continuation = continuation
        return HudConversationHostSession.Transcripts(
            onUserDelta: { delta in continuation.yield(.user(delta)) },
            onAssistantDelta: { delta in continuation.yield(.assistant(delta)) })
    }
}

// MARK: - Host wiring

public enum NativeHostExample {
    public enum WiringError: LocalizedError {
        case unknownProvider(String)
        case missingDelegationModel

        public var errorDescription: String? {
            switch self {
            case .unknownProvider(let id):
                "No adapter is registered for provider '\(id)'."
            case .missingDelegationModel:
                """
                GPT-Live needs a Responses backend model before tools can be \
                declared. Set options["delegationModel"], or supply a full \
                authored options["delegation"] object; the adapter will not \
                guess a model.
                """
            }
        }
    }

    /// Host authorization gate. It runs before any handler, and returning
    /// false fails the call without running its effect. A real host would
    /// consult user consent or a policy object here; this one allows exactly
    /// the tool it registered and nothing else.
    static func authorize(_ call: HudConversationToolCall) async -> Bool {
        call.name == WordCountTool.name
    }

    /// Build a dispatcher with the local tool registered and the host gate in
    /// place. A dispatcher is scoped to one conversation: its call-ID history
    /// is what makes effects at-most-once, so never share one across sessions.
    public static func makeDispatcher() async -> HudConversationToolDispatcher {
        let dispatcher = HudConversationToolDispatcher(authorize: authorize)
        await dispatcher.register(WordCountTool.name) { call in
            try WordCountTool.handle(call)
        }
        return dispatcher
    }

    /// Select the adapter for a configuration's provider. Both adapters take
    /// the host's credential resolver; neither stores a secret.
    public static func makeAdapter(
        for configuration: HudConversationConfiguration,
        credentials: any HudConversationCredentialResolver
    ) throws -> any HudConversationAdapter {
        switch configuration.providerID {
        case HudGPTLiveAdapter.providerID:
            return HudGPTLiveAdapter(credentials: credentials)
        case HudGeminiConversationAdapter.providerID:
            return HudGeminiConversationAdapter(credentials: credentials)
        default:
            throw WiringError.unknownProvider(configuration.providerID.rawValue)
        }
    }

    /// GPT-Live takes its delegation setup from `options`, and there are two
    /// valid shapes. This mirrors the adapter's precedence rather than
    /// imposing a narrower rule:
    ///
    /// - `options["delegation"]` — a full authored delegation JSON object. When
    ///   present the adapter uses it and never consults `delegationModel`, so
    ///   an authored config is valid **without** that key. Requiring it here
    ///   would reject configurations the adapter accepts.
    /// - otherwise, with tools declared — `options["delegationModel"]` names
    ///   the Responses backend model, and the adapter synthesizes the rest. It
    ///   will not guess a model, so a missing key fails at open time.
    ///
    /// Checking here only moves that failure earlier, with a message naming the
    /// missing key. The adapter remains the authority: it additionally
    /// validates the authored object's shape and rejects tools declared both on
    /// the session and inside the delegation option. Gemini has no equivalent
    /// requirement, so the check is scoped to GPT-Live.
    public static func validateDelegation(
        _ configuration: HudConversationConfiguration,
        tools: [HudConversationToolDeclaration]
    ) throws {
        guard configuration.providerID == HudGPTLiveAdapter.providerID, !tools.isEmpty else { return }
        if configuration.options["delegation"] != nil { return }
        let model = configuration.options["delegationModel"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let model, !model.isEmpty else { throw WiringError.missingDelegationModel }
    }

    /// Everything above, assembled. Returns a session that has NOT been run:
    /// no socket is opened and no audio device is touched until the caller
    /// invokes `run()`.
    ///
    /// Readiness is checked first so a misconfigured setup fails here rather
    /// than at connect time. Readiness performs no network I/O — it reports
    /// configuration shape and credential presence, and never proves the
    /// provider accepted anything.
    public static func makeHostSession(
        configuration: HudConversationConfiguration,
        credentials: any HudConversationCredentialResolver,
        log: TranscriptLog
    ) async throws -> HudConversationHostSession {
        let tools = [WordCountTool.declaration]
        try validateDelegation(configuration, tools: tools)

        let adapter = try makeAdapter(for: configuration, credentials: credentials)
        let readiness = try await adapter.readiness(configuration: configuration)
        guard readiness.isReady else { throw HudConversationError.notReady(readiness) }

        return HudConversationHostSession(
            adapter: adapter,
            configuration: configuration,
            dispatcher: await makeDispatcher(),
            tools: tools,
            transcripts: log.transcripts())
    }

    /// Barge-in, effect 1 only: stop local playback. It sends nothing to the
    /// provider and cancels no tool or delegated work — neither provider
    /// documents a client-initiated cancel, and tool effects that already ran
    /// stay run.
    public static func userInterrupted(_ host: HudConversationHostSession) async {
        await host.userInterrupted()
    }

    /// End input and close gracefully. Safe while `run()` is still opening.
    public static func stop(_ host: HudConversationHostSession) async {
        await host.stop()
    }
}
