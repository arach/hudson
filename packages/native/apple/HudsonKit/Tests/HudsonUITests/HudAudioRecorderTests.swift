import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudAudioRecorderFormatting")
struct HudAudioRecorderFormattingTests {

    @Test("duration formats minutes and seconds")
    func durationFormatsMinutesAndSeconds() {
        #expect(HudAudioRecorderFormatting.duration(0) == "0:00")
        #expect(HudAudioRecorderFormatting.duration(5.9) == "0:05")
        #expect(HudAudioRecorderFormatting.duration(65.1) == "1:05")
    }

    @Test("duration includes hours when needed")
    func durationFormatsHours() {
        #expect(HudAudioRecorderFormatting.duration(3_671) == "1:01:11")
    }

    @Test("meter normalization clamps decibels")
    func meterNormalizationClamps() {
        #expect(HudAudioRecorderFormatting.normalizedLevel(fromAveragePower: -100) == 0)
        #expect(HudAudioRecorderFormatting.normalizedLevel(fromAveragePower: -80) == 0)
        #expect(HudAudioRecorderFormatting.normalizedLevel(fromAveragePower: -40) == 0.5)
        #expect(HudAudioRecorderFormatting.normalizedLevel(fromAveragePower: 10) == 1)
    }
}

@Suite("HudAudioRecorderConfiguration")
struct HudAudioRecorderConfigurationTests {

    @Test("file prefixes are sanitized")
    func filePrefixesAreSanitized() {
        let configuration = HudAudioRecorderConfiguration(filePrefix: "Hudson Demo / Audio")

        #expect(configuration.sanitizedFilePrefix == "Hudson-Demo---Audio")
    }

    @Test("output URLs are deterministic with explicit inputs")
    func outputURLsAreDeterministic() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("HudAudioRecorderTests", isDirectory: true)
        try? FileManager.default.removeItem(at: directory)

        let id = try #require(UUID(uuidString: "11111111-2222-3333-4444-555555555555"))
        let configuration = HudAudioRecorderConfiguration(
            directory: directory,
            filePrefix: "hudson test"
        )

        let url = try configuration.makeOutputURL(
            now: Date(timeIntervalSince1970: 42),
            id: id
        )

        #expect(url.deletingLastPathComponent() == directory)
        #expect(url.lastPathComponent == "hudson-test-42-11111111-2222-3333-4444-555555555555.m4a")
        #expect(FileManager.default.fileExists(atPath: directory.path))
    }
}

@Suite("HudAudioRecorderState")
struct HudAudioRecorderStateTests {

    @Test("recording state exposes convenience fields")
    func recordingStateConvenience() {
        let state = HudAudioRecorderState(
            permissionStatus: .granted,
            phase: .recording,
            duration: 12.8,
            averagePower: -20
        )

        #expect(state.isRecording)
        #expect(state.formattedDuration == "0:12")
        #expect(state.normalizedLevel == 0.75)
    }
}
