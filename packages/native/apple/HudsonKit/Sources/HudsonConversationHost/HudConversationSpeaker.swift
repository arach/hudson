import AVFoundation
import Foundation
import HudsonConversation

/// Assistant speech playback that honors playback generations: after a
/// barge-in, chunks from older generations are dropped instead of played.
/// The scheduling queue is bounded by buffer count and bytes; when the device
/// falls behind, the newest chunk is dropped and counted rather than growing
/// the queue without limit.
public actor HudConversationSpeaker: HudConversationAudioOutput {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let maximumQueuedBuffers: Int
    private let maximumQueuedBytes: Int
    private var attached = false
    private var connectedRate: Double?
    private var currentGeneration: UInt64 = 0
    /// Bumped on every flush/stop; completion callbacks from before the flush
    /// carry the old epoch and must not decrement the new queue's counters.
    private var epoch: UInt64 = 0
    private var queuedBuffers = 0
    private var queuedBytes = 0
    private var dropped = 0

    private var running = false

    public init(maximumQueuedBuffers: Int = 64, maximumQueuedBytes: Int = 2_000_000) {
        self.maximumQueuedBuffers = maximumQueuedBuffers
        self.maximumQueuedBytes = maximumQueuedBytes
    }

    /// Chunks dropped because the queue bound was reached. A growing value
    /// means the output device is not keeping up.
    public var droppedChunks: Int { dropped }

    public func start() throws {
        guard !running else { return }
        if !attached {
            engine.attach(player)
            attached = true
        }
        // AVAudioEngine raises an uncatchable NSException from prepare() when an
        // attached node has no connection ("inputNode != nullptr ||
        // outputNode != nullptr"), so connect at the provider's documented
        // output rate now; play() reconnects if a chunk arrives at another rate.
        if connectedRate == nil {
            let rate = Double(HudConversationAudioFormat.pcm24k.sampleRate)
            guard let format = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false) else {
                throw HudConversationError.invalidConfiguration("Playback format is unavailable.")
            }
            engine.disconnectNodeOutput(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
            connectedRate = rate
        }
        engine.prepare()
        running = true
    }

    /// Invalidate all queued speech older than `generation` and stop the
    /// player immediately. Pair with `HudConversationSession.interruptPlayback()`
    /// or a `.interrupted` event.
    public func flush(to generation: UInt64) {
        currentGeneration = max(currentGeneration, generation)
        guard running else { return }
        epoch += 1
        player.stop()
        queuedBuffers = 0
        queuedBytes = 0
    }

    /// Schedule one assistant chunk. Chunks from a superseded generation are
    /// dropped silently — that is the point of the generation.
    public func play(_ chunk: HudConversationAudioChunk) throws {
        // Malformed PCM is rejected before any state or engine work;
        // incomplete samples are never silently truncated.
        guard !chunk.data.isEmpty, chunk.data.count.isMultiple(of: 2) else {
            throw HudConversationError.invalidAudioChunk
        }
        guard running else { throw HudConversationError.invalidConfiguration("Playback is not started.") }
        guard chunk.generation >= currentGeneration else { return }
        currentGeneration = chunk.generation
        guard queuedBuffers < maximumQueuedBuffers,
              queuedBytes + chunk.data.count <= maximumQueuedBytes else {
            dropped += 1
            return
        }
        let rate = Double(chunk.format.sampleRate)
        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false) else {
            throw HudConversationError.invalidAudioChunk
        }
        if connectedRate != rate {
            engine.disconnectNodeOutput(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
            connectedRate = rate
        }
        if !engine.isRunning { try engine.start() }
        let sampleCount = chunk.data.count / 2
        guard sampleCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(sampleCount)),
              let channel = buffer.floatChannelData else {
            throw HudConversationError.invalidAudioChunk
        }
        buffer.frameLength = AVAudioFrameCount(sampleCount)
        chunk.data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            let samples = raw.bindMemory(to: Int16.self)
            for index in 0..<sampleCount {
                channel[0][index] = Float(Int16(littleEndian: samples[index])) / Float(Int16.max)
            }
        }
        queuedBuffers += 1
        queuedBytes += chunk.data.count
        let scheduledEpoch = epoch
        let bytes = chunk.data.count
        player.scheduleBuffer(buffer) {
            Task { await self.bufferFinished(epoch: scheduledEpoch, bytes: bytes) }
        }
        if !player.isPlaying { player.play() }
    }

    public func stop() {
        guard running else { return }
        epoch += 1
        player.stop()
        engine.stop()
        running = false
        queuedBuffers = 0
        queuedBytes = 0
        // A later start must reconnect and restart the engine.
        connectedRate = nil
    }

    private func bufferFinished(epoch finishedEpoch: UInt64, bytes: Int) {
        guard finishedEpoch == epoch else { return }
        queuedBuffers = max(0, queuedBuffers - 1)
        queuedBytes = max(0, queuedBytes - bytes)
    }
}
