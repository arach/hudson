# Lattices Editor — slice 1

Read-only Hudson app over the locked native bridge in
[editor-read-bridge-v1.md](../../docs/proposals/editor-read-bridge-v1.md).
No config writes, agent session or desktop effects are exposed.

## Build and check

From this worktree's root:

```sh
bun run build:lattices-editor
bun x tsc --noEmit -p apps/lattices-editor/tsconfig.json
bun x tsc --noEmit -p packages/web/hudsonkit/tsconfig.json
bun run lint apps/lattices-editor packages/web/hudsonkit/src/editor packages/web/hudsonkit/src/editor-panels.tsx packages/web/hudsonkit/src/editor-workspace.ts
bun run test:lattices-editor
bun run test:lattices-editor:browser
```

Bundle directory:
`/Users/arach/dev/hudson-worktrees/lattices-editor-slice-1/apps/lattices-editor/dist/`.
Embed all three files unchanged. There are no runtime HTTP requests or CDN assets.

Production excludes the synthetic transport and controls. For an isolated fixture:

```sh
bun apps/lattices-editor/build.ts --dev
```

Open `apps/lattices-editor/dist-dev/index.html?mock=1` in a browser.
The labelled synthetic controls exercise config/inventory events, invalid reads,
recovery and stale revisions. Both duplicate entries map to one key, all UTF-16
ranges and one projected row. Without the explicit development flag and query,
the client uses only the native handler. Generated bundles are ignored by git.

## Verification (2026-10-01)

- Production and development editor builds passed. Full HudsonKit package build
  also passed (including ESM, declarations and CSS).
- Editor and HudsonKit typechecks passed (exit 0).
- Targeted lint over all changed TypeScript/TSX and build/config files passed
  (exit 0). Existing Next ESLint configuration prints a missing-pages-directory
  advisory; there are no lint findings.
- Bun tests: **25 passed, 0 failed, 89 assertions**. Covers reply correlation,
  timeout, missing handler, disposal, revision mismatch, stale retry, generation/
  ABA protection, events before subscribe reply and during projection, null
  discovery revision, unavailable/recovery, bootstrap Retry, duplicate UTF-16
  ranges, selection capture, layout persistence, and StrictMode portal lifecycle.
- Headless Chrome browser checks passed: older-host fallback, both cross-selection
  directions, duplicate highlighting, live History/config updates, invalid-read
  recovery, stale retry, hide/reflow, move, focus, keyboard resize, reload
  persistence, narrow stacking without wide-layout overwrite, no console errors.
- Committed design evidence at 1280×820 and 640×820: [design-evidence](./design-evidence/).
  Reproduce with bun run test:lattices-editor:browser; this builds a development
  fixture and runs headless Chrome, never the native app. Set
  EDITOR_BROWSER_EXECUTABLE for a different Chromium executable.
  The script asserts chips/removal, empty groups, Unassigned ordering, keyboard
  selection, both scroll directions, editor identity and range visibility after
  layout changes, History, narrow ordering/height and unchanged wide storage.
- Design detector: only advisory undocumented type/color ramps; DESIGN.md
  reconciles those tokens. Independent reviewer scored the narrow unused space,
  Source scroll context and resize capture issues resolved and returned ship
  for the reviewed design scope.
- Production bundle string check confirms mock fixture and controls are absent.

## Read-only flow design pass

The header combines title, Read only, selection summary/Clear and inspection
actions. The existing layout toolbar remains a compact second row (28px);
there is no header slot for it, so no shell fork was added. Panel headers are
28px. showActions?: boolean is a generic panel option, defaulting to the
existing visible menus; this app hides them. Panels still show/hide through
the picker and reorder through drag or Alt+Arrow on the panel handle.

Chat mirrors live window context as removable app/title chips, with honest
disabled composer copy and noninteractive future examples. Preview uses
30px keyboard-accessible rows, local initial glyphs, sticky group bands,
single-line empty groups and Unassigned last. Arrow keys move the active row;
Space/Enter selects; Cmd/Ctrl+Space toggles additive selection. Explicit row
selection and chip removal remain exact even when multiple rows share one
entry; this is an implementation fix, not a model or bridge contract change.

Source reveals the first selected range using nearest, instant scrolling;
Source selection reveals the matching Preview row. Duplicate ranges remain
highlighted. The kit avoids reparenting unchanged panel nodes, preserving
CodeMirror and scroll context during layout changes. Controlled text refresh
keeps bounded cursor offsets.

At narrow widths Preview comes first with at least 60vh, expanding into any
unused height; Chat is a compact chips-only surface second. History and Source
follow. This is CSS presentation only and does not alter saved wide layouts.
History uses one empty-state line, newest-first relative times with absolute
tooltips and short revision hashes.

**Deliberately omitted:** pinned/matched reason hints. Entry.canonical describes
the configured rule, pins and saved state, but not which reason actually won
for this row (including companion/group matches). Reliable hints need an
explicit native per-row match reason, ideally correlated to the winning entry
key. No host or wire contract was changed or guessed.

## Starting preset restored to spec V2

First open shows Chat and Preview side by side at 38:62, with Preview wider.
Source, History & Results and Terminal open on demand through Panels.
Inspect Source opens Source without losing selection or panel state.
Expanded layout remains a filled 2×2 grid: Chat/Preview above History/Source,
with Terminal hidden. Singular/plural selection text and narrow stacking remain.

The app-specific `lattices.editor.layout.v3` namespace resets v1/v2 layouts
to the starting preset once. Later user changes, including Expanded layout,
are restored on return; old namespace data is preserved.

Regression tests cover both presets, v1/v2 migration, retained subsequent
choices, subject isolation and pluralization. Headless Chrome verified the
wider Preview, initially hidden optional panels, Inspect Source retaining
duplicate highlights, Expanded 2×2, chosen-layout restoration and narrow
stacking without overwriting wide settings. Evidence is in
`/tmp/hudson-editor-browser-check/preset-v3.ts`, `desktop-v3.png` and
`mobile-v3.png`.

The coordinator previously verified native membership, cross-selection and
layout persistence. This revised bundle was checked in the browser; this
session did not relaunch the native app.

## Acceptance boundaries

| Acceptance | Hudson evidence |
| --- | --- |
| Editor opens; panels; Terminal hidden; Chat reflows | Browser verified. First open shows Chat and wider Preview. Other panels open on demand without losing state. Expanded remains a filled 2×2 grid, Terminal hidden. The v3 namespace resets old presets once; subsequent chosen layouts are restored. |
| Preview membership matches Lattices | Client renders host groups/rows without recomputing membership. Native live comparison pending. |
| Bidirectional selection, duplicate ambiguity | Model and browser checks pass. All duplicate ranges highlighted and ambiguity labelled. |
| External assign updates Source/Preview/History in about a second | Synthetic events update atomically without reload; generation guard tests pass. Native assign latency/flicker measurement pending. |
| Layout survives reopen; narrow stacks | Browser reload persistence, show/hide/move/focus/resize and 500px stacking pass. Native close/reopen remains pending. |
| Older host shows unavailable | Production browser check passes exact fallback text. Unreadable subject is a recoverable read error instead. |
| No config writes or desktop actions | Only four read-only calls; test asserts allowlist. No native app launch or desktop action performed. |

The native builder must import this approved bundle and run a separately authorized
live integration pass. Browser/mock verification is not native end-to-end proof.
No push, merge or PR was performed.

## Approved asset SHA-256

```text
ad57c97a9583367d73d9f86db4b0511a5243d199d777233c821d483d2d13ac7e  editor.css
a9a549ed933d52714aa7812d792bf4c4cc9fe0306ec67cf4732c3ba0ef9949b0  editor.js
73af1bc2c2f6f69c0674176a2ca4f3746cacebab8146ef26f07f307f0dce0e69  index.html
```
