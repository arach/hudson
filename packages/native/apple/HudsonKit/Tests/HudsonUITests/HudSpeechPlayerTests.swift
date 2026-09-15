import AVFoundation
import Foundation
import Testing
@testable import HudsonUIAudio

@Suite("HudSpeechPlayer identity")
@MainActor
struct HudSpeechPlayerTests {
    @Test("stale finish does not complete a newer player")
    func staleFinishDoesNotCompleteNewerPlayer() throws {
        let hud = HudSpeechPlayer()
        let wav = silentWAV()
        let first = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        let second = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        var completions = 0

        hud.adopt(first, completion: { completions += 1 })
        hud.adopt(second, completion: { completions += 1 })
        #expect(hud.isPlaying)

        hud.finishIfCurrent(first)
        #expect(hud.isPlaying)
        #expect(completions == 0)

        hud.finishIfCurrent(second)
        #expect(!hud.isPlaying)
        #expect(completions == 1)
    }

    @Test("unsuccessful finish calls failure and not completion")
    func unsuccessfulFinishCallsFailure() throws {
        let hud = HudSpeechPlayer()
        let wav = silentWAV()
        let player = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        var completions = 0
        var failures = 0
        var failureMessage: String?

        hud.adopt(
            player,
            completion: { completions += 1 },
            failure: { error in
                failures += 1
                failureMessage = error.localizedDescription
            }
        )
        hud.failIfCurrent(
            player,
            error: HudTTSError.playbackFailed(message: "Speech audio did not finish playing.")
        )

        #expect(!hud.isPlaying)
        #expect(completions == 0)
        #expect(failures == 1)
        #expect(failureMessage == "Speech audio did not finish playing.")
    }

    @Test("decode error calls failure and not completion")
    func decodeErrorCallsFailure() throws {
        let hud = HudSpeechPlayer()
        let wav = silentWAV()
        let player = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        var completions = 0
        var failures = 0

        hud.adopt(player, completion: { completions += 1 }, failure: { _ in failures += 1 })
        hud.failIfCurrent(
            player,
            error: HudTTSError.playbackFailed(message: "Speech audio could not be decoded.")
        )

        #expect(!hud.isPlaying)
        #expect(completions == 0)
        #expect(failures == 1)
    }

    @Test("stale unsuccessful finish does not fail a newer player")
    func staleFailureDoesNotFailNewerPlayer() throws {
        let hud = HudSpeechPlayer()
        let wav = silentWAV()
        let first = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        let second = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        var completions = 0
        var failures = 0

        hud.adopt(first, completion: { completions += 1 }, failure: { _ in failures += 1 })
        hud.adopt(second, completion: { completions += 1 }, failure: { _ in failures += 1 })

        hud.failIfCurrent(first, error: HudTTSError.playbackFailed(message: "stale"))
        #expect(hud.isPlaying)
        #expect(completions == 0)
        #expect(failures == 0)

        hud.finishIfCurrent(second)
        #expect(!hud.isPlaying)
        #expect(completions == 1)
        #expect(failures == 0)
    }

    @Test("existing completion-only callers still succeed")
    func completionOnlyCallersStillSucceed() throws {
        let hud = HudSpeechPlayer()
        let wav = silentWAV()
        let player = try AVAudioPlayer(data: wav, fileTypeHint: AVFileType.wav.rawValue)
        var completions = 0

        hud.adopt(player, completion: { completions += 1 })
        hud.finishIfCurrent(player)
        #expect(completions == 1)
        #expect(!hud.isPlaying)
    }
}

private func silentWAV(sampleCount: Int = 32) -> Data {
    let dataSize = UInt32(sampleCount * 2)
    var wav = Data()
    func append16(_ value: UInt16) {
        wav.append(UInt8(value & 0xff))
        wav.append(UInt8((value >> 8) & 0xff))
    }
    func append32(_ value: UInt32) {
        wav.append(UInt8(value & 0xff))
        wav.append(UInt8((value >> 8) & 0xff))
        wav.append(UInt8((value >> 16) & 0xff))
        wav.append(UInt8((value >> 24) & 0xff))
    }
    wav.append(contentsOf: Array("RIFF".utf8))
    append32(36 + dataSize)
    wav.append(contentsOf: Array("WAVEfmt ".utf8))
    append32(16)
    append16(1)
    append16(1)
    append32(8_000)
    append32(16_000)
    append16(2)
    append16(16)
    wav.append(contentsOf: Array("data".utf8))
    append32(dataSize)
    wav.append(Data(count: Int(dataSize)))
    return wav
}
