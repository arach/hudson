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
    @Published public private(set) var runtimeDetail = "Hudson Voice embedded runtime has not started."
    @Published public private(set) var startedAt: Date?
    @Published public private(set) var preferences: HudsonVoiceHostPreferences
    @Published public private(set) var inputDevices: [HudsonVoiceHostAudioDevice] = []
    @Published public private(set) var modelReadiness: HudsonVoiceModelReadiness = .placeholder(
        modelId: HudsonVoiceHostPreferences.defaultTranscriptionModelId,
        detail: "Model readiness is reported by the embedded runtime after it starts."
    )

    private let bindAddress = "127.0.0.1"
    private let port: UInt16
    private let runtimeHomeURL: URL
    private let runtimeCapabilityURL: URL
    private let voxRuntimeURL: URL
    private let preferencesURL: URL
    private let embeddedVoxPreferencesURL: URL
    private var runtimeService: VoxRuntimeService?

    public init() {
        port = Self.resolvePort()
        runtimeHomeURL = Self.defaultRuntimeHomeURL()
        runtimeCapabilityURL = runtimeHomeURL.appendingPathComponent("hudson-voice-runtime.json")
        voxRuntimeURL = runtimeHomeURL.appendingPathComponent("vox-runtime.json")
        preferencesURL = Self.defaultPreferencesURL()
        embeddedVoxPreferencesURL = runtimeHomeURL.appendingPathComponent("preferences.json")
        preferences = (try? HudsonVoiceHostPreferences.load(from: preferencesURL)) ?? HudsonVoiceHostPreferences()
        refreshMicrophonePermission()
        refreshInputDevices()
        refreshModelReadinessPlaceholder()
    }

    deinit {
        runtimeService?.stop()
    }

    public var summary: String {
        switch lifecycle {
        case .running:
            return "Hudson Menu is holding the long-running voice host. \(runtimeDetail)"
        case .starting:
            return "Hudson Menu is preparing the Hudson Voice embedded runtime."
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
        refreshInputDevices()
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
            try persistPreferences()
            try configureVoxRuntimeEnvironment(authToken: token)
            let service = VoxRuntimeService(port: port, bindAddress: bindAddress, authToken: token)
            try service.start()
            try writeRuntimeCapability(authToken: token, startedAt: startedAt)
            runtimeService = service
            lifecycle = .running
            runtimeDetail = "Authenticated Hudson voice runtime is available through /api/hudson-voice."
            self.startedAt = startedAt
            refreshModelReadinessPlaceholder()
        } catch {
            runtimeService?.stop()
            runtimeService = nil
            removeRuntimeCapability()
            lifecycle = .error
            runtimeDetail = "Hudson Voice embedded runtime failed to start: \(error.localizedDescription)"
            startedAt = nil
        }
    }

    public func stop() {
        runtimeService?.stop()
        runtimeService = nil
        removeRuntimeCapability()
        lifecycle = .stopped
        runtimeDetail = "Hudson Voice embedded runtime is stopped."
        startedAt = nil
        refreshModelReadinessPlaceholder()
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

    public func refreshInputDevices() {
        let defaultDeviceId = AVCaptureDevice.default(for: .audio)?.uniqueID
        inputDevices = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.microphone],
            mediaType: .audio,
            position: .unspecified
        ).devices.map { device in
            HudsonVoiceHostAudioDevice(
                id: device.uniqueID,
                name: device.localizedName,
                isDefault: device.uniqueID == defaultDeviceId,
                isSelected: preferences.preferredInputDeviceId == device.uniqueID
            )
        }
        try? writeInputDeviceCache(defaultDeviceId: defaultDeviceId)
    }

    public func setPreferredInputDevice(_ deviceId: String?) {
        let cleaned = Self.clean(deviceId)
        if let cleaned, !inputDevices.contains(where: { $0.id == cleaned }) {
            runtimeDetail = "Hudson Voice input device is no longer available."
            return
        }

        preferences.preferredInputDeviceId = cleaned
        do {
            try persistPreferences()
            refreshInputDevices()
            runtimeDetail = lifecycle == .running
                ? "Authenticated Hudson voice runtime is available through /api/hudson-voice."
                : "Hudson Voice input preference was saved."
        } catch {
            runtimeDetail = "Hudson Voice could not save input preference: \(error.localizedDescription)"
        }
    }

    public func setPreferredTranscriptionModel(_ modelId: String?) {
        preferences.preferredTranscriptionModelId = Self.clean(modelId) ?? HudsonVoiceHostPreferences.defaultTranscriptionModelId
        do {
            try persistPreferences()
            refreshModelReadinessPlaceholder()
        } catch {
            runtimeDetail = "Hudson Voice could not save model preference: \(error.localizedDescription)"
        }
    }

    public var diagnostics: HudsonVoiceDaemonDiagnostics {
        HudsonVoiceDaemonDiagnostics(
            permission: microphonePermission,
            runtimeCapabilityPath: runtimeCapabilityURL.path,
            runtimeAlive: runtimeService != nil && lifecycle == .running,
            selectedInputDevice: inputDevices.first(where: { $0.id == preferences.preferredInputDeviceId }),
            defaultInputDevice: inputDevices.first(where: { $0.isDefault }),
            selectedModelId: preferences.preferredTranscriptionModelId,
            modelReadiness: modelReadiness,
            lifecycle: lifecycle
        )
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

    private func persistPreferences() throws {
        let normalized = preferences.normalized()
        preferences = normalized
        try normalized.save(to: preferencesURL, mirrorToEmbeddedVox: embeddedVoxPreferencesURL)
    }

    private func refreshModelReadinessPlaceholder() {
        modelReadiness = .placeholder(
            modelId: preferences.preferredTranscriptionModelId ?? HudsonVoiceHostPreferences.defaultTranscriptionModelId,
            detail: lifecycle == .running
                ? "Use /api/hudson-voice/health for runtime warmup status."
                : "Model warmup status is available after the embedded runtime starts."
        )
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

    private static func defaultPreferencesURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Voice", isDirectory: true)
            .appendingPathComponent("preferences.json")
    }

    private func writeInputDeviceCache(defaultDeviceId: String?) throws {
        let cacheURL = Self.defaultPreferencesURL()
            .deletingLastPathComponent()
            .appendingPathComponent("input-devices.json")
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: cacheURL.deletingLastPathComponent().path)

        let cache = HudsonVoiceHostInputDeviceCache(
            devices: inputDevices,
            defaultDeviceId: defaultDeviceId,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(cache)
        try data.write(to: cacheURL, options: .atomic)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: cacheURL.path)
    }

    private static func clean(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}

public struct HudsonVoiceHostPreferences: Codable, Equatable, Sendable {
    public static let defaultTranscriptionModelId = "parakeet:v3"

    public var schemaVersion: Int
    public var preferredInputDeviceId: String?
    public var preferredOutputDeviceId: String?
    public var preferredTranscriptionModelId: String?
    public var preferredSynthesisModelId: String?
    public var preferredLanguage: String?
    public var mode: String

    public init(
        schemaVersion: Int = 1,
        preferredInputDeviceId: String? = nil,
        preferredOutputDeviceId: String? = nil,
        preferredTranscriptionModelId: String? = defaultTranscriptionModelId,
        preferredSynthesisModelId: String? = nil,
        preferredLanguage: String? = "en",
        mode: String = "push_to_talk"
    ) {
        self.schemaVersion = schemaVersion
        self.preferredInputDeviceId = Self.clean(preferredInputDeviceId)
        self.preferredOutputDeviceId = Self.clean(preferredOutputDeviceId)
        self.preferredTranscriptionModelId = Self.clean(preferredTranscriptionModelId)
        self.preferredSynthesisModelId = Self.clean(preferredSynthesisModelId)
        self.preferredLanguage = Self.clean(preferredLanguage)
        self.mode = Self.clean(mode) ?? "push_to_talk"
    }

    public static func load(from url: URL) throws -> HudsonVoiceHostPreferences {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return HudsonVoiceHostPreferences()
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(HudsonVoiceHostPreferences.self, from: data).normalized()
    }

    public func save(to url: URL, mirrorToEmbeddedVox mirrorURL: URL) throws {
        let normalized = normalized()
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: url.deletingLastPathComponent().path)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(normalized).write(to: url, options: .atomic)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)

        try fileManager.createDirectory(at: mirrorURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: mirrorURL.deletingLastPathComponent().path)
        try encoder.encode(EmbeddedVoxPreferences(speech: .init(
            preferredTranscriptionModelId: normalized.preferredTranscriptionModelId,
            preferredSynthesisModelId: normalized.preferredSynthesisModelId,
            preferredInputDeviceId: normalized.preferredInputDeviceId
        ))).write(to: mirrorURL, options: .atomic)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: mirrorURL.path)
    }

    public func normalized() -> HudsonVoiceHostPreferences {
        HudsonVoiceHostPreferences(
            schemaVersion: schemaVersion > 0 ? schemaVersion : 1,
            preferredInputDeviceId: preferredInputDeviceId,
            preferredOutputDeviceId: preferredOutputDeviceId,
            preferredTranscriptionModelId: preferredTranscriptionModelId ?? Self.defaultTranscriptionModelId,
            preferredSynthesisModelId: preferredSynthesisModelId,
            preferredLanguage: preferredLanguage ?? "en",
            mode: mode
        )
    }

    private static func clean(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}

private struct EmbeddedVoxPreferences: Codable {
    var speech: EmbeddedVoxSpeechPreferences
}

private struct EmbeddedVoxSpeechPreferences: Codable {
    var preferredTranscriptionModelId: String?
    var preferredSynthesisModelId: String?
    var preferredInputDeviceId: String?
}

public struct HudsonVoiceHostAudioDevice: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let isDefault: Bool
    public let isSelected: Bool
}

private struct HudsonVoiceHostInputDeviceCache: Encodable {
    let schemaVersion = 1
    let devices: [HudsonVoiceHostAudioDevice]
    let defaultDeviceId: String?
    let updatedAt: String
}

public enum HudsonVoiceModelReadiness: Equatable, Sendable {
    case ready(modelId: String, detail: String)
    case warming(modelId: String, detail: String)
    case unavailable(modelId: String, detail: String)
    case placeholder(modelId: String, detail: String)

    public var modelId: String {
        switch self {
        case .ready(let modelId, _), .warming(let modelId, _), .unavailable(let modelId, _), .placeholder(let modelId, _):
            return modelId
        }
    }

    public var label: String {
        switch self {
        case .ready: return "READY"
        case .warming: return "WARMING"
        case .unavailable: return "UNAVAILABLE"
        case .placeholder: return "DEFERRED"
        }
    }

    public var detail: String {
        switch self {
        case .ready(_, let detail), .warming(_, let detail), .unavailable(_, let detail), .placeholder(_, let detail):
            return detail
        }
    }
}

public struct HudsonVoiceDaemonDiagnostics: Equatable, Sendable {
    public let permission: HudsonMicrophonePermission
    public let runtimeCapabilityPath: String
    public let runtimeAlive: Bool
    public let selectedInputDevice: HudsonVoiceHostAudioDevice?
    public let defaultInputDevice: HudsonVoiceHostAudioDevice?
    public let selectedModelId: String?
    public let modelReadiness: HudsonVoiceModelReadiness
    public let lifecycle: HudsonVoiceDaemonLifecycle
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

public enum HudsonVoiceDaemonLifecycle: Equatable, Sendable {
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

public enum HudsonMicrophonePermission: Equatable, Sendable {
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
