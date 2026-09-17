import Foundation
import Testing
@testable import HudsonConversation

private func call(_ id: String, name: String = "lookup",
                  arguments: String = #"{"query":"weather"}"#) -> HudConversationToolCall {
    .init(id: id, name: name, argumentsJSON: Data(arguments.utf8))
}

@Test("Successful dispatch preserves call ID, name, and delegation ID")
func dispatchSuccess() async {
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in Data(#"{"answer":42}"#.utf8) }
    var request = call("c1")
    request.delegationID = "d1"
    let result = await dispatcher.dispatch(request)
    #expect(result.callID == "c1")
    #expect(result.name == "lookup")
    #expect(result.delegationID == "d1")
    #expect(result.output == .success(Data(#"{"answer":42}"#.utf8)))
}

@Test("Unknown tools and non-object arguments fail safely without running")
func unknownAndMalformed() async {
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in Data() }
    let unknown = await dispatcher.dispatch(call("c1", name: "missing"))
    #expect(unknown.output == .failure("Unknown tool."))
    let malformed = await dispatcher.dispatch(call("c2", arguments: "[1,2]"))
    #expect(malformed.output == .failure("Tool arguments were not a JSON object."))
}

@Test("Declared validator gates the handler beyond well-formed JSON")
func declaredValidation() async {
    let counter = Counter()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup", validate: { call in
        call.argumentsJSON.contains(UInt8(ascii: "q")) ? nil : "The query field is required."
    }) { _ in await counter.increment(); return Data() }
    let rejected = await dispatcher.dispatch(call("c1", arguments: #"{"other":1}"#))
    #expect(rejected.output == .failure("The query field is required."))
    #expect(await counter.value == 0)
    _ = await dispatcher.dispatch(call("c2"))
    #expect(await counter.value == 1)
}

@Test("Host authorization declines without executing the effect")
func authorizationDeclined() async {
    let counter = Counter()
    let dispatcher = HudConversationToolDispatcher(authorize: { _ in false })
    await dispatcher.register("lookup") { _ in await counter.increment(); return Data() }
    let result = await dispatcher.dispatch(call("c1"))
    #expect(result.output == .failure("The host declined this tool call."))
    #expect(await counter.value == 0)
}

@Test("Duplicate call IDs never re-execute the effect")
func duplicateSuppression() async {
    let counter = Counter()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in await counter.increment(); return Data("ok".utf8) }
    let first = await dispatcher.dispatch(call("c1"))
    let second = await dispatcher.dispatch(call("c1"))
    #expect(first.output == .success(Data("ok".utf8)))
    #expect(second.output == .failure("Duplicate tool call was not executed again."))
    #expect(await counter.value == 1)
}

@Test("Cancellation before dispatch prevents the effect")
func cancelBeforeDispatch() async {
    let counter = Counter()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in await counter.increment(); return Data() }
    await dispatcher.cancel(ids: ["c1"])
    let result = await dispatcher.dispatch(call("c1"))
    #expect(result.output == .failure("Tool call was cancelled before it ran."))
    #expect(await counter.value == 0)
}

@Test("Cancellation while authorization awaits prevents the effect")
func cancelDuringAuthorization() async {
    let counter = Counter()
    let gate = Gate()
    let dispatcher = HudConversationToolDispatcher(authorize: { _ in
        await gate.wait()
        return true
    })
    await dispatcher.register("lookup") { _ in await counter.increment(); return Data() }
    async let pending = dispatcher.dispatch(call("c1"))
    try? await Task.sleep(nanoseconds: 50_000_000)
    await dispatcher.cancel(ids: ["c1"])
    await gate.open()
    let result = await pending
    #expect(result.output == .failure("Tool call was cancelled before it ran."))
    #expect(await counter.value == 0)
}

@Test("A late result after mid-flight cancellation is discarded; the effect is kept")
func lateResultDiscarded() async {
    let counter = Counter()
    let gate = Gate()
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("lookup") { _ in
        await counter.increment()
        await gate.wait()
        return Data("late".utf8)
    }
    async let pending = dispatcher.dispatch(call("c1"))
    try? await Task.sleep(nanoseconds: 50_000_000)
    await dispatcher.cancel(ids: ["c1"])
    await gate.open()
    let result = await pending
    #expect(result.output == .failure("Tool call was cancelled; its late result was discarded."))
    #expect(await counter.value == 1)
}

@Test("Only deliberate tool failures reach the provider verbatim")
func errorSanitization() async {
    struct Leaky: LocalizedError { var errorDescription: String? { "secret internal path" } }
    let dispatcher = HudConversationToolDispatcher()
    await dispatcher.register("curated") { _ in throw HudConversationToolFailure("The city was not found.") }
    await dispatcher.register("leaky") { _ in throw Leaky() }
    let curated = await dispatcher.dispatch(call("c1", name: "curated"))
    let leaky = await dispatcher.dispatch(call("c2", name: "leaky"))
    #expect(curated.output == .failure("The city was not found."))
    #expect(leaky.output == .failure("The tool failed."))
}

private actor Counter {
    private(set) var value = 0
    func increment() { value += 1 }
}

private actor Gate {
    private var opened = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if opened { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func open() {
        opened = true
        for waiter in waiters { waiter.resume() }
        waiters = []
    }
}
