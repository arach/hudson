---
title: "QR Code"
description: "QR generation + scanning primitives (Apple)"
order: 16
section: "iOS Apps"
---

# QR Code

## Overview

`HudQRCode` and `HudQRScanner` are paired primitives for QR pairing flows. Generation is cross-platform (iOS + macOS) via CoreImage. Scanning is iOS-only via `AVCaptureSession`; macOS shows an empty-state placeholder. Import from `HudsonUI`.

## HudQRCode

Generates a QR via `CIQRCodeGenerator`, recolors via `CIFalseColor`, and renders as a sharp `Image` with `.interpolation(.none)` so the pixel grid stays crisp at any size.

```swift
struct PairingShareView: View {
    let pairingURL: String

    var body: some View {
        HudQRCode(
            pairingURL,
            size: 240,
            errorCorrection: .high
        )
    }
}
```

### Init parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `String` | — | The string to encode. Empty content renders an error placeholder. |
| `size` | `CGFloat` | `HudLayout.qrCodeDefault` (200) | Width + height in points. |
| `foreground` | `Color` | `HudPalette.ink` | Module color. |
| `background` | `Color` | `HudPalette.surface` | Background fill. |
| `errorCorrection` | `ErrorCorrection` | `.medium` | `.low` (~7%), `.medium` (~15%), `.quartile` (~25%), `.high` (~30%). Pick `.high` when printed, photographed, or overlaid with a logo. |

The view is accessibility-aware: it announces as "QR code" with the encoded content as its value.

## HudQRScanner

Wraps `AVCaptureSession` with a viewfinder overlay, debounces duplicate scans within 1.5s, and vibrates on each accepted code via `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)`.

```swift
struct PairingScanView: View {
    var body: some View {
        HudPermissionGate(.camera, rationale: "Scan a pairing QR to link this device.") {
            HudQRScanner { code in
                pair(with: code)
            }
        }
    }
}
```

The scanner assumes camera access is granted; calling it without permission yields a black preview, never a crash. Always wrap with `HudPermissionGate(.camera, …)` so denial flows render the Settings deep-link automatically. See [Permissions](./permissions.md).

### Init parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `isActive` | `Bool` | `true` | Toggle the capture session. Set `false` off-screen to release the camera. |
| `showsViewfinder` | `Bool` | `true` | Overlay corner brackets + centered cutout in a scrim. |
| `onScan` | `(String) -> Void` | — | Called on the main queue with each accepted scan. |

### Platform behavior

iOS renders a live preview with viewfinder, orientation tracking, and vibration on scan. macOS renders a `HudEmptyState` reading "QR scanner unavailable".

Don't forget `NSCameraUsageDescription` in your Info.plist. `HudPermission.camera.infoPlistKey` returns the exact key.
