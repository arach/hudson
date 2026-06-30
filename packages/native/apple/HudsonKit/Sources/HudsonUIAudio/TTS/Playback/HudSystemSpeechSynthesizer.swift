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
    private var completionHandler: (() -> Void)?

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

        let utterance = AVSpeechUtterance(string: trimmed)
        if let voiceIdentifier, !voiceIdentifier.isEmpty,
           let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier) {
            utterance.voice = voice
        } else if let selectedVoiceIdentifier,
                  let voice = AVSpeechSynthesisVoice(identifier: selectedVoiceIdentifier) {
            utterance.voice = voice
        }
        utterance.rate = speechRate
        utterance.prefersAssistiveTechnologySettings = true
        utterance.preUtteranceDelay = 0.05
        utterance.postUtteranceDelay = 0.1

        completionHandler = completion
        isSpeaking = true
        synthesizer.speak(utterance)
    }

    public func speakAsync(_ text: String, voiceIdentifier: String? = nil) async {
        await withCheckedContinuation { continuation in
            speak(text, voiceIdentifier: voiceIdentifier) {
                continuation.resume()
            }
        }
    }

    public func synthesizeAudioData(_ text: String, voiceIdentifier: String? = nil) async throws -> Data {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw HudTTSError.emptyInput
        }

        stop()

        let utterance = AVSpeechUtterance(string: trimmed)
        if let voiceIdentifier, !voiceIdentifier.isEmpty,
           let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier) {
            utterance.voice = voice
        } else if let selectedVoiceIdentifier,
                  let voice = AVSpeechSynthesisVoice(identifier: selectedVoiceIdentifier) {
            utterance.voice = voice
        }
        utterance.rate = speechRate
        utterance.prefersAssistiveTechnologySettings = true

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
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
        completionHandler = nil
    }
}

extension HudSystemSpeechSynthesizer: AVSpeechSynthesizerDelegate {
    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
            self.completionHandler?()
            self.completionHandler = nil
        }
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
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
