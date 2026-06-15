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
        return preferences.normalized()
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
