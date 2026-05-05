---
title: Theme
description: Runtime theming via @Environment(\.hudTheme)
order: 18
section: Design System
---

# Theme

## Overview

`HudTheme` is the runtime counterpart to Hudson's static design tokens (`HudPalette`, `HudHairline`, `HudRadius`, `HudFocus`, `HudSurface`). A theme bundles every visual token the shell + primitives read at render time, so apps can swap themes per-app or per-window via SwiftUI's environment instead of recompiling against a single static palette.

The static tokens still work — they point at the same values as `HudTheme.default`. Migration is opportunistic, not big-bang: primitives move to `@Environment(\.hudTheme)` when they're touched for another reason, or when a consuming app needs runtime theming.

## Composition

`HudTheme` is composed from four sub-themes that mirror the existing static enums:

| Sub-theme | Carries | Static counterpart |
|-----------|---------|--------------------|
| `HudThemePalette` | `bg`, `surface`, `chrome`, `ink`, `muted`, `dim`, `border`, `accent`, `accentSoft`, `statusOk`/`Warn`/`Error`/`Info` | `HudPalette` |
| `HudThemeHairline` | `subtle`, `standard` | `HudHairline` |
| `HudThemeRadius` | `tight`, `standard`, `card` | `HudRadius` |
| `HudThemeFocus` | `ring`, `ringWidth` | `HudFocus` |

Spacing (`HudSpacing`), typography (`HudFont`, `HudTextSize`), motion (`HudMotion`), and layout (`HudLayout`) remain static — they're not bundled into the runtime theme. They don't change per-template today; if that need surfaces, they'll graduate to sub-themes.

## Built-in themes

```swift
HudTheme.default     // dark surface aesthetic — mirrors HudPalette exactly
HudTheme.lightDraft  // light-theme stub — placeholder values, opt-in early feedback
```

`lightDraft` is intentionally rough — light mode is on the roadmap but not the user-facing default yet. Don't ship it as the production light theme; do mount it behind a developer flag to start gathering feedback.

## Reading the theme

```swift
import SwiftUI
import HudsonUI

struct StatRow: View {
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack {
            Text("Active")
                .foregroundStyle(theme.palette.ink)
            Spacer()
            Circle()
                .fill(theme.palette.statusOk)
                .frame(width: 8, height: 8)
        }
        .padding(HudSpacing.lg)
        .background(theme.palette.surface)
        .overlay(
            RoundedRectangle(cornerRadius: theme.radius.card)
                .stroke(theme.hairline.subtle, lineWidth: 1)
        )
    }
}
```

`@Environment(\.hudTheme)` resolves to `HudTheme.default` if no ancestor has injected one — so primitives that read from the environment continue to render correctly in untouched apps.

## Injecting a theme

Wherever you want a theme override in the view tree:

```swift
MyAppRoot()
    .environment(\.hudTheme, .lightDraft)

// Or via the convenience modifier:
MyAppRoot()
    .hudTheme(.lightDraft)
```

Per-app, per-window, or per-subtree — SwiftUI's environment resolution handles the rest. Two windows in the same app can run different themes by injecting at the window root.

## Switching at runtime

Hold the active theme in app state and re-inject:

```swift
@Observable
final class ThemeStore {
    var theme: HudTheme = .default
}

struct AppRoot: View {
    @State private var store = ThemeStore()

    var body: some View {
        ContentView()
            .environment(\.hudTheme, store.theme)
            .toolbar {
                Button("Light") { store.theme = .lightDraft }
                Button("Dark")  { store.theme = .default }
            }
    }
}
```

Theme swaps propagate through SwiftUI's normal invalidation — every view reading `@Environment(\.hudTheme)` re-renders with the new values. No manual notification plumbing.

## Custom themes

Build a fully custom theme by composing the sub-types directly:

```swift
let brand = HudTheme(
    palette: HudThemePalette(
        bg: .black, surface: Color(white: 0.08), chrome: .black,
        ink: .white, muted: Color(white: 0.65), dim: Color(white: 0.45),
        border: Color(white: 0.18),
        accent: Color(red: 1.0, green: 0.42, blue: 0.20),
        accentSoft: Color(red: 1.0, green: 0.42, blue: 0.20).opacity(0.10),
        statusOk: HudPalette.statusOk,
        statusWarn: HudPalette.statusWarn,
        statusError: HudPalette.statusError,
        statusInfo: HudPalette.statusInfo
    ),
    hairline: .default,
    radius:   .default,
    focus:    .default
)

ContentView().hudTheme(brand)
```

Apps shipping a fixed brand palette typically declare a single `static let` and inject it at the root.

## Migration policy

Existing primitives that reference `HudPalette.bg`, `HudHairline.standard`, etc. continue to render correctly under any theme that uses `default` sub-themes — because `HudTheme.default` mirrors the static enums byte-for-byte. Migrate to `@Environment(\.hudTheme)` when:

- you're already touching the primitive's file for another reason, or
- a consuming app needs the primitive to respond to runtime theme overrides.

There's no deprecation pressure on the static enums in v1 — they're the floor, the runtime theme is the ceiling.

## See also

- `HudPalette`, `HudHairline`, `HudRadius`, `HudFocus`, `HudSurface` — static token enums (`packages/native/apple/HudsonKit/Sources/HudsonUI/Tokens/`)
- `HudSpacing`, `HudLayout`, `HudFont`, `HudMotion` — static tokens not bundled into `HudTheme`
- [Theming on web](theming.md) — `--hud-*` semantic tokens and `<ThemeProvider>`
