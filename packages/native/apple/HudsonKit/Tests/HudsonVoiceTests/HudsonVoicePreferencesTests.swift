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
            modelDownloadPolicy: .never,
            mode: .alwaysOn
        )

        try preferences.save(to: preferencesURL, mirrorToEmbeddedVox: mirrorURL)

        let loaded = try HudsonVoicePreferences.load(from: preferencesURL)
        #expect(loaded.preferredInputDeviceId == "mic-1")
        #expect(loaded.preferredTranscriptionModelId == "parakeet:v3")
        #expect(loaded.modelDownloadPolicy == .never)
        #expect(loaded.mode == .alwaysOn)

        let mirrorData = try Data(contentsOf: mirrorURL)
        let mirror = try JSONSerialization.jsonObject(with: mirrorData) as? [String: Any]
        let speech = mirror?["speech"] as? [String: Any]
        #expect(speech?["preferredInputDeviceId"] as? String == "mic-1")
        #expect(speech?["preferredTranscriptionModelId"] as? String == "parakeet:v3")
        #expect(speech?["modelDownloadPolicy"] as? String == "never")
    }

    @Test("missing preference file returns defaults")
    func missingFileReturnsDefaults() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("hudson-voice-\(UUID().uuidString)")
            .appendingPathComponent("preferences.json")

        let preferences = try HudsonVoicePreferences.load(from: url)

        #expect(preferences.preferredTranscriptionModelId == HudsonVoicePreferences.defaultTranscriptionModelId)
        #expect(preferences.preferredLanguage == "en")
        #expect(preferences.modelDownloadPolicy == .onFirstUse)
        #expect(preferences.mode == .pushToTalk)
    }

    @Test("legacy preferences default model downloads to first use")
    func legacyPreferencesDefaultDownloadPolicy() throws {
        let data = Data(#"{"schemaVersion":1,"mode":"push_to_talk"}"#.utf8)

        let preferences = try JSONDecoder().decode(HudsonVoicePreferences.self, from: data)

        #expect(preferences.preferredTranscriptionModelId == HudsonVoicePreferences.defaultTranscriptionModelId)
        #expect(preferences.modelDownloadPolicy == .onFirstUse)
    }

    @Test("automatic preparation follows the runtime download policy")
    func automaticPreparationPolicy() {
        #expect(!HudVoiceModelDownloadPolicy.never.allowsAutomaticPreparation(for: .activation))
        #expect(!HudVoiceModelDownloadPolicy.never.allowsAutomaticPreparation(for: .firstUse))
        #expect(!HudVoiceModelDownloadPolicy.onFirstUse.allowsAutomaticPreparation(for: .activation))
        #expect(HudVoiceModelDownloadPolicy.onFirstUse.allowsAutomaticPreparation(for: .firstUse))
        #expect(HudVoiceModelDownloadPolicy.eager.allowsAutomaticPreparation(for: .activation))
        #expect(HudVoiceModelDownloadPolicy.eager.allowsAutomaticPreparation(for: .firstUse))
    }
}
