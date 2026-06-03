---
title: "Permissions"
description: "Unified permission gate for camera, microphone, photos, location, notifications"
order: 15
section: "iOS Apps"
---

# Permissions

## Overview

`HudPermissions` collapses Apple's per-framework auth APIs (`AVCaptureDevice.requestAccess`, `AVAudioApplication.requestRecordPermission`, `SFSpeechRecognizer.requestAuthorization`, `PHPhotoLibrary.requestAuthorization`, `UNUserNotificationCenter.requestAuthorization`) into one async-first surface. App code branches on a single `HudPermissionStatus` enum instead of five framework-specific status types.

iOS supports microphone, speech recognition, camera, photos, and notifications today. Location is on the roadmap. macOS calls return `.unavailable` until per-platform plumbing lands. Import from `HudsonUI`.

## Imperative API

`HudPermissions` is a static enum namespace; there is no shared instance. Call `request(_:)` from any async context to surface the system prompt and receive the resolved status.

```swift
import HudsonUI

func enableDictation() async {
    let status = await HudPermissions.request(.microphone)
    guard status.isAuthorized else {
        if status.isTerminal { HudPermissions.openSettings() }
        return
    }
    startRecording()
}
```

`status(of:)` returns the current status without prompting. `openSettings()` opens the host app's permission page in the system Settings app; that's the only escape from `.denied` or `.restricted`.

## Declarative gate

`HudPermissionGate` wraps permission-protected content with the right UI for each status state (request card, denied + Settings card, or unavailable card), so call sites stop reimplementing the same branches.

```swift
import HudsonUI

struct DictationScreen: View {
    var body: some View {
        HudPermissionGate(.microphone, rationale: "Talkie listens to your dictation.") {
            RecordingView()
        }
    }
}
```

The gate reads the current status on `.task`, swaps to your content as soon as it is `.granted` or `.limited`, and otherwise renders a `HudCard` with the right call-to-action.

## HudPermission

| Case | Info.plist key | Symbol |
|------|----------------|--------|
| `.microphone` | `NSMicrophoneUsageDescription` | `mic.fill` |
| `.speech` | `NSSpeechRecognitionUsageDescription` | `waveform` |
| `.camera` | `NSCameraUsageDescription` | `camera.fill` |
| `.photos` | `NSPhotoLibraryUsageDescription` | `photo.on.rectangle.angled` |
| `.notifications` | — (no Info.plist string required) | `bell.fill` |

Each case exposes `infoPlistKey`, `symbolName`, and `displayName`. iOS silently fails to surface the prompt if the matching `NSUsageDescription` string is missing from your Info.plist or `INFOPLIST_KEY_*` build settings. Verify with `HudPermission.microphone.infoPlistKey` during integration.

## HudPermissionStatus

| Value | Meaning |
|-------|---------|
| `.notDetermined` | User hasn't been asked yet. `request` will prompt. |
| `.granted` | Full access. |
| `.limited` | Partial access (Photos `.limited`, Notifications `.provisional` or `.ephemeral`). Treat as success. |
| `.denied` | User said no. `request` won't re-prompt; only Settings will. |
| `.restricted` | Parental controls or MDM blocked the prompt. |
| `.unavailable` | Not supported on the current platform or OS version. |

Two helpers keep call sites tidy:

- `isAuthorized`: `true` for `.granted` or `.limited`. Gate your protected work on this.
- `isTerminal`: `true` for `.denied` or `.restricted`. Use it to switch from "show request button" to "show open-Settings button".

```swift
switch status {
case _ where status.isAuthorized: showContent()
case _ where status.isTerminal:   showSettingsLink()
default:                          showRequestButton()
}
```
