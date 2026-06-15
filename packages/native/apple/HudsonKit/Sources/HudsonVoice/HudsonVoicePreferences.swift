import Foundation

public struct HudsonVoicePreferences: Codable, Equatable, Sendable {
    public static let defaultTranscriptionModelId = "parakeet:v3"

    public var schemaVersion: Int
    public var preferredInputDeviceId: String?
    public var preferredOutputDeviceId: String?
    public var preferredTranscriptionModelId: String?
    public var preferredSynthesisModelId: String?
    public var preferredLanguage: String?
    public var mode: HudVoiceMode

    public init(
        schemaVersion: Int = 1,
        preferredInputDeviceId: String? = nil,
        preferredOutputDeviceId: String? = nil,
        preferredTranscriptionModelId: String? = Self.defaultTranscriptionModelId,
        preferredSynthesisModelId: String? = nil,
        preferredLanguage: String? = "en",
        mode: HudVoiceMode = .pushToTalk
    ) {
        self.schemaVersion = schemaVersion
        self.preferredInputDeviceId = Self.clean(preferredInputDeviceId)
        self.preferredOutputDeviceId = Self.clean(preferredOutputDeviceId)
        self.preferredTranscriptionModelId = Self.clean(preferredTranscriptionModelId)
        self.preferredSynthesisModelId = Self.clean(preferredSynthesisModelId)
        self.preferredLanguage = Self.clean(preferredLanguage)
        self.mode = mode
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
                preferredInputDeviceId: preferredInputDeviceId
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
}
