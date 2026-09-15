# HudSpeechCache and HudSpeechPlayerSession API

Status: assignment spec for `codex/shared-speech` (isolated copy `/tmp/hudson-shared-speech`). Do not implement in the primary Hudson checkout.

Date: 2026-09-14

Depends on: SpeakEasy mapping in the prior investigation. This document is the concrete API. Implement this, not a second cache or a pause/seek patch on `HudSpeechPlayback`.

## Decision

1. **Cache** lives in `HudsonUIAudio` as `HudSpeechCache`. The key must include provider, model, voice, synthesis rate, instructions, and voice settings. Lattices `handsoff-worker` keys `kokoro_${sanitizedPhrase}.wav` and omits voice/settings. That key is invalid for the shared cache.
2. **Queued playback with pause/seek** is a new `HudSpeechPlayerSession` built on `HudSpeechPlayer`. Do not add pause, seek, queue, or volume to `HudSpeechPlayback`.
3. **`HudSpeechPlayback` stays** the per-surface Vox utterance API (`speak` replaces current, `stop`/`cancel` only). Apps that want "say this now and replace" keep using it.
4. **Lattices hosts** the session and the Unix socket. Hands-Off later reads `HudSpeechCache` with a full key; do not keep `~/.lattices/tts-cache` as the shared format.

## Why these two types

Verified current behavior:

| Type | Pause/seek | Queue | Cache | Vox | Role |
| --- | --- | --- | --- | --- | --- |
| `HudSpeechPlayer` | yes (`pauseOrResume`, `seek(to:)`, `play(data:)`, `play(fileURL:)`) | no | no | no | In-process AVAudioPlayer wrapper |
| `HudTTS` | yes, via `HudSpeechPlayer` | no | no | no | Cloud/system speak helper |
| `HudSpeechPlayback` | no (documented: no pause/seek, no singleton) | no | no | yes | Replace-current Vox output |
| SpeakEasy `PlaybackEngine` | yes | yes | no (cache is TS) | no | Product player |
| Lattices `handsoff-worker` | `afplay` | no | phrase filename only | yes, Kokoro | Canned acks |

`HudSpeechPlayer` is the playback primitive. `HudSpeechPlayback` is the generation+output controller. Mixing them would break the Vox event contract (`HudSpeechPlaybackEvent` phases: resolving → generating → starting → playing → finished/cancelled/failed).

---

## Slice 1. `HudSpeechCache`

Module: `HudsonUIAudio`.
Files:

- `packages/native/apple/HudsonKit/Sources/HudsonUIAudio/TTS/Cache/HudSpeechCache.swift`
- `packages/native/apple/HudsonKit/Tests/HudsonUITests/HudSpeechCacheTests.swift`

No Vox import. No SQLite in v1 (SpeakEasy uses SQLite because it is Node; Hudson stays Foundation).

### Key

```swift
public struct HudSpeechCacheKey: Hashable, Sendable, Codable, Equatable {
    public var text: String
    public var providerID: String
    public var modelID: String
    public var voiceID: String
    public var rate: Double
    public var instructions: String
    public var voiceSettings: HudTTSVoiceSettings?
    public var format: HudTTSAudioFormat?

    public init(
        text: String,
        providerID: String,
        modelID: String,
        voiceID: String,
        rate: Double = 1.0,
        instructions: String = "",
        voiceSettings: HudTTSVoiceSettings? = nil,
        format: HudTTSAudioFormat? = nil
    )
}
```

Canonical digest (the on-disk identity):

1. Trim text, NFC-normalize, lowercase for the digest only. Store the original trimmed text in metadata.
2. Trim `providerID`, `modelID`, `voiceID`. Empty `voiceID` or `modelID` is invalid; `lookup`/`store` throw `HudSpeechCacheError.incompleteKey`.
3. `instructions`: trim; missing and `""` are the same.
4. `rate`: format with `String(format: "%.3f", rate)` so `1` and `1.0` match.
5. `voiceSettings`: include only non-nil fields, keys in this order: `stability`, `similarityBoost`, `style`, `useSpeakerBoost`. Omit the object when every field is nil.
6. `format`: include the raw value when the caller requested a format. Omit when nil.
7. UTF-8 payload, one line, pipe-separated, stable field order:

```
v1|{text}|{providerID}|{modelID}|{voiceID}|{rate}|{instructions}|{voiceSettingsJSON or ""}|{format or ""}
```

8. SHA-256 hex of that payload. Use the full 64-character hex as `digest`. File name is `"{digest}.{ext}"`.

Do **not** use SpeakEasy UUID v5. Do **not** use Lattices `phrase.replace(/[^a-z]/gi, "_")`.

Not part of the key:

- `playbackRate`, `volume`, `sourceThreadID`, hostname, pid, cwd
- credential values
- word timings

### Entry and stats

```swift
public struct HudSpeechCacheEntry: Sendable, Equatable {
    public var digest: String
    public var key: HudSpeechCacheKey
    public var fileURL: URL
    public var format: HudTTSAudioFormat
    public var byteCount: Int
    public var createdAt: Date
    public var originalText: String
}

public struct HudSpeechCacheStats: Sendable, Equatable {
    public var entries: Int
    public var bytes: Int
    public var hits: Int
    public var misses: Int
}

public enum HudSpeechCacheError: Error, LocalizedError, Equatable {
    case incompleteKey
    case emptyAudio
    case corruptIndex
    case io(String)
}
```

### Actor

```swift
public actor HudSpeechCache {
    public static let defaultTTL: TimeInterval = 7 * 24 * 60 * 60
    public static let defaultMaxBytes: Int = 100 * 1024 * 1024

    public init(
        directory: URL? = nil,
        ttl: TimeInterval = HudSpeechCache.defaultTTL,
        maxBytes: Int = HudSpeechCache.defaultMaxBytes
    )

    public func lookup(_ key: HudSpeechCacheKey) async throws -> HudSpeechCacheEntry?
    public func store(
        _ key: HudSpeechCacheKey,
        data: Data,
        format: HudTTSAudioFormat
    ) async throws -> HudSpeechCacheEntry
    public func stats() async -> HudSpeechCacheStats
    public func removeExpired() async throws
}
```

Default directory: `~/Library/Caches/Hudson/Speech/`.
Layout:

```
~/Library/Caches/Hudson/Speech/
  index.json          # 0600
  <digest>.wav|mp3|caf
```

`index.json` schema version `1`:

```json
{
  "version": 1,
  "hits": 0,
  "misses": 0,
  "entries": {
    "<digest>": {
      "digest": "<digest>",
      "file": "<digest>.wav",
      "format": "wav",
      "byteCount": 1234,
      "createdAt": "2026-09-14T00:00:00Z",
      "originalText": "Got it.",
      "key": {
        "text": "got it.",
        "providerID": "mlx-audio",
        "modelID": "mlx-community/Kokoro-82M-bf16",
        "voiceID": "af_heart",
        "rate": 1.0,
        "instructions": "",
        "voiceSettings": null,
        "format": "wav"
      }
    }
  }
}
```

Behavior:

- `lookup`: miss increments `misses` and returns nil. Hit requires the audio file to exist and not exceed TTL. Missing file or expiry deletes the index row, increments `misses`, returns nil. Do not throw on miss.
- `store`: reject empty `Data` (`emptyAudio`). Write the audio file `0600`, then update `index.json` atomically (write temp, rename). Then evict oldest entries until `bytes <= maxBytes`.
- Corrupt `index.json`: throw `corruptIndex` on `lookup`/`store`. Do not delete audio files automatically.
- System/`avspeech` callers pass `cacheable: false` at the synthesizer layer. The cache actor itself does not special-case provider IDs.

### Wire into existing doors

`HudTTSResult` and `HudSpeechAudio` gain `public var cached: Bool = false`. Existing memberwise inits keep compiling with a default of `false`.

`HudTTS.synthesize` (not `HudTTSClient.synthesize`):

1. If `providerID == .system`, skip cache (SpeakEasy already disables system cache).
2. Else build `HudSpeechCacheKey` from the request (`providerID.rawValue`, `model ?? adapter default`, `voice ?? adapter.defaultVoice`, `rate`, `instructions ?? ""`, `voiceSettings`).
3. `lookup`. On hit, return `HudTTSResult(..., cached: true)` without calling the client.
4. On miss, `client.synthesize`, `store`, return `cached: false`.

`HudSpeechSynthesizer.synthesize`:

1. Skip cache when `provider == .system`.
2. Else key with `provider.providerId`, `modelId`, `voiceId ?? ""` (empty voice is incompleteKey; require a resolved voice before lookup, matching current Vox default-voice resolution after generate if needed). Practical rule: resolve voice first (existing `voices(modelId:)` default), then lookup.
3. Same hit/miss path. Set `HudSpeechAudio.cached`.

`HudTTSClient` stays a pure network door so credits can wrap generate vs cache at `HudTTS.synthesize`.

Web `HudsonVoxSpeechResponse.cached` currently hardcoded `false` in `apps/web/app/lib/tts/voxBridge.ts`. After native reports the flag, copy it. Not required to land in the same PR as the Swift cache.

### Lattices Hands-Off (later, isolated lattices copy)

Replace:

```
~/.lattices/tts-cache/kokoro_${phrase.replace(/[^a-z]/gi, "_").toLowerCase()}.wav
```

with `HudSpeechCacheKey(text: phrase, providerID: "mlx-audio", modelID: KOKORO_MODEL_ID, voiceID: KOKORO_VOICE_ID, rate: 1, format: .wav)`.

Until the Swift cache exists, do not invent a second JS hash. The worker can keep its local warmup files, but they are not the shared cache.

---

## Slice 2. `HudSpeechPlayerSession`

Module: `HudsonUIAudio`.
Files:

- `packages/native/apple/HudsonKit/Sources/HudsonUIAudio/TTS/Playback/HudSpeechPlayerSession.swift`
- `packages/native/apple/HudsonKit/Sources/HudsonUI/Primitives/HudSpeechPlaybackHUD.swift` (view only; session stays in UIAudio)
- `packages/native/apple/HudsonKit/Tests/HudsonUITests/HudSpeechPlayerSessionTests.swift`

`HudSpeechPlayback` / `HudsonVoice` are not modified in this slice.

### Small extension to `HudSpeechPlaying`

Today the protocol is `isPlaying`, `currentTime`, `duration`, `play(data:)`, `play(fileURL:)`, `pauseOrResume()`, `seek(to:)`, `stop()`.

Add, with defaults implemented on `HudSpeechPlayer`:

```swift
var volume: Float { get set }          // 0...1, default 0.8
var playbackRate: Float { get set }    // 0.5...2.0, default 1.0; set enableRate on AVAudioPlayer
var audioLevel: Float { get }          // 0...1, 0 when not playing

func pause()
func resume() throws
```

Keep `pauseOrResume()` as a wrapper so `HudTTS` does not change. `pause()` is a no-op when already paused or idle. `resume()` throws `HudTTSError.playbackFailed` if there is no adopted player.

`audioLevel`: enable `isMeteringEnabled` on `AVAudioPlayer`, `updateMeters()`, map `averagePower(forChannel: 0)` from about -40 dB...0 dB into 0...1. Do not import `HudsonKitExperimental`.

Queue does **not** belong on `HudSpeechPlayer`.

### Session

```swift
public enum HudSpeechPlayerState: String, Sendable, Codable, Equatable {
    case idle, loading, playing, paused, failed
}

public enum HudSpeechQueuePriority: String, Sendable, Codable, Equatable {
    case high, normal, low
}

public struct HudSpeechQueueItem: Identifiable, Sendable, Equatable, Codable {
    public var id: UUID
    public var fileURL: URL
    public var title: String
    public var text: String?
    public var providerID: String?
    public var modelID: String?
    public var voiceID: String?
    public var cacheDigest: String?
    public var createdAt: Date
    public var sourceThreadID: String?
    public var synthesisRate: Double?
}

@MainActor
@Observable
public final class HudSpeechPlayerSession {
    public private(set) var state: HudSpeechPlayerState
    public private(set) var currentItem: HudSpeechQueueItem?
    public private(set) var queue: [HudSpeechQueueItem]
    public private(set) var currentTime: TimeInterval
    public private(set) var duration: TimeInterval
    public private(set) var audioLevel: Float
    public private(set) var lastError: String?

    public var volume: Float                 // mirrors player
    public var playbackRate: Float           // mirrors player; not a cache key
    public var autoplayEnabled: Bool

    public init(player: any HudSpeechPlaying = HudSpeechPlayer())

    public func enqueue(
        _ item: HudSpeechQueueItem,
        priority: HudSpeechQueuePriority = .normal,
        interrupt: Bool = false,
        autoplay: Bool? = nil
    ) throws

    public func pause()
    public func resume() throws
    public func togglePlayback() throws
    public func stop()
    public func skip() throws
    public func seek(to time: TimeInterval) -> Bool
    public func clearQueue()
    public func remove(id: UUID)
}
```

Enqueue rules (match SpeakEasy `PlaybackEngine`, minus completion channels):

- `fileURL` must be absolute and exist, else throw `HudTTSError.playbackFailed`.
- `interrupt: true` stops current, inserts at front.
- `priority == .high` inserts at front; `.normal`/`.low` append. v1 may treat `.low` as append (SpeakEasy does).
- If `(autoplay ?? autoplayEnabled)` and nothing is current, start the next item.
- Starting an item sets `state = .loading`, calls `player.play(fileURL:)`, then `.playing`.
- Player completion starts the next queued item when `autoplayEnabled`.
- `stop()` clears current playback, keeps the queue.
- `skip()` stops current and starts next.
- `clearQueue()` does not stop current.
- `sourceThreadID` is an opaque string. The HUD may show a control; Codex URL construction stays in the host.

Do not add SpeakEasy `PlaybackChannel` / `completionActivityID` in v1.

### HUD view

```swift
public struct HudSpeechPlaybackHUD: View {
    public init(session: HudSpeechPlayerSession)
}
```

Required chrome:

- title of `currentItem`
- spoken `text` with a progress indication from `currentTime` / `duration` (character-index estimate is enough; word timings are optional)
- pause / resume / stop / skip
- scrubber bound to `seek(to:)`
- optional `sourceThreadID` caption, not a Codex deep link inside Hudson

Use `HudPalette` / `HudFont` / `HudButton`. No purple.

### Socket (Lattices binds, Hudson defines)

Path: `/tmp/hudson-speech-player-\(getuid()).sock` so MCP/plugin can find it without Application Support probing. Document the path as `HudSpeechPlayerSocket.defaultPath`.

Protocol version `1`. One JSON object per line. Same command set as SpeakEasy `src/player-protocol.ts`, Hudson field names:

```json
{
  "protocolVersion": 1,
  "requestId": "UUID",
  "command": "enqueue",
  "arguments": {
    "item": {
      "id": "UUID",
      "fileURL": "/absolute/path.wav",
      "title": "Ack",
      "text": "Got it.",
      "providerID": "mlx-audio",
      "modelID": "mlx-community/Kokoro-82M-bf16",
      "voiceID": "af_heart",
      "cacheDigest": "optional hex",
      "createdAt": "2026-09-14T00:00:00Z",
      "sourceThreadID": null,
      "synthesisRate": 1.0
    },
    "priority": "normal",
    "interrupt": false,
    "autoplay": true
  }
}
```

Commands: `enqueue`, `pause`, `resume`, `togglePlayback`, `stop`, `skip`, `seek`, `setVolume`, `setPlaybackRate`, `removeQueueItem`, `clearQueue`, `status`.

Response always includes `ok`, `requestId`, and a snapshot (`state`, `currentItem`, `queue`, `currentTime`, `duration`, `volume`, `playbackRate`, `autoplayEnabled`, `audioLevel`). Errors are stable strings: `file_missing`, `path_not_absolute`, `player_unavailable`, `invalid_command`.

Socket server code may live in HudsonUIAudio as `HudSpeechPlayerSocketServer` so Lattices only binds and retains it. If that pulls unwanted networking into UIAudio, put the server in `HudsonVoice` but keep the session type in UIAudio. Prefer UIAudio so SpeakEasy.app can adopt without linking Vox.

v1 of this slice can ship session + HUD without the socket. The socket is required before MCP and the Codex plugin retarget.

---

## Explicit non-goals for these two slices

- Editing `HudSpeechPlayback` (`speak`/`stop`/`cancel` only).
- Adding Groq/Gemini/NVIDIA adapters.
- SpeakEasy plugin retarget.
- MCP server.
- Promoting `HudLevelMeter`.
- Migrating `~/.lattices/tts-cache` in the same PR as `HudSpeechCache` (follow-up in `/tmp/lattices-shared-speech`).
- `afplay` fallback.

## Tests

Cache (`HudSpeechCacheTests`):

- Same text/provider/model/voice/rate/instructions/settings/format → same digest.
- Voice change, settings change, model change, instructions change → different digest.
- Empty voice or model → `incompleteKey`.
- Store then lookup returns `cached` bytes and increments hits.
- Expired entry is a miss and the index row is removed.
- `rate` 1 vs 1.0 vs 1.000 collide.
- Text case and surrounding whitespace collide; stored `originalText` keeps the first stored trimmed original.
- Empty data → `emptyAudio`.
- `maxBytes` evicts the oldest file.

Player (`HudSpeechPlayerSessionTests`), reuse `silentWAV()` from `HudSpeechPlayerTests`:

- Enqueue with autoplay starts playing.
- Pause then resume keeps the same item and advances `currentTime` only while playing.
- Seek while paused updates `currentTime`.
- Skip starts the next item.
- Interrupt replaces current and plays the new item.
- Missing file throws and leaves state idle/failed without crashing.
- Stale finish of a replaced player does not complete the new item (existing `HudSpeechPlayer` test must still pass).

Do not call paid TTS.

```bash
cd /tmp/hudson-shared-speech
swift test --filter HudSpeechCacheTests
swift test --filter HudSpeechPlayerTests
swift test --filter HudSpeechPlayerSessionTests
swift test --filter HudTTSSpeakTests
swift test --filter HudSpeechPlaybackTests
```

`HudSpeechPlaybackTests` must stay green and unchanged.

## Implementation order in this worktree

1. `HudSpeechCache` + tests.
2. `cached` on `HudTTSResult` / `HudSpeechAudio`; wrap `HudTTS.synthesize` only.
3. `HudSpeechPlaying` volume/rate/level/pause/resume; `HudSpeechPlayerSession` + tests.
4. `HudSpeechPlaybackHUD`.
5. Optional in the same worktree: wrap `HudSpeechSynthesizer.synthesize`. Stop before Lattices/MCP unless assigned.

## Assignment boundary

Primary checkout: `/Users/arach/dev/hudson` (do not edit).
Implement here: `/tmp/hudson-shared-speech` on `codex/shared-speech`.
Lattices follow-up: `/tmp/lattices-shared-speech`.
