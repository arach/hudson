# Vox Always-On Voice for Hudson

This document defines the Vox-side work Hudson needs in order to support both voice interaction styles cleanly:

- `push_to_talk` — explicit start/stop recording
- `always_on` — persistent listening with automatic utterance finalization

## Current State

Hudson's current Vox integration is browser-owned, one-shot dictation:

- [app/shell/WorkspaceAI.tsx](/Users/arach/dev/hudson/app/shell/WorkspaceAI.tsx) opens `getUserMedia()`
- Hudson records locally with `MediaRecorder`
- Hudson uploads the finished blob to `@voxd/client.transcribe()`
- Vox returns one final transcript only after recording stops

That works for manual dictation, but it is the wrong shape for continuous voice.

## Root Cause

The missing capability is not in Hudson. It is the mismatch between Vox's daemon surface and Vox's browser bridge:

- Vox daemon already exposes live-session routes over WebSocket JSON-RPC:
  - `transcribe.startSession`
  - `transcribe.sessionStatus`
  - `transcribe.stopSession`
  - `transcribe.cancelSession`
- Vox browser integrations use `@voxd/client` over the HTTP bridge on `127.0.0.1:43115`
- That bridge currently exposes only:
  - `GET /health`
  - `GET /capabilities`
  - `POST /transcribe`
  - job creation / polling
- `@voxd/client` types already hint at realtime support, but the client does not implement it

Important detail: Vox's daemon live sessions are microphone-owned on the companion side, not browser-audio-stream-owned. For Hudson, that is preferable. The browser should control a session, not continuously upload raw audio chunks.

## Goal

Expose one browser-safe Vox live-session surface that supports both:

1. Manual start/stop dictation
2. Continuous listening with utterance segmentation

Hudson should be able to switch between those modes via settings without changing its core chat UI or re-implementing VAD/endpointing in the browser.

## Non-Goals

- Wake-word detection
- Speaker diarization
- Cloud fallback design
- Browser-side audio chunk transport as the primary path

## Preferred Design

### Phase 1: Browser Bridge Parity for Existing Live Sessions

Expose Vox daemon live sessions through the browser bridge and `@voxd/client`.

This phase does not yet create true always-on voice. It gives Hudson a browser-safe way to use Vox-owned microphone capture for the existing explicit start/stop model.

#### Required browser bridge addition

Add a WebSocket endpoint on the HTTP bridge:

- `GET /live`

Requirements:

- Validate `Origin` before upgrade using the same allowlist rules as the existing HTTP endpoints
- Keep the browser connected to the bridge, not directly to the daemon
- Proxy live-session control to the daemon's existing JSON-RPC methods
- On browser disconnect, cancel any owned live session

#### Required `@voxd/client` API

Add a live-session API for web clients that matches the daemon's microphone-owned model.

Proposed shape:

```ts
type VoxDVoiceMode = "push_to_talk" | "always_on";

interface VoxDLiveSessionOptions {
  clientId: string;
  surface?: string;
  modelId?: string;
  language?: string;
  mode?: VoxDVoiceMode;
  emitPartials?: boolean;
  endpointing?: {
    silenceMs?: number;
    minSpeechMs?: number;
    maxUtteranceMs?: number;
  };
  metadata?: Record<string, unknown>;
}

interface VoxDSessionStateEvent {
  sessionId: string;
  state:
    | "starting"
    | "listening"
    | "recording"
    | "processing"
    | "done"
    | "cancelled"
    | "error";
  previous?: string | null;
}

interface VoxDSessionFinalEvent {
  sessionId: string;
  text: string;
  elapsedMs: number;
  utteranceIndex?: number;
  metrics?: {
    inferenceMs?: number;
    totalMs?: number;
    realtimeFactor?: number;
  };
  words?: Array<{ word: string; start: number; end: number }>;
}

interface VoxDLiveSession {
  id: string | null;
  start(options?: Partial<VoxDLiveSessionOptions>): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  close(): void;
  onState(cb: (event: VoxDSessionStateEvent) => void): void;
  onPartial(cb: (text: string, sessionId: string) => void): void;
  onFinal(cb: (event: VoxDSessionFinalEvent) => void): void;
  onError(cb: (error: Error) => void): void;
}
```

Notes:

- `@voxd/client` should not require `send(chunk)` for the browser live-session API
- The current `RealtimeSession.send(chunk)` type does not match Vox's daemon-owned microphone model
- If raw-audio browser streaming is ever added later, it should be a separate API shape

#### Capability reporting

Extend `GET /capabilities` and `@voxd/client.capabilities()` so Hudson can branch cleanly:

```ts
features: {
  local_asr?: boolean;
  alignment?: boolean;
  realtime?: boolean;            // bridge supports live-session transport
  continuous_sessions?: boolean; // daemon supports multi-utterance always-on sessions
  partial_results?: boolean;
}
```

### Phase 2: Continuous Multi-Utterance Sessions

This phase is what Hudson actually needs for an `always_on` mode.

The daemon must keep a single listening session alive across multiple utterances and emit a final event for each utterance without requiring the browser to stop and restart recording after every prompt.

#### Required daemon behavior

Extend `transcribe.startSession` with a mode:

```ts
{
  mode: "push_to_talk" | "always_on";
}
```

Expected semantics:

- `push_to_talk`
  - current behavior
  - one recording, one final transcript, session ends on stop
- `always_on`
  - microphone stays active until explicit stop/cancel
  - daemon performs endpointing / silence detection
  - daemon emits one `session.final` per utterance
  - session stays alive after each final utterance
  - browser does not need to reopen the session after every prompt

#### Required events for `always_on`

Browser-facing events should include:

- `session.state`
- `session.partial` (optional but useful)
- `session.final`
- `session.error`

Recommended event payloads:

```ts
{ event: "session.state", data: { sessionId, state, previous } }
{ event: "session.partial", data: { sessionId, utteranceIndex, text } }
{ event: "session.final", data: { sessionId, utteranceIndex, text, elapsedMs, metrics, words } }
{ event: "session.error", data: { sessionId, code, message } }
```

#### Stop semantics

`stop()` should mean:

- stop listening
- flush the current utterance if speech is in progress
- emit the final utterance if available
- transition the session to `done`

`cancel()` should mean:

- stop listening immediately
- discard unfinished speech
- transition the session to `cancelled`

## Hudson Integration Contract

Once Vox provides the browser live-session surface above, Hudson should switch its voice implementation as follows:

### `push_to_talk`

- Mic button starts a Vox live session
- Mic button stop requests `session.stop()`
- Hudson merges the returned transcript into the current draft
- If `autoSend` is on, Hudson submits immediately

### `always_on`

- Hudson opens one live session while the user has voice listening enabled
- Each `session.final` becomes one discrete utterance for the chat composer
- If `autoSend` is on, Hudson sends each utterance as its own chat turn
- If `autoSend` is off, Hudson appends the utterance to the draft and keeps listening
- Hudson stays in a listening state between utterances without reopening the session

### Hudson settings model

Hudson will need:

```ts
interface VoiceSettings {
  autoSend: boolean;
  mode: "push_to_talk" | "always_on";
}
```

But Hudson should not ship `always_on` as an active user-facing mode until Vox exposes `features.continuous_sessions === true`.

## Why Not Browser-Side Chunk Uploads

Hudson could simulate continuous voice by:

- keeping `getUserMedia()` open
- segmenting speech in the browser
- repeatedly uploading blobs through `/transcribe`

That is not the preferred fix because it duplicates the hard parts in every web app:

- voice activity detection
- endpointing
- session lifecycle
- microphone ownership semantics
- reconnect / disconnect recovery

Vox already has the correct place to own those concerns: the daemon and the bridge.

## Acceptance Criteria

Vox is ready for Hudson always-on voice when all of the following are true:

1. `@voxd/client` exposes browser-safe live sessions without raw-audio upload requirements.
2. `GET /capabilities` reports whether live sessions and continuous sessions are supported.
3. Hudson can start and stop a live session without using `MediaRecorder`.
4. Vox can keep a single session alive across multiple utterances.
5. Hudson receives one final event per utterance while listening remains active.
6. Browser disconnects cancel owned sessions cleanly.

## Relevant Code References

Hudson:

- [app/shell/WorkspaceAI.tsx](/Users/arach/dev/hudson/app/shell/WorkspaceAI.tsx)
- [app/shell/WorkspaceShell.tsx](/Users/arach/dev/hudson/app/shell/WorkspaceShell.tsx)
- [app/shell/workspace-manager/WorkspaceManagerPanel.tsx](/Users/arach/dev/hudson/app/shell/workspace-manager/WorkspaceManagerPanel.tsx)

Vox:

- [/Users/arach/dev/vox/packages/web-client/src/client.ts](/Users/arach/dev/vox/packages/web-client/src/client.ts)
- [/Users/arach/dev/vox/packages/web-client/src/types.ts](/Users/arach/dev/vox/packages/web-client/src/types.ts)
- [/Users/arach/dev/vox/swift/Sources/VoxBridge/HTTPBridgeServer.swift](/Users/arach/dev/vox/swift/Sources/VoxBridge/HTTPBridgeServer.swift)
- [/Users/arach/dev/vox/swift/Sources/VoxService/VoxRuntimeService.swift](/Users/arach/dev/vox/swift/Sources/VoxService/VoxRuntimeService.swift)
- [/Users/arach/dev/vox/swift/Sources/VoxService/LiveSessionCoordinator.swift](/Users/arach/dev/vox/swift/Sources/VoxService/LiveSessionCoordinator.swift)
