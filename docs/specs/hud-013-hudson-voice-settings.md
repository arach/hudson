# HUD-013 — Hudson voice settings and preferences

**Status**: Draft (implementing on `work/hud-013-voice-settings`)
**Owner**: Arach
**Depends on**: `specs/hud-012-hudson-voice-daemon.md` (daemon + live session transport)
**Targets**: `app/lib/hudsonVoicePreferences.ts`, `app/api/hudson-voice/**`, `packages/web/hudsonkit`, `packages/native/apple/HudsonKit/Sources/HudsonVoice`, Hudson Menu host

## Summary

HUD-013 adds the **operator settings layer** on top of HUD-012: persisted capture preferences, a settings API, web + native settings UI, and a native→web device cache so microphone pickers work without standalone Vox.

```
Web HudsonVoiceSettingsEditor ──┐
Native HudsonVoiceSettingsView ──┼── preferences.json  (Hudson/Voice)
Hudson Menu / API routes      ───┘         │
                                           └── mirror ──► Vox/preferences.json
Native host (AVCaptureDevice) ──► input-devices.json (read by web GET /devices)
```

## Terminology

| Name | Where | Role |
|------|-------|------|
| **`HudsonVoicePreferences`** | `app/lib/hudsonVoicePreferences.ts`, `HudsonVoice/HudsonVoicePreferences.swift` | Canonical capture prefs (disk JSON) |
| **`HudsonVoiceHostPreferences`** | `HudsonVoiceDaemonHost.swift` (Hudson Menu) | Same JSON shape as kit prefs; Menu-local type until Menu imports HudsonKit prefs |
| **`VoiceSettings`** | `packages/web/hudsonkit/src/types/voice.ts` | Shell UI state: capture fields **+** reply/TTS fields; capture fields hydrate from disk |
| **`hudson-voice-runtime.json`** | `~/Library/Application Support/Hudson/Vox/` | HUD-012 private capability file (not a settings store) |
| **`input-devices.json`** | `~/Library/Application Support/Hudson/Voice/` | Native-written mic enumeration cache for web |

## On-disk layout

| Path | Writer | Mode |
|------|--------|------|
| `~/Library/Application Support/Hudson/Voice/preferences.json` | Web API, native prefs APIs | `0600` (dir `0700`) |
| `~/Library/Application Support/Hudson/Vox/preferences.json` | Mirror on every Hudson prefs save | `0600` |
| `~/Library/Application Support/Hudson/Voice/input-devices.json` | Native host / `HudsonVoiceAudioDevices` | `0600` |
| `~/Library/Application Support/Hudson/Vox/hudson-voice-runtime.json` | HUD-012 host only | `0600` |

### `preferences.json` (schema v1)

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

| Field | Values | Default |
|-------|--------|---------|
| `preferredInputDeviceId` | `string \| null` | `null` (system default) |
| `preferredOutputDeviceId` | `string \| null` | `null` (reserved) |
| `preferredTranscriptionModelId` | string | `parakeet:v3` |
| `preferredSynthesisModelId` | `string \| null` | `null` |
| `preferredLanguage` | string | `en` |
| `mode` | `push_to_talk` \| `always_on` | `push_to_talk` |

### Vox mirror (`Vox/preferences.json`)

```json
{
  "speech": {
    "preferredTranscriptionModelId": "parakeet:v3",
    "preferredSynthesisModelId": null,
    "preferredInputDeviceId": null
  }
}
```

### Input device cache (`input-devices.json`)

Written by native code after `AVCaptureDevice` enumeration:

```json
{
  "schemaVersion": 1,
  "devices": [
    { "id": "…", "name": "MacBook Pro Microphone", "isDefault": true, "isSelected": false }
  ],
  "defaultDeviceId": "…",
  "updatedAt": "2026-06-19T12:00:00.000Z"
}
```

## Environment overrides

| Variable | Default |
|----------|---------|
| `HUDSON_VOICE_PREFERENCES_PATH` | `…/Hudson/Voice/preferences.json` |
| `HUDSON_VOICE_EMBEDDED_VOX_PREFERENCES_PATH` | `…/Hudson/Vox/preferences.json` |
| `HUDSON_VOICE_INPUT_DEVICES_PATH` | `…/Hudson/Voice/input-devices.json` |
| `HUDSON_VOICE_RUNTIME_PATH` | `…/Hudson/Vox/hudson-voice-runtime.json` (HUD-012) |

## HTTP API

**Base**: `/api/hudson-voice` (same-origin only; see `app/lib/hudsonVoiceRuntime.ts`)

**Client paths** (`packages/web/hudsonkit/src/lib/hudsonVoiceClient.ts` → `HUDSON_VOICE_API_PATHS`):

| Constant | Path |
|----------|------|
| `health` | `/health` |
| `settings` | `/v1/voice/settings` |
| `devices` | `/v1/voice/devices` |
| `defaultDevice` | `/v1/voice/devices/default` |
| `live` | `/v1/voice/live` |
| `liveStop(id)` | `/v1/voice/live/{id}/stop` |
| `liveCancel(id)` | `/v1/voice/live/{id}/cancel` |

Host wiring: `voiceApiBase: '/api/hudson-voice'` in `app/lib/hudsonShellEnvironment.tsx`.

### `GET /api/hudson-voice/health`

HUD-012 health RPC + HUD-013 enrichments:

```json
{
  "service": "hudson-voice",
  "status": "ready",
  "permissions": { "microphone": "granted" },
  "input": {
    "selectedDeviceId": "…",
    "selectedDeviceName": "…",
    "defaultDeviceId": null
  },
  "settings": { /* HudsonVoicePreferences */ },
  "model": { "selectedModelId": "parakeet:v3", "readiness": { "state": "ready" } },
  "troubleshooting": { "runtimeCapabilityPath": "…", "runtimeAlive": true }
}
```

Returns `503` with structured error when runtime capability file is missing (disk prefs unchanged).

### `GET /api/hudson-voice/v1/voice/settings`

`{ "settings": HudsonVoicePreferences }` — defaults when file absent.

### `PUT /api/hudson-voice/v1/voice/settings`

Body: `{ "settings": { … } }` or flat preference keys.

Accepts aliases: `inputDeviceId` → `preferredInputDeviceId`, `language` → `preferredLanguage`, `modelId` → `preferredTranscriptionModelId`.

Returns `{ "settings" }` after merge + mirror. Invalid `mode` → `400`.

### `GET /api/hudson-voice/v1/voice/devices`

1. Read `input-devices.json` when present (native enumeration).
2. Else fall back to preference-only list (selected device stub).
3. Always include `selectedDeviceId`, `defaultDeviceId`, `settings`.

Works **without** a running runtime (preferences + cache only).

### `PUT /api/hudson-voice/v1/voice/devices/default`

Body: `{ "deviceId": string | null }` (alias: `inputDeviceId`).

Updates `preferredInputDeviceId`, mirrors to Vox, returns same shape as `GET /devices`.

v1: does not reject unknown device ids on web (native UI validates via `AVCaptureDevice`).

### `POST /api/hudson-voice/v1/voice/live`

Merges request body with disk preferences via `createHudsonVoiceSessionDefaults()` before RPC `transcribe.startSession`.

## Settings merge (web)

| Concern | Source of truth | UI field (`VoiceSettings`) |
|---------|-------------------|----------------------------|
| Input device | `preferences.preferredInputDeviceId` | `inputDeviceId` (`''` = default) |
| Capture mode | `preferences.mode` | `captureMode` |
| Transcription model | `preferences.preferredTranscriptionModelId` | `transcriptionModel` |
| Language | `preferences.preferredLanguage` | `transcriptionLanguage` |
| Reply speech | shell localStorage only | `speakReplies`, `replyProvider`, … |

**Hydration** (`HudsonVoiceSettingsEditor` mount):

1. `GET …/health` + `GET …/devices` (status + device list)
2. `GET …/settings` → merge capture fields into `VoiceSettings` via `onChange`
3. User edits capture → `PUT …/settings` or `PUT …/devices/default` first, then update local `VoiceSettings`

**Live sessions** (`WorkspaceAI`, `useVoiceInput`, `useHudsonVoiceInput`) use hydrated `VoiceSettings` for `deviceId`, `modelId`, `language`, `mode`.

## Native (`HudsonVoice` module)

| Type | Role |
|------|------|
| `HudsonVoicePreferences` | Load/save prefs + Vox mirror |
| `HudsonVoiceAudioDevices` | `AVCaptureDevice` list/set preferred + write `input-devices.json` |
| `HudsonVoiceRuntime` | Read `hudson-voice-runtime.json` |
| `HudsonVoiceRuntimeHost` | Embed `VoxRuntimeService` for kit apps |
| `HudsonVoiceSettingsView` | SwiftUI capture settings |

**Hosts**

| Host | Integration |
|------|-------------|
| Hudson Menu (`HudsonVoiceDaemonHost`) | Start/stop runtime, menu UI, write device cache on refresh |
| HudsonKit Demo (`VoiceTab`) | `HudsonVoiceSettingsView` beside `HudVoicePanel` |

`Package.swift`: `HudsonVoice` links `VoxEngine` + `VoxService`.

## Concurrency

- Atomic file replace on all writers; last writer wins (no lock v1).
- Web API read-merge-writes full `preferences.json` document.

## Out of scope (v1)

- Output device UI
- Dedicated `/v1/voice/models` route (model list via health RPC)
- Replacing Menu host with `HudsonVoiceRuntimeHost`
- Non-macOS hosts

## Acceptance criteria

1. Native host running → `GET /api/hudson-voice/v1/voice/devices` returns enumerated mics from `input-devices.json`.
2. Web capture settings hydrate from `GET /settings` and survive reload.
3. `PUT /settings` with invalid `mode` returns `400`.
4. `HudsonVoiceSettingsView` and web editor show the same preferred input after save.
5. `bun test test/lib/hudson-voice-preferences.test.ts` passes.
6. Live sessions inherit disk defaults when request omits `deviceId` / `modelId` / `mode` / `language`.

## Implementation checklist

- [x] `hudsonVoicePreferences.ts` + settings route
- [x] Health enrichment + live session defaults
- [x] `HudsonVoiceSettingsEditor` capture section
- [x] Swift prefs, runtime, runtime host, settings view
- [x] Menu host prefs + device refresh
- [x] `input-devices.json` cache (native write + web read)
- [x] Editor hydration from `GET /settings`
- [x] `HUDSON_VOICE_API_PATHS.settings` + client helpers
- [x] Demo `VoiceTab` settings surface
