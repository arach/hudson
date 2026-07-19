import AVFoundation
import Foundation

public struct HudsonVoiceAudioDevice: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let isDefault: Bool
    public let isSelected: Bool

    public init(id: String, name: String, isDefault: Bool = false, isSelected: Bool = false) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
        self.isSelected = isSelected
    }
}

public struct HudsonVoiceAudioDeviceList: Codable, Equatable, Sendable {
    public let devices: [HudsonVoiceAudioDevice]
    public let selectedDeviceId: String?
    public let defaultDeviceId: String?
}

public enum HudsonVoiceAudioDevices {
    public static func listInputDevices(
        selectedDeviceId: String? = nil
    ) -> HudsonVoiceAudioDeviceList {
        let defaultDeviceId = AVCaptureDevice.default(for: .audio)?.uniqueID
        let selected = clean(selectedDeviceId)
        let devices = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.microphone],
            mediaType: .audio,
            position: .unspecified
        ).devices.map { device in
            HudsonVoiceAudioDevice(
                id: device.uniqueID,
                name: device.localizedName,
                isDefault: device.uniqueID == defaultDeviceId,
                isSelected: selected.map { $0 == device.uniqueID } ?? false
            )
        }

        return HudsonVoiceAudioDeviceList(
            devices: devices,
            selectedDeviceId: selected,
            defaultDeviceId: defaultDeviceId
        )
    }

    public static func setPreferredInputDevice(
        _ deviceId: String?,
        preferencesURL: URL = HudsonVoicePreferences.defaultPreferencesURL
    ) throws -> HudsonVoicePreferences {
        let cleaned = clean(deviceId)
        let list = listInputDevices(selectedDeviceId: cleaned)
        if let cleaned, !list.devices.contains(where: { $0.id == cleaned }) {
            throw HudsonVoiceAudioDeviceError.inputDeviceNotFound(cleaned)
        }

        var preferences = try HudsonVoicePreferences.load(from: preferencesURL)
        preferences.preferredInputDeviceId = cleaned
        try preferences.save(to: preferencesURL)
        try writeInputDeviceCache(list)
        return preferences.normalized()
    }

    public static func writeInputDeviceCache(
        _ list: HudsonVoiceAudioDeviceList,
        to url: URL = defaultInputDevicesCacheURL
    ) throws {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: url.deletingLastPathComponent().path)

        let cache = InputDeviceCacheDocument(
            devices: list.devices,
            defaultDeviceId: list.defaultDeviceId,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(cache)
        try data.write(to: url, options: .atomic)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }

    public static var defaultInputDevicesCacheURL: URL {
        HudsonVoicePreferences.defaultPreferencesDirectoryURL
            .appendingPathComponent("input-devices.json")
    }

    public static func refreshInputDeviceCache(selectedDeviceId: String? = nil) throws {
        let list = listInputDevices(selectedDeviceId: selectedDeviceId)
        try writeInputDeviceCache(list)
    }

    private static func clean(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}

public enum HudsonVoiceAudioDeviceError: Error, LocalizedError, Equatable {
    case inputDeviceNotFound(String)

    public var errorDescription: String? {
        switch self {
        case .inputDeviceNotFound(let id):
            return "Hudson Voice input device was not found: \(id)"
        }
    }
}

private struct InputDeviceCacheDocument: Encodable {
    let schemaVersion = 1
    let devices: [HudsonVoiceAudioDevice]
    let defaultDeviceId: String?
    let updatedAt: String
}
