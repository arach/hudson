// Compile with the Transcription/*.swift sources; see HUD-013 for the command.
// This opt-in local-file proof never opens a microphone or sends audio to a server.
import Foundation
@preconcurrency import AVFoundation
import Darwin

private enum SmokeError: Error {
    case usage, invalidFile, conversionFailed, noFinalTranscript, timedOut, cancellationIgnored
}

private final class OneShotAudioInput: @unchecked Sendable {
    private let lock = NSLock()
    private let buffer: AVAudioPCMBuffer
    private var supplied = false

    init(_ buffer: AVAudioPCMBuffer) { self.buffer = buffer }

    func take() -> AVAudioPCMBuffer? {
        lock.lock()
        defer { lock.unlock() }
        guard !supplied else { return nil }
        supplied = true
        return buffer
    }
}

private actor Evidence {
    var finalText = ""
    var finalCount = 0
    var timedSpanCount = 0
    var invalidSourceTiming = false

    func record(_ update: HudTranscriptUpdate) {
        print("\(update.isFinal ? "final" : "partial") [\(update.range.start), +\(update.range.duration)] \(update.text)")
        if update.isFinal {
            finalCount += 1
            finalText += update.text
            timedSpanCount += update.spans.filter { $0.range != nil }.count
            if update.range.start < 6.9 || update.spans.contains(where: { ($0.range?.start ?? 7) < 6.9 }) {
                invalidSourceTiming = true
            }
        }
    }

    func verify() throws {
        guard finalCount > 0, timedSpanCount > 0, !invalidSourceTiming,
              !finalText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SmokeError.noFinalTranscript
        }
        print("PASS: \(finalCount) finalized segments, \(timedSpanCount) source-timed spans")
    }
}

@main
private struct StreamingTranscriptionSmoke {
    static func main() async {
        do {
            try await run()
        } catch {
            FileHandle.standardError.write(Data("FAIL: \(error.localizedDescription)\n".utf8))
            exit(1)
        }
    }

    private static func run() async throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        guard let path = arguments.first, !path.hasPrefix("--") else {
            print("Usage: streaming-transcription-smoke AUDIO_FILE [--allow-model-download]")
            throw SmokeError.usage
        }
        let engine = HudAppleStreamingTranscriber()
        let preparation = try await engine.prepare(
            localeIdentifier: "en-US",
            downloadPolicy: arguments.contains("--allow-model-download") ? .downloadIfNeeded : .requireInstalled
        )
        let samples = try loadMonoAudio(path: path, sampleRate: preparation.sampleRate)
        let input = try HudTranscriptionAudioStream(bufferCapacity: 32)
        let evidence = Evidence()
        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask {
                let consumer = Task {
                    try await engine.transcribe(audio: input) { update in
                        await evidence.record(update)
                    }
                }
                do {
                    let chunkSize = Int(preparation.sampleRate / 10)
                    for offset in stride(from: 0, to: samples.count, by: chunkSize) {
                        try Task.checkCancellation()
                        let end = min(offset + chunkSize, samples.count)
                        // A nonzero source origin proves timestamps aren't wall-clock based.
                        try input.yield(HudTranscriptionAudioChunk(
                            samples: Array(samples[offset..<end]),
                            sampleRate: preparation.sampleRate,
                            startTime: 7 + Double(offset) / preparation.sampleRate
                        ))
                        try await Task.sleep(for: .milliseconds(100))
                    }
                    input.finish()
                    try await consumer.value
                    try await evidence.verify()
                    // Reuse after normal EOF, then cancel while waiting for first input.
                    _ = try await engine.prepare(localeIdentifier: "en-US")
                    let pending = try HudTranscriptionAudioStream()
                    let waiting = Task {
                        try await engine.transcribe(audio: pending) { _ in }
                    }
                    try await Task.sleep(for: .milliseconds(200))
                    await engine.cancel()
                    do {
                        try await waiting.value
                        throw SmokeError.cancellationIgnored
                    } catch is CancellationError {
                        print("PASS: cancellation ends an open input stream")
                    }
                    _ = try await engine.prepare(localeIdentifier: "en-US")
                    await engine.cancel()
                    print("PASS: engine prepares again after cancellation")
                } catch {
                    input.finish(throwing: error)
                    consumer.cancel()
                    await engine.cancel()
                    _ = await consumer.result
                    throw error
                }
            }
            group.addTask {
                try await Task.sleep(for: .seconds(150))
                throw SmokeError.timedOut
            }
            defer { group.cancelAll() }
            try await group.next()
        }
    }

    private static func loadMonoAudio(path: String, sampleRate: Double) throws -> [Float] {
        let file = try AVAudioFile(forReading: URL(fileURLWithPath: path))
        guard file.length > 0,
              Double(file.length) / file.processingFormat.sampleRate <= 120,
              let source = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: file.processingFormat, to: format) else {
            throw SmokeError.invalidFile
        }
        try file.read(into: source)
        let capacity = AVAudioFrameCount(ceil(Double(source.frameLength) * sampleRate / source.format.sampleRate)) + 4096
        guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
            throw SmokeError.conversionFailed
        }
        let input = OneShotAudioInput(source)
        var error: NSError?
        let status = converter.convert(to: output, error: &error) { _, inputStatus in
            guard let next = input.take() else {
                inputStatus.pointee = .endOfStream
                return nil
            }
            inputStatus.pointee = .haveData
            return next
        }
        if let error { throw error }
        guard status != .error, output.frameLength > 0, let channel = output.floatChannelData?[0] else {
            throw SmokeError.conversionFailed
        }
        return Array(UnsafeBufferPointer(start: channel, count: Int(output.frameLength)))
    }
}
