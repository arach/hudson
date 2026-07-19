import Foundation

/// Controls when Hudson may acquire the on-device transcription model.
///
/// This is a runtime policy. `HudsonVoice` itself is always compiled into the
/// Apple package, and no model data is embedded in the library product.
public enum HudVoiceModelDownloadPolicy: String, Codable, CaseIterable, Sendable {
    /// Never start an automatic model download. Already-installed models may
    /// still be used, and an explicit user-initiated `prepare()` remains valid.
    case never
    /// Begin downloading and warming when dictation is used for the first time.
    case onFirstUse = "on_first_use"
    /// Begin downloading and warming when the host activates its voice surface.
    case eager

    public var title: String {
        switch self {
        case .never: return "Never"
        case .onFirstUse: return "On First Use"
        case .eager: return "At Launch"
        }
    }
}

public struct HudsonVoicePreferences: Codable, Equatable, Sendable {
    public static let defaultTranscriptionModelId = "parakeet:v3"

    public var schemaVersion: Int
    public var preferredInputDeviceId: String?
    public var preferredOutputDeviceId: String?
    public var preferredTranscriptionModelId: String?
    public var preferredSynthesisModelId: String?
    public var preferredLanguage: String?
    public var modelDownloadPolicy: HudVoiceModelDownloadPolicy
    public var mode: HudVoiceMode

    public init(
        schemaVersion: Int = 1,
        preferredInputDeviceId: String? = nil,
        preferredOutputDeviceId: String? = nil,
        preferredTranscriptionModelId: String? = Self.defaultTranscriptionModelId,
        preferredSynthesisModelId: String? = nil,
        preferredLanguage: String? = "en",
        modelDownloadPolicy: HudVoiceModelDownloadPolicy = .onFirstUse,
        mode: HudVoiceMode = .pushToTalk
    ) {
        self.schemaVersion = schemaVersion
        self.preferredInputDeviceId = Self.clean(preferredInputDeviceId)
        self.preferredOutputDeviceId = Self.clean(preferredOutputDeviceId)
        self.preferredTranscriptionModelId = Self.clean(preferredTranscriptionModelId)
        self.preferredSynthesisModelId = Self.clean(preferredSynthesisModelId)
        self.preferredLanguage = Self.clean(preferredLanguage)
        self.modelDownloadPolicy = modelDownloadPolicy
        self.mode = mode
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            schemaVersion: try values.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1,
            preferredInputDeviceId: try values.decodeIfPresent(String.self, forKey: .preferredInputDeviceId),
            preferredOutputDeviceId: try values.decodeIfPresent(String.self, forKey: .preferredOutputDeviceId),
            preferredTranscriptionModelId: try values.decodeIfPresent(
                String.self,
                forKey: .preferredTranscriptionModelId
            ) ?? Self.defaultTranscriptionModelId,
            preferredSynthesisModelId: try values.decodeIfPresent(String.self, forKey: .preferredSynthesisModelId),
            preferredLanguage: try values.decodeIfPresent(String.self, forKey: .preferredLanguage) ?? "en",
            modelDownloadPolicy: try values.decodeIfPresent(
                HudVoiceModelDownloadPolicy.self,
                forKey: .modelDownloadPolicy
            ) ?? .onFirstUse,
            mode: try values.decodeIfPresent(HudVoiceMode.self, forKey: .mode) ?? .pushToTalk
        )
    }

    public static var defaultPreferencesURL: URL {
        defaultPreferencesDirectoryURL.appendingPathComponent("preferences.json")
    }

    public static var defaultPreferencesDirectoryURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Voice", isDirectory: true)
    }

    public static var embeddedVoxPreferencesURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base
            .appendingPathComponent("Hudson", isDirectory: true)
            .appendingPathComponent("Vox", isDirectory: true)
            .appendingPathComponent("preferences.json")
    }

    public static func load(from url: URL = defaultPreferencesURL) throws -> HudsonVoicePreferences {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return HudsonVoicePreferences()
        }

        let data = try Data(contentsOf: url)
        let decoded = try JSONDecoder().decode(HudsonVoicePreferences.self, from: data)
        return decoded.normalized()
    }

    public func save(
        to url: URL = defaultPreferencesURL,
        mirrorToEmbeddedVox mirrorURL: URL? = embeddedVoxPreferencesURL
    ) throws {
        let preferences = normalized()
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: url.deletingLastPathComponent().path)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(preferences)
        try data.write(to: url, options: .atomic)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)

        if let mirrorURL {
            try preferences.saveEmbeddedVoxMirror(to: mirrorURL)
        }
    }

    public func normalized() -> HudsonVoicePreferences {
        HudsonVoicePreferences(
            schemaVersion: schemaVersion > 0 ? schemaVersion : 1,
            preferredInputDeviceId: preferredInputDeviceId,
            preferredOutputDeviceId: preferredOutputDeviceId,
            preferredTranscriptionModelId: preferredTranscriptionModelId ?? Self.defaultTranscriptionModelId,
            preferredSynthesisModelId: preferredSynthesisModelId,
            preferredLanguage: preferredLanguage ?? "en",
            modelDownloadPolicy: modelDownloadPolicy,
            mode: mode
        )
    }

    private func saveEmbeddedVoxMirror(to url: URL) throws {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: url.deletingLastPathComponent().path)

        let mirror = EmbeddedVoxPreferences(
            speech: EmbeddedVoxSpeechPreferences(
                preferredTranscriptionModelId: preferredTranscriptionModelId,
                preferredSynthesisModelId: preferredSynthesisModelId,
                preferredInputDeviceId: preferredInputDeviceId,
                modelDownloadPolicy: modelDownloadPolicy
            )
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(mirror)
        try data.write(to: url, options: .atomic)
        try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
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
    var modelDownloadPolicy: HudVoiceModelDownloadPolicy
}
