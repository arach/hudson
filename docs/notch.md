---
title: "Notch"
description: "HudNotch: a notch or island surface that tools post to and people answer from"
order: 13
section: "macOS Apps"
---

# Notch

## Overview

HudNotch puts a small surface at the top of the screen. On a display with a camera housing, it grows out of the housing as two wings with concave shoulders. On other displays, it draws a black island in the same place. Tools post **activities** to it over a Unix socket. An activity can ask a question, and the answer goes back to the tool that asked.

The notch never activates its app and never takes key on its own. It opens when something needs attention and folds back to a pill. The person can hover over it, or click it, to reopen it. A panel only becomes key when the person clicks into its reply field.

Three products:

| Product | What it holds |
| --- | --- |
| `HudsonNotchCore` | Activity model, wire format, stage reducer, socket server and client, configuration and metrics. Foundation only, no UI. |
| `HudsonNotch` | `HudNotchController`, `HudNotchSurface`, shapes, `HudNotchTuner`. Depends on HudsonUI and HudsonShell. |
| `hudson-notch` | Command-line client. |

`HudsonNotchDemo` is a menu bar host for trying it out.

## Activities

An activity is one piece of work from one sender, keyed by `id`. Posting the same `id` again updates it in place.

| Field | Meaning |
| --- | --- |
| `id` | Stable key. Reuse it to update. |
| `source` | Shown as the eyebrow (for example `Xcode`). |
| `title`, `detail` | The card's text. |
| `state` | `notice`, `working`, `waiting`, `done` or `failed`. |
| `tone` | `info`, `success`, `warning` or `error`. Defaults from the state. |
| `progress` | 0 to 1. Draws a bar on the card and a ring on the pill. |
| `choices` | Buttons: `{id, title, role}`, where the role is `primary`, `normal` or `cancel`. |
| `replyPrompt` | Adds a text field with this placeholder. |
| `link` | `{title, url}`, opened with the default handler. |
| `ttl` | Seconds the notch stays open. The default is 6, or 12 for an activity that asks. |

When an activity has choices or a reply prompt, it defaults to `waiting`.

Attention rules, in `HudNotchStage`:

- A new activity, a state change, a new question or a new title opens the notch.
- Updates that only change progress or detail don't open it, so a working job can stream progress quietly.
- The collapsed pill shows the oldest waiting activity first, then the newest working one.
- Once the stage is over capacity (8 by default), settled activities are evicted. Ongoing ones never are.

## Wire format

The wire is JSON lines on `~/Library/Application Support/Hudson/notch.sock`. The socket's directory is created with mode 0700 and the socket with 0600.

```json
{"op":"post","id":"job-42","source":"Claude Code","title":"Keep the old link?","choices":[{"id":"keep","title":"Keep","role":"primary"},{"id":"later","title":"Later","role":"cancel"}]}
{"op":"dismiss","id":"job-42"}
{"op":"pulse"}
{"op":"subscribe"}
```

The notch writes back:

```json
{"op":"reply","id":"job-42","choice":"keep","at":"2026-09-24T03:52:00Z"}
{"op":"reply","id":"job-42","text":"the old link is in the changelog","at":"…"}
{"op":"dismissed","id":"job-42"}
```

A response goes to two places: the connection that posted the waiting activity, if it's still open, and every connection that sent `subscribe`. A sender that writes one line and closes still works. A line without `op` is read as a post. The older event shape (`body`, `level`, `action`, `agent.name`) maps onto the matching activity fields.

Pressing a `cancel` choice or the close button sends `dismissed`. Any other choice, or submitting the reply field, sends `reply`. The card then shows the answer and waits for the sender's next post.

## Command line

```bash
hudson-notch post --id build --source Xcode --title "Building fab" --state working --progress 0.4
hudson-notch post --id build --source Xcode --title "Building fab" --state done

hudson-notch ask --title "Keep the old link?" \
  --choice keep:Keep:primary --choice redirect:Redirect --choice later:Later:cancel \
  --reply-prompt "Or say why" --timeout 120
# {"at":"…","choice":"keep","id":"…","op":"reply"}

hudson-notch listen      # every reply and dismissal, as JSON lines
hudson-notch dismiss build
hudson-notch pulse
```

`ask` exits 0 on a reply, 2 on a dismissal and 3 on a timeout. Every command takes `--socket PATH`.

From Swift:

```swift
let client = HudNotchClient()
try client.send(.post(HudNotchActivity(id: "build", source: "Xcode", title: "Building", state: .working, progress: 0.4)))

let answer = try await client.ask(
    HudNotchActivity(title: "Keep the old link?", choices: [
        HudNotchChoice(id: "keep", title: "Keep", role: .primary),
        HudNotchChoice(id: "later", title: "Later", role: .cancel),
    ]),
    timeout: 120
)
```

## Hosting it

```swift
let notch = HudNotchController(
    persistenceKey: "MyApp.notch",
    copy: .init(name: "MyApp", idleTitle: "Nothing running", idleDetail: "Updates appear here")
)
notch.start()
try notch.serve(socketURL: myAppSupport.appendingPathComponent("notch.sock"))
notch.onResponse = { response in /* in-process listeners */ }

// In-process, without the socket:
notch.post(HudNotchActivity(title: "Saved", state: .done))
```

Give each host its own socket URL so two notch apps never share one. If a socket is already live, `serve` throws `alreadyRunning`. A stale socket file is replaced.

Answers get ⌘1…⌘9 in order and a `cancel` choice gets Escape. They work once the person has clicked into the notch, since it never takes key on its own.

### Theme

`HudNotchTheme` dresses the notch in the host's brand. Pass it as `theme:` to `HudNotchController`. The default, `.hudson`, uses HudsonUI's palette and type.

| Field | What it sets |
| --- | --- |
| `body` | The body's color. Keep it near black so it still reads as part of the housing. |
| `ink`, `muted`, `dim` | Text colors. |
| `accent` | The idle dot and anything not tied to an activity's tone. |
| `tones` | Overrides for tone colors. Tones without one use Hudson's status colors. |
| `eyebrowFont`, `titleFont`, `detailFont` | Type for the source line, the title and the detail. |
| `action`, `actionInk` | Fill and label for the primary choice. With `action` set, choices are drawn in the theme's colors with their ⌘ key shown. Nil keeps Hudson's buttons. |
| `mark` | A view drawn in place of the status dot on the left wing and before the eyebrow. It is tinted with the activity's tone. |

```swift
let theme = HudNotchTheme(
    body: Color(red: 0.043, green: 0.039, blue: 0.031),
    accent: brandOrange,
    titleFont: .custom("EB Garamond", size: 18),
    action: brandOrange,
    mark: AnyView(LogoShape().fill())
)
let notch = HudNotchController(persistenceKey: "MyApp.notch", copy: copy, theme: theme)
```

`HudNotchTuner(controller:)` is a settings view for the shape: pokeout, radii, overlap, card heights, timing and display mode (automatic, notch or island). Changes persist under the `persistenceKey`.

## Motion

The notch is one black silhouette, `HudNotchSilhouetteShape`, drawn at different sizes for each state, so every change is a morph rather than a crossfade:

| State | Silhouette |
| --- | --- |
| Tucked in | The size of the camera housing, where the hardware hides it. On a display without one it starts faded out. |
| Pill | The housing plus the wings, with concave shoulders against the top of the screen. The island is a capsule. |
| Card | The open card, with the same shoulders and 22 pt bottom corners. |

`HudNotchMotion` holds the timing:

- Opening and appearing use an underdamped spring (`open`), so the card stretches a few points past its size and settles.
- Closing and hiding use a tighter spring (`close`), so the shape tucks back without wobbling against the housing. `hide()` waits `retractSeconds` for it before ordering the panel out.
- Size changes within a state, such as hover reach or a taller card for a question, use `resize`.
- Width runs on its own, springier curves (`widthOpen`, `widthResize`), so an open or a resize stretches a few points sideways and settles while the height stays calm. Closing keeps `close` for both.
- Content fades in with a light blur and lift about 90 ms after the shape starts. On close it fades while the shrinking silhouette masks it, so it reads as drawn back into the housing.
- Something new arriving while the card is open gives it a small stretch (`nudgeOut`, then `nudgeBack`) along with the tinted outline flash.

With Reduce Motion on, state changes happen without springs and content only fades.

## Appearance

`HudNotchConfiguration.appearance` sets how the body is drawn, with one `HudNotchLook` for the pill and one for the card. The tucked state uses the pill's look. Every value animates with the state change.

| Field | Range | What it does |
| --- | --- | --- |
| `fillOpacity` | 0–1 | Opacity of the black body. Below 1 the desktop shows through. |
| `blur` | 0–1 | Strength of the frosted backdrop under the body. Only visible when the fill is see-through. |
| `borderWidth` | 0–3 pt | Width of the rim. |
| `borderOpacity` | 0–1 | Brightness of the white rim. In notch style it fades out toward the top, so it never outlines the edge that meets the menu bar. |
| `shadowOpacity`, `shadowRadius`, `shadowY` | 0–1, 0–40 pt, 0–24 pt | The shadow. It is cut out of the body, so a see-through body never shows it from inside. |

There are three presets: `solid` (the default, opaque like the housing), `smoked` and `glass`. The Tuner's Appearance section applies a preset and edits either state's look. Saved configurations without an appearance decode as `solid`.

## Tests

```bash
swift test --filter HudsonNotchCoreTests
```

The tests cover wire decoding, including the legacy shape, the stage's attention rules, metrics, lenient configuration decoding, and a socket round trip with ask, respond and subscribe. The socket tests use a short `/tmp` path because `sun_path` holds only 104 bytes.
