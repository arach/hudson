import Foundation
import IOSurface

// A private feasibility protocol, not a stable Hudson API. The real terminal
// contract is documented in docs/native-terminal-isolation.md.
@objc(HudTerminalIsolationProbeService)
protocol ProbeService {
    func hello(reply: @escaping (Int32, Int) -> Void)
    func acquireFrame(reply: @escaping (IOSurface?, UInt64) -> Void)
    func releaseFrame(_ sequence: UInt64, reply: @escaping (Bool) -> Void)
    func heartbeat(reply: @escaping (UInt64) -> Void)
}

func serviceInterface() -> NSXPCInterface {
    let interface = NSXPCInterface(with: ProbeService.self)
    interface.setClasses(NSSet(object: IOSurface.self) as! Set<AnyHashable>, for: #selector(ProbeService.acquireFrame(reply:)), argumentIndex: 0, ofReply: true)
    return interface
}

// Serial-owner lease table. A surface is immutable while the client holds its
// lease. Invalid/duplicate acknowledgements cannot release a different frame.
struct FrameLeases {
    private var slots: [UInt64?] = Array(repeating: nil, count: 3)
    private var next: UInt64 = 1
    mutating func acquire() -> (slot: Int, sequence: UInt64)? {
        guard let slot = slots.firstIndex(where: { $0 == nil }), next < UInt64.max else { return nil }
        let sequence = next; next += 1; slots[slot] = sequence
        return (slot, sequence)
    }
    mutating func release(_ sequence: UInt64) -> Bool {
        guard sequence != 0, let slot = slots.firstIndex(where: { $0 == sequence }) else { return false }
        slots[slot] = nil
        return true
    }
}
