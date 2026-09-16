import Foundation
import IOSurface

final class Worker: NSObject, ProbeService {
    private let queue = DispatchQueue(label: "hudson.terminal.probe.worker", qos: .userInitiated)
    private var leases = FrameLeases()
    private var ticks: UInt64 = 0
    private var timer: DispatchSourceTimer!
    private let producer = GPUProducer()!
    override init() {
        super.init()
        timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(10))
        timer.setEventHandler { [weak self] in self?.ticks += 1 }
        timer.resume()
    }
    deinit { timer.cancel() }
    func hello(reply: @escaping (Int32, Int) -> Void) { reply(getpid(), 1) }
    func acquireFrame(reply: @escaping (IOSurface?, UInt64) -> Void) {
        queue.async {
            guard let lease = self.leases.acquire() else { reply(nil, 0); return }
            self.producer.render(slot: lease.slot, sequence: lease.sequence) { success in
                self.queue.async {
                    guard success else {
                        _ = self.leases.release(lease.sequence); reply(nil, 0); return
                    }
                    reply(self.producer.surfaces[lease.slot], lease.sequence)
                }
            }
        }
    }
    func releaseFrame(_ sequence: UInt64, reply: @escaping (Bool) -> Void) {
        queue.async { reply(self.leases.release(sequence)) }
    }
    func cancelFrameRequest(reply: @escaping () -> Void) { reply() }
    func heartbeat(reply: @escaping (UInt64) -> Void) { queue.async { reply(self.ticks) } }
}

final class ListenerDelegate: NSObject, NSXPCListenerDelegate {
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard connection.effectiveUserIdentifier == getuid() else { return false }
        connection.exportedInterface = serviceInterface()
        connection.exportedObject = Worker()
        // The fixture has exactly one client. Never leave an owned helper
        // running after that client exits or the external watchdog kills it.
        connection.invalidationHandler = { exit(0) }
        connection.resume()
        return true
    }
}

@main struct WorkerMain {
    static func main() {
        let listener = NSXPCListener.service()
        let delegate = ListenerDelegate()
        listener.delegate = delegate
        withExtendedLifetime(delegate) { listener.resume(); RunLoop.main.run() }
    }
}
