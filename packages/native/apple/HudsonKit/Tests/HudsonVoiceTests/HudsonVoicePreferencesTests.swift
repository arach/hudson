import Foundation
import Testing
@testable import HudsonVoice

@Suite("HudsonVoicePreferences")
struct HudsonVoicePreferencesTests {
    @Test("saves Hudson preferences and embedded Vox mirror")
    func savesPreferencesAndMirror() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("hudson-voice-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let preferencesURL = directory
            .appendingPathComponent("Voice", isDirectory: true)
            .appendingPathComponent("preferences.json")
        let mirrorURL = directory
            .appendingPathComponent("Vox", isDirectory: true)
            .appendingPathComponent("preferences.json")

        let preferences = HudsonVoicePreferences(
            preferredInputDeviceId: "mic-1",
            preferredTranscriptionModelId: "parakeet:v3",
            preferredLanguage: "en",
            mode: .alwaysOn
        )

        try preferences.save(to: preferencesURL, mirrorToEmbeddedVox: mirrorURL)

        let loaded = try HudsonVoicePreferences.load(from: preferencesURL)
        #expect(loaded.preferredInputDeviceId == "mic-1")
        #expect(loaded.preferredTranscriptionModelId == "parakeet:v3")
        #expect(loaded.mode == .alwaysOn)

        let mirrorData = try Data(contentsOf: mirrorURL)
        let mirror = try JSONSerialization.jsonObject(with: mirrorData) as? [String: Any]
        let speech = mirror?["speech"] as? [String: Any]
        #expect(speech?["preferredInputDeviceId"] as? String == "mic-1")
        #expect(speech?["preferredTranscriptionModelId"] as? String == "parakeet:v3")
    }

    @Test("missing preference file returns defaults")
    func missingFileReturnsDefaults() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("hudson-voice-\(UUID().uuidString)")
            .appendingPathComponent("preferences.json")

        let preferences = try HudsonVoicePreferences.load(from: url)

        #expect(preferences.preferredTranscriptionModelId == HudsonVoicePreferences.defaultTranscriptionModelId)
        #expect(preferences.preferredLanguage == "en")
        #expect(preferences.mode == .pushToTalk)
    }
}
