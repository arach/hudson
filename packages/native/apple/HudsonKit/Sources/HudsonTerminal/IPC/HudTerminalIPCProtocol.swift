#if os(macOS)
import Foundation
import IOSurface
import CoreText

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
    /// Optional style for normal cells. Bold and italic retain their own styles.
    public var fontStyle: String?
    /// Installed system font files to register only in the worker process.
    public var fontFilePaths: [String]?
    public var version = HudTerminalIPCWire.version
    public init(executable: String = "/bin/zsh", arguments: [String] = ["-l"], environment: [String: String] = [:],
                workingDirectory: String = NSHomeDirectory(), fontFamily: String = "Menlo", fontSize: Double = 14,
                fontStyle: String? = nil, fontFilePaths: [String]? = nil) {
        self.executable = executable; self.arguments = arguments; self.environment = environment
        self.workingDirectory = workingDirectory; self.fontFamily = fontFamily; self.fontSize = fontSize
        self.fontStyle = fontStyle; self.fontFilePaths = fontFilePaths
    }

    public static func isValidFontStyle(_ style: String) -> Bool {
        let bytes = Array(style.utf8)
        guard (1...64).contains(bytes.count), bytes.first != 0x20, bytes.last != 0x20 else { return false }
        return bytes.allSatisfy {
            (0x30...0x39).contains($0) || (0x41...0x5A).contains($0) || (0x61...0x7A).contains($0) || $0 == 0x20
        }
    }
}

/// Uses fonts already supplied by macOS. Registration never installs or copies
/// a font and must happen independently in each process that resolves it.
public enum HudTerminalSystemFonts {
    private static let terminalFonts = "/System/Applications/Utilities/Terminal.app/Contents/Resources/Fonts/"
    public static let sfMonoFilePaths: [String] = {
        ["Regular", "Light", "Medium", "Semibold", "Bold", "Heavy"].flatMap { style in
            [style, style + "Italic"].map { terminalFonts + "SF-Mono-" + $0 + ".otf" }
        }.filter { FileManager.default.fileExists(atPath: $0) }
    }()

    public static func isAllowedFilePath(_ path: String) -> Bool {
        guard !path.contains("\0"), path.utf8.count <= 4096, path.hasPrefix("/") else { return false }
        let url = URL(fileURLWithPath: path).standardizedFileURL.resolvingSymlinksInPath()
        let allowedRoot = url.path.hasPrefix("/System/Library/Fonts/") || url.path.hasPrefix(terminalFonts)
        return allowedRoot && ["otf", "ttf"].contains(url.pathExtension.lowercased())
    }

    public static func register(_ paths: [String]) -> Bool {
        guard paths.count <= 32, paths.allSatisfy(isAllowedFilePath) else { return false }
        for path in paths {
            let url = URL(fileURLWithPath: path).standardizedFileURL.resolvingSymlinksInPath()
            guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey]), values.isRegularFile == true else { return false }
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                guard let error = error?.takeRetainedValue(),
                      CFErrorGetCode(error) == CTFontManagerError.alreadyRegistered.rawValue else { return false }
            }
        }
        return true
    }

    public static let registeredSFMono: Bool = !sfMonoFilePaths.isEmpty && register(sfMonoFilePaths)
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
