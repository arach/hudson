#if os(macOS)
import Foundation
import IOSurface

// Versioned private wire contract shared by Hudson's host and embedded helper.
// No terminal bytes or screen snapshots travel on the presentation channel.
@objc(HudTerminalWorkerService) public protocol HudTerminalWorkerService {
    func open(_ identifier: String, specification: Data, reply: @escaping (String?) -> Void)
    func close(_ identifier: String, reply: @escaping () -> Void)
    func input(_ identifier: String, sequence: UInt64, event: Data, reply: @escaping (Bool) -> Void)
    func configure(_ identifier: String, revision: UInt64, width: Int, height: Int, scale: Double, visible: Bool, focused: Bool, reply: @escaping (String?) -> Void)
    func acquire(_ identifier: String, reply: @escaping (IOSurface?, UInt64) -> Void)
    func release(_ identifier: String, sequence: UInt64, reply: @escaping (Bool) -> Void)
    func cancelAcquire(_ identifier: String, reply: @escaping () -> Void)
    func selection(_ identifier: String, reply: @escaping (String) -> Void)
}
@objc(HudTerminalHostEvents) public protocol HudTerminalHostEvents {
    func ended(_ identifier: String, message: String)
}
public enum HudTerminalIPCWire {
    public static let version = 1
    public static let serviceName = "app.hudson.TerminalWorker"
    public static func interface() -> NSXPCInterface {
        let result = NSXPCInterface(with: HudTerminalWorkerService.self)
        result.setClasses(NSSet(object: IOSurface.self) as! Set<AnyHashable>,
            for: #selector(HudTerminalWorkerService.acquire(_:reply:)), argumentIndex: 0, ofReply: true)
        return result
    }
}
public struct HudTerminalProcessSpecification: Codable, Equatable, Sendable {
    public var executable: String
    public var arguments: [String]
    public var environment: [String: String]
    public var workingDirectory: String
    public var fontFamily: String
    public var fontSize: Double
    public var version = HudTerminalIPCWire.version
    public init(executable: String = "/bin/zsh", arguments: [String] = ["-l"], environment: [String: String] = [:],
                workingDirectory: String = NSHomeDirectory(), fontFamily: String = "Menlo", fontSize: Double = 14) {
        self.executable = executable; self.arguments = arguments; self.environment = environment
        self.workingDirectory = workingDirectory; self.fontFamily = fontFamily; self.fontSize = fontSize
    }
}
public struct HudTerminalInputEvent: Codable, Sendable {
    public var kind: String
    public var text: String = ""
    public var keycode: UInt32 = 0
    public var modifiers: UInt32 = 0
    public var codepoint: UInt32 = 0
    public var action: Int = 0
    public var x: Double = 0
    public var y: Double = 0
    public var button: Int = 0
    public init(kind: String) { self.kind = kind }
}
#endif
