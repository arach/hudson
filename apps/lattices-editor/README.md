# Layers web view — read-only

## Embed

Dist: `/Users/arach/dev/hudson-worktrees/lattices-editor-slice-1/apps/lattices-editor/dist/`.
Bundle all six files, including JetBrains Mono 400/600 and its license. No CDN or runtime HTTP requests.
Production excludes the synthetic host and developer controls.

The native host opts into page mode with `capabilities.result.payload.chrome: "host"`.
That removes the web title/header, status bar and arrangement/panel-picker toolbar.
Panel headers remain, with window/selection counts, Clear, filename and selected lines.
Without the flag, standalone header/status/layout controls remain available.

See [the wire extension](../../docs/proposals/editor-read-bridge-v1.md#layers-page--native-chrome-extension-v7)
for `ui.command` and serialized `ui.state`. The UI operations use the discovered
subject ID and null revision. `ui.state.result` has an empty payload and correlated
request ID. Initial/restored layout and all changes are reported only in host mode.

## Overview / Workspace (v8)

Overview is the first-open default. The last view is persisted per subject under
`lattices.editor.view.v1:<subjectId>`. Native sends
`ui.command {command:"view",value:"overview"|"workspace"}`; every ui.state now
includes `view`. Standalone adds an Overview/Workspace segmented control.
Workspace stays mounted while Overview is visible, preserving CodeViewer,
selection, panel state and the v3 layout preference.

Overview retains the 212px index and pinned disabled composer. A windows table
shows native matched-rule text; unmatched entries appear as waiting rules.
Optional display maps use global point frames from the host. Preview layout is
now a read-only Overview subview with pure native proposed frames and a moves
list, not a command that moves windows. Only live current/proposed pairs receive
Moves/Stays labels. Missing geometry omits drawings; missing eligible preview
shows an unavailable notice. Narrow widths hide the maps and rule column.
Unassigned positions are white; empty layers use neutral chips and disabled
Preview. All uses an outline square, Unassigned a grey dot. Source links still
open Workspace Source and preserve duplicate ranges.

Run the Overview fixture with `?mock=1&host=1&overviewfixture=1`.
Evidence: overview-1280.png, overview-560.png, overview-to-workspace-1280.png,
overview-to-workspace-560.png. Tests cover default/restored views, native view
commands/state, data-derived facts, narrow picker, panel shortcuts and stable
CodeViewer across view switches. Remote v8 canvas remained inaccessible; this
was compared with the explicit specification and local Talkie source, not
claimed to pixel-match unseen boards. Independent review found no must-fix.

## Appearance and behavior

- The .lv v8 palette in overview.css overrides both views: neutral surfaces, green actions and amber warnings.
- SF Pro Text UI at 13px; JetBrains Mono 400/600 for data and labels. Overview layer names use SF Pro Display/system UI at 28px, weight 600. 36px panel headers,
  34px window rows, 18px app tiles, count pills, selected checks and header dot.
- Stable Hudson components: grouped list, list items, badges, composer, CodeViewer,
  peer panel mounts and optional standalone chrome.
- Read-only context chips mirror Preview; removing chips deselects exact rows.
  Composer input/send stay disabled. Prompt cards are noninteractive examples.
- Both selection directions reveal their counterpart. Duplicate Source ranges are
  amber; stale configuration keeps the last good view under an amber banner.
  An initial unreadable workspace offers Retry and recovers on config.changed.
- First open is Overview. Workspace retains Chat plus wider Preview (38:62); Expanded remains filled 2×2.
  Panels open on demand. The v3 layout namespace preserves chosen layouts.
- At ≤640px: Preview ≥62vh, context strip, Source, then other enabled panels.
  CSS fallback does not rewrite the saved wide layout or ui.state ordering.

## Checks (2026-10-02)

`bun run build:lattices-editor` passed. Editor and kit typechecks passed.
Scoped lint passed (only the existing missing-pages advisory). Unit tests:
**40 passed, 0 failed, 166 assertions**. Browser checks passed at 1280×820 and
640×820 in standalone and host modes, including commands/state, chrome gating,
header metadata, stable Source through layout and recovery, and narrow ordering.
The full HudsonKit package build also passed.

`bun run test:lattices-editor:browser` rebuilds the isolated development bundle
and refreshes evidence. It uses installed Chrome or EDITOR_BROWSER_EXECUTABLE.
For manual fixture use: `dist-dev/index.html?mock=1&host=1`; add `&unreadable=1`
for the initial read-error state. Native application was not launched or tested.

## Evidence and limits

[design-evidence](./design-evidence/) contains refreshed standalone captures and:
- host-main-1280.png
- host-context-source-1280.png
- host-expanded-1280.png
- host-narrow-640.png
- host-states-ambiguous-1280.png
- host-states-stale-1280.png
- host-states-unreadable-1280.png
- host-boards-contact-sheet.png (side-by-side inspection before commits)

The remote v7 canvas was inaccessible. Implementation follows the explicit
operator requirements and checked native HudThemeBridge.swift mapping; the
contact sheet compares our board equivalents, not unseen reference pixels.
Independent bounded review found no material must-fix issues.

Workspace group markers use the running accent (Unassigned neutral). Overview rule text is shown only for the native matchedRule index; ambiguous duplicates do not get a guessed winning rule.
Search remains native-owned: no search/filter bridge command was specified.
This bundle does not create the native app page or chrome; native integration is
separate. No push, merge or PR.

## Short-height checks

Overview keeps the composer visible at 1280×650, 1280×820 and 560×650; only the reading content scrolls. Workspace keeps its full input visible in a 290px Chat panel while context and Try content scroll independently. Browser regression checks and refreshed screenshots cover both. Build, typecheck, lint and all 40 unit tests pass.

## Shared layer selection

Native capabilities seeds the ordered selectedLayerIds. All windows is []; Cmd/Ctrl-click toggles index rows; native commands update the index without switching views or changing row/source selection. Every ui.state includes full layout and selectedLayerIds. Standalone selection persists locally. Counts come directly from projection groups. Evidence: desk-all-1280.png, desk-layer-1280.png, desk-multi-1280.png. Optional read-only arrangement geometry is now enabled when the host supplies it.

## Arrangement evidence and comparison limit

Use `?mock&host&pass2` for the synthetic three-display fixture.
Screenshots: pass2-overview-1280.png, pass2-empty-1280.png,
pass2-unassigned-1280.png, pass2-preview-1280.png, pass2-overview-560.png.
The requested Main/EmptyLayer/Unassigned/PreviewLayout/Register canvas exports
were unavailable: web access failed and the coordinator exported only DeskAll
before stopping desktop interaction. No pixel-match claim is made. The written
brief and current register were checked; bounded review found no must-fix
geometry/provenance or screenshot issues. ChatAnswer was not implemented.

## SHA-256

```text
4ec2fa012a6479509b00a6fc7787de05ad2691c85817161df14c312a575a467a  editor.css
d98536f4e0fb748d5821a943222eeefbbc74dcce18803ecd2100b932e661e330  editor.js
6ceb52eedcfc21964230e4e1793d4e9703b7d76393b8a3808229b6c30c19c208  index.html
403581b69dac5cff4079205e01c6b467e56af449ecbd7247693ddb1baafa005b  jetbrains-mono-LICENSE.txt
14425ba9c695763c1547f48a206b7aa60350a33ae23de09f0407877f3fcd89eb  jetbrains-mono-latin-400-normal.woff2
400c6bfda18d5d14acad1c15d6dcb9f8e13c015e7286317e0b9a482539bef147  jetbrains-mono-latin-600-normal.woff2
```
