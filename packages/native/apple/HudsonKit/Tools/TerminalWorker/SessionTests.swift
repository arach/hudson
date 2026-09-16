// Compile with IPC sources and -D HUDSON_TERMINAL_IPC_TESTING. No XPC helper,
// PTY, app bundle, or user session is launched by this regression test.
import AppKit
import IOSurface

private final class Service: NSObject, HudTerminalWorkerService {
    var opened: ((String?) -> Void)?
    var inputTexts: [String] = []
    var closed: [String] = []
    var identifiers: [String] = []
    func open(_ identifier: String, specification: Data, reply: @escaping (String?) -> Void) {
        identifiers.append(identifier); opened = reply
    }
    func close(_ identifier: String, reply: @escaping () -> Void) { closed.append(identifier); reply() }
    func input(_ identifier: String, sequence: UInt64, event: Data, reply: @escaping (Bool) -> Void) {
        inputTexts.append(try! JSONDecoder().decode(HudTerminalInputEvent.self, from: event).text); reply(true)
    }
    func configure(_ identifier: String, revision: UInt64, width: Int, height: Int, scale: Double, visible: Bool, focused: Bool, reply: @escaping (String?) -> Void) { reply(nil) }
    func acquire(_ identifier: String, reply: @escaping (IOSurface?, UInt64) -> Void) { fatalError("hidden test session must not acquire") }
    func release(_ identifier: String, sequence: UInt64, reply: @escaping (Bool) -> Void) { reply(true) }
    func cancelAcquire(_ identifier: String, reply: @escaping () -> Void) { reply() }
    func selection(_ identifier: String, reply: @escaping (String) -> Void) { reply("") }
}
@main private struct SessionTests {
    @MainActor static func wait(_ description: String, until condition: () -> Bool) async {
        for _ in 0..<1000 {
            if condition() { return }
            try! await Task.sleep(nanoseconds: 10_000_000)
        }
        fatalError("Timed out: \(description)")
    }
    @MainActor static func main() async {
        _ = NSApplication.shared
        let service = Service()
        HudTerminalIPCSession.installTestService(service)
        var session: HudTerminalIPCSession? = HudTerminalIPCSession()
        session!.start()
        precondition(session!.acceptsInput && !session!.isRunning)
        session!.send(Data("first".utf8)); session!.send(Data("second".utf8))
        precondition(session!.queuedInputCount == 2 && service.inputTexts.isEmpty)
        await wait("open request") { service.opened != nil }
        precondition(service.inputTexts.isEmpty)
        service.opened!(nil); service.opened = nil
        await wait("startup queue drained") { service.inputTexts.count == 2 }
        precondition(service.inputTexts == ["first", "second"])
        let initialID = service.identifiers[0]
        weak var weakSession = session
        session = nil
        await wait("last owner closes helper session") { weakSession == nil && service.closed.contains(initialID) }

        let stopped = HudTerminalIPCSession()
        stopped.start(); stopped.send(Data("must not reach helper".utf8))
        await wait("second open request") { service.opened != nil }
        let reply = service.opened!; service.opened = nil
        stopped.stop(); reply(nil)
        try! await Task.sleep(nanoseconds: 100_000_000)
        precondition(!stopped.acceptsInput && stopped.queuedInputCount == 0)
        precondition(service.inputTexts == ["first", "second"])
        print("PASS: startup input buffers and drains in order; last owner closes session; stop discards pending startup input and ignores late open reply")
    }
}
