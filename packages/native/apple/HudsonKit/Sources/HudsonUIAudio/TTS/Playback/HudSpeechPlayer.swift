#if canImport(AVFoundation)
import AVFoundation
import Observation

@MainActor
protocol HudSpeechPlaying: AnyObject {
    var isPlaying: Bool { get }
    var currentTime: TimeInterval { get }
    var duration: TimeInterval { get }

    func play(
        data: Data,
        format: HudTTSAudioFormat?,
        failure: ((Error) -> Void)?,
        completion: (() -> Void)?
    ) throws
    func pauseOrResume()
    func seek(to time: TimeInterval) -> Bool
    func stop()
}

@MainActor
@Observable
public final class HudSpeechPlayer: NSObject, HudSpeechPlaying {
    private var audioPlayer: AVAudioPlayer?
    private var completionHandler: (() -> Void)?
    private var failureHandler: ((Error) -> Void)?
    private var progressTimer: Timer?

    public private(set) var isPlaying = false
    public private(set) var currentTime: TimeInterval = 0
    public private(set) var duration: TimeInterval = 0

    override public init() {
        super.init()
    }

    public func play(
        data: Data,
        format: HudTTSAudioFormat? = nil,
        failure: ((Error) -> Void)? = nil,
        completion: (() -> Void)? = nil
    ) throws {
        stop()
        configureAudioSession()

        let player: AVAudioPlayer
        if let hint = Self.fileTypeHint(for: format) {
            player = try AVAudioPlayer(data: data, fileTypeHint: hint)
        } else {
            player = try AVAudioPlayer(data: data)
        }
        try start(player: player, completion: completion, failure: failure)
    }

    public func play(
        fileURL: URL,
        failure: ((Error) -> Void)? = nil,
        completion: (() -> Void)? = nil
    ) throws {
        stop()
        configureAudioSession()

        let player = try AVAudioPlayer(contentsOf: fileURL)
        try start(player: player, completion: completion, failure: failure)
    }

    private static func fileTypeHint(for format: HudTTSAudioFormat?) -> String? {
        switch format {
        case .mp3: AVFileType.mp3.rawValue
        case .wav: AVFileType.wav.rawValue
        case .caf: AVFileType.caf.rawValue
        case nil: nil
        }
    }

    private func start(
        player: AVAudioPlayer,
        completion: (() -> Void)?,
        failure: ((Error) -> Void)?
    ) throws {
        player.delegate = self
        player.prepareToPlay()
        guard player.play() else {
            player.stop()
            throw HudTTSError.playbackFailed(message: "Speech audio could not be played.")
        }

        adopt(player, completion: completion, failure: failure)
        startProgressTimer()
    }

    func adopt(
        _ player: AVAudioPlayer,
        completion: (() -> Void)?,
        failure: ((Error) -> Void)? = nil
    ) {
        audioPlayer = player
        completionHandler = completion
        failureHandler = failure
        currentTime = player.currentTime
        duration = player.duration
        isPlaying = true
    }

    public func pauseOrResume() {
        guard let audioPlayer else { return }

        if audioPlayer.isPlaying {
            audioPlayer.pause()
            isPlaying = false
            refreshTime()
            stopProgressTimer()
        } else {
            guard audioPlayer.play() else { return }
            isPlaying = true
            startProgressTimer()
        }
    }

    @discardableResult
    public func seek(to time: TimeInterval) -> Bool {
        guard let audioPlayer else { return false }
        let clampedTime = min(max(0, time), audioPlayer.duration)
        audioPlayer.currentTime = clampedTime
        refreshTime()
        return true
    }

    public func stop() {
        stopProgressTimer()
        audioPlayer?.stop()
        audioPlayer = nil
        completionHandler = nil
        failureHandler = nil
        isPlaying = false
        currentTime = 0
        duration = 0
    }

    private func startProgressTimer() {
        stopProgressTimer()
        let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.refreshTime()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        progressTimer = timer
    }

    private func stopProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }

    private func refreshTime() {
        guard let audioPlayer else {
            currentTime = 0
            duration = 0
            return
        }
        currentTime = audioPlayer.currentTime
        duration = audioPlayer.duration
    }
}

extension HudSpeechPlayer: AVAudioPlayerDelegate {
    nonisolated public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if flag {
                self.finishIfCurrent(player)
            } else {
                self.failIfCurrent(
                    player,
                    error: HudTTSError.playbackFailed(message: "Speech audio did not finish playing.")
                )
            }
        }
    }

    nonisolated public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in
            self.failIfCurrent(
                player,
                error: HudTTSError.playbackFailed(
                    message: error?.localizedDescription ?? "Speech audio could not be decoded."
                )
            )
        }
    }

    func finishIfCurrent(_ player: AVAudioPlayer) {
        guard audioPlayer === player else { return }
        stopProgressTimer()
        currentTime = player.duration
        duration = player.duration
        audioPlayer = nil
        isPlaying = false
        let completion = completionHandler
        completionHandler = nil
        failureHandler = nil
        completion?()
    }

    func failIfCurrent(_ player: AVAudioPlayer, error: Error) {
        guard audioPlayer === player else { return }
        stopProgressTimer()
        currentTime = player.currentTime
        duration = player.duration
        audioPlayer = nil
        isPlaying = false
        let failure = failureHandler
        completionHandler = nil
        failureHandler = nil
        failure?(error)
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
