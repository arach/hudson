---
title: iOS Shell
description: HudPhoneAppShell + HudPhoneComplications for iPhone apps
order: 11
section: "iOS Apps"
---

# iOS Shell

## Overview

`HudPhoneAppShell` is the iPhone sibling of `HudAppShell`. The macOS/iPad-regular chassis ships a leading rail, trailing inspector, and drawers; the phone shell wraps your root view in a `NavigationStack` and coordinates a five-zone HUD of programmable affordances called **complications**.

Pages own state; the shell renders chrome. Pages publish complications via `View.hudComplications(_:)`; the shell reads the preference and dispatches to the chosen renderer. Native `.sheet`, `.fullScreenCover`, and `.toolbar` modifiers stay available — the shell doesn't own modal presentation.

## HudPhoneAppShell

```swift
import HudsonShell
import HudsonUI

struct RootView: View {
    var body: some View {
        HudPhoneAppShell(complicationsStyle: .tray) {
            ContentView()
                .navigationTitle("Home")
                .navigationBarTitleDisplayMode(.inline)
                .hudComplications(complications)
        }
    }
}
```

### Init parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `complicationsStyle` | `HudPhoneComplicationsStyle` | `.tray` | Which renderer dispatches the published complications. |
| `background` | `Color` | `HudPalette.bg` | Fills the safe area behind `root`. |
| `root` | `() -> Root` | — | The page content; should publish complications via `.hudComplications(_:)`. |

## HudPhoneComplications

Five positions, each hosting a primary `Slot` plus an optional secondary chip:

```
+-----------------------------+
|  [TL]·s          s·[TR]     |   ← top corners (ToolbarItems)
|                             |
|          content            |
|          ╭─────╮            |
|          │  ★  │            |   ← center
|  [BL]              [BR]     |   ← bottom corners
+-----------------------------+
```

```swift
let complications = HudPhoneComplications(
    topLeft:  .init(icon: "list.bullet",     action: showLogs),
    topRight: .init(icon: "ellipsis.circle", action: showMenu),
    bottomLeft:  .init(icon: "gearshape",          action: openSettings),
    bottomRight: .init(icon: "rectangle.3.group",  action: openShell),
    center: .init(
        icon: "circle.grid.2x2",
        role: .accent,
        longPressModes: [
            .init(id: "tray",      icon: "rectangle.bottomthird.inset.filled", label: "Tray")      { style = .tray },
            .init(id: "scattered", icon: "circle.grid.cross.fill",             label: "Scattered") { style = .scattered },
            .init(id: "minimal",   icon: "circle.fill",                        label: "Minimal")   { style = .minimal },
        ],
        action: openComplications
    )
)
```

### Slot

| Name | Type | Description |
|------|------|-------------|
| `icon` | `String` | SF Symbol name. |
| `role` | `Role` | `.standard`, `.accent`, or `.destructive`. Drives fill, stroke, and icon colors. |
| `label` | `String?` | Optional text label (renderer-specific). |
| `secondary` | `Secondary?` | A smaller chip attached to the slot's outer side. |
| `longPressModes` | `[Mode]?` | Alternative actions surfaced on long-press. |
| `action` | `() -> Void` | Tap handler. |

### Mode (long-press semantic)

Long-press reveals a slot's `longPressModes` — **alternative actions for that slot**, not a hidden navigation menu. The demo wires center so tap opens the Complications page while long-press cycles renderer styles. The slot's role doesn't change; you pick a variant of *its* job.

## Render styles

| Style | Behavior |
|-------|----------|
| `.tray` | Default. Bottom three (BL, center, BR) grouped in a glass-material tray via `safeAreaInset(.bottom)`. Top two render as `ToolbarItem`s inline with the nav title, Talkie-style. |
| `.scattered` | All five slots float as corner overlays. No grouping, no tray. |
| `.minimal` | Center only; other positions ignored. For focus or takeover flows. |

## Preference plumbing

`View.hudComplications(_:)` writes into `HudPhoneComplicationsKey`. The shell observes via `onPreferenceChange` and re-renders. Last non-nil writer wins, so a child page can override container defaults without prop-drilling.

```swift
content
    .navigationTitle(page.title)
    .hudComplications(activeComplications)   // page publishes
// HudPhoneAppShell reads the preference and dispatches to the renderer.
```

For the full design rationale on slot variants and the open-slot vs. variant-enum contract, see `HUD-002` in `packages/native/apple/HudsonKit/Docs/`.
