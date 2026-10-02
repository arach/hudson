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
bun test apps/lattices-editor
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
- Bun tests: **16 passed, 0 failed, 55 assertions**. Covers reply correlation,
  timeout, missing handler, disposal, revision mismatch, stale retry, generation/
  ABA protection, events before subscribe reply and during projection, null
  discovery revision, unavailable/recovery, bootstrap Retry, duplicate UTF-16
  ranges, selection capture, layout persistence, and StrictMode portal lifecycle.
- Headless Chrome browser checks passed: older-host fallback, both cross-selection
  directions, duplicate highlighting, live History/config updates, invalid-read
  recovery, stale retry, hide/reflow, move, focus, keyboard resize, reload
  persistence, narrow stacking without wide-layout overwrite, no console errors.
- Desktop 1280×850 and narrow 500×850 screenshots:
  `/tmp/hudson-editor-browser-check/desktop.png` and `mobile.png`.
  Browser scripts and logs are in that same temporary evidence directory.
- Impeccable detector: no findings. Independent finish reviewer scored the
  bootstrap Retry fix resolved and returned ship for the reviewed UI scope.
- Production bundle string check confirms mock fixture and controls are absent.

## Acceptance boundaries

| Acceptance | Hudson evidence |
| --- | --- |
| Editor opens; panels; Terminal hidden; Chat reflows | Browser verified. First-open Chat/Preview preset follows spec §4; Source/History on demand, expanded preset available, Terminal placeholder hidden. Native window launch pending. |
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
f47c38467762442d6fb3aa4d5f74bf72a59b70ec2c2076fa04386d63e78c65bb  editor.css
434f3e40a3aadfd8c08cf824fdedadde51d17bf2f2f3bf279d95cda6777c33c3  editor.js
73af1bc2c2f6f69c0674176a2ca4f3746cacebab8146ef26f07f307f0dce0e69  index.html
```
