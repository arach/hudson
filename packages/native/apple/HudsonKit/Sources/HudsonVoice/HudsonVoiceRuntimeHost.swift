import Foundation
import Security
import VoxService

public enum HudsonVoiceRuntimeHostState: Equatable, Sendable {
    case stopped
    case running(endpoint: HudVoxEndpoint, pid: Int32)
    case failed(String)

    public var isRunning: Bool {
        if case .running = self {
            return true
        }
        return false
    }
}

/// Long-running embedded Vox host for native HudsonKit apps.
///
/// Apps that embed HudsonVoice are the permission and lifecycle owner for voice.
/// The host starts `VoxRuntimeService` in-process, writes the private Hudson
/// runtime capability used by `HudsonVoiceRuntime`, and mirrors Hudson Voice
/// preferences into the embedded Vox home.
public final class HudsonVoiceRuntimeHost: @unchecked Sendable {
    public static let shared = HudsonVoiceRuntimeHost()

    private let lock = NSRecursiveLock()
    private let bindAddress = "127.0.0.1"
    private let port: UInt16
    private let runtimeHomeURL: URL
    private let runtimeCapabilityURL: URL
    private let voxRuntimeURL: URL
    private var runtimeService: VoxRuntimeService?

    public private(set) var state: HudsonVoiceRuntimeHostState = .stopped

    public init(
        runtimeHomeURL: URL? = nil,
        port: UInt16? = nil
    ) {
        let resolvedRuntimeHomeURL = runtimeHomeURL ?? Self.defaultRuntimeHomeURL()
        self.runtimeHomeURL = resolvedRuntimeHomeURL
        self.runtimeCapabilityURL = resolvedRuntimeHomeURL.appendingPathComponent("hudson-voice-runtime.json")
        self.voxRuntimeURL = resolvedRuntimeHomeURL.appendingPathComponent("vox-runtime.json")
        self.port = port ?? Self.resolvePort()
    }

    public var capabilityURL: URL {
        runtimeCapabilityURL
    }

    public func start() throws {
        lock.lock()
        defer { lock.unlock() }

        if runtimeService != nil, HudsonVoiceRuntime.isAvailable() {
            return
        }

        let authToken = try Self.generateCapabilityToken()
        try configureVoxRuntimeEnvironment(authToken: authToken)
        try persistPreferences()

        let service = VoxRuntimeService(port: port, bindAddress: bindAddress, authToken: authToken)
        do {
            try service.start()
            try writeRuntimeCapability(authToken: authToken, startedAt: Date())
            runtimeService = service
            state = .running(endpoint: HudVoxEndpoint(host: bindAddress, port: port), pid: getpid())
        } catch {
            service.stop()
            removeRuntimeCapability()
            state = .failed(error.localizedDescription)
            throw error
        }
    }

    public func stop() {
        lock.lock()
        defer { lock.unlock() }

        runtimeService?.stop()
        runtimeService = nil
        removeRuntimeCapability()
        state = .stopped
    }

    private func configureVoxRuntimeEnvironment(authToken: String) throws {
        try FileManager.default.createDirectory(at: runtimeHomeURL, withIntermediateDirectories: true)
        try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: runtimeHomeURL.path)
        setenv("VOX_HOME", runtimeHomeURL.path, 1)
        setenv("VOX_RUNTIME_PATH", voxRuntimeURL.path, 1)
        setenv("VOX_HOST", bindAddress, 1)
        setenv("VOX_PORT", String(port), 1)
        setenv("VOX_AUTH_TOKEN", authToken, 1)
        setenv(HudsonVoiceRuntime.runtimePathEnvironmentKey, runtimeCapabilityURL.path, 1)
    }

    private func persistPreferences() throws {
        let preferences = (try? HudsonVoicePreferences.load()) ?? HudsonVoicePreferences()
        try preferences.normalized().save()
    }

    private func writeRuntimeCapability(authToken: String, startedAt: Date) throws {
        let capability = RuntimeCapabilityDocument(
            host: bindAddress,
            port: port,
            authToken: authToken,
            pid: getpid(),
            startedAt: ISO8601DateFormatter().string(from: startedAt),
            voxRuntimePath: voxRuntimeURL.path
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(capability)
        try data.write(to: runtimeCapabilityURL, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: runtimeCapabilityURL.path)
    }

    private func removeRuntimeCapability() {
        if FileManager.default.fileExists(atPath: runtimeCapabilityURL.path) {
            try? FileManager.default.removeItem(at: runtimeCapabilityURL)
        }
    }

    private static func defaultRuntimeHomeURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Vox", isDirectory: true)
    }

    private static func resolvePort() -> UInt16 {
        let env = ProcessInfo.processInfo.environment
        if let raw = env["HUDSON_VOICE_VOX_PORT"], let value = UInt16(raw) {
            return value
        }
        return UInt16.random(in: 49152...65535)
    }

    private static func generateCapabilityToken() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let byteCount = bytes.count
        let status = bytes.withUnsafeMutableBytes { buffer in
            SecRandomCopyBytes(kSecRandomDefault, byteCount, buffer.baseAddress!)
        }
        guard status == errSecSuccess else {
            throw NSError(domain: "HudsonVoiceRuntimeHost", code: Int(status), userInfo: [
                NSLocalizedDescriptionKey: "Could not generate Hudson voice capability token."
            ])
        }

        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private struct RuntimeCapabilityDocument: Encodable {
    let schemaVersion = 1
    let service = "hudson-voice"
    let transport = "ws+json-rpc"
    let host: String
    let port: UInt16
    let webSocketUrl: String
    let authToken: String
    let pid: Int32
    let startedAt: String
    let voxRuntimePath: String

    init(host: String, port: UInt16, authToken: String, pid: Int32, startedAt: String, voxRuntimePath: String) {
        self.host = host
        self.port = port
        self.webSocketUrl = "ws://\(host):\(port)"
        self.authToken = authToken
        self.pid = pid
        self.startedAt = startedAt
        self.voxRuntimePath = voxRuntimePath
    }
}
