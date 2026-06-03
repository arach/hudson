import AppKit
import AVFoundation
import Darwin
import Security
import SwiftUI
import VoxService

@MainActor
public final class HudsonVoiceDaemonHost: ObservableObject {
    @Published public private(set) var lifecycle: HudsonVoiceDaemonLifecycle = .stopped
    @Published public private(set) var microphonePermission: HudsonMicrophonePermission = .unknown
    @Published public private(set) var runtimeDetail = "Embedded Vox runtime has not started."
    @Published public private(set) var startedAt: Date?

    private let bindAddress = "127.0.0.1"
    private let port: UInt16
    private let runtimeHomeURL: URL
    private let runtimeCapabilityURL: URL
    private let voxRuntimeURL: URL
    private var runtimeService: VoxRuntimeService?

    public init() {
        port = Self.resolvePort()
        runtimeHomeURL = Self.defaultRuntimeHomeURL()
        runtimeCapabilityURL = runtimeHomeURL.appendingPathComponent("hudson-voice-runtime.json")
        voxRuntimeURL = runtimeHomeURL.appendingPathComponent("vox-runtime.json")
        refreshMicrophonePermission()
    }

    deinit {
        runtimeService?.stop()
    }

    public var summary: String {
        switch lifecycle {
        case .running:
            return "Hudson Menu is holding the long-running voice host. \(runtimeDetail)"
        case .starting:
            return "Hudson Menu is preparing the embedded Vox runtime."
        case .unavailable:
            return runtimeDetail
        case .stopped:
            return "Hudson voice is stopped. Start it to own mic permissions and daemon lifecycle."
        case .error:
            return runtimeDetail
        }
    }

    public func start() {
        guard lifecycle != .running && lifecycle != .starting else { return }

        refreshMicrophonePermission()
        lifecycle = .starting

        guard microphonePermission == .granted else {
            lifecycle = microphonePermission == .denied || microphonePermission == .restricted ? .error : .stopped
            runtimeDetail = "Microphone permission is \(microphonePermission.label.lowercased())."
            startedAt = nil
            return
        }

        do {
            let token = try Self.generateCapabilityToken()
            let startedAt = Date()
            try configureVoxRuntimeEnvironment(authToken: token)
            let service = VoxRuntimeService(port: port, bindAddress: bindAddress, authToken: token)
            try service.start()
            try writeRuntimeCapability(authToken: token, startedAt: startedAt)
            runtimeService = service
            lifecycle = .running
            runtimeDetail = "Authenticated Hudson voice runtime is available through /api/hudson-voice."
            self.startedAt = startedAt
        } catch {
            runtimeService?.stop()
            runtimeService = nil
            removeRuntimeCapability()
            lifecycle = .error
            runtimeDetail = "Embedded Vox runtime failed to start: \(error.localizedDescription)"
            startedAt = nil
        }
    }

    public func stop() {
        runtimeService?.stop()
        runtimeService = nil
        removeRuntimeCapability()
        lifecycle = .stopped
        runtimeDetail = "Embedded Vox runtime is stopped."
        startedAt = nil
    }

    public func refreshMicrophonePermission() {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            microphonePermission = .granted
        case .notDetermined:
            microphonePermission = .notDetermined
        case .denied:
            microphonePermission = .denied
        case .restricted:
            microphonePermission = .restricted
        @unknown default:
            microphonePermission = .unknown
        }
    }

    public func requestMicrophonePermission() async {
        refreshMicrophonePermission()
        guard microphonePermission.canRequest else { return }

        let granted = await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted)
            }
        }

        microphonePermission = granted ? .granted : .denied
        start()
    }

    public func openMicrophoneSettings() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone") else { return }
        NSWorkspace.shared.open(url)
    }

    private func configureVoxRuntimeEnvironment(authToken: String) throws {
        try FileManager.default.createDirectory(at: runtimeHomeURL, withIntermediateDirectories: true)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: runtimeHomeURL.path)
        setenv("VOX_HOME", runtimeHomeURL.path, 1)
        setenv("VOX_RUNTIME_PATH", voxRuntimeURL.path, 1)
        setenv("VOX_HOST", bindAddress, 1)
        setenv("VOX_PORT", String(port), 1)
        setenv("VOX_AUTH_TOKEN", authToken, 1)
        setenv("HUDSON_VOICE_RUNTIME_PATH", runtimeCapabilityURL.path, 1)
    }

    private func writeRuntimeCapability(authToken: String, startedAt: Date) throws {
        let capability = HudsonVoiceRuntimeCapability(
            host: bindAddress,
            port: port,
            authToken: authToken,
            pid: getpid(),
            startedAt: startedAt,
            voxRuntimePath: voxRuntimeURL.path
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(capability)
        try data.write(to: runtimeCapabilityURL, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: runtimeCapabilityURL.path)
    }

    private func removeRuntimeCapability() {
        if FileManager.default.fileExists(atPath: runtimeCapabilityURL.path) {
            try? FileManager.default.removeItem(at: runtimeCapabilityURL)
        }
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
            throw NSError(domain: "HudsonVoiceDaemonHost", code: Int(status), userInfo: [
                NSLocalizedDescriptionKey: "Could not generate Hudson voice capability token."
            ])
        }

        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func defaultRuntimeHomeURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Vox", isDirectory: true)
    }
}

private struct HudsonVoiceRuntimeCapability: Encodable {
    let schemaVersion = 1
    let service = "hudson-voice"
    let transport = "ws+json-rpc"
    let host: String
    let port: UInt16
    let webSocketUrl: String
    let authToken: String
    let pid: Int32
    let startedAt: Date
    let voxRuntimePath: String

    init(host: String, port: UInt16, authToken: String, pid: Int32, startedAt: Date, voxRuntimePath: String) {
        self.host = host
        self.port = port
        self.webSocketUrl = "ws://\(host):\(port)"
        self.authToken = authToken
        self.pid = pid
        self.startedAt = startedAt
        self.voxRuntimePath = voxRuntimePath
    }
}

public enum HudsonVoiceDaemonLifecycle: Equatable {
    case stopped
    case starting
    case running
    case unavailable
    case error

    public var label: String {
        switch self {
        case .stopped: return "STOPPED"
        case .starting: return "STARTING"
        case .running: return "RUNNING"
        case .unavailable: return "UNAVAILABLE"
        case .error: return "NEEDS ATTENTION"
        }
    }

    public var tint: Color {
        switch self {
        case .stopped: return .secondary
        case .starting: return .yellow
        case .running: return .green
        case .unavailable: return .orange
        case .error: return .red
        }
    }
}

public enum HudsonMicrophonePermission: Equatable {
    case unknown
    case notDetermined
    case granted
    case denied
    case restricted

    public var label: String {
        switch self {
        case .unknown: return "Unknown"
        case .notDetermined: return "Not Determined"
        case .granted: return "Granted"
        case .denied: return "Denied"
        case .restricted: return "Restricted"
        }
    }

    public var canRequest: Bool {
        self == .notDetermined || self == .unknown
    }
}
