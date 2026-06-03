import AppKit
import AVFoundation
import Darwin
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
    private var runtimeService: VoxRuntimeService?

    public init() {
        port = Self.resolvePort()
        runtimeHomeURL = Self.defaultRuntimeHomeURL()
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
            try configureVoxRuntimeEnvironment()
            let service = VoxRuntimeService(port: port, bindAddress: bindAddress)
            try service.start()
            runtimeService = service
            lifecycle = .running
            runtimeDetail = "Embedded Vox runtime is listening on ws://\(bindAddress):\(port)."
            startedAt = Date()
        } catch {
            runtimeService?.stop()
            runtimeService = nil
            lifecycle = .error
            runtimeDetail = "Embedded Vox runtime failed to start: \(error.localizedDescription)"
            startedAt = nil
        }
    }

    public func stop() {
        runtimeService?.stop()
        runtimeService = nil
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

    private func configureVoxRuntimeEnvironment() throws {
        try FileManager.default.createDirectory(at: runtimeHomeURL, withIntermediateDirectories: true)
        setenv("VOX_HOME", runtimeHomeURL.path, 1)
        setenv("VOX_RUNTIME_PATH", runtimeHomeURL.appendingPathComponent("runtime.json").path, 1)
        setenv("VOX_HOST", bindAddress, 1)
        setenv("VOX_PORT", String(port), 1)
    }

    private static func resolvePort() -> UInt16 {
        let env = ProcessInfo.processInfo.environment
        if let raw = env["HUDSON_VOICE_VOX_PORT"], let value = UInt16(raw) {
            return value
        }
        return 42138
    }

    private static func defaultRuntimeHomeURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Vox", isDirectory: true)
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
        case .unavailable: return "RUNTIME MISSING"
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
