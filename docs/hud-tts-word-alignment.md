# HudTTS: surface word-level alignment from synthesis

**Requested by:** Linea (macOS/iOS reader). Linea's read-along highlights the
sentence being spoken and follows the voice down the page. Word-level
following is blocked here: `HudTTSResult` carries only audio, so word timings
never leave HudsonKit, and Linea falls back to estimated words-per-minute
timing for its cues.

## The waste this fixes

`EdgeReadAloudHudTTSProvider` already requests word boundaries on the wire —
`speech.config` is sent with `"wordBoundaryEnabled": "true"` — and then
discards every `audio.metadata` frame the service sends back
(`case "audio.metadata", "response", "turn.start": continue`). The timings
arrive today and are dropped on the floor.

## API change

Extend `HudTTSResult` (in `HudsonUIAudio/TTS/HudTTSTypes.swift`) with an
optional alignment, defaulted so no existing call site or adapter breaks:

```swift
public struct HudTTSWordTiming: Equatable, Sendable {
    public var word: String
    /// Seconds from the start of the returned audio.
    public var start: TimeInterval
    public var end: TimeInterval
}

public struct HudTTSResult: Equatable, Sendable {
    public var audioData: Data
    public var format: HudTTSAudioFormat
    public var providerID: HudTTSProviderID
    public var voice: String
    /// Word-level timings, when the provider produced them. Nil is normal:
    /// most providers return none, and callers must not require it.
    public var wordTimings: [HudTTSWordTiming]?
}
```

Thread it through `HudTTSProviderAdapter` / `HudTTSClient` however fits the
existing seams — the contract that matters is: an adapter that has timings
puts them on the result; every other adapter changes nothing.

## Edge Read Aloud (the required provider)

Parse the `audio.metadata` text frames instead of skipping them. Each frame's
body is JSON of the shape:

```json
{"Metadata":[{"Type":"WordBoundary","Data":{
  "Offset": 1000000, "Duration": 4500000,
  "text": {"Text": "word", "Length": 4, "BoundaryType": "WordBoundary"}}}]}
```

`Offset`/`Duration` are in 100-nanosecond ticks from the start of the audio
(divide by 10_000_000 for seconds). Ignore non-`WordBoundary` entries.
Verify the offsets against the actual audio once on a real synthesis — Edge
has a known fixed lead-in quirk on some output formats; if the first word's
offset is visibly late/early against playback, correct with the measured
constant and record it in a comment.

## ElevenLabs (stretch, separate commit if done)

`POST /v1/text-to-speech/{voice_id}/with-timestamps` returns base64 audio
plus character-level alignment. Word timings can be assembled by grouping the
character alignment at whitespace. Only worth doing if the endpoint swap is
clean — the adapter currently uses the plain endpoint.

## Acceptance

- Edge synthesis on macOS returns `wordTimings` covering the input text in
  order, monotonically non-decreasing, in seconds.
- All other providers return `wordTimings == nil` and behave exactly as
  before; existing tests pass unchanged.
- A unit test feeds a canned `audio.metadata` frame (recorded from a real
  session) through the parser and asserts words + seconds.
- No public API removed; the new field is additive with a default.

## Consumer note (Linea side, not this task)

Linea maps this into its `AudioAlignment { source, words: [{word, start, end}] }`
and persists it beside the cached audio chunk. That wiring is Linea's to do
once this lands; nothing in HudsonKit should know about Linea's cache.
