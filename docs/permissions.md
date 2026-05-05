---
title: "Permissions"
description: "Unified permission gate for camera, microphone, photos, location, notifications"
order: 15
section: "iOS Apps"
---

# Permissions

## Overview

`HudPermissions` collapses every per-framework auth API on Apple platforms — `AVCaptureDevice.requestAccess`, `AVAudioApplication.requestRecordPermission`, `PHPhotoLibrary.requestAuthorization`, `UNUserNotificationCenter.requestAuthorization` — into one async-first surface. App code branches on a single `HudPermissionStatus` enum instead of four framework-specific status types.

iOS supports camera, microphone, photos, and notifications today. Location is on the roadmap. macOS calls return `.unavailable` until per-platform plumbing lands. Import from `HudsonUI`.

## Imperative API

`HudPermissions` is a static enum namespace — there is no shared instance. Call `request(_:)` from any async context to surface the system prompt and receive the resolved status.

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

`status(of:)` returns the current status without prompting. `openSettings()` opens the host app's permission page in the system Settings app — the only way out of `.denied` or `.restricted`.

## Declarative gate

`HudPermissionGate` wraps permission-protected content with the appropriate UI for each status state — request card, denied + Settings card, or unavailable card — so call sites stop reimplementing the same three branches.

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
| `.camera` | `NSCameraUsageDescription` | `camera.fill` |
| `.photos` | `NSPhotoLibraryUsageDescription` | `photo.on.rectangle.angled` |
| `.notifications` | — (no Info.plist string required) | `bell.fill` |

Each case exposes `infoPlistKey`, `symbolName`, and `displayName`. iOS silently fails to surface the prompt if the matching `NSUsageDescription` string is missing from your Info.plist or `INFOPLIST_KEY_*` build settings — verify with `HudPermission.microphone.infoPlistKey` during integration.

## HudPermissionStatus

| Value | Meaning |
|-------|---------|
| `.notDetermined` | User hasn't been asked yet. `request` will prompt. |
| `.granted` | Full access. |
| `.limited` | Partial access (Photos `.limited`, Notifications `.provisional` / `.ephemeral`). Treat as success. |
| `.denied` | User said no. `request` won't re-prompt — only Settings will. |
| `.restricted` | Parental controls / MDM blocked the prompt. |
| `.unavailable` | Not supported on the current platform / OS version. |

Two helpers keep call sites tidy:

- `isAuthorized` — `true` for `.granted` or `.limited`. Gate your protected work on this.
- `isTerminal` — `true` for `.denied` or `.restricted`. Use it to switch from "show request button" to "show open-Settings button".

```swift
switch status {
case _ where status.isAuthorized: showContent()
case _ where status.isTerminal:   showSettingsLink()
default:                          showRequestButton()
}
```
