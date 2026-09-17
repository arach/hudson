import AVFoundation
import Foundation
import HudsonConversation

/// Whether to request platform echo cancellation on the capture node.
/// Playback and capture run on separate engines here, so without voice
/// processing a loudspeaker conversation can hear itself.
public enum HudConversationEchoCancellationPolicy: Sendable {
    /// Try to enable it; capture proceeds without it when the platform
    /// refuses, and `echoCancellationEngaged()` reports the truth.
    case attempt
    /// Refuse to capture without it.
    case require
    /// The host routes its own audio graph and opts out explicitly.
    case off
}

/// Microphone capture producing mono PCM16 chunks in the session's input
/// format. The host owns permission prompts; capture fails without them.
public actor HudConversationMicrophone: HudConversationAudioInput {
    private let engine = AVAudioEngine()
    private let echoCancellation: HudConversationEchoCancellationPolicy
    private var continuation: AsyncStream<Data>.Continuation?
    private var running = false
    private var tapInstalled = false
    private var sessionActivated = false
    private var voiceProcessingEngaged = false

    public init(echoCancellation: HudConversationEchoCancellationPolicy = .attempt) {
        self.echoCancellation = echoCancellation
    }

    /// True while capture runs with platform echo cancellation actually
    /// engaged. `.attempt` hosts should read this instead of assuming a
    /// working duplex path; hardware behavior stays unverified either way.
    public func echoCancellationEngaged() -> Bool { voiceProcessingEngaged }

    /// Start capture. The stream yields ~100ms PCM16 chunks and finishes on
    /// `stop()`. Chunks the consumer falls behind on are dropped oldest-first:
    /// stale microphone audio is worthless to a live conversation. Every
    /// failure path releases whatever was set up before it, including the
    /// iOS audio session.
    public func start(format: HudConversationAudioFormat) async throws -> AsyncStream<Data> {
        guard !running else { throw HudConversationError.invalidConfiguration("Capture is already running.") }
        do {
            #if os(iOS)
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
            try audioSession.setActive(true)
            sessionActivated = true
            #endif
            guard let target = AVAudioFormat(
                commonFormat: .pcmFormatInt16, sampleRate: Double(format.sampleRate),
                channels: 1, interleaved: true) else {
                throw HudConversationError.invalidConfiguration("Unsupported capture format.")
            }
            let input = engine.inputNode
            switch echoCancellation {
            case .off:
                voiceProcessingEngaged = false
            case .attempt:
                voiceProcessingEngaged = (try? input.setVoiceProcessingEnabled(true)) != nil
            case .require:
                do { try input.setVoiceProcessingEnabled(true) }
                catch {
                    throw HudConversationError.invalidConfiguration(
                        "Echo cancellation is required but unavailable on this device.")
                }
                voiceProcessingEngaged = true
            }
            let source = input.outputFormat(forBus: 0)
            guard let converter = AVAudioConverter(from: source, to: target) else {
                throw HudConversationError.invalidConfiguration("Capture conversion is unavailable.")
            }
            let (stream, continuation) = AsyncStream<Data>.makeStream(bufferingPolicy: .bufferingNewest(64))
            self.continuation = continuation
            input.installTap(onBus: 0, bufferSize: 4096, format: source) { buffer, _ in
                let ratio = target.sampleRate / source.sampleRate
                let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16
                guard let converted = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
                let inputBuffer = ConverterInput(buffer)
                var conversionError: NSError?
                converter.convert(to: converted, error: &conversionError) { _, status in
                    guard let next = inputBuffer.take() else {
                        status.pointee = .noDataNow
                        return nil
                    }
                    status.pointee = .haveData
                    return next
                }
                guard conversionError == nil, converted.frameLength > 0,
                      let samples = converted.int16ChannelData else { return }
                continuation.yield(Data(bytes: samples[0], count: Int(converted.frameLength) * 2))
            }
            tapInstalled = true
            engine.prepare()
            try engine.start()
            running = true
            return stream
        } catch {
            releaseCaptureState(stopEngine: false)
            throw error
        }
    }

    public func stop() {
        guard running || tapInstalled || sessionActivated else { return }
        releaseCaptureState(stopEngine: running)
        running = false
    }

    private func releaseCaptureState(stopEngine: Bool) {
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        if stopEngine { engine.stop() }
        continuation?.finish()
        continuation = nil
        voiceProcessingEngaged = false
        #if os(iOS)
        if sessionActivated {
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            sessionActivated = false
        }
        #endif
    }
}

/// One conversion owns one tap buffer. AVAudioConverter can request input
/// repeatedly; hand the buffer out once, with synchronized ownership transfer.
/// The tap does not mutate its samples during conversion, and conversion
/// finishes before the tap returns and AVAudioEngine can reuse the buffer.
/// The unchecked boundary is limited to this AVFoundation buffer handoff;
/// neither the buffer nor mutable callback state escapes to an async task.
private final class ConverterInput: @unchecked Sendable {
    private let lock = NSLock()
    private var buffer: AVAudioPCMBuffer?

    init(_ buffer: AVAudioPCMBuffer) { self.buffer = buffer }

    func take() -> AVAudioPCMBuffer? {
        lock.lock()
        defer { lock.unlock() }
        let next = buffer
        buffer = nil
        return next
    }
}
