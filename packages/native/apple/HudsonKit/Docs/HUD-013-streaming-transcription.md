# HUD-013 — Continuous transcription with source timing

Status: implemented and locally validated (2026-09-07)

## Intent

Extend HudsonUIAudio's existing transcription capability with continuous,
timestamped recognition. A host supplies audio; Hudson returns provisional and
final text with ranges on the same audio timeline. The first engine is Apple's
SpeechAnalyzer/SpeechTranscriber on iOS and macOS 26. Other engines can implement
the same contract without changing a reader or caption surface.

This does not replace `HudAudioFileTranscriber` or HudsonVoice dictation. Neither
existing consumer needs to migrate to get this additive API.

## Boundary

Hudson owns the transcription contract, Apple engine lifecycle, locale/model
preparation, bounded audio input, and timestamp extraction. A host owns capture
permissions, audio routing, resampling, playback, persistence, and UI.

There is no browser capture, microphone tap, rolling playback buffer, audiobook
provider integration, book matching, cloud fallback, or transcript storage in this
primitive. Linea can build those behaviors around it; other projects need not
adopt them. Recognition stays on device. Model installation may use the network
only when the caller selects the download policy that allows it.

## Contract

- Prepare an engine for a locale before supplying audio. The default policy
  requires installed assets; the host decides when a model download is appropriate.
- Preparation returns the required sample rate. Input is mono Float32 PCM, in
  chunks no longer than one second. Convert browser or microphone audio at the
  host boundary; an encoded WebM fragment is not a PCM chunk.
- Each chunk carries a source start time. Preserve a sample-count-based timeline,
  including silence and gaps. Never derive offsets from request completion time.
- Bounded input fails explicitly on overflow. Dropping old audio silently would
  corrupt the transcript's relationship with playback.
- Updates include their source range, text, finality, and timed text spans.
  Spans preserve Apple's attributed timing; they are not promised to be exactly
  one word each. Missing span timing remains missing, never evenly interpolated.
- Provisional results revise earlier results. Treat them as replacement text,
  not text to append repeatedly. Empty updates can retract provisional text.
- The Apple adapter normalizes implicit finalization and revisions into this
  contract. A same-origin revision supersedes the old hypothesis. Overlapping
  revisions preserve only independently timed residual spans; coarse provisional
  text is discarded rather than assigned invented timing.
- Finishing input drains final recognition results. Canceling discards pending
  analysis. Errors propagate to the caller instead of producing a successful
  but incomplete transcript.

## Consumer integration

```swift
import HudsonUIAudio

let engine: any HudStreamingTranscriber = HudAppleStreamingTranscriber()
let prepared = try await engine.prepare(
    localeIdentifier: "en-US", downloadPolicy: .requireInstalled
)
let audio = try HudTranscriptionAudioStream(bufferCapacity: 32)

let recognition = Task {
    try await engine.transcribe(audio: audio) { update in
        // Send to your actor/UI model. Reconcile revisions by source range.
        // Store only if your product explicitly needs persistence.
        print(update.text, update.isFinal, update.range)
    }
}

// From a serialized, non-realtime producer, supply converted mono Float32 PCM.
// 'samples' contains at most one second at prepared.sampleRate.
try audio.yield(HudTranscriptionAudioChunk(
    samples: samples,
    sampleRate: prepared.sampleRate,
    startTime: sourceTime
))

// At end of source:
audio.finish()
try await recognition.value
```

On capture or transport failure, finish the input with that error. On user
cancellation, cancel recognition and ask the engine to cancel. Hosts should end
the old session before beginning another after a backwards seek. Keep reading
position and audio-source identity outside the recognizer.

A focus reader should drive highlighting from the audio output playhead, not
from the latest recognized text or a wall clock. If playback is delayed, only
play ranges for which the desired recognition stability is available. This
scheduling policy remains in the consumer.

## Local smoke proof

The standalone script accepts a short local audio file (up to two minutes),
converts it to the prepared format, and feeds 100 ms chunks at real-time speed.
It starts at source time 7 seconds and checks that final text includes timed
spans. It does not open a microphone, store transcripts, or call a cloud API.

From the Hudson root:

```sh
xcrun swiftc -swift-version 6 -parse-as-library \
  packages/native/apple/HudsonKit/Sources/HudsonUIAudio/Transcription/*.swift \
  scripts/apple/streaming-transcription-smoke.swift \
  -o /tmp/hudson-streaming-transcription-smoke

/tmp/hudson-streaming-transcription-smoke /absolute/path/to/narration.aiff
```

Add `--allow-model-download` only when model installation is intended. Without
that flag, missing assets are reported rather than downloaded. Run with original
or otherwise authorized audio; this proof does not establish any source service's
integration permissions.

## Validation criteria

- HudsonUIAudio and existing consumers still compile.
- Deterministic tests cover PCM/range validation, overflow, end/error propagation,
  and provisional/final transcript reconciliation.
- The local proof completes with nonempty finalized text and real source timing.
- Cancellation terminates recognition and allows reuse of the engine.
- No recognition/model downloads run implicitly in the unit test suite.

## Validation evidence

On 2026-09-07:

- 161 tests across 35 HudsonUITests suites passed, including 14 new streaming
  transcription tests. Existing audio, permissions, UI, and provider tests pass.
- Production sources and the standalone smoke script compile in Swift 6 mode.
- Production sources typecheck for arm64 iOS 26 Simulator.
- A short original, system-synthesized narration streamed in real time produced
  three finalized segments with 40 timed spans. The supplied seven-second source
  origin was preserved. The engine prepared again after normal EOF, canceled an
  open input stream, and prepared again after cancellation.
- The initial smoke proof used explicit model installation; a second run of the
  same executable passed with installed-only policy. Unit tests do not install
  assets or run recognition. This is a short correctness proof, not a sustained
  audiobook accuracy, latency, or energy benchmark.

The production backend is Apple only. The provider protocol permits future
Parakeet/Nemotron/Qwen adapters; those engines are not bundled or implemented here.
Consumers must select a Hudson revision containing this change. No downstream
dependency pins or application flows were changed by this work.

## References

- [Apple SpeechAnalyzer introduction and timed-result sample](https://developer.apple.com/videos/play/wwdc2025/277/)
- [SpeechTranscriber timing attributes](https://developer.apple.com/documentation/speech/speechtranscriber/resultattributeoption/audiotimerange)
- [Analyzer finalization](https://developer.apple.com/documentation/speech/speechanalyzer/finalizeandfinishthroughendofinput())
- [AssetInventory](https://developer.apple.com/documentation/speech/assetinventory)

Use the installed SDK interface when online documentation describes newer APIs.
