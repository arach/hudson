import Foundation

/// A failure a tool handler deliberately shows to the provider. Any other
/// thrown error is replaced with generic text so host internals and secrets
/// cannot leak into provider context.
public struct HudConversationToolFailure: Error, Equatable, Sendable {
    public var message: String
    public init(_ message: String) { self.message = message }
}

/// Local asynchronous tool execution owned by the host. Provider messages are
/// data: the dispatcher looks up host-registered handlers by name and never
/// evaluates provider-supplied code. Effects run at most once per call ID.
public actor HudConversationToolDispatcher {
    public typealias Handler = @Sendable (HudConversationToolCall) async throws -> Data
    /// Host authorization gate over effects. Returning false fails the call
    /// without running its handler.
    public typealias Authorizer = @Sendable (HudConversationToolCall) async -> Bool
    /// Declared argument validation beyond well-formed JSON. Return a rejection
    /// message, or nil to accept. Runs before authorization and the handler.
    public typealias Validator = @Sendable (HudConversationToolCall) async -> String?

    private struct Registration {
        let handler: Handler
        let validate: Validator?
    }

    private var registrations: [String: Registration] = [:]
    private let authorize: Authorizer
    private var started: Set<String> = []
    private var cancelled: Set<String> = []
    private var running: [String: Task<Void, Never>] = [:]

    public init(authorize: @escaping Authorizer = { _ in true }) {
        self.authorize = authorize
    }

    public func register(_ name: String, validate: Validator? = nil, handler: @escaping Handler) {
        registrations[name] = Registration(handler: handler, validate: validate)
    }

    /// Cancel provider-withdrawn calls. A handler that has already produced an
    /// effect keeps its effect; only its result delivery is suppressed.
    public func cancel(ids: [String]) {
        for id in ids {
            cancelled.insert(id)
            running[id]?.cancel()
        }
    }

    /// Execute one provider tool call and return the result to send back.
    /// Duplicate call IDs return an error without re-running the effect.
    public func dispatch(_ call: HudConversationToolCall) async -> HudConversationToolResult {
        func failure(_ message: String) -> HudConversationToolResult {
            .init(callID: call.id, name: call.name, output: .failure(message), delegationID: call.delegationID)
        }
        guard !started.contains(call.id) else { return failure("Duplicate tool call was not executed again.") }
        started.insert(call.id)
        guard !cancelled.contains(call.id) else { return failure("Tool call was cancelled before it ran.") }
        guard let registration = registrations[call.name] else { return failure("Unknown tool.") }
        guard (try? JSONSerialization.jsonObject(with: call.argumentsJSON)) as? [String: Any] != nil else {
            return failure("Tool arguments were not a JSON object.")
        }
        if let validate = registration.validate, let rejection = await validate(call) {
            return failure(rejection)
        }
        guard await authorize(call) else { return failure("The host declined this tool call.") }
        // Cancellation can arrive while validation or authorization awaited;
        // the effect must not start afterwards.
        guard !cancelled.contains(call.id) else { return failure("Tool call was cancelled before it ran.") }

        let box = ResultBox()
        let work = Task { [handler = registration.handler] in
            do { await box.set(.success(try await handler(call))) }
            catch is CancellationError { await box.set(.failure("Tool call was cancelled.")) }
            catch let failure as HudConversationToolFailure { await box.set(.failure(failure.message)) }
            catch { await box.set(.failure("The tool failed.")) }
        }
        running[call.id] = work
        await work.value
        running[call.id] = nil
        let output = await box.value ?? .failure("Tool produced no result.")
        if cancelled.contains(call.id) {
            return failure("Tool call was cancelled; its late result was discarded.")
        }
        return .init(callID: call.id, name: call.name, output: output, delegationID: call.delegationID)
    }
}

private actor ResultBox {
    private(set) var value: HudConversationToolResult.Output?
    func set(_ output: HudConversationToolResult.Output) { value = output }
}
