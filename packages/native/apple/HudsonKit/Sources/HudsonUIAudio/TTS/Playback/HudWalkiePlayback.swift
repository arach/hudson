#if canImport(AVFoundation)
@preconcurrency import AVFoundation
import Observation

/// Walkie-talkie bookend around already-synthesized speech audio: opening
/// kerchunk, speech through a fixed radio EQ (high-pass 420 Hz, low-pass
/// 2.7 kHz, presence peak at 1.6 kHz), then a squelch tail and a closing
/// kerchunk once the speech ends.
///
/// `HudTTS` still owns synthesis — feed `HudTTSResult.audioData` to
/// `play(data:)`. No audio assets are shipped; the kerchunk and squelch
/// buffers are generated at runtime and cached for reuse.
///
/// `isActive` stays true from the moment speech is scheduled until the
/// closing kerchunk has finished, so callers can hold a "speaking" phase on
/// it. `stop()` silences the voice player *and* the FX player: the closing
/// sequence is scheduled ahead of time, and without stopping both it would
/// fire into the middle of the next utterance.
@MainActor
@Observable
public final class HudWalkiePlayback {
    public private(set) var isActive = false

    private let engine = AVAudioEngine()
    private let fxPlayer = AVAudioPlayerNode()
    private let voicePlayer = AVAudioPlayerNode()
    private let voiceEQ = AVAudioUnitEQ(numberOfBands: 3)
    private let format: AVAudioFormat

    private var kerchunkBuffer: AVAudioPCMBuffer?
    private var tailBuffer: AVAudioPCMBuffer?
    private var generation = 0
    private var finishTask: Task<Void, Never>?

    public init() {
        // Mono float32 at 44.1kHz for both chains. Connecting through the
        // main mixer lets CoreAudio convert to the hardware format as needed.
        self.format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)
            ?? AVAudioFormat()

        let highPass = voiceEQ.bands[0]
        highPass.filterType = .highPass
        highPass.frequency = 420
        highPass.bandwidth = 1.6
        highPass.bypass = false

        let lowPass = voiceEQ.bands[1]
        lowPass.filterType = .lowPass
        lowPass.frequency = 2_700
        lowPass.bandwidth = 1.6
        lowPass.bypass = false

        let presence = voiceEQ.bands[2]
        presence.filterType = .parametric
        presence.frequency = 1_600
        presence.bandwidth = 1.0
        presence.gain = 4.5
        presence.bypass = false

        engine.attach(fxPlayer)
        engine.attach(voicePlayer)
        engine.attach(voiceEQ)
        engine.connect(fxPlayer, to: engine.mainMixerNode, format: format)
        engine.connect(voicePlayer, to: voiceEQ, format: format)
        engine.connect(voiceEQ, to: engine.mainMixerNode, format: format)
    }

    /// Plays `data` (any AVAudioFile-decodable container) with the full
    /// bookend. Returns once the speech audio is actually scheduled and
    /// playing; the closing squelch and kerchunk follow the speech on their
    /// own. Throws when the engine or decode fails so the caller can fall
    /// back to dry speech instead of silence.
    public func play(data: Data) async throws {
        stop()
        generation += 1
        let run = generation
        try ensureRunning()

        // Opening kerchunk, then a short gap before the voice keys in.
        if let click = kerchunk() {
            fxPlayer.scheduleBuffer(click, at: nil, options: [], completionHandler: nil)
            if !fxPlayer.isPlaying { fxPlayer.play() }
        }
        try? await Task.sleep(for: .milliseconds(60))
        guard run == generation else { return }

        let buffer = try decodeVoiceBuffer(data)
        isActive = true
        voicePlayer.scheduleBuffer(
            buffer,
            at: nil,
            options: [],
            completionCallbackType: .dataPlayedBack
        ) { [weak self] _ in
            Task { @MainActor in self?.voiceDidFinish(run) }
        }
        voicePlayer.play()
    }

    /// Immediately silences the voice and every scheduled bookend buffer.
    public func stop() {
        generation += 1
        finishTask?.cancel()
        finishTask = nil
        voicePlayer.stop()
        fxPlayer.stop()
        isActive = false
    }

    // MARK: - Closing sequence

    private func voiceDidFinish(_ run: Int) {
        guard run == generation, isActive else { return }
        var closeDuration: TimeInterval = 0
        if let tail = tail(), let click = kerchunk() {
            let tailDuration = Double(tail.frameLength) / format.sampleRate
            let clickDuration = Double(click.frameLength) / format.sampleRate
            closeDuration = tailDuration + clickDuration
            fxPlayer.scheduleBuffer(tail, at: nil, options: [], completionHandler: nil)
            fxPlayer.scheduleBuffer(click, at: nil, options: [], completionHandler: nil)
            if !fxPlayer.isPlaying { fxPlayer.play() }
        }
        finishTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(closeDuration + 0.02))
            guard let self, !Task.isCancelled, run == self.generation else { return }
            self.isActive = false
            self.finishTask = nil
        }
    }

    // MARK: - Decode

    /// Converts decodable audio data into the exact format of the voice
    /// graph. `AVAudioPlayerNode.scheduleBuffer` raises an Objective-C
    /// exception (not a catchable Swift error) when formats differ, so the
    /// invariant must be established before scheduling.
    private func decodeVoiceBuffer(_ data: Data) throws -> AVAudioPCMBuffer {
        let stagingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-walkie-voice-\(UUID().uuidString).audio")
        try data.write(to: stagingURL, options: .atomic)
        defer { try? FileManager.default.removeItem(at: stagingURL) }

        let file = try AVAudioFile(forReading: stagingURL)
        let frameCount = AVAudioFrameCount(file.length)
        guard frameCount > 0,
              let decoded = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frameCount)
        else {
            throw HudTTSError.playbackFailed(message: "Speech audio contained no frames.")
        }
        try file.read(into: decoded)

        let decodedFormat = decoded.format
        if decodedFormat.sampleRate == format.sampleRate,
           decodedFormat.channelCount == format.channelCount,
           decodedFormat.commonFormat == format.commonFormat,
           decodedFormat.isInterleaved == format.isInterleaved {
            return decoded
        }

        guard let converter = AVAudioConverter(from: decodedFormat, to: format) else {
            throw HudTTSError.playbackFailed(message: "Speech audio format is not convertible.")
        }
        let ratio = format.sampleRate / decodedFormat.sampleRate
        let capacity = AVAudioFrameCount(ceil(Double(decoded.frameLength) * ratio) + 32)
        guard capacity > 0,
              let converted = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity)
        else {
            throw HudTTSError.playbackFailed(message: "Speech audio conversion buffer failed.")
        }

        var suppliedInput = false
        var conversionError: NSError?
        let status = converter.convert(to: converted, error: &conversionError) { _, inputStatus in
            guard !suppliedInput else {
                inputStatus.pointee = .endOfStream
                return nil
            }
            suppliedInput = true
            inputStatus.pointee = .haveData
            return decoded
        }
        if let conversionError { throw conversionError }
        guard status != .error, converted.frameLength > 0 else {
            throw HudTTSError.playbackFailed(message: "Speech audio conversion produced no audio.")
        }
        return converted
    }

    // MARK: - Engine lifecycle

    private func ensureRunning() throws {
        // Dictation releases the shared audio session as soon as the mic
        // closes. Playback owns the next phase, so explicitly reactivate a
        // playback session even when this engine survived the previous turn:
        // AVAudioEngine state alone does not prove iOS has an audible route.
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try session.setActive(true)
        #endif
        if !engine.isRunning {
            engine.prepare()
            try engine.start()
        }
    }

    // MARK: - Buffer synthesis (cached)

    private func kerchunk() -> AVAudioPCMBuffer? {
        if let cached = kerchunkBuffer { return cached }
        let buffer = synthesizeKerchunk(durationMs: 70, peakGain: 0.35)
        kerchunkBuffer = buffer
        return buffer
    }

    private func tail() -> AVAudioPCMBuffer? {
        if let cached = tailBuffer { return cached }
        let buffer = synthesizeTail(durationMs: 180, gain: 0.07, fadeOutMs: 30)
        tailBuffer = buffer
        return buffer
    }

    /// Filtered noise burst with an exponential decay envelope plus a small
    /// initial transient suggesting a relay snap.
    private func synthesizeKerchunk(durationMs: Double, peakGain: Float) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount((durationMs / 1_000.0) * format.sampleRate)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount),
              let channel = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frameCount

        var lastSample: Float = 0
        let length = Float(frameCount)
        for i in 0..<Int(frameCount) {
            let t = Float(i) / length
            var envelope = pow(1 - t, 2.4)
            if i < 32 {
                envelope += pow(1 - Float(i) / 32, 3) * 0.6
            }
            let white = Float.random(in: -1...1)
            lastSample = lastSample * 0.6 + white * 0.4
            channel[i] = lastSample * envelope * peakGain
        }
        return buffer
    }

    /// Low-gain noise burst with a short fade-out so it doesn't cut hard at
    /// the end of the transmission.
    private func synthesizeTail(durationMs: Double, gain: Float, fadeOutMs: Double) -> AVAudioPCMBuffer? {
        let frameCount = AVAudioFrameCount((durationMs / 1_000.0) * format.sampleRate)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount),
              let channel = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frameCount

        let fadeFrames = max(1, Int((fadeOutMs / 1_000.0) * format.sampleRate))
        let fadeStart = max(0, Int(frameCount) - fadeFrames)
        var lastSample: Float = 0
        for i in 0..<Int(frameCount) {
            let white = Float.random(in: -1...1)
            lastSample = lastSample * 0.6 + white * 0.4
            var sample = lastSample * gain
            if i >= fadeStart {
                let fadeT = Float(i - fadeStart) / Float(fadeFrames)
                sample *= (1 - fadeT)
            }
            channel[i] = sample
        }
        return buffer
    }
}
#endif
