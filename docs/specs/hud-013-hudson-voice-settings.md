# HUD-013 — Hudson voice settings and preferences

**Status**: Draft — **Go for implementation** after Codex review (`ref:8-pxngax`); tighten contracts below before marking Accepted.
**Owner**: Arach
**Targets**: `app/lib/hudsonVoicePreferences.ts`, `app/api/hudson-voice/**`, `packages/web/hudsonkit` voice settings UI, Apple `HudsonVoice`, Hudson Menu / native hosts
**Related**: `specs/hud-012-hudson-voice-daemon.md`, `docs/voice.md`, `packages/web/hudsonkit/src/workspace/shell/HudsonVoiceSettingsEditor.tsx`

## Summary

HUD-012 defines Hudson-owned voice daemon ownership and the live-session API. **HUD-013 completes the operator settings layer**: persisted capture preferences, real device enumeration, a settings API, web UI for input/capture, and native settings surfaces that any Hudson host can ship.

The goal is that a user can configure voice once in Hudson and have web + native surfaces agree on microphone, capture mode, model, and language without opening Vox or editing JSON by hand.

```
Hudson Web settings UI ──┐
Native settings view  ───┼──> preferences.json (Hudson/Voice)
                         │         │
                         │         └── mirror ──> Hudson/Vox/preferences.json
                         │
Hudson API proxy ────────┴──> RPC to embedded runtime (devices, live sessions)
```

## Problem on `main` today

| Area | `main` behavior | Gap |
|------|-----------------|-----|
| `GET /v1/voice/devices` | Returns `{ devices: [] }` | No real enumeration |
| `PUT /v1/voice/devices/default` | Echoes `deviceId`, empty list | No persistence |
| Settings API | Missing | No Hudson preference contract |
| `HudsonVoiceSettingsEditor` | Reply/TTS only | No mic, mode, model, or runtime status |
| Native `HudsonVoice` | `HudVoicePanel`, `HudVoxLiveSession` | No preferences store, device helpers, or settings view |
| Host lifecycle | `HudsonVoiceDaemonHost` in Hudson Menu | Does not load/mirror preferences on start; no reusable `HudsonVoiceRuntimeHost` for other native apps |

HUD-012 remains **Draft**; this spec is the settings slice that makes the daemon usable as a product surface.

## Decisions

1. **Hudson owns preference storage** at `~/Library/Application Support/Hudson/Voice/preferences.json` (mode `0600`, directory `0700`).
2. **Mirror into embedded Vox home** at `~/Library/Application Support/Hudson/Vox/preferences.json` on every write so the runtime picks up device/model defaults without web callers touching Vox paths directly.
3. **Web never writes Vox files** — only the Node preferences module (API routes) and native Swift preference APIs write disk.
4. **Device enumeration is native-first** — Swift uses `AVCaptureDevice`; the Next proxy forwards RPC/`health` enrichment. Web lists devices only through `/api/hudson-voice/v1/voice/devices`.
5. **Two settings domains stay separate** (see [Settings merge precedence](#settings-merge-precedence)):
   - `HudsonVoicePreferences` on disk — capture/input source of truth
   - `VoiceSettings` (shell/localStorage) — UI cache for capture fields **plus** reply speech (provider, voice, rate, behavior presets)
   Web UI shows both in one editor but persists capture fields through the Hudson API, not only localStorage.
6. **`HudsonVoiceRuntimeHost`** — reusable in-process Vox host for native apps (HudsonKit Lab, future shells). Hudson Menu keeps `HudsonVoiceDaemonHost` but shares preference + capability file shape with the kit host.
7. **No standalone Vox dependency** for first-party settings paths.

## Settings merge precedence

| Layer | Role | Precedence |
|-------|------|------------|
| `~/Library/.../Hudson/Voice/preferences.json` | Capture source of truth | **Wins** for `preferredInputDeviceId`, `mode`, `preferredTranscriptionModelId`, `preferredLanguage` |
| `VoiceSettings` in shell localStorage | Fast UI + reply speech | Hydrate capture fields from `GET /v1/voice/settings` on editor mount; write capture changes via API first, then mirror into `VoiceSettings` |
| Embedded Vox mirror | Runtime consumption | Write-only derivative; never read back by web |

On editor load:

1. `GET /api/hudson-voice/health` (runtime + permission summary)
2. `GET /api/hudson-voice/v1/voice/settings` (disk preferences)
3. `GET /api/hudson-voice/v1/voice/devices` (device list payload)
4. Merge into `VoiceSettings` capture fields (`inputDeviceId`, `captureMode`, `transcriptionModel`, `transcriptionLanguage`)

`VoiceSettings` already defines capture fields in `packages/web/hudsonkit/src/types/voice.ts`; HUD-013 wires them to Hudson disk, not new types.

Live sessions (`WorkspaceAI`, `useHudsonVoiceInput`, `useVoiceInput`) read **merged** `VoiceSettings` at session start. Disk preferences must be reflected there after hydration.

## Device enumeration contract

v1 does **not** require the embedded Vox runtime to enumerate macOS devices. Enumeration is **host-native**:

| Runtime state | `GET /v1/voice/devices` behavior |
|---------------|----------------------------------|
| Any | Always includes persisted `selectedDeviceId` + `settings` from disk |
| Hudson Menu / native host running | Host may enrich via `AVCaptureDevice` locally; web API returns preference-backed list until a host-side bridge exports full enumeration |
| Runtime up, RPC exposes devices later | Optional future: `callHudsonVoiceRuntimeRpc('devices.list')` with native fallback |

`PUT /v1/voice/devices/default`:

- `deviceId: null` → clear preference (system default)
- Non-null → accept id (v1: trust client; native settings UI validates against `AVCaptureDevice`)
- v1.1: reject unknown ids when a host enumeration list is available in the same process

Unavailable runtime: device routes **still succeed** (preferences-only); live sessions fail separately with `runtime_missing`.

## Concurrency and atomic writes

- All writers use **atomic replace** (`writeFileSync(..., { flag: 'w' })` / `Data.write(..., .atomic)`).
- Directory mode `0700`, file mode `0600`.
- **Last writer wins** for the Hudson preferences file; no file locking in v1.
- Native host and web API may write the same file; both must read-merge-write the full document (no blind patch files).
- Vox mirror is rewritten on every Hudson preference save; treat it as derived state.

## Validation (`PUT /v1/voice/settings`)

| Field | Rule |
|-------|------|
| `mode` | `push_to_talk` or `always_on` only; ignore/reject others with `400` |
| `preferredLanguage` | Non-empty string ≤ 16 chars |
| `preferredTranscriptionModelId` | Non-empty string ≤ 128 chars |
| `preferredInputDeviceId` / `preferredOutputDeviceId` | `null` or non-empty string |
| Unknown keys | Ignored |

## Preference schema (v1)

Path: `~/Library/Application Support/Hudson/Voice/preferences.json`

```json
{
  "schemaVersion": 1,
  "preferredInputDeviceId": null,
  "preferredOutputDeviceId": null,
  "preferredTranscriptionModelId": "parakeet:v3",
  "preferredSynthesisModelId": null,
  "preferredLanguage": "en",
  "mode": "push_to_talk"
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `preferredInputDeviceId` | `string \| null` | `null` | `null` = system default mic |
| `preferredOutputDeviceId` | `string \| null` | `null` | Reserved; not exposed in v1 UI |
| `preferredTranscriptionModelId` | `string \| null` | `parakeet:v3` | Passed to live session RPC |
| `preferredSynthesisModelId` | `string \| null` | `null` | Mirror hook for Vox TTS prefs |
| `preferredLanguage` | `string \| null` | `en` | BCP-47-ish hint |
| `mode` | `push_to_talk \| always_on` | `push_to_talk` | Default session mode |

Embedded Vox mirror (written atomically on save):

```json
{
  "speech": {
    "preferredTranscriptionModelId": "parakeet:v3",
    "preferredSynthesisModelId": null,
    "preferredInputDeviceId": null
  }
}
```

Env overrides (tests + CI):

| Variable | Purpose |
|----------|---------|
| `HUDSON_VOICE_PREFERENCES_PATH` | Override Hudson preferences file |
| `HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH` | Override Vox mirror path |
| `HUDSON_VOICE_RUNTIME_PATH` | Existing runtime capability file (HUD-012) |

## API additions (v1)

All routes stay under `/api/hudson-voice`, same-origin only.

### `GET /v1/voice/settings`

Returns `{ settings: HudsonVoicePreferences }` from disk (defaults if missing).

### `PUT /v1/voice/settings`

Body: `{ settings: Partial<HudsonVoicePreferences> }` (flat keys also accepted).

Returns merged normalized `{ settings }`. Writes Hudson file + Vox mirror.

### `GET /v1/voice/devices` (replace stub)

Returns:

```json
{
  "devices": [
    { "id": "…", "name": "MacBook Pro Microphone", "isDefault": true, "isSelected": false }
  ],
  "selectedDeviceId": "…",
  "defaultDeviceId": "…"
}
```

Implementation: RPC to embedded runtime when available; enrich from `readHudsonVoicePreferences()` for selection. Native host may also answer via health `input` block.

### `PUT /v1/voice/devices/default` (replace stub)

Body: `{ deviceId: string | null }`.

Validates device exists when non-null, updates `preferredInputDeviceId`, mirrors to Vox, returns device list payload.

### `GET /health` enrichment

Include:

```json
{
  "permissions": { "microphone": "granted" },
  "input": {
    "selectedDeviceId": "…",
    "selectedDeviceName": "…"
  },
  "settings": { /* HudsonVoicePreferences subset */ }
}
```

## Web UI (`HudsonVoiceSettingsEditor`)

Add a **Capture** section above existing reply controls:

| Control | Binds to | Persists via |
|---------|----------|--------------|
| Runtime status row | `GET /health` | read-only |
| Microphone permission | `health.permissions.microphone` | read-only + link copy |
| Input device | `VoiceSettings.inputDeviceId` + devices API | `PUT …/devices/default` + preferences |
| Capture mode | `VoiceSettings.captureMode` | `PUT …/settings` (`mode`) |
| Transcription model | select | `PUT …/settings` |
| Language | select | `PUT …/settings` |

Existing reply/TTS section unchanged (provider, model, voice preview, behavior presets).

`useVoiceInput` / `useHudsonVoiceInput` / `WorkspaceAI` pass `deviceId`, `modelId`, `language`, `mode` from hydrated `VoiceSettings` when starting live sessions.

## Native (`HudsonVoice` Swift module)

New public types:

| Type | Responsibility |
|------|----------------|
| `HudsonVoicePreferences` | Codable store + load/save + Vox mirror |
| `HudsonVoiceAudioDevices` | `AVCaptureDevice` enumeration + set preferred input |
| `HudsonVoiceRuntime` | Read/validate `hudson-voice-runtime.json` capability |
| `HudsonVoiceRuntimeHost` | Start/stop embedded `VoxRuntimeService`, write capability, persist prefs on start |
| `HudsonVoiceSettingsView` | SwiftUI settings: runtime status, mic permission, input/mode/model/language |

`Package.swift`: add `VoxService` product to `HudsonVoice` target (already used by Hudson Menu host).

### Host integration

| Host | Change |
|------|--------|
| **Hudson Menu** (`HudsonVoiceDaemonHost`) | On start: load preferences, mirror to Vox, apply device RPC defaults; expose settings entry |
| **HudsonKit Lab / embedders** | May use `HudsonVoiceRuntimeHost.shared` instead of duplicating daemon bootstrap |

Error copy: prefer **"Launch the host app"** over **"Launch Hudson Menu"** when the kit must work outside Menu-only branding.

## Data flow

### Save input device (web)

1. User picks mic in `HudsonVoiceSettingsEditor`
2. `PUT /api/hudson-voice/v1/voice/devices/default`
3. Node writes `preferences.json` + Vox mirror
4. Optional RPC to runtime to apply active input route
5. UI refreshes `GET /devices` + `GET /health`

### Start live session

1. Caller (`WorkspaceAI`, terminal, `useHudsonVoiceInput`) reads merged settings
2. `POST /v1/voice/live` body includes `modelId`, `language`, `mode`, `deviceId` when set
3. Proxy forwards to embedded Vox JSON-RPC with auth token from capability file

## Out of scope (v1)

- Output device picker UI (field reserved in schema)
- `/v1/voice/models` catalog endpoint (hardcode Parakeet v3 + passthrough custom id)
- iOS background audio / always-on policy beyond enum storage
- Replacing `HudsonVoiceDaemonHost` entirely with `HudsonVoiceRuntimeHost` in Menu (share logic, keep Menu-specific lifecycle UI)
- Windows/Linux hosts

## Acceptance criteria

1. With Hudson Menu running, `GET /api/hudson-voice/v1/voice/devices` returns ≥1 real device on macOS.
2. Selecting a mic in web settings survives reload and is reflected in `GET /health` `input`.
3. `PUT /v1/voice/settings` updates mode/model/language; live sessions inherit defaults.
4. `HudsonVoiceSettingsView` in HudsonKit Demo/Lab shows the same preferred input as web.
5. Preferences file permissions: dir `0700`, file `0600`.
6. Unit tests: `hudsonVoicePreferences` normalize/mirror; device route validation; preferences round-trip; invalid `mode` rejected.
7. Integration: editor hydration from `GET /settings`; offline health returns structured error without corrupting disk.
8. No regression to existing reply/TTS settings or live NDJSON session stream.

## Codex review (2026-06-19)

**Verdict:** No-go for Accepted until contracts above landed; **go** to implement with those additions.

Incorporated feedback: settings precedence, device enumeration ownership, atomic write semantics, validation table, existing `VoiceSettings` fields.

## Implementation plan

1. Land `app/lib/hudsonVoicePreferences.ts` + tests
2. Replace device/settings API stubs with real handlers
3. Enrich health + wire live route defaults from preferences
4. Extend `HudsonVoiceSettingsEditor` capture section
5. Add Swift preferences, devices, runtime reader, runtime host, settings view
6. Integrate Hudson Menu host start path + `Package.swift` dependency
7. Update `docs/voice.md` settings section; mark HUD-013 **Accepted** when shipped

## Provenance

Recovered from branch commit `93539f9` (*Add Hudson-owned voice runtime settings*) plus stashed WIP:

- `HudsonVoiceRuntimeHost.swift`
- `HudsonVoiceSettingsView.swift`
- `Package.swift` (`VoxService` link)
- Minor `HudsonVoiceRuntime.swift` error-string tweak
