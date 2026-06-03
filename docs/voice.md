---
title: Voice
description: Voice input, output, and assistant voice integration
order: 7
---

# Voice

## Overview

Import from `hudsonkit/voice` to add speech-to-text input, text-to-speech output, or voice-driven assistant interaction. The subpath is opt-in: it lazily loads `@voxd/client` (the local Vox Companion) and pulls in voice hooks and reply-shaping utilities. The main `hudsonkit` package has zero voice dependencies; nothing ships to users who don't import this subpath.

Voice input requires the [Vox Companion](https://vox.app) running locally on `127.0.0.1:43115`. Substitute your own STT provider by passing a `transcribe` function directly.

## useVoiceInput

Captures microphone audio via `MediaRecorder`, ships it to Vox for transcription, and delivers the transcript via `onTranscript`.

```tsx
'use client';

import { useVoiceInput } from 'hudsonkit/voice';

export function VoiceButton() {
  const { status, error, start, stop, isSupported } = useVoiceInput({
    onTranscript: (text) => console.log('transcript:', text),
  });

  if (!isSupported) return null;

  return status === 'recording'
    ? <button onClick={stop}>Stop</button>
    : <button onClick={start} disabled={status === 'transcribing'}>Speak</button>;
}
```

### UseVoiceInputOptions

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `onTranscript` | `(transcript: string) => void` | — | Called with the final transcript after recording stops. |
| `surface` | `string` | `"hudson-assistant"` | Identifies the calling surface in Vox metadata. |
| `metadata` | `Record<string, unknown>` | — | Free-form metadata included with every transcribe request. |
| `language` | `string` | `"en"` | Spoken language hint. |
| `transcribe` | `TranscribeFn` | — | Custom STT provider. If omitted, `@voxd/client` is loaded lazily. |
| `probe` | `() => Promise<boolean>` | — | Availability probe override. Defaults to the Vox client's `probe()`. |

### UseVoiceInputResult

| Name | Type | Description |
|------|------|-------------|
| `status` | `VoiceStatus` | Current state of the input pipeline. |
| `error` | `string \| null` | Human-readable error message, or `null`. |
| `lastTranscript` | `string \| null` | Most recent transcript. Useful for "draft ready" UI before send. |
| `start` | `() => Promise<void>` | Request mic access and begin recording. |
| `stop` | `() => void` | Stop recording and trigger transcription. |
| `isSupported` | `boolean` | `true` if `MediaRecorder` and `getUserMedia` are available. |

## useVoiceOutput

Synthesizes speech by posting to your app's `/v1/audio/speech` route and plays the returned audio.

```tsx
'use client';

import { useVoiceOutput } from 'hudsonkit/voice';

export function SpeakButton({ text }: { text: string }) {
  const { speak, stop, isPlaying } = useVoiceOutput();

  return isPlaying
    ? <button onClick={stop}>Stop</button>
    : <button onClick={() => speak(text)}>Play</button>;
}
```

### SpeakOptions

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `provider` | `VoiceProvider` | — | TTS provider override. |
| `model` | `string` | — | Model identifier (provider-specific). |
| `voice` | `string` | — | Voice identifier (provider-specific). |
| `rate` | `number` | — | Speech rate multiplier. `1.0` = normal. |
| `metadata` | `Record<string, unknown>` | — | Free-form metadata included with the speech request. |

### UseVoiceOutputResult

| Name | Type | Description |
|------|------|-------------|
| `status` | `VoiceStatus` | Current state of the output pipeline. |
| `error` | `string \| null` | Human-readable error message, or `null`. |
| `speak` | `(text: string, opts?: SpeakOptions) => Promise<void>` | Synthesize and play text. Resolves once playback starts or fails. |
| `stop` | `() => void` | Stop any in-flight playback and discard pending requests. |
| `isPlaying` | `boolean` | `true` while audio is synthesizing or actively playing. |

## useAssistantVoice

Combines `useVoiceInput` and `useVoiceOutput` into an `AssistantVoiceKit`, the prop type the built-in `<Assistant>` component consumes for mic + speaker UI and auto-reply playback.

```tsx
'use client';

import { useAssistantVoice } from 'hudsonkit/voice';

const voiceKit = useAssistantVoice({
  appId: 'my-app',
  settings: { speakReplies: true },
});
```

> **Heads up:** `<AppShell>` does not currently forward a `voiceKit` prop to its built-in Assistant. Today this hook wires voice to a manually mounted `<Assistant>` or to your own UI. Threading through AppShell will follow.

### UseAssistantVoiceOptions

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `appId` | `string` | — | App ID included in voice metadata. |
| `settings` | `Partial<VoiceSettings>` | — | Overrides for `DEFAULT_VOICE_SETTINGS`. |

### AssistantVoiceKit shape

```ts
interface AssistantVoiceKit {
  input: {
    status: VoiceKitStatus;
    error: string | null;
    isSupported: boolean;
    start: (onTranscript: (transcript: string) => void) => Promise<void>;
    stop: () => void;
  };
  output: {
    status: VoiceKitStatus;
    error: string | null;
    isPlaying: boolean;
    speak: (text: string, opts?: Record<string, unknown>) => Promise<void>;
    stop: () => void;
  };
  settings: {
    autoSend: boolean;
    speakReplies: boolean;
  };
  speakReply: (message: Pick<UIMessage, 'parts'>, metadata?: Record<string, unknown>) => void;
}
```

`speakReply` extracts text from a `UIMessage`, shapes it for speech (see [Reply shaping](#reply-shaping)), and calls `output.speak`. Call it from your chat's `onFinish` to automatically read assistant responses aloud.

## Voice settings

`VoiceSettings` controls both input behavior and how replies are shaped for speech.

```ts
import { DEFAULT_VOICE_SETTINGS } from 'hudsonkit/voice';
```

### VoiceSettings

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `autoSend` | `boolean` | `true` | Auto-submit the transcript instead of just filling the input. |
| `speakReplies` | `boolean` | `false` | Speak assistant replies aloud after streaming completes. |
| `replyProvider` | `VoiceProvider` | `"vox"` | TTS provider for spoken replies. |
| `replyModel` | `string` | `"avspeech:system"` | TTS model identifier. |
| `replyVoice` | `string` | `""` | Voice identifier. Empty string uses the provider default. |
| `replyRate` | `number` | `1` | Speech rate multiplier. |
| `spokenReplyStyle` | `SpokenReplyStyle` | `"adaptive"` | How much of the reply to speak: `"brief"`, `"adaptive"`, or `"full"`. |
| `spokenReplyLongResponse` | `SpokenReplyLongResponse` | `"invite"` | Handling for long replies: `"summary"`, `"invite"`, or `"verbatim"`. |
| `spokenReplyCodeResponse` | `SpokenReplyCodeResponse` | `"summary"` | Handling for code-heavy replies: `"summary"`, `"mention"`, or `"read"`. |
| `spokenReplyMaxChars` | `number` | `720` | Hard character cap for spoken output. |

### VoiceProvider

`"vox"` is the only supported provider. Pass it as `replyProvider` or in `SpeakOptions.provider`.

### VoiceStatus

| Value | Meaning |
|-------|---------|
| `"idle"` | No activity. |
| `"recording"` | Mic is active and capturing audio. |
| `"transcribing"` | Audio has been sent; waiting for transcript. |
| `"ready"` | Transcript is available. |
| `"synthesizing"` | Speech request is in flight. |
| `"speaking"` | Audio is playing. |
| `"unavailable"` | Vox Companion is unreachable or warming up. |
| `"error"` | A hard error occurred; see `error` string for details. |

## Reply shaping

These utilities convert raw assistant text into speech-friendly output: stripping markdown, code blocks, and `<think>` tags, then applying length and style constraints.

```ts
import {
  createHudsonSpokenReply,
  getHudsonMessageDisplayText,
  getHudsonVoiceBehaviorPreset,
  applyHudsonVoiceBehaviorPreset,
} from 'hudsonkit/voice';
```

**`getHudsonMessageDisplayText(message)`** — Extracts and cleans the text content from a `UIMessage`. Strips `<think>` blocks and collapses whitespace.

**`createHudsonSpokenReply(text, policy)`** — The main shaping function. Pass the display text and either a `VoiceSettings` object or a `SpokenReplyStyle` string. Returns a speech-ready string (or `""` if nothing remains after cleaning).

```ts
const spoken = createHudsonSpokenReply(displayText, voiceSettings);
if (spoken) voiceOutput.speak(spoken);
```

**`getHudsonVoiceBehaviorPreset(settings)`** — Identifies which named preset (`"concise"`, `"balanced"`, `"detailed"`, or `"custom"`) matches the given settings.

**`applyHudsonVoiceBehaviorPreset(settings, preset)`** — Returns a new `VoiceSettings` with the preset values merged in. Does not mutate the original.

```ts
const updated = applyHudsonVoiceBehaviorPreset(settings, 'concise');
```

Preset mappings:

| Preset | `spokenReplyStyle` | `spokenReplyLongResponse` | `spokenReplyCodeResponse` | `spokenReplyMaxChars` |
|--------|--------------------|--------------------------|--------------------------|----------------------|
| `"concise"` | `"brief"` | `"invite"` | `"mention"` | `360` |
| `"balanced"` | `"adaptive"` | `"invite"` | `"summary"` | `720` |
| `"detailed"` | `"full"` | `"summary"` | `"summary"` | `960` |

## probeVoxAvailability

`probeVoxAvailability` is exported from the main `hudsonkit` package (not `hudsonkit/voice`) so you can check Vox status without pulling in voice dependencies.

```ts
import { probeVoxAvailability } from 'hudsonkit';

const availability = await probeVoxAvailability(voxClient);
// → "connected" | "warming" | "unreachable" | "blocked-origin"
```

Use this to gate voice UI before the user tries to record (e.g. show an "Install Vox" prompt when the result is `"unreachable"`).

## Apple (HudsonVoice)

Hudson's Apple SDK ships a Swift counterpart to `hudsonkit/voice` as the `HudsonVoice` target inside the `HudsonKit` Swift package. Like the web subpath, it is opt-in: voice code never compiles into your binary unless you flip a build flag.

### Build flag opt-in

Voice support follows the same env-gated pattern as `HudsonTerminal`. Pass `HUDSONKIT_WITH_VOICE=1` when resolving / building the package:

```bash
HUDSONKIT_WITH_VOICE=1 swift build
# or, alongside the terminal target:
HUDSONKIT_WITH_TERMINAL=1 HUDSONKIT_WITH_VOICE=1 swift build
```

`Package.swift` reads the env var and conditionally adds the `HudsonVoice` product, so consumers without the flag pay zero compile-time or binary cost. For Xcode projects, set the env var in the shell before running `xcodegen` (and re-run xcodegen after toggling).

### HudVoicePanel — SwiftUI primitive

`HudVoicePanel` is a drop-in SwiftUI view that renders the Vox listen / stop / cancel UI in Hudson's design language (HudCard, HudButton, HudBadge, HudStatusDot). It owns its own `HudVoxLiveSession`, transcript buffer, and health-probe lifecycle.

```swift
import SwiftUI
import HudsonVoice

struct VoxScreen: View {
    var body: some View {
        HudVoicePanel(
            options: HudVoxLiveSessionOptions(clientId: "my-app")
        )
    }
}
```

Provide a custom endpoint to point at a remote Mac running Vox:

```swift
HudVoicePanel(
    endpoint: HudVoxEndpoint(host: "macbook.local", port: 42138),
    options: HudVoxLiveSessionOptions(clientId: "my-app", language: "en")
)
```

### HudVoxLiveSessionOptions

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `clientId` | `String` | `"HudsonKit"` | Identifies the calling surface in Vox metadata. |
| `modelId` | `String` | `"parakeet:v3"` | Transcription model identifier. |
| `language` | `String?` | `nil` | Spoken language hint. |
| `mode` | `HudVoiceMode` | `.pushToTalk` | `.pushToTalk` or `.alwaysOn`. |
| `metadata` | `[String: String]` | `[:]` | Free-form metadata sent with the session. |

### Connection state — iOS pairs with a Mac

Vox is a local daemon that today runs on macOS. On macOS the panel reaches `ws://127.0.0.1:42138`. iOS has no on-device Vox daemon: the device pairs with a nearby Mac running Vox, and `HudVoxEndpoint` should point at that host.

When Vox is unreachable, `HudVoicePanel` surfaces an `OFFLINE` badge and a message like _"Vox is not reachable at <url>. Launch Vox and check again."_ Tap **Check** to re-probe via `HudVoxProbe.health(...)`. The Listen button auto-runs the probe before connecting and short-circuits to offline if no health is returned.

Cross-device pairing (discovery, trust, transport) will be handled by the forthcoming **HudPairing** primitive. Until then, set the host manually.
