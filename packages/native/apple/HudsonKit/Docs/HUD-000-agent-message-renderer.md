# HUD-000: Agent Message Renderer

## Status

Landed (Hudson side) — 2026-06-22. OpenScout chose option (b).

## Driver

OpenScout (Lattices renderer extraction request) asked Hudson to confirm the
public API shape for moving Scout's agent-tuned assistant-message renderer into
`HudsonUI`.

## Audience

OpenScout (`openscout.port-range-revamp`), Lattices.

## What landed (option b, minimal + back-compat)

- `Primitives/HudMarkdownParser.swift` (new) — `HudMarkdownBlock` (+ `Kind`) and
  `HudMarkdownParser` moved here, `import Foundation` only (no SwiftUI), both now
  `Sendable`. Empty fence language normalizes to `nil`.
- `Primitives/HudMarkdownStyle.swift` (new) — `HudMarkdownStyle` skin with
  `.mono` (default, == prior look) and `.agent` (UI-font body/headings/list,
  mono markers + code). Colors via `ColorRole` resolved against `hudTheme`.
- `Primitives/HudMarkdownView.swift` — view-only now; gains `style:` and
  `inlineTransform:` params, both defaulted. `HudMarkdownView(text:contentSize:)`
  stays source-compatible (Lattices unaffected). Code still via `HudCodeBlock`.
- `Tests/HudsonUITests/HudMarkdownTests.swift` (new) — 12 parser/style tests.
  `swift build` + `swift test --filter HudMarkdown` + `make lint` all green.

Scout migration: parse with `HudMarkdownParser`, render with
`HudMarkdownView(text:, style: .agent, inlineTransform: { ScoutFileLinkifier.apply(to: $0, accent:, baseDirectory:) })`,
and keep `.environment(\.openURL, …)` + a Scout-mapped `HudTheme` at the call site.

## TL;DR

- **Do not add a third parser.** Hudson already owns
  `HudMarkdownParser`/`HudMarkdownBlock` (`Primitives/HudMarkdownView.swift`),
  which is the *same algorithm* as Scout's `MessageMarkupParser`. Converge to
  one. Don't introduce `HudMessageMarkupParser`/`HudMessageMarkupBlock`.
- **Do not fork the view.** Evolve `HudMarkdownView` with one optional seam —
  `inlineTransform` — instead of adding a parallel `HudAgentMessageView`.
- **Keep all `openscout-file://` / `openURL` / `baseDirectory` logic in Scout.**
  The proposal already says this; it's the right call. Hudson stays
  provider-agnostic.
- **One real decision is yours, not mine:** typography. `HudMarkdownView` is
  all-`HudFont.mono` + `hudTheme`; `ScoutMarkdownView` uses `HudFont.ui` body +
  `ScoutPalette`. Pick "adopt mono+theme" (no new API) vs "preserve UI-font
  body" (needs a small style struct). See [Open decision](#open-decision).

## What exists today (verified)

| Piece | Location | Notes |
|---|---|---|
| `HudMarkdownBlock` / `HudMarkdownParser` | `HudsonUI/Primitives/HudMarkdownView.swift` | `public`. **Not** `Sendable`; lives behind `import SwiftUI` only because it shares a file with the view. |
| `HudMarkdownView(text:contentSize:)` | same file | Themed via `@Environment(\.hudTheme)`; all-mono; `inline()`/`inlineMarkdown()` are **private** (the seam Scout needs). Code → `HudCodeBlock`. |
| `HudCodeBlock(language:source:codeSize:)` | `HudsonUI/Primitives/HudCodeBlock.swift` | `public`, tokenized highlighting. |
| `HudTheme` / `HudThemePalette` | `HudsonUI/Tokens/HudTheme.swift` | `public`, `Sendable`, public `init` → **consumers can construct a Scout-mapped theme.** |
| `MessageMarkupParser` / `MessageMarkupBlock` | `scout-native-core/.../MessageMarkup.swift` | `public`, `Sendable`, Foundation-only. Byte-for-byte the same parse logic as `HudMarkdownParser`, modulo one divergence (below). |
| `ScoutMarkdownView` | `openscout apps/macos/.../ScoutRootView.swift:2775` | Injects `.environment(\.openURL, …)`, `baseDirectory`, and `ScoutFileLinkifier.apply(to:accent:baseDirectory:)` inside its private `inline()`. UI-font body + `ScoutPalette`; `MessageCodeBlock`/`ScoutMarkdownTable`. |
| `ScoutFileLinkifier.apply` | `openscout apps/macos/.../ScoutFileLink.swift:119` | `(AttributedString, accent, baseDirectory?) -> AttributedString`. Already exactly the shape of an injectable inline transform. |
| `PiChatMarkdownView` | `lattices apps/mac/.../PiChatMarkdown.swift` | Already a thin wrapper over `HudMarkdownView(text:contentSize:)`. Lattices is *already on Hudson*. |
| iOS render | `openscout apps/ios/Scout/MessageMarkupView.swift` | Uses `MessageMarkupParser`. **iOS already `import HudsonUI`** (ScoutApp/RootView/StatusBar…). |

**Portability is a non-issue:** both Scout macOS *and* iOS already depend on
`HudsonUI`. The parser only lives in `scout-native-core` to stay Foundation-pure;
we can preserve that property inside HudsonUI (see below) without a new target.

## Recommendation

### 1. One parser, made Foundation-pure and `Sendable`

Keep `HudMarkdownParser` / `HudMarkdownBlock`. Two trivial changes:

- Mark `HudMarkdownBlock` and `HudMarkdownBlock.Kind` `: Sendable` (all value
  types — free).
- Split the parser into its own file (`Primitives/HudMarkdownParser.swift`,
  `import Foundation`, no SwiftUI). This matches the project's recent
  one-type-per-file move (commit `12ffbf9`, HudAIClient split) and lets any
  non-SwiftUI call site consume it.

Reconcile the **one** behavioural divergence during migration: Hudson's
`fenceLanguage` returns `nil` for an empty language (→ `.code(language: nil)`);
Scout returns `""`. Standardize on Hudson's `nil`. After this, Scout deletes
`MessageMarkupParser` (core + the `ScoutSharedUI` shim) and repoints
`MessageMarkupView` (iOS) and `ScoutMarkdownView` (macOS) at `HudMarkdownParser`.

### 2. One view, with an `inlineTransform` seam (not a second view)

```swift
public init(
    text: String,
    contentSize: CGFloat = 13,
    inlineTransform: ((AttributedString) -> AttributedString)? = nil
)
```

`HudMarkdownView`'s private `inline(...)` applies `inlineTransform` after
`inlineMarkdown(...)`. Scout passes
`{ ScoutFileLinkifier.apply(to: $0, accent: theme.accent, baseDirectory: base) }`.

Scout keeps owning link *behavior* at its own call site — it wraps the view and
sets `.environment(\.openURL, OpenURLAction { … })` plus `baseDirectory`. Hudson
never learns about `openscout-file://`.

**This is backwards-compatible:** `inlineTransform` defaults to `nil`, so
Lattices' `PiChatMarkdownView` keeps compiling untouched and can opt into its own
transform later.

### 3. `HudAgentMessageView` — only if there's *chrome*, not markup

Add it only if Hudson wants agent-message **affordances beyond markdown** — role
header, avatar, copy/regenerate buttons, streaming caret. For "markdown + an
injectable inline transform," that's a *parameter*, not a new public type, and a
second 90%-overlapping view just creates a sync-drift surface. If you want the
name for call-site clarity, make `HudAgentMessageView` a thin wrapper/typealias
over `HudMarkdownView`; the substance stays the transform param.

## Open decision (yours)

`HudMarkdownView` renders **all-`HudFont.mono` + `hudTheme`**. `ScoutMarkdownView`
renders **`HudFont.ui` body/headings + `ScoutPalette`** (mono only for list
markers/code). Migrating Scout onto `HudMarkdownView` as-is is a visible restyle.

- **(a) Adopt mono + theme (recommended if acceptable):** Scout injects a
  `HudTheme` whose palette maps `ScoutPalette` (ink/muted/accent/dim/border/
  surface). `HudThemePalette` is public + constructible, so color parity is
  free. **No new Hudson API** beyond §1–§2.
- **(b) Preserve UI-font body:** Hudson adds a small `HudMarkdownStyle` (body /
  heading font roles + spacing) parameter. Bigger public surface; only worth it
  if UI-font body is a hard product requirement for Scout.

I recommend **(a)**. Tell me if Scout needs **(b)** and I'll spec the style struct.

## Migration concerns / checklist

- **Code block parity:** `HudCodeBlock` replaces Scout's `MessageCodeBlock` +
  `MessageCodeBlockStyle`. Confirm theme-driven styling covers what Scout's style
  struct configured (label/code fonts, inset, border) — if not, that's the one
  place we may need a knob.
- **Table parity:** Hudson's built-in table view replaces `ScoutMarkdownTable`;
  diff the visuals before deleting Scout's.
- **iOS:** `MessageMarkupView` repoints to `HudMarkdownParser` — low-risk since
  iOS already imports HudsonUI, but it's a SwiftUI render path swap, so smoke-test
  it.
- **`ScoutFileLinkifier` stays in Scout** as the injected transform — no Hudson
  dependency on `openscout-file`.
- **Lattices:** no change required; opt into a transform later if it wants file
  links.

## Next move

Hudson owns landing §1 (parser split + `Sendable`) and §2 (`inlineTransform`
seam) once OpenScout picks **(a)** or **(b)** in [Open decision](#open-decision).
That choice is the only blocker on a concrete PR.
