# Layers web view — read-only

## Embed

Dist: `/Users/arach/dev/hudson-worktrees/lattices-editor-slice-1/apps/lattices-editor/dist/`.
Bundle all five files, including JetBrains Mono and its license. No CDN or runtime HTTP requests.
Production excludes the synthetic host and developer controls.

The native host opts into page mode with `capabilities.result.payload.chrome: "host"`.
That removes the web title/header, status bar and arrangement/panel-picker toolbar.
Panel headers remain, with window/selection counts, Clear, filename and selected lines.
Without the flag, standalone header/status/layout controls remain available.

See [the wire extension](../../docs/proposals/editor-read-bridge-v1.md#layers-page--native-chrome-extension-v7)
for `ui.command` and serialized `ui.state`. The UI operations use the discovered
subject ID and null revision. `ui.state.result` has an empty payload and correlated
request ID. Initial/restored layout and all changes are reported only in host mode.

## Appearance and behavior

- Lattices native preset in theme.css: neutral surfaces, running green, amber warnings.
- SF Rounded UI at 12.5px; JetBrains Mono only for data. 36px panel headers,
  34px window rows, 18px app tiles, count pills, selected checks and header dot.
- Stable Hudson components: grouped list, list items, badges, composer, CodeViewer,
  peer panel mounts and optional standalone chrome.
- Read-only context chips mirror Preview; removing chips deselects exact rows.
  Composer input/send stay disabled. Prompt cards are noninteractive examples.
- Both selection directions reveal their counterpart. Duplicate Source ranges are
  amber; stale configuration keeps the last good view under an amber banner.
  An initial unreadable workspace offers Retry and recovers on config.changed.
- First open remains Chat plus wider Preview (38:62). Expanded remains filled 2×2.
  Panels open on demand. The v3 layout namespace preserves chosen layouts.
- At ≤640px: Preview ≥62vh, context strip, Source, then other enabled panels.
  CSS fallback does not rewrite the saved wide layout or ui.state ordering.

## Checks (2026-10-02)

`bun run build:lattices-editor` passed. Editor and kit typechecks passed.
Scoped lint passed (only the existing missing-pages advisory). Unit tests:
**30 passed, 0 failed, 111 assertions**. Browser checks passed at 1280×820 and
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

Host projection has no layer-color or winning-match-reason field. Group markers
use the running accent (Unassigned neutral); pinned/matched hints are not guessed.
Search remains native-owned: no search/filter bridge command was specified.
This bundle does not create the native app page or chrome; native integration is
separate. No push, merge or PR.

## SHA-256

```text
c3da4864461752e8e47563d00863f42e6ab4fa5fb19e9a56acc8f57170fc8dc8  editor.css
bedff931079496384fc16cc8f13543f42bd1f007f6e383e5822c0ef0cc5ec133  editor.js
f8959618fcd68f274db3a9f718dcc1c495855e6a5bc0859944f2c31a06b0a83a  index.html
403581b69dac5cff4079205e01c6b467e56af449ecbd7247693ddb1baafa005b  jetbrains-mono-LICENSE.txt
14425ba9c695763c1547f48a206b7aa60350a33ae23de09f0407877f3fcd89eb  jetbrains-mono-latin-400-normal.woff2
```
