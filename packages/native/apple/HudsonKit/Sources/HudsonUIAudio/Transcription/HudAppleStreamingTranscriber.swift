#if canImport(Speech) && canImport(AVFAudio) && !os(watchOS) && compiler(>=6.2)
import Foundation
import CoreMedia
@preconcurrency import AVFAudio
import Speech

/// Convert floating-point seconds once, rounding to the nearest source sample.
/// CMTime(seconds:preferredTimescale:) may truncate an inexact Double one sample
/// below its intended boundary, falsely rejecting contiguous chunks as overlap.
enum HudTranscriptionSampleClock {
    static func time(seconds: Double, sampleRate: Double) throws -> CMTime {
        let ticks = (seconds * sampleRate).rounded()
        guard seconds.isFinite, seconds >= 0, sampleRate.isFinite,
              sampleRate >= 1, sampleRate <= 192_000,
              sampleRate.rounded() == sampleRate,
              ticks.isFinite, ticks >= 0, ticks < Double(Int64.max) else {
            throw HudStreamingTranscriptionError.invalidTimeRange
        }
        return CMTime(value: Int64(ticks), timescale: CMTimeScale(sampleRate))
    }
}

/// Continuous on-device recognition using Apple's long-form SpeechTranscriber.
/// Owns no microphone, audio session, file, transcript history, or cloud service.
/// Available hardware and languages are checked during explicit preparation.
@available(macOS 26.0, iOS 26.0, visionOS 26.0, tvOS 26.0, *)
public actor HudAppleStreamingTranscriber: HudStreamingTranscriber {
    private struct Prepared: Sendable {
        let transcriber: SpeechTranscriber
        let analyzer: SpeechAnalyzer
        let format: AVAudioFormat
        let info: HudTranscriptionPreparation
    }

    private var prepared: Prepared?
    private var preparationTask: Task<Prepared, Error>?
    private var transcriptionTask: Task<Void, Error>?
    private var runningAudio: HudTranscriptionAudioStream?

    public init() {}

    /// Resolves locale equivalence, checks model installation, and loads the model.
    /// The default never requests a download. `.downloadIfNeeded` may download and
    /// reserve system-managed language assets; no app-global reservations are released.
    /// Call again before each new transcription session.
    public func prepare(
        localeIdentifier: String = Locale.current.identifier,
        downloadPolicy: HudTranscriptionModelDownloadPolicy = .requireInstalled
    ) async throws -> HudTranscriptionPreparation {
        guard preparationTask == nil, transcriptionTask == nil else {
            throw HudStreamingTranscriptionError.alreadyRunning
        }
        let previous = prepared
        prepared = nil
        let task = Task {
            if let previous { await previous.analyzer.cancelAndFinishNow() }
            return try await Self.makePrepared(localeIdentifier: localeIdentifier, downloadPolicy: downloadPolicy)
        }
        preparationTask = task
        defer { preparationTask = nil }
        let result = try await withTaskCancellationHandler {
            try await task.value
        } onCancel: {
            task.cancel()
        }
        if Task.isCancelled || task.isCancelled {
            await result.analyzer.cancelAndFinishNow()
            throw CancellationError()
        }
        prepared = result
        return result.info
    }

    /// Reads one bounded caller-owned stream. Successful EOF finalizes all results.
    /// Cancellation closes that input stream with CancellationError and stops analysis.
    /// The handler runs serially, outside the main actor; it must cooperate with cancellation.
    public func transcribe(
        audio: HudTranscriptionAudioStream,
        onUpdate: @escaping @Sendable (HudTranscriptUpdate) async throws -> Void
    ) async throws {
        guard preparationTask == nil, transcriptionTask == nil else {
            throw HudStreamingTranscriptionError.alreadyRunning
        }
        guard let prepared else { throw HudStreamingTranscriptionError.notPrepared }
        let input = try audio.consume()
        self.prepared = nil
        let task = Task {
            try await Self.run(prepared: prepared, audio: audio, input: input, onUpdate: onUpdate)
        }
        transcriptionTask = task
        runningAudio = audio
        defer {
            transcriptionTask = nil
            runningAudio = nil
        }
        try await withTaskCancellationHandler {
            try await task.value
            try Task.checkCancellation()
            if task.isCancelled { throw CancellationError() }
        } onCancel: {
            audio.finish(throwing: CancellationError())
            task.cancel()
        }
    }

    /// Cancels preparation or recognition, or releases an unused prepared analyzer.
    /// Await the original prepare/transcribe call to observe its terminal outcome.
    public func cancel() async {
        preparationTask?.cancel()
        transcriptionTask?.cancel()
        runningAudio?.finish(throwing: CancellationError())
        let previous = prepared
        prepared = nil
        if let previous { await previous.analyzer.cancelAndFinishNow() }
    }

    private static func makePrepared(
        localeIdentifier: String,
        downloadPolicy: HudTranscriptionModelDownloadPolicy
    ) async throws -> Prepared {
        try Task.checkCancellation()
        guard SpeechTranscriber.isAvailable else { throw HudStreamingTranscriptionError.unavailable }
        guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: localeIdentifier)) else {
            throw HudStreamingTranscriptionError.unsupportedLocale(localeIdentifier)
        }
        try Task.checkCancellation()
        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [.volatileResults],
            attributeOptions: [.audioTimeRange]
        )
        let status = await AssetInventory.status(forModules: [transcriber])
        try Task.checkCancellation()
        if status != .installed {
            guard status != .unsupported else {
                throw HudStreamingTranscriptionError.unsupportedLocale(locale.identifier)
            }
            guard downloadPolicy == .downloadIfNeeded else {
                throw HudStreamingTranscriptionError.modelNotInstalled(locale.identifier)
            }
            if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                try Task.checkCancellation()
                try await request.downloadAndInstall()
            }
            try Task.checkCancellation()
            guard await AssetInventory.status(forModules: [transcriber]) == .installed else {
                throw HudStreamingTranscriptionError.modelNotInstalled(locale.identifier)
            }
        }
        guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]),
              format.sampleRate.isFinite, (1...192_000).contains(format.sampleRate),
              format.sampleRate.rounded() == format.sampleRate else {
            throw HudStreamingTranscriptionError.unsupportedAudioFormat
        }
        try Task.checkCancellation()
        let analyzer = SpeechAnalyzer(
            modules: [transcriber],
            options: .init(priority: .userInitiated, modelRetention: .whileInUse)
        )
        do {
            try await analyzer.prepareToAnalyze(in: format)
            try Task.checkCancellation()
        } catch {
            await analyzer.cancelAndFinishNow()
            throw error
        }
        return Prepared(
            transcriber: transcriber,
            analyzer: analyzer,
            format: format,
            info: .init(localeIdentifier: locale.identifier, sampleRate: format.sampleRate)
        )
    }

    private static func run(
        prepared: Prepared,
        audio: HudTranscriptionAudioStream,
        input: AsyncThrowingStream<HudTranscriptionAudioChunk, Error>,
        onUpdate: @escaping @Sendable (HudTranscriptUpdate) async throws -> Void
    ) async throws {
        let analyzer = prepared.analyzer
        try await withTaskCancellationHandler {
            try await withThrowingTaskGroup(of: HudTranscriptRevisionNormalizer?.self) { group in
                group.addTask {
                    var revisions = HudTranscriptRevisionNormalizer()
                    for try await result in prepared.transcriber.results {
                        try Task.checkCancellation()
                        try audio.checkForFailure()
                        // Empty revisions matter: they revoke an earlier hypothesis.
                        let finalizationTime = result.resultsFinalizationTime
                        for update in try revisions.receive(
                            Self.update(from: result),
                            finalizedThrough: finalizationTime.isNumeric ? finalizationTime.seconds : nil
                        ) {
                            try await onUpdate(update)
                        }
                    }
                    return revisions
                }
                group.addTask {
                    let sequence = AppleInputSequence(base: input, source: audio, format: prepared.format)
                    let lastSample = try await analyzer.analyzeSequence(sequence)
                    try Task.checkCancellation()
                    try audio.checkForFailure()
                    if let lastSample {
                        try await analyzer.finalizeAndFinish(through: lastSample)
                    } else {
                        await analyzer.cancelAndFinishNow()
                    }
                    return nil
                }
                do {
                    var revisions: HudTranscriptRevisionNormalizer?
                    // waitForAll delays errors until every child exits, which can
                    // deadlock when the failed result handler leaves input open.
                    while let completed = try await group.next() {
                        if let completed { revisions = completed }
                    }
                    try Task.checkCancellation()
                    try audio.checkForFailure()
                    // Apple need not repeat unchanged volatile text as a final
                    // result. Only promote it after BOTH tasks complete cleanly.
                    for update in revisions?.finish() ?? [] {
                        try Task.checkCancellation()
                        try audio.checkForFailure()
                        try await onUpdate(update)
                    }
                    // A handler may return normally after suspension even when
                    // cancel() closed the stream while it was running.
                    try Task.checkCancellation()
                    try audio.checkForFailure()
                } catch {
                    audio.finish(throwing: error)
                    group.cancelAll()
                    await analyzer.cancelAndFinishNow()
                    throw error
                }
            }
        } onCancel: {
            audio.finish(throwing: CancellationError())
            Task { await analyzer.cancelAndFinishNow() }
        }
    }

    private static func update(from result: SpeechTranscriber.Result) throws -> HudTranscriptUpdate {
        let attributed = result.text
        let spans = try attributed.runs.map { run in
            HudTranscriptSpan(
                text: String(attributed[run.range].characters),
                range: try run.audioTimeRange.map(sourceRange)
            )
        }
        return HudTranscriptUpdate(
            range: try sourceRange(result.range),
            text: String(attributed.characters),
            spans: spans,
            isFinal: result.isFinal
        )
    }

    private static func sourceRange(_ range: CMTimeRange) throws -> HudTranscriptTimeRange {
        guard range.isValid, range.start.isNumeric, range.duration.isNumeric,
              let converted = try? HudTranscriptTimeRange(start: range.start.seconds, duration: range.duration.seconds) else {
            throw HudStreamingTranscriptionError.invalidResultTiming
        }
        return converted
    }
}

/// Pull-through adapter: no second audio queue is introduced between caller and analyzer.
@available(macOS 26.0, iOS 26.0, visionOS 26.0, tvOS 26.0, *)
private struct AppleInputSequence: AsyncSequence, Sendable {
    typealias Element = AnalyzerInput
    let base: AsyncThrowingStream<HudTranscriptionAudioChunk, Error>
    let source: HudTranscriptionAudioStream
    let format: AVAudioFormat

    func makeAsyncIterator() -> Iterator {
        Iterator(base: base.makeAsyncIterator(), source: source, format: format)
    }

    struct Iterator: AsyncIteratorProtocol {
        var base: AsyncThrowingStream<HudTranscriptionAudioChunk, Error>.Iterator
        let source: HudTranscriptionAudioStream
        let format: AVAudioFormat
        var previousEnd: CMTime?

        mutating func next() async throws -> AnalyzerInput? {
            try Task.checkCancellation()
            try source.checkForFailure()
            guard let chunk = try await base.next() else {
                try Task.checkCancellation()
                try source.checkForFailure()
                return nil
            }
            try Task.checkCancellation()
            try source.checkForFailure()
            guard chunk.sampleRate == format.sampleRate else {
                throw HudStreamingTranscriptionError.unexpectedSampleRate(expected: format.sampleRate, actual: chunk.sampleRate)
            }
            // Quantize to an actual source sample, rather than introducing a
            // different timebase whose rounding can imply overlapping buffers.
            let start = try HudTranscriptionSampleClock.time(seconds: chunk.startTime, sampleRate: chunk.sampleRate)
            let end = start + CMTime(value: Int64(chunk.samples.count), timescale: CMTimeScale(chunk.sampleRate))
            guard start.isNumeric, end.isNumeric else {
                throw HudStreamingTranscriptionError.invalidTimeRange
            }
            if let previousEnd, start < previousEnd {
                throw HudStreamingTranscriptionError.disorderedAudio
            }
            previousEnd = end
            guard let inputFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: chunk.sampleRate, channels: 1, interleaved: false
            ), let buffer = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: AVAudioFrameCount(chunk.samples.count)),
                  let channel = buffer.floatChannelData?[0] else {
                throw HudStreamingTranscriptionError.unsupportedAudioFormat
            }
            buffer.frameLength = AVAudioFrameCount(chunk.samples.count)
            chunk.samples.withUnsafeBufferPointer { samples in
                if let address = samples.baseAddress { channel.update(from: address, count: samples.count) }
            }
            let output: AVAudioPCMBuffer
            if inputFormat == format {
                output = buffer
            } else {
                // Only encoding/channel conversion at the negotiated rate: no
                // resampling delay or invented change to the caller's timeline.
                guard let converter = AVAudioConverter(from: inputFormat, to: format),
                      let converted = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: buffer.frameLength) else {
                    throw HudStreamingTranscriptionError.unsupportedAudioFormat
                }
                try converter.convert(to: converted, from: buffer)
                guard converted.frameLength == buffer.frameLength else {
                    throw HudStreamingTranscriptionError.unsupportedAudioFormat
                }
                output = converted
            }
            return AnalyzerInput(
                buffer: output,
                // SpeechAnalyzer checks exact sample continuity. Nanosecond
                // rounding can place the next buffer just before the previous
                // one's end; represent time directly on the audio sample clock.
                bufferStartTime: start
            )
        }
    }
}
#endif
