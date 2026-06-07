#if canImport(AVFoundation)
import AVFoundation
import Observation

@MainActor
@Observable
public final class HudSpeechPlayer: NSObject {
    private var audioPlayer: AVAudioPlayer?
    private var completionHandler: (() -> Void)?

    public private(set) var isPlaying = false

    override public init() {
        super.init()
    }

    public func play(data: Data, completion: (() -> Void)? = nil) throws {
        stop()
        configureAudioSession()

        let player = try AVAudioPlayer(data: data)
        player.delegate = self
        player.prepareToPlay()
        guard player.play() else {
            throw HudTTSError.playbackFailed(message: "Speech audio could not be played.")
        }

        audioPlayer = player
        completionHandler = completion
        isPlaying = true
    }

    public func pauseOrResume() {
        guard let audioPlayer else { return }

        if audioPlayer.isPlaying {
            audioPlayer.pause()
            isPlaying = false
        } else {
            guard audioPlayer.play() else { return }
            isPlaying = true
        }
    }

    public func stop() {
        audioPlayer?.stop()
        audioPlayer = nil
        completionHandler = nil
        isPlaying = false
    }
}

extension HudSpeechPlayer: AVAudioPlayerDelegate {
    nonisolated public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if self.audioPlayer === player {
                self.audioPlayer = nil
            }
            self.isPlaying = false
            self.completionHandler?()
            self.completionHandler = nil
        }
    }
}

@MainActor
private func configureAudioSession() {
    #if os(iOS)
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
    try? session.setActive(true, options: [])
    #endif
}
#endif
