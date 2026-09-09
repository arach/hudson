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
///
/// Hosts that want one engine and one result set `parakeetOnly`. Apple Speech
/// then never runs, and an utterance spoken before the model is warm is held on
/// disk rather than resolved by a second engine or dropped — see `queuedCount`.
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

    /// Strict on-device Parakeet, overriding `preference`.
    ///
    /// Apple Speech does not run at all: no live preview, no fallback final, and
    /// no speech-recognition permission prompt. An utterance captured before the
    /// model is warm — or one whose transcription fails — is held on disk and
    /// transcribed, in capture order, as soon as Parakeet is ready. Hosts that
    /// promise "your dictation is never lost" want this.
    public var parakeetOnly: Bool = false

    /// Utterances captured but not yet transcribed, waiting on the model. Only
    /// ever non-zero under `parakeetOnly`. Survives app launches.
    public private(set) var queuedCount: Int = 0

    /// Host-defined tag describing what the *next* capture is for — a thread, a
    /// lane, a document. Snapshotted when capture starts and stored alongside
    /// held audio, so an utterance transcribed minutes later still knows where
    /// it was headed. Limited to letters, digits and `:_-.`; 64 characters.
    public var captureContext: String?

    /// The `captureContext` that was in force when the most recent final was
    /// captured. Read this inside `onFinal` — for a held utterance it is the
    /// context from capture time, not whatever the host is doing now.
    public private(set) var lastFinalContext: String?

    /// Instantaneous microphone energy, 0...1, while listening; 0 otherwise.
    /// Published raw — consumers own any smoothing or history.
    public private(set) var audioLevel: Double = 0

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
    private let heldUtterances = HudPendingUtteranceStore()
    private var drainTask: Task<Void, Never>?
    /// `captureContext` as it was when the in-flight capture began.
    private var contextAtCapture: String?

    // MARK: Capture state

    private let audioEngine = AVAudioEngine()
    private var recordingFile: AVAudioFile?
    private var recordingURL: URL?
    private var speechRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechTask: SFSpeechRecognitionTask?
    private var prepareTask: Task<Void, Never>?
    /// Permission prompts make `start()` asynchronous. Keep that pending
    /// interval distinct from `.listening` so a second tap cannot install a
    /// duplicate input-node tap while the first start is still awaiting.
    private var captureStartGate = HudDictationCaptureStartGate()
    private var hasInputTap = false

    public init(
        modelId: String = HudsonVoicePreferences.defaultTranscriptionModelId,
        modelDownloadPolicy: HudVoiceModelDownloadPolicy = .onFirstUse,
        locale: Locale = .current
    ) {
        self.modelId = modelId
        self.modelDownloadPolicy = modelDownloadPolicy
        self.recognizer = SFSpeechRecognizer(locale: locale)
        // Speech held across a previous launch is still owed to the host.
        self.queuedCount = heldUtterances.count
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
        guard parakeetOnly || preference != .apple else { return } // Apple-only: never download Parakeet
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
                self.drainHeldUtterances()
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
        if info?.preloaded == true {
            modelReady = true
            drainHeldUtterances()
        }
        queuedCount = heldUtterances.count
    }

    /// Transcribe everything held on disk, oldest first, and deliver each as a
    /// normal final. Runs whenever the model becomes ready — including a launch
    /// that inherits utterances from a previous run.
    ///
    /// A failure re-holds the recording rather than dropping it: the next warm
    /// model tries again. Only a real transcript retires a recording.
    private func drainHeldUtterances() {
        guard modelReady, drainTask == nil else { return }
        let held = heldUtterances.pending()
        guard !held.isEmpty else {
            queuedCount = 0
            return
        }

        queuedCount = held.count
        log.notice("Transcribing \(held.count) held utterance(s)")
        drainTask = Task { [weak self] in
            guard let self else { return }
            defer { self.drainTask = nil }
            for held in held {
                guard !Task.isCancelled else { return }
                do {
                    let output = try await self.asr.transcribe(url: held.url, modelId: self.modelId)
                    let text = output.text.trimmingCharacters(in: .whitespacesAndNewlines)
                    self.heldUtterances.discard(held.url)
                    self.queuedCount = max(0, self.queuedCount - 1)
                    guard !text.isEmpty else { continue }
                    self.lastEngine = .parakeet
                    self.lastFinalContext = held.context
                    self.finalText = text
                    self.finalCount += 1
                    self.onFinal?(text)
                } catch {
                    // Leave it on disk. Losing speech is worse than retrying it.
                    self.log.error("Held utterance still not transcribable: \(error.localizedDescription)")
                    return
                }
            }
        }
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
        guard !isListening, let generation = captureStartGate.begin() else { return }
        contextAtCapture = captureContext
        prepareAutomatically(for: .firstUse)
        Task { [weak self] in
            guard let self else { return }
            guard await self.ensureMicPermission() else {
                guard self.captureStartGate.finish(generation) else { return }
                self.state = .unavailable("Microphone access denied")
                return
            }
            guard self.captureStartGate.isCurrent(generation) else { return }
            // Speech permission is only needed for the Apple preview/fallback;
            // a denial shouldn't block Parakeet-only capture, and a host that
            // never uses Apple shouldn't see the prompt at all.
            if !self.parakeetOnly {
                _ = await self.ensureSpeechPermission()
                guard self.captureStartGate.isCurrent(generation) else { return }
            }
            do {
                try self.beginCapture()
                guard self.captureStartGate.finish(generation) else {
                    self.teardownCapture()
                    return
                }
                self.state = .listening
            } catch {
                self.teardownCapture()
                guard self.captureStartGate.finish(generation) else { return }
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
        if captureStartGate.cancelIfStarting() {
            // A permission callback may still arrive. Its generation check
            // prevents it from installing a tap after the user stopped.
            return
        }
        guard isListening else { return }
        let url = recordingURL
        let applePreview = partialText.trimmingCharacters(in: .whitespacesAndNewlines)
        teardownCapture()
        state = .transcribing

        if parakeetOnly {
            Task { [weak self] in
                guard let self else { return }
                await self.resolveWithParakeetOnly(fileURL: url)
                self.state = .idle
            }
            return
        }

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
        captureStartGate.invalidate()
        if let url = recordingURL { try? FileManager.default.removeItem(at: url) }
        teardownCapture()
        partialText = ""
        if case .unavailable = state {} else { state = .idle }
    }

    // MARK: - Engine selection

    /// The `parakeetOnly` path: transcribe now when the model is warm and
    /// nothing is already waiting, otherwise hold the recording so it is
    /// delivered later, in the order it was spoken. There is no second engine
    /// and no discard — the audio always outlives the attempt.
    private func resolveWithParakeetOnly(fileURL: URL?) async {
        guard let fileURL else { return }

        // Jumping the queue would reorder someone's dictation.
        if modelReady, queuedCount == 0, drainTask == nil {
            do {
                let output = try await asr.transcribe(url: fileURL, modelId: modelId)
                let text = output.text.trimmingCharacters(in: .whitespacesAndNewlines)
                try? FileManager.default.removeItem(at: fileURL)
                guard !text.isEmpty else { return }
                lastEngine = .parakeet
                lastFinalContext = contextAtCapture
                finalText = text
                finalCount += 1
                onFinal?(text)
                return
            } catch {
                log.error("Parakeet transcribe failed; holding the utterance: \(error.localizedDescription)")
            }
        }

        hold(fileURL)
    }

    /// Move a recording into durable storage and make sure a model is on its way.
    private func hold(_ url: URL) {
        do {
            _ = try heldUtterances.adopt(url, context: contextAtCapture)
            queuedCount += 1
            prepare()
            drainHeldUtterances()
        } catch {
            // The recording stays in the temporary directory rather than being
            // deleted — a worse place to keep it, but still not a silent loss.
            log.error("Could not hold an utterance: \(error.localizedDescription)")
        }
    }

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
        if !parakeetOnly, let recognizer, recognizer.isAvailable,
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
        // AVAudioEngine permits one tap per bus and raises an Objective-C
        // exception (rather than a Swift error) when that invariant is broken.
        // The state gate above prevents normal duplicate starts; removing a
        // stale tap here makes recovery from an interrupted prior capture safe.
        input.removeTap(onBus: 0)
        let meter = LevelThrottle()
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            try? file.write(from: buffer)
            request?.append(buffer)

            // Metering is a display concern: 30 Hz is smooth to the eye and
            // leaves the audio thread alone the rest of the time.
            let now = ProcessInfo.processInfo.systemUptime
            guard now - meter.lastPublish >= 1.0 / 30.0 else { return }
            meter.lastPublish = now
            let level = Self.normalizedLevel(in: buffer)
            Task { @MainActor [weak self] in
                guard let self, self.isListening else { return }
                self.audioLevel = level
            }
        }
        hasInputTap = true

        audioEngine.prepare()
        try audioEngine.start()
    }

    /// Convert the microphone's RMS energy into a perceptual 0...1 meter.
    /// Roughly -55 dB reads as silence and -10 dB as full scale.
    private nonisolated static func normalizedLevel(in buffer: AVAudioPCMBuffer) -> Double {
        guard let channels = buffer.floatChannelData,
              buffer.frameLength > 0,
              buffer.format.channelCount > 0 else { return 0 }

        let frameCount = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        var sum: Float = 0
        for channel in 0..<channelCount {
            let samples = channels[channel]
            for frame in 0..<frameCount {
                let sample = samples[frame]
                sum += sample * sample
            }
        }

        let rms = sqrt(sum / Float(frameCount * channelCount))
        let decibels = 20 * log10(max(rms, 0.000_01))
        let linear = min(1, max(0, (decibels + 55) / 45))
        return Double(pow(linear, 0.72))
    }

    private func teardownCapture() {
        if hasInputTap {
            audioEngine.inputNode.removeTap(onBus: 0)
            hasInputTap = false
        }
        if audioEngine.isRunning { audioEngine.stop() }
        speechRequest?.endAudio()
        speechTask?.cancel()
        speechRequest = nil
        speechTask = nil
        recordingFile = nil // finalizes the file
        audioLevel = 0
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

/// The audio tap is invoked serially on one thread, so an unsynchronized box is
/// enough to rate-limit metering without reaching for main-actor state. Kept at
/// file scope so it never inherits `HudDictation`'s main-actor isolation.
private final class LevelThrottle: @unchecked Sendable {
    var lastPublish: Double = 0
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
