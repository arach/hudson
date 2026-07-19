import Foundation
import AVFoundation
import Speech
import Observation
import OSLog
import VoxEngine

/// Turnkey on-device dictation for HudsonKit iOS surfaces.
///
/// HudsonKit owns the **UX layer** of voice input: microphone permission, mic
/// capture → audio file, transcript rendering, and the error/edge cases. The
/// transcription engine itself is **Vox** (`VoxEngine`, an embeddable Parakeet
/// download+execution facility). For best UX this composes two engines:
///
/// - **Parakeet (Vox)** — preferred; acquired at runtime according to
///   `modelDownloadPolicy`, then warmed on-device.
/// - **Apple Speech** — the always-available fallback used while Parakeet is
///   still downloading/warming, and the source of *live* partial text.
///
/// A single mic capture is teed to both sinks: the buffers are written to a file
/// (Parakeet transcribes it on stop, when warm) and simultaneously streamed to
/// `SFSpeechRecognizer` for an instant partial preview. Whichever engine yields
/// the better final wins — Parakeet when ready, Apple otherwise.
@MainActor
@Observable
public final class HudDictation {
    public enum Engine: String, Sendable {
        case parakeet
        case apple
    }

    /// User's engine choice. `.auto` uses Parakeet when warm and Apple otherwise;
    /// `.parakeet` prefers Parakeet when available; `.apple` stays on Apple
    /// Speech only. Model acquisition is configured separately.
    public enum Preference: String, Sendable, CaseIterable {
        case auto
        case parakeet
        case apple

        public var title: String {
            switch self {
            case .auto: return "Auto"
            case .parakeet: return "Parakeet"
            case .apple: return "Apple Speech"
            }
        }
    }

    public enum State: Equatable, Sendable {
        case idle
        /// Parakeet model is downloading and/or warming (0...1).
        case preparing(progress: Double)
        case listening
        case transcribing
        case unavailable(String)
    }

    // MARK: Observable state

    public private(set) var state: State = .idle
    /// Live, non-final transcript (from Apple) shown as a preview while listening.
    public private(set) var partialText: String = ""
    /// Whether the preferred Parakeet model is downloaded and warm (in memory).
    public private(set) var modelReady: Bool = false
    /// Whether the Parakeet model files are present on disk (downloaded).
    public private(set) var modelInstalled: Bool = false
    /// Which engine produced the most recent final transcript.
    public private(set) var lastEngine: Engine = .apple

    /// Engine choice for transcription and fallback behavior.
    public var preference: Preference = .auto

    /// When Hudson may automatically download and warm the Parakeet model.
    /// Defaults to first use so constructing a dictation object or compiling
    /// HudsonVoice never starts a model download.
    public var modelDownloadPolicy: HudVoiceModelDownloadPolicy

    /// The most recent resolved final transcript, and a monotonic counter that
    /// ticks once per delivered utterance. SwiftUI consumers observe `finalCount`
    /// (`.onChange`) and read `finalText` — robust even when two utterances
    /// transcribe to the same string.
    public private(set) var finalText: String = ""
    public private(set) var finalCount: Int = 0

    /// Also delivered once per utterance, for non-SwiftUI consumers.
    public var onFinal: ((String) -> Void)?

    public var isListening: Bool {
        if case .listening = state { return true }
        return false
    }

    // MARK: Dependencies

    private let modelId: String
    private let asr = EngineManager() // Vox Parakeet (defaults to ParakeetProvider)
    private let recognizer: SFSpeechRecognizer?
    private let log = Logger(subsystem: "com.hudson.voice", category: "dictation")

    // MARK: Capture state

    private let audioEngine = AVAudioEngine()
    private var recordingFile: AVAudioFile?
    private var recordingURL: URL?
    private var speechRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechTask: SFSpeechRecognitionTask?
    private var prepareTask: Task<Void, Never>?

    public init(
        modelId: String = HudsonVoicePreferences.defaultTranscriptionModelId,
        modelDownloadPolicy: HudVoiceModelDownloadPolicy = .onFirstUse,
        locale: Locale = .current
    ) {
        self.modelId = modelId
        self.modelDownloadPolicy = modelDownloadPolicy
        self.recognizer = SFSpeechRecognizer(locale: locale)
    }

    public convenience init(
        preferences: HudsonVoicePreferences,
        locale: Locale = .current
    ) {
        self.init(
            modelId: preferences.preferredTranscriptionModelId
                ?? HudsonVoicePreferences.defaultTranscriptionModelId,
            modelDownloadPolicy: preferences.modelDownloadPolicy,
            locale: locale
        )
    }

    // MARK: - Model lifecycle

    /// Explicitly download (if missing) and warm the Parakeet model. This is an
    /// operator/user action and therefore remains available for every automatic
    /// download policy. No-op once `modelReady`.
    public func prepare() {
        guard preference != .apple else { return } // Apple-only: never download Parakeet
        guard !modelReady, prepareTask == nil else { return }
        if case .preparing = state { return }
        state = .preparing(progress: 0)
        prepareTask = Task { [weak self] in
            guard let self else { return }
            do {
                // `preload` ensures the model is downloaded *and* loaded into
                // memory (warm) in one call.
                _ = try await self.asr.preload(modelId: self.modelId) { progress in
                    Task { @MainActor [weak self] in
                        guard let self, case .preparing = self.state else { return }
                        self.state = .preparing(progress: progress.progress)
                    }
                }
                self.modelReady = true
                self.modelInstalled = true
                if case .preparing = self.state { self.state = .idle }
                self.log.info("Parakeet warm and ready")
            } catch {
                // Non-fatal: Apple Speech remains available as the fallback.
                self.modelReady = false
                if case .preparing = self.state { self.state = .idle }
                self.log.error("Parakeet prepare failed, using Apple fallback: \(error.localizedDescription)")
            }
            self.prepareTask = nil
        }
    }

    /// Notify dictation that its host surface is active. Only the `.eager`
    /// policy starts model acquisition here; `.onFirstUse` waits for `start()`.
    public func activate() {
        prepareAutomatically(for: .activation)
    }

    /// Refresh `modelInstalled`/`modelReady` from the engine (e.g. when opening a
    /// settings page) so the UI reflects on-disk and in-memory state.
    public func refreshStatus() async {
        let models = await asr.models()
        let info = models.first { $0.id == modelId } ?? models.first
        modelInstalled = info?.installed ?? false
        if info?.preloaded == true { modelReady = true }
    }

    // MARK: - Capture

    public func toggle() {
        switch state {
        case .listening: stop()
        case .idle, .preparing, .unavailable: start()
        case .transcribing: break
        }
    }

    public func start() {
        guard !isListening else { return }
        prepareAutomatically(for: .firstUse)
        Task { [weak self] in
            guard let self else { return }
            guard await self.ensureMicPermission() else {
                self.state = .unavailable("Microphone access denied")
                return
            }
            // Speech permission is only needed for the Apple preview/fallback;
            // a denial shouldn't block Parakeet-only capture.
            _ = await self.ensureSpeechPermission()
            do {
                try self.beginCapture()
                self.state = .listening
            } catch {
                self.teardownCapture()
                self.state = .unavailable("Could not start the microphone")
                self.log.error("beginCapture failed: \(error.localizedDescription)")
            }
        }
    }

    private func prepareAutomatically(for trigger: HudVoiceAutomaticPreparationTrigger) {
        guard modelDownloadPolicy.allowsAutomaticPreparation(for: trigger) else { return }
        prepare()
    }

    public func stop() {
        guard isListening else { return }
        let url = recordingURL
        let applePreview = partialText.trimmingCharacters(in: .whitespacesAndNewlines)
        teardownCapture()
        state = .transcribing
        Task { [weak self] in
            guard let self else { return }
            let final = await self.resolveFinal(fileURL: url, applePreview: applePreview)
            if let url { try? FileManager.default.removeItem(at: url) }
            self.partialText = ""
            self.state = .idle
            if !final.isEmpty {
                self.finalText = final
                self.finalCount += 1
                self.onFinal?(final)
            }
        }
    }

    public func cancel() {
        prepareTask?.cancel()
        prepareTask = nil
        if let url = recordingURL { try? FileManager.default.removeItem(at: url) }
        teardownCapture()
        partialText = ""
        if case .unavailable = state {} else { state = .idle }
    }

    // MARK: - Engine selection

    /// Parakeet is authoritative when warm; otherwise fall back to the Apple
    /// live preview as the final.
    private func resolveFinal(fileURL: URL?, applePreview: String) async -> String {
        if preference != .apple, modelReady, let fileURL {
            do {
                let output = try await asr.transcribe(url: fileURL, modelId: modelId)
                let text = output.text.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty {
                    lastEngine = .parakeet
                    return text
                }
            } catch {
                log.error("Parakeet transcribe failed, falling back to Apple: \(error.localizedDescription)")
            }
        }
        lastEngine = .apple
        return applePreview
    }

    // MARK: - Capture plumbing

    private func beginCapture() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("hud-dictation-\(UUID().uuidString).caf")
        recordingURL = url

        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        #endif

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        recordingFile = file

        // Live Apple preview (best-effort — only if speech is authorized/available).
        var request: SFSpeechAudioBufferRecognitionRequest?
        if let recognizer, recognizer.isAvailable,
           SFSpeechRecognizer.authorizationStatus() == .authorized {
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition {
                req.requiresOnDeviceRecognition = true
            }
            request = req
            speechRequest = req
            speechTask = recognizer.recognitionTask(with: req) { [weak self] result, _ in
                guard let text = result?.bestTranscription.formattedString else { return }
                Task { @MainActor [weak self] in self?.partialText = text }
            }
        }

        // One tap, two sinks: write every buffer to the file (for Parakeet) and
        // stream it to Apple (for the live preview). Captures locals, not self,
        // so the realtime audio thread never touches main-actor state.
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            try? file.write(from: buffer)
            request?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
    }

    private func teardownCapture() {
        if audioEngine.isRunning || audioEngine.inputNode.numberOfInputs > 0 {
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        if audioEngine.isRunning { audioEngine.stop() }
        speechRequest?.endAudio()
        speechTask?.cancel()
        speechRequest = nil
        speechTask = nil
        recordingFile = nil // finalizes the file
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }

    // MARK: - Permissions

    private func ensureMicPermission() async -> Bool {
        #if os(iOS)
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        case .undetermined:
            return await withCheckedContinuation { cont in
                AVAudioApplication.requestRecordPermission { granted in cont.resume(returning: granted) }
            }
        @unknown default: return false
        }
        #else
        return true
        #endif
    }

    private func ensureSpeechPermission() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return true
        case .denied, .restricted: return false
        case .notDetermined:
            return await withCheckedContinuation { cont in
                SFSpeechRecognizer.requestAuthorization { status in cont.resume(returning: status == .authorized) }
            }
        @unknown default: return false
        }
    }
}

enum HudVoiceAutomaticPreparationTrigger {
    case activation
    case firstUse
}

extension HudVoiceModelDownloadPolicy {
    func allowsAutomaticPreparation(for trigger: HudVoiceAutomaticPreparationTrigger) -> Bool {
        switch (self, trigger) {
        case (.never, _), (.onFirstUse, .activation):
            return false
        case (.onFirstUse, .firstUse), (.eager, _):
            return true
        }
    }
}
