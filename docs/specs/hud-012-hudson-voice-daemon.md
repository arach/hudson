# HUD-012 - Hudson-owned Vox daemon

**Status**: Draft
**Owner**: TBD (Arach)
**Targets**: `hudsonkit/voice`, Apple `HudsonVoice`, Hudson native app/host, Hudson Web voice surfaces, Vox embeddable daemon runtime
**Related**: `docs/voice.md`, `docs/permissions.md`, `docs/specs/hud-008-app-backends.md`, `docs/specs/hud-pairing-framework.md`, `packages/web/hudsonkit/src/workspace/shell/WorkspaceShell.tsx`, `packages/native/apple/HudsonKit/Sources/HudsonVoice/*`

## Summary

Hudson voice surfaces should depend on a Hudson-owned local voice service, not a separately installed Vox app.

The service embeds and operates Vox's daemon runtime. Vox remains the transcription/session engine and still owns the reusable daemon machinery. Hudson owns the app bundle or host process, lifecycle, permissions, device settings, diagnostics, and the public local API that Hudson Web and native Hudson surfaces call.

In short:

```
Hudson Web / Hudson native UI
        -> HudsonVoice client
        -> Hudson-owned local voice API
        -> Hudson native app or bundled host
        -> embedded Vox daemon runtime
        -> Parakeet / transcription backend
```

The standalone Vox app remains useful for development, compatibility, and non-Hudson consumers. It is not the primary product dependency for first-party Hudson voice.

## Decision

Hudson will introduce a first-party voice daemon shape:

1. **Hudson owns the host** - the process, app bundle, launch-at-login behavior, restart policy, update UX, menu/status UI, logs, and diagnostics are Hudson responsibilities.
2. **Hudson owns permissions** - microphone permission, permission rationale copy, denied-state recovery, and device selection live in Hudson-owned native UI.
3. **Hudson owns the public local API** - web and native callers talk to a Hudson endpoint and Hudson types. They do not depend on Vox app ports, Vox app install state, or Vox settings UI.
4. **Vox owns the embedded runtime** - capture/session/transcription mechanics, model adapters, Parakeet wrapping, streaming events, and daemon internals remain Vox-provided code.
5. **Standalone Vox is an adapter path** - direct `@voxd/client` or direct Vox WebSocket usage may remain as an explicit development or compatibility adapter, but it must not be the default first-party Hudson path.

This is an ownership decision, not a rewrite decision. Hudson should not reimplement Vox's transcription daemon functionality.

## Current state

| Surface | Current behavior | Gap |
|---------|------------------|-----|
| Hudson Web assistant | `WorkspaceAI` imports `@voxd/client`, records browser audio, and asks users to install or launch Vox when unavailable. | Product dependency is the standalone Vox app. Browser owns capture. |
| `hudsonkit/voice` web subpath | Lazily loads `@voxd/client` and defaults to browser `MediaRecorder` plus Vox transcription. | Useful hook boundary, but default provider is not Hudson-owned. |
| Apple `HudsonVoice` | Provides `HudVoxLiveSession`, a WebSocket JSON-RPC adapter to a Vox daemon endpoint. | Good native client primitives, but first-party browser surfaces should use Hudson's API facade. |
| Vox Swift runtime | `../vox/swift` provides `VoxService.VoxRuntimeService`, which can be embedded and started in-process. | Hudson starts it with a per-run token and keeps the raw endpoint private behind the Hudson API facade. |
| OpenScout native HUD reference | Uses a Swift service to call Vox Companion on `127.0.0.1:43115`; the companion owns mic capture. | Correct local-service interaction model, wrong operator ownership for Hudson. |

The result is confusing: Hudson has a `HudsonVoice` name and some useful provider boundaries, but the actual runtime assumption is still "Vox app is installed and running."

## Terminology

| Term | Meaning |
|------|---------|
| **Vox runtime** | The embeddable Vox code that implements daemon/session/transcription behavior and model integration. |
| **Standalone Vox app** | The Vox-owned menu bar app or companion app that hosts the Vox runtime for general-purpose use. |
| **Hudson voice daemon** | The Hudson-owned local service that embeds and operates the Vox runtime. |
| **Hudson native app / host** | The Hudson-owned app bundle or helper process that owns permissions, lifecycle, status UI, and daemon hosting. |
| **HudsonVoice client** | Web and Swift client APIs that talk to the Hudson voice daemon. |
| **Direct Vox adapter** | Compatibility provider that talks to standalone Vox instead of a Hudson-owned daemon. Explicit opt-in only. |

## Product boundary

First-party Hudson voice features should be able to say:

- Install or launch Hudson.
- Grant microphone access to Hudson.
- Pick a microphone in Hudson settings.
- Start a voice session from Hudson Web, native Hudson UI, or the terminal surface.

They should not need to say:

- Install Vox separately.
- Launch Vox separately.
- Allowlist Hudson in Vox settings.
- Debug which Vox app, Vox port, or Vox origin policy is active.

Vox can still power all of this. The distinction is that Hudson is the operator.

## Architecture

### Runtime shape

```
Hudson Web terminal / assistant mic
Hudson native surfaces
        |
        | HudsonVoice client API
        v
Next same-origin /api/hudson-voice
        |
        | private capability file + bearer token
        v
Hudson Menu helper
        |
        | token-gated loopback JSON-RPC
        v
Embedded Vox daemon runtime
        |
        | session engine, capture/transcription pipeline
        v
Parakeet and future Vox-backed providers
```

The web client should not use `navigator.mediaDevices.getUserMedia()` by default for first-party Hudson voice. The native host owns mic capture so the system permission prompt names Hudson, not the browser.

### Host choices

V1 should prefer the Hudson native app, with a bundled helper only when needed, because it gives the clearest product and permission boundary:

- a Hudson-owned app bundle with `NSMicrophoneUsageDescription`;
- a small status/menu surface for voice availability and device selection;
- a local daemon endpoint for Hudson Web and native UI;
- a managed embedded Vox runtime.

Future native Hudson apps may also host the runtime in process when that product shape is better. The API contract should not require callers to know whether the runtime is hosted by a menu bar helper, a bundled agent, or an app process.

The standalone Vox app is the fallback host only when explicitly configured.

## Local API contract

The browser-visible API is same-origin and Hudson-namespaced. The embedded Vox
port is randomized per run, stored only in a user-readable runtime capability
file, and protected by a per-run token that Hudson injects into Vox JSON-RPC
requests.

Minimum v1 endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/hudson-voice/health` | `GET` | Check Hudson voice daemon status, version, embedded Vox runtime health, permission state, and active session summary. |
| `/api/hudson-voice/v1/voice/devices` | `GET` | List input devices and the selected/default microphone. |
| `/api/hudson-voice/v1/voice/devices/default` | `PUT` | Set Hudson's preferred input device. |
| `/api/hudson-voice/v1/voice/live` | `POST` | Start a live transcription session. Response streams NDJSON events. |
| `/api/hudson-voice/v1/voice/live/{sessionId}/stop` | `POST` | Stop capture and finalize the transcript. |
| `/api/hudson-voice/v1/voice/live/{sessionId}/cancel` | `POST` | Cancel capture and discard pending transcript text. |

Optional v1 endpoints if the embedded Vox runtime already exposes them cleanly:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/voice/models` | `GET` | List available local transcription models. |
| `/v1/audio/speech` | `POST` | Hudson-owned TTS endpoint for spoken replies. |
| `/v1/voice/logs` | `GET` | Recent daemon/session diagnostics for local troubleshooting. |

### Health response

```json
{
  "service": "Hudson",
  "status": "ready",
  "version": "0.1.0",
  "pid": 12345,
  "startedAt": "2026-05-31T00:00:00.000Z",
  "runtime": {
    "authenticated": true,
    "host": "127.0.0.1",
    "port": 54321
  },
  "voxRuntime": {
    "service": "Vox",
    "status": "ready",
    "version": "0.3.4",
    "authenticated": true
  },
  "permissions": {
    "microphone": "granted"
  },
  "input": {
    "selectedDeviceId": "built-in",
    "selectedDeviceName": "MacBook Pro Microphone"
  },
  "activeSession": null
}
```

### Live request

```json
{
  "clientId": "hudson-web",
  "surface": "terminal",
  "modelId": "parakeet:v3",
  "language": "en",
  "mode": "push_to_talk",
  "metadata": {
    "workspaceId": "hudson-os"
  }
}
```

### Live events

The response from `/api/hudson-voice/v1/voice/live` streams newline-delimited JSON.

Required event names:

| Event | Meaning |
|-------|---------|
| `session.started` | Session id assigned; capture is being prepared. |
| `session.state` | State transition such as `starting`, `recording`, `processing`, `done`, `cancelled`, or `error`. |
| `session.partial` | Interim transcript text. |
| `session.final` | Final transcript text and metrics. |
| `session.error` | Recoverable or terminal error with Hudson-facing code/message. |
| `session.cancelled` | Capture was cancelled and text should be discarded. |

Example:

```json
{"event":"session.started","sessionId":"voice_123","data":{"state":"starting"}}
{"event":"session.state","sessionId":"voice_123","data":{"state":"recording"}}
{"event":"session.partial","sessionId":"voice_123","data":{"text":"open the terminal"}}
{"event":"session.final","sessionId":"voice_123","data":{"text":"Open the terminal.","elapsedMs":1380}}
```

## Lifecycle rules

V1 should keep session rules strict and easy to test:

1. One active recording session per host by default.
2. `stop` is idempotent once a session is already stopping or done.
3. `cancel` is idempotent once a session is already cancelled or missing.
4. A final transcript is emitted at most once.
5. A cancelled session must not emit final transcript text after cancellation.
6. The daemon records client id, surface, model id, device id, start time, stop time, elapsed time, and final status for diagnostics.
7. A daemon restart must clear stale active-session state and make the next `/api/hudson-voice/health` response honest.
8. Permission denied, missing input device, model unavailable, and runtime warming states must be represented as typed Hudson errors.

## Permissions and settings

The embedder owns permissions in the embedded scenario.

For Hudson this means:

- the Hudson native app or bundled host includes `NSMicrophoneUsageDescription`;
- first-run permission UX is Hudson-branded and recoverable via Hudson settings;
- device selection lives in Hudson settings and is surfaced through the local API;
- the web mic button does not request browser mic permission by default;
- `HudPermissionGate(.microphone, ...)` or an equivalent native flow gates any local recording UI;
- diagnostics report whether failure is permission, device, runtime, model, or transport.

`docs/permissions.md` already provides the Hudson-side permission abstraction. HUD-012 should reuse that shape instead of inventing a new permission enum.

## SDK changes

### Web

`hudsonkit/voice` should grow a Hudson service client as the default provider.

Required changes:

- Default `useVoiceInput` talks to the Hudson voice daemon, not directly to `@voxd/client`.
- Browser `MediaRecorder` capture becomes a custom provider path, not the first-party default.
- Direct standalone Vox access moves behind explicit configuration or a distinct adapter export.
- `probeVoxAvailability` either becomes `probeHudsonVoiceAvailability` or is deprecated in favor of Hudson-named health checks.
- Workspace AI, terminal mic, and built-in Assistant use the Hudson service client.
- User-facing errors say "Hudson voice service" or "Hudson app", not "Install Vox", unless the explicit direct Vox adapter is active.

### Apple

Apple `HudsonVoice` should split client and host responsibilities.

Required changes:

- Add a host-side abstraction for running the embedded Vox runtime under Hudson ownership.
- Keep client primitives for surfaces that only need to start, stop, cancel, and stream session events.
- Prefer `HudVoice*` public names for Hudson-facing concepts.
- Keep `HudVox*` names only where the type is explicitly a Vox runtime adapter or backwards-compatible shim.
- Integrate `HudPermissions` for microphone readiness and denied-state recovery.

### Native Hudson app / host

The host should provide:

- app-bundle permission strings;
- launch and restart lifecycle;
- local API server;
- embedded Vox runtime startup/shutdown;
- input-device list and selection;
- model availability and warmup state;
- session logs and health;
- UI affordances for permission, active mic state, and failures.

The initial product shape is two app bundles:

- **Hudson.app** - regular Canvas main-window app.
- **Hudson Menu.app** - LSUIElement helper that owns microphone permission and embeds `VoxRuntimeService`.

## Security model

The local daemon is powerful because it controls the microphone. V1 must treat it as a local privileged capability, not a generic unauthenticated web service.

Minimum requirements:

1. Bind to loopback by default.
2. Do not expose LAN access unless routed through HudPairing or another authenticated transport.
3. Restrict browser access to same-origin Hudson routes.
4. Use a user-only runtime capability file plus a per-run token for the private Vox JSON-RPC transport.
5. Avoid accepting raw shell commands, file paths, or model downloads from the unauthenticated local API.
6. Log client id and surface for every session start/stop/cancel.
7. Treat standalone Vox direct mode as a separate trust boundary with its own warnings and settings.

## Migration plan

### Phase 0 - decision record

- Land HUD-012.
- Update `docs/voice.md` to say first-party Hudson Web uses `/api/hudson-voice`; standalone Vox remains an explicit compatibility path.

### Phase 1 - Hudson voice API facade

- Define the TypeScript client and Swift client protocol for `/api/hudson-voice/health`, device listing, and live sessions.
- Add tests for session event parsing, stop/cancel idempotency, and health-state mapping.
- Keep a direct Vox adapter only for explicit development or native-tool scenarios that can provide a runtime token.

### Phase 2 - Hudson native host

- Build the Hudson native host that embeds `VoxRuntimeService` from `../vox/swift`.
- Add microphone permission flow and selected-device persistence.
- Expose the v1 Hudson local API as a same-origin facade over the embedded token-gated Vox runtime transport.
- Verify that standalone Vox can be stopped and Hudson voice still works.

### Phase 3 - web migration

- Move `WorkspaceAI` and terminal mic surfaces off direct `@voxd/client`.
- Remove first-party "Install Vox" and "Launch Vox" prompts from Hudson Web.
- Replace browser `MediaRecorder` capture in first-party flows with daemon-owned capture.

### Phase 4 - Apple SDK migration

- Keep `HudVoxLiveSession` as compatibility if needed.
- Add Hudson-owned host/client APIs.
- Update the demo Voice tab to show "Hudson voice daemon powered by Vox" rather than "Vox local daemon".

### Phase 5 - docs and cleanup

- Update `docs/voice.md`, settings UI copy, and any install instructions.
- Move direct Vox docs into an explicit "standalone Vox adapter" section.
- Add troubleshooting for Hudson app availability, permission, selected mic, and runtime warmup.

## Acceptance criteria

- A user can use Hudson Web voice with only the Hudson app installed and running.
- Killing the standalone Vox app does not break Hudson voice when the Hudson voice daemon is healthy.
- The system microphone permission prompt names Hudson.
- Hudson settings can show and change the selected microphone.
- Hudson Web terminal mic does not require browser microphone permission in the default path.
- Health checks identify Hudson service health, embedded Vox runtime health, permission state, model availability, and selected input device.
- Session lifecycle tests cover start, partial, final, stop, cancel, runtime error, permission denied, unavailable device, and daemon restart.
- Direct Vox usage is explicit in code and docs, never the hidden first-party default.

## Non-goals

- Reimplementing Vox's transcription pipeline.
- Forking the Parakeet wrapper into Hudson.
- Making browser `MediaRecorder` the default first-party recording path.
- Cloud transcription.
- Always-on wake word or background listening policy.
- LAN/mobile access without HudPairing or equivalent authentication.
- Replacing standalone Vox for non-Hudson consumers.

## Open questions

1. **Launch at login** - should `Hudson Menu.app` register itself as a login item in v1, or should that wait for a settings toggle?
2. **Port and discovery** - use a stable port, a launchd-registered service, a file-based endpoint manifest, or an authenticated discovery endpoint?
3. **Local auth** - choose CORS allowlist, local bearer token, signed challenge, or a combination.
4. **Vox embed API** - what is the exact embeddable Swift/Node API for starting the runtime, listing devices, selecting input, and streaming sessions?
5. **Model storage** - does Hudson own model install/update UX, or does the embedded Vox runtime own it behind Hudson status messages?
6. **TTS scope** - should the Hudson voice daemon own `/v1/audio/speech` in v1, or should TTS remain in the existing Next route until STT is stable?
7. **Multi-client policy** - how should Hudson handle simultaneous mic requests from terminal, assistant, and native UI?
8. **Naming** - settle public API names: `HudsonVoiceDaemon`, `HudVoiceService`, or another product/API label.
