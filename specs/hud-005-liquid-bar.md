# HUD-005 — HudLiquidBar

**Status**: Draft → ready for implementation
**Owner**: dispatched to `@codex-liquid-bar`
**Targets**: iOS 17+ (deployment), iOS 26+ for native Liquid Glass

## Summary

Bottom-anchored floating chrome primitive that uses Apple's iOS 26 Liquid Glass material when available, with a tasteful `.regularMaterial` fallback on iOS 17–25. Composable content surface — apps drop in tabs, actions, or even complications. Coexists with `HudPhoneComplications` as the alternative bottom-chrome aesthetic.

## Motivation

Hudson today has one bottom-chrome aesthetic: the bespoke Hud action tray (`HudPhoneComplications` with the `tray` / `scattered` / `minimal` renderers). That's the right look for apps that want a distinctively-Hud feel.

But there's a second use case: apps built on Hudson's *construction kit* that should feel completely native to iOS — no obvious Hudson visual signature, just well-architected app structure. For those apps, the bottom chrome should be Apple's Liquid Glass — the material every iOS 26 user already knows.

Two presentation lanes, one library:
- **Hud-aesthetic** → `HudPhoneComplications`
- **Native-aesthetic** → `HudLiquidBar` *(this spec)*

Both are first-class. The app developer picks at integration time. There is no "right" choice; it's a brand decision.

> Future: when we have a second native-aesthetic primitive (likely a top nav-title bar), introduce a `HudPresentationStyle` env value (`.hud` / `.native`) that propagates through every primitive. Out of scope for v1 — premature without two consumers.

## API surface

### Core

```swift
public struct HudLiquidBar<Content: View>: View {
    public init(
        tint: HudLiquidBarTint = .regular,
        @ViewBuilder content: () -> Content
    )

    public var body: some View
}

/// Match SwiftUI iOS 26's `Glass` variants where they exist.
public enum HudLiquidBarTint: Sendable {
    case regular        // Glass.regular on iOS 26+, .regularMaterial fallback
    case tinted(Color)  // Glass.tinted(color) on iOS 26+, color-overlaid material fallback
    case clear          // Glass.clear on iOS 26+, ultraThinMaterial fallback
}
```

### Convenience constructors

For the common cases — apps don't have to hand-roll the row layout.

```swift
public extension HudLiquidBar where Content == HudLiquidBarTabRow {
    /// Tab navigation: one selected at a time.
    init(
        tabs: [HudLiquidBarTab],
        selection: Binding<HudLiquidBarTab.ID>,
        tint: HudLiquidBarTint = .regular
    )
}

public extension HudLiquidBar where Content == HudLiquidBarActionRow {
    /// Fire-and-forget actions: each tap invokes its handler.
    init(
        actions: [HudLiquidBarAction],
        tint: HudLiquidBarTint = .regular
    )
}

public struct HudLiquidBarTab: Identifiable, Sendable {
    public let id: String
    public let icon: String        // SF Symbol
    public let title: String?      // optional label below icon
    public init(id: String, icon: String, title: String? = nil)
}

public struct HudLiquidBarAction: Identifiable, Sendable {
    public let id: String
    public let icon: String
    public let title: String?
    public let role: ButtonRole?   // .destructive etc
    public let handler: @Sendable () -> Void
    public init(
        id: String,
        icon: String,
        title: String? = nil,
        role: ButtonRole? = nil,
        handler: @escaping @Sendable () -> Void
    )
}
```

### Free-form composition (escape hatch)

```swift
HudLiquidBar(tint: .tinted(HudPalette.accent)) {
    HStack(spacing: HudSpacing.lg) {
        Button { ... } label: { Image(systemName: "house.fill") }
        Spacer()
        HudComplicationStatusDot(...)   // hosting a complication inside the bar
        Spacer()
        Button { ... } label: { Image(systemName: "person.crop.circle") }
    }
}
```

The free-form form is what enables the "complications live in the nav" composition. We don't ship a dedicated convenience for that in v1 — apps that want it use the free-form form with their own zone composition.

## Material strategy

### iOS 26+

Use the public Liquid Glass API:

```swift
.glassEffect(.regular, in: .capsule)        // for .regular
.glassEffect(.regular.tint(color), in: .capsule)  // for .tinted
.glassEffect(.clear, in: .capsule)          // for .clear
```

Wrap the bar in `GlassEffectContainer` if multiple glass children need to morph together (the convenience constructors don't need this; free-form callers can opt in).

### iOS 17–25 fallback

Best-approximation native material:

```swift
.background {
    Capsule()
        .fill(.regularMaterial)              // .ultraThinMaterial for .clear
        .overlay(
            Capsule().stroke(
                LinearGradient(
                    colors: [.white.opacity(0.18), .white.opacity(0.04)],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                lineWidth: 1
            )
        )
}
```

`.tinted` adds a translucent color overlay (`color.opacity(0.18)`) on top of the material.

### Detection

Use `if #available(iOS 26.0, *)` at the apply site. Don't introduce a separate "version-aware" branch tree — keep the iOS 26 path and fallback path adjacent and small.

## Layout & geometry

- **Anchored** to the safe-area bottom inset; honor keyboard avoidance (move with keyboard, like SwiftUI's native toolbar).
- **Floating** with horizontal padding (default `HudSpacing.lg`) so the capsule doesn't touch screen edges.
- **Max width**: 560pt — beyond that (large iPads, Mac Catalyst) the bar caps and centers.
- **Capsule shape** with `HudRadius.capsule` (or whatever the existing radius token is — confirm + use the token, don't hardcode).
- **Min height**: 56pt for tap-target compliance; expands to fit content.

Use the existing `HudSpacing` / `HudPalette` / `HudTextSize` / `HudRadius` tokens. HudLint will block hardcoded values.

## Interaction

- **Haptics**: `UIImpactFeedbackGenerator(style: .soft)` on tab change / action tap. Match HudButton's existing haptic pattern.
- **Animation**: tab selection animates with `.spring(response: 0.32, dampingFraction: 0.8)` for the selection indicator (a glass pill underneath the active tab on iOS 26+, a tinted capsule on fallback).
- **Accessibility**:
  - Each tab/action gets `accessibilityLabel` from `title ?? icon`.
  - Tabs: `accessibilityAddTraits(.isSelected)` for the active one.
  - Honor reduce-motion for the selection animation.
  - Honor reduce-transparency: swap glass/material for solid `HudPalette.bgElevated` background.

## Tests required (HudsonUITests)

- `HudLiquidBarTab` / `HudLiquidBarAction` value-type roundtrip (id, icon, title preservation)
- Tint enum exhaustiveness
- Convenience-init tab selection binding flow (state-machine test, doesn't need a host runtime)

UI-runtime testing is out of scope for unit tests; the demo gallery exercise is the integration test.

## Demo gallery

New section in `Demo/HudsonKitDemo-iOS/Sources/Tabs/PrimitivesTab.swift`:

- "Liquid bar — tabs" → `HudLiquidBar(tabs: ..., selection: $selected)` with 3 tabs, selection state visible above the bar.
- "Liquid bar — actions" → `HudLiquidBar(actions: ...)` with 3 fire-and-forget buttons; tapping logs to a `HudKVRow` showing last action.
- "Liquid bar — tint variants" → side-by-side `.regular` / `.tinted(HudPalette.accent)` / `.clear`.
- "Liquid bar — hosting a complication" → free-form composition with a status dot in the middle.

Add scrollAnchor entry. Update HudPhoneComplications demo's intro copy to mention the alternative.

## Out of scope (v1)

- macOS variant (this is an iOS bottom-chrome primitive; macOS gets a different thinking)
- Tab badge counts (icon + numeric badge overlay) — defer until a consumer asks
- Variable-height bar (extending bar) — keep it capsule-only for v1
- Top-anchored variant — defer; introduce when it becomes the second consumer of a `HudPresentationStyle.native`-mode chrome family
- Gesture dismissal / hide-on-scroll — defer
- Theming via `@Environment(\.hudTheme)` — the bar uses tokens; theming arrives once `hudTheme` lands repo-wide

## Future / explicitly deferred

- `HudPresentationStyle` env value once a 2nd native-aesthetic primitive exists
- `HudLiquidBar.complications(...)` convenience that renders a 5-zone HudPhoneComplications-equivalent inside the bar (today: use free-form composition)
- macOS Liquid Glass variants

## Quality bar

- `swift build` clean (Apple CI gates this)
- `swift test --filter HudsonUITests` passes including new HudLiquidBar tests (currently 15/15)
- `xcodebuild` iOS demo builds against the iPhone 17 Pro simulator
- HudLint zero new violations
- No purple. No hardcoded colors / sizes / radii / fonts.
- iOS 26 + iOS 17 paths both render; verify on the simulator.

## File layout

```
packages/native/apple/HudsonKit/Sources/HudsonUI/
  Liquid/
    HudLiquidBar.swift             — main view + convenience inits
    HudLiquidBarTint.swift         — tint enum
    HudLiquidBarTab.swift          — tab + tab row
    HudLiquidBarAction.swift       — action + action row
    HudLiquidBarMaterial.swift     — material modifier (iOS 26 vs fallback)
Tests/HudsonUITests/
  HudLiquidBarTests.swift
Demo/HudsonKitDemo-iOS/Sources/Tabs/
  PrimitivesTab.swift              — add 4 demo sections
```

## PR strategy

Single PR off `main`: `feat/hud-liquid-bar-v1`. Title: `🌊 HUD-005 — HudLiquidBar v1 (Liquid Glass bottom chrome)`. Reply with PR URL + LOC + iOS 26 vs fallback test notes.
