#if canImport(AVFoundation)
import AVFoundation
import Observation

@MainActor
@Observable
public final class HudSystemSpeechSynthesizer: NSObject {
    public static let shared = HudSystemSpeechSynthesizer()

    public static let fallbackDefaultVoiceIdentifier = HudSystemSpeechDefaults.fallbackVoiceIdentifier

    public static var defaultVoiceIdentifier: String {
        HudSystemSpeechDefaults.defaultVoiceIdentifier
    }

    private let synthesizer = AVSpeechSynthesizer()
    private var activeUtterance: AVSpeechUtterance?
    private var completionHandler: (() -> Void)?
    private var pendingPieces: [String] = []
    private var currentVoice: AVSpeechSynthesisVoice?

    public private(set) var isSpeaking = false
    public var selectedVoiceIdentifier: String?
    public var speechRate: Float = AVSpeechUtteranceDefaultSpeechRate * 0.93

    override init() {
        super.init()
        synthesizer.delegate = self
        selectedVoiceIdentifier = Self.defaultVoiceIdentifier
    }

    public func speak(_ text: String, voiceIdentifier: String? = nil, completion: (() -> Void)? = nil) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            completion?()
            return
        }

        stop()
        configureAudioSession()

        let voiceID = voiceIdentifier.flatMap { $0.isEmpty ? nil : $0 } ?? selectedVoiceIdentifier
        currentVoice = voiceID.flatMap { AVSpeechSynthesisVoice(identifier: $0) }
        pendingPieces = HudSystemSpeechChunking.pieces(trimmed, voiceIdentifier: voiceID)
        completionHandler = completion
        speakNextPiece()
    }

    private func speakNextPiece() {
        guard !pendingPieces.isEmpty else { return }
        let utterance = AVSpeechUtterance(string: pendingPieces.removeFirst())
        utterance.voice = currentVoice
        utterance.rate = speechRate
        utterance.prefersAssistiveTechnologySettings = true
        utterance.preUtteranceDelay = 0.05
        utterance.postUtteranceDelay = 0.1
        activeUtterance = utterance
        isSpeaking = true
        synthesizer.speak(utterance)
    }

    func adopt(_ utterance: AVSpeechUtterance, completion: (() -> Void)?) {
        activeUtterance = utterance
        completionHandler = completion
        isSpeaking = true
    }

    public func speakAsync(_ text: String, voiceIdentifier: String? = nil) async {
        await withCheckedContinuation { continuation in
            speak(text, voiceIdentifier: voiceIdentifier) {
                continuation.resume()
            }
        }
    }

    public func synthesizeAudioData(_ text: String, voiceIdentifier: String? = nil, rate: Double? = nil) async throws -> Data {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw HudTTSError.emptyInput
        }

        stop()

        let utterance = AVSpeechUtterance(string: text)
        if let voiceIdentifier, !voiceIdentifier.isEmpty,
           let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier) {
            utterance.voice = voice
        } else if let selectedVoiceIdentifier,
                  let voice = AVSpeechSynthesisVoice(identifier: selectedVoiceIdentifier) {
            utterance.voice = voice
        }
        utterance.rate = try Self.audioRate(multiplier: rate, defaultRate: speechRate)
        utterance.prefersAssistiveTechnologySettings = rate == nil

        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("hudson-system-tts-\(UUID().uuidString)")
            .appendingPathExtension("caf")

        defer {
            try? FileManager.default.removeItem(at: outputURL)
        }

        return try await withCheckedThrowingContinuation { continuation in
            var audioFile: AVAudioFile?
            var didResume = false

            synthesizer.write(utterance) { buffer in
                guard !didResume else { return }
                guard let pcmBuffer = buffer as? AVAudioPCMBuffer else { return }

                do {
                    if pcmBuffer.frameLength == 0 {
                        didResume = true
                        if audioFile == nil {
                            continuation.resume(throwing: HudTTSError.synthesisFailed(
                                provider: .system,
                                message: "System speech did not produce audio."
                            ))
                        } else {
                            continuation.resume(returning: try Data(contentsOf: outputURL))
                        }
                        return
                    }

                    if audioFile == nil {
                        audioFile = try AVAudioFile(
                            forWriting: outputURL,
                            settings: pcmBuffer.format.settings,
                            commonFormat: pcmBuffer.format.commonFormat,
                            interleaved: pcmBuffer.format.isInterleaved
                        )
                    }

                    try audioFile?.write(from: pcmBuffer)
                } catch {
                    didResume = true
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Explicit rates are multipliers of the standard speech rate; legacy
    /// callers without a rate retain their configured playback preference.
    static func audioRate(multiplier: Double?, defaultRate: Float) throws -> Float {
        guard let multiplier else { return defaultRate }
        guard multiplier.isFinite, multiplier > 0 else {
            throw HudTTSError.synthesisFailed(provider: .system, message: "Speech rate must be finite and positive.")
        }
        let value = Double(AVSpeechUtteranceDefaultSpeechRate) * multiplier
        return Float(min(max(value, Double(AVSpeechUtteranceMinimumSpeechRate)), Double(AVSpeechUtteranceMaximumSpeechRate)))
    }

    public func pauseOrResume() {
        if synthesizer.isSpeaking {
            synthesizer.pauseSpeaking(at: .word)
            isSpeaking = false
            return
        }

        if synthesizer.isPaused {
            synthesizer.continueSpeaking()
            isSpeaking = true
        }
    }

    public func stop() {
        pendingPieces = []
        currentVoice = nil
        activeUtterance = nil
        completionHandler = nil
        isSpeaking = false
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }
}

extension HudSystemSpeechSynthesizer: AVSpeechSynthesizerDelegate {
    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.finishIfCurrent(utterance)
        }
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.cancelIfCurrent(utterance)
        }
    }

    func finishIfCurrent(_ utterance: AVSpeechUtterance) {
        guard activeUtterance === utterance else { return }
        if !pendingPieces.isEmpty {
            speakNextPiece()
            return
        }
        activeUtterance = nil
        isSpeaking = false
        let completion = completionHandler
        completionHandler = nil
        completion?()
    }

    func cancelIfCurrent(_ utterance: AVSpeechUtterance) {
        guard activeUtterance === utterance else { return }
        activeUtterance = nil
        isSpeaking = false
        completionHandler = nil
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
