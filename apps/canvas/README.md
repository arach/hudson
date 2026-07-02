# Canvas

Native macOS product — a spatial runtime canvas for tmux sessions, terminals,
and workspace artifacts. Built on **HudsonCanvas** (`HudCanvasHost*` host kit +
`HudCanvasSurface` canvas). Ships as **Canvas** (`com.hudsonkit.canvas`).

Run it from the repo root:

```sh
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/canvas CanvasApp
```

For day-to-day use, build a real `.app` bundle with icon, menus, settings, and a
menu-bar companion:

```sh
apps/canvas/scripts/run-app.sh
apps/canvas/scripts/run-app.sh --install   # copies to ~/Applications
```

The bundle lands at `dist/Hudson Canvas.app` by default. State persists under
`~/Library/Application Support/Hudson/Canvas/` instead of `/tmp`.

## Host app

`CanvasApp` is the thin SwiftPM executable — all chrome lives in **HudsonCanvas**:

| HudsonKit type | Role |
|----------------|------|
| `HudCanvasHostAppModel` | Host state, control-path helpers, status subscription |
| `HudCanvasHostRootView` | Embeds `HudCanvasSurface` + About sheet |
| `HudCanvasHostScenes` | Window, menu bar extra, settings, commands |
| `HudCanvasConfiguration.hostApplication(...)` | Default paths and persistence wiring |

`CanvasApp.swift` only supplies repo-specific setup manifest paths and
calls `HudCanvasHostApplication.activateOnLaunch()`.

The native host includes:

- Dock icon generated from `scripts/generate-app-icon.swift`
- Standard macOS menus (`Workspace`, `Canvas`, `Appearance`)
- Settings window (`⌘,`) with control-lane paths
- Menu bar extra with live node/status readout
- About panel with control-path copy/reveal helpers

Menu actions post into `HudCanvasSurface` through `CanvasHostCommandCenter`.
The surface publishes live status back via `HudCanvasHostStatusCenter`.

**Menu bar companion** (Lattices-style):

- **Left click** the status icon → transient popover with live status and quick actions
- **Right click** → context menu (show, palette, lens, save, paths, settings, quit)
- Template **2×2 grid** icon in the menu bar; popover warms up on launch

On first launch, when no saved state exists, the app applies the practice
manifest at:

```sh
apps/canvas/fixtures/hudson-canvas-practice.setup.json
```

That practice workspace lays out two tmux sessions, two Hudson source files, a
plan document, and a running diff placeholder. It is deliberately just a
manifest: agents and host apps can replace it with their own project setup
without Canvas needing a top-down product model.

## What belongs where

This app is a pressure-test for native HudsonKit canvas APIs. Most of the
canvas behavior still lives locally in the sample so it can change quickly.

Hudson Canvas-owned:

- Termini terminal node creation and local PTY wiring.
- JSONL control API under `/tmp`.
- 8x8 tiling and renderer virtualization experiments.
- tmux/Graphite prototype models.
- Native Canvas shell with navigator, tag filters, inspector, minimap, and
  viewport tools.

Expected upstream targets:

- Pan/zoom viewport state and world/screen transforms.
- Trackpad scroll and magnify gesture handling.
- Minimap, zoom HUD, viewport readout, resizable panels.
- Selection, Space-drag panning, modifier-aware marquee hit testing, z-order,
  drag/resize cards.

Termini-owned:

- Local PTY process lifecycle and child cleanup.

See [Hudson Canvas](../../docs/hudson-canvas.md) for the reusable surface
contract.

## Local control API

While running, the app watches a JSONL command file:

```sh
/tmp/hudson-canvas-control.jsonl
```

Responses are appended to:

```sh
/tmp/hudson-canvas-control.responses.jsonl
```

Example commands:

```sh
printf '{"id":"grid-8x8","action":"tile","columns":8,"rows":8,"width":300,"height":200,"gap":18}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"tmux-lab","action":"reattach","sessions":["hudson-lab"],"createIfMissing":true}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"tmux-ids","action":"reattach","ids":["hudson.lab.termini.canvas.0042.shell","hudson.lab.agents.codex.0007.worker"]}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.canvas.command","id":"select","action":"select","nodeIDs":["NODE_ID_PREFIX"]}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.canvas.command","id":"inspect","action":"inspect"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.canvas.command","id":"focus-mode","action":"focus-mode"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.canvas.command","id":"popout","action":"popout"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.canvas.command","id":"metrics","action":"metrics"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"save","action":"save"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"workspace","action":"save-workspace","statePath":"/tmp/project.canvas.json"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"restore","action":"restore","createIfMissing":true}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"status","action":"status"}\n' >> /tmp/hudson-canvas-control.jsonl
printf '{"id":"reset","action":"reset"}\n' >> /tmp/hudson-canvas-control.jsonl
```

Agents can use the `canvasctl` wrapper instead of hand-writing JSON:

```sh
apps/canvas/scripts/canvasctl.sh --wait status
apps/canvas/scripts/canvasctl.sh --wait tile 8 8 --width 300 --height 200 --gap 18
apps/canvas/scripts/canvasctl.sh --wait reattach --session hudson-lab --create
apps/canvas/scripts/canvasctl.sh --wait reattach --remote user@host --session hudson-lab
apps/canvas/scripts/canvasctl.sh --wait reattach \
  --id hudson.lab.termini.canvas.0042.shell \
  --id hudson.lab.agents.codex.0007.worker
apps/canvas/scripts/canvasctl.sh --wait select NODE_ID_PREFIX
apps/canvas/scripts/canvasctl.sh --wait inspect
apps/canvas/scripts/canvasctl.sh --wait focus
apps/canvas/scripts/canvasctl.sh --wait focus-mode
apps/canvas/scripts/canvasctl.sh --wait popout
apps/canvas/scripts/canvasctl.sh --wait exit-focus
apps/canvas/scripts/canvasctl.sh --wait metrics
apps/canvas/scripts/canvasctl.sh --wait style --scope workspace --preset jade --terminal-theme hudson-paper
apps/canvas/scripts/canvasctl.sh --wait style --scope tag --tag focus --terminal-theme jade-night
apps/canvas/scripts/canvasctl.sh --wait setup --manifest apps/canvas/fixtures/hudson-canvas-practice.setup.json --create --fit
apps/canvas/scripts/canvasctl.sh --wait setup --manifest apps/canvas/fixtures/scout-canvas.setup.json --create --fit
apps/canvas/scripts/canvasctl.sh --wait tmux-health --session hudson-lab
apps/canvas/scripts/canvasctl.sh --wait tmux-health --remote user@host --session hudson-lab
apps/canvas/scripts/canvasctl.sh --wait tmux-health --remote user@host --session hudson-lab --probe-remote --timeout-ms 750
apps/canvas/scripts/canvasctl.sh --wait perf-harness --prefix hudson-perf-lab --sessions 64 --active 32 --mode tail --rate-ms 250
apps/canvas/scripts/canvasctl.sh --wait perf-cleanup --prefix hudson-perf-lab
apps/canvas/scripts/canvasctl.sh --wait viewport --fit
apps/canvas/scripts/canvasctl.sh --wait viewport --pan-x -120 --pan-y 44 --scale 0.25
apps/canvas/scripts/canvasctl.sh --wait ensure-tmux --confirm
apps/canvas/scripts/canvasctl.sh --wait save
apps/canvas/scripts/canvasctl.sh --wait save-workspace --state-file /tmp/project.canvas.json
apps/canvas/scripts/canvasctl.sh --wait restore --create
apps/canvas/scripts/canvasctl.sh --wait restore-workspace --state-file /tmp/project.canvas.json --create
apps/canvas/scripts/canvasctl.sh --wait raw '{"action":"metrics","includeNodes":false}'
```

That means a Claude, Codex, or shell session outside the app can instantiate
or reconstruct the visible canvas while the macOS app keeps running.

The v0 command envelope is `apiVersion: "v0"` and
`kind: "hudson.canvas.command"`. The app still accepts older flat commands,
but wrappers emit v0 by default. Responses include a matching response kind,
selected node IDs, viewport, metrics, and per-command latency.

The wrapper `raw` command normalizes ad hoc JSON objects by injecting a
waitable request id plus the v0 envelope when those fields are missing.

`focus-mode` renders exactly one selected or targeted node as the whole
surface and hides the canvas side panels until `exit-focus` or Escape.
`popout` opens selected or targeted nodes in a separate native window with
either a live grid or a single-node focus tab.

`setup` can compose a broader canvas than terminals. In addition to `tmux`,
manifests can create `file`, `plan`, `diff`, `note`, and `preview` artifact
nodes with `path`, `language`, and `role` metadata. Their canvas cards stay
native and lightweight. Opened code artifacts use a read-only web renderer slot
that loads one local shell and updates it with JSON payloads. Diff artifacts are
parsed into `HudDiffDocument` through the HudsonDiff core target, then rendered
natively by Canvas. A React/Shiki/Diffs renderer can still consume the same JSON
later without placing WebViews on the zooming canvas. Git, the filesystem, tmux,
and the host product remain the real sources of truth.

`perf-harness` creates a repeatable local tmux stress scene. The default shape
is 64 sessions with 32 active `tail -n 50 -f` workloads, then the canvas
reattaches to those durable sessions. Use `perf-cleanup --prefix PREFIX` to
remove the matching harness sessions and nodes when the trial is done.

`reattach` accepts:

- `sessions`: tmux session names, attached with `tmux attach-session -t`.
- `targets`: raw tmux targets such as `hudson-lab` or `hudson-lab:window`.
- `ids`: Graphite-style ids such as `hudson.lab.termini.canvas.0042.shell`.
- `remoteHost`: optional SSH host. When set, the PTY runs
  `ssh -tt <host> tmux ...` instead of requiring local tmux.

Local `targets` must already exist. For a simple session that can be created on
demand, use `--session NAME --create`.

`tmux-health` reports `ready`, `tmux-missing`, or `session-missing` for local
targets. Remote health is identity-only by default and reports
`remote-unverified`; use `--probe-remote` for a bounded noninteractive SSH probe
that may report `ready`, `auth-needed`, `unreachable`, `tmux-missing`,
`session-missing`, or `remote-error`.

If local tmux is missing, the app inspector exposes an Install tmux action that
confirms with the user before running Homebrew. Agents can request the same path
with `ensure-tmux` or `install-tmux`, but the command must include `--confirm`
/ `confirmInstall: true` before Canvas runs an installer.

`save` persists the current durable canvas state to:

```sh
/tmp/hudson-canvas-practice-state.json
```

`save-workspace` is the same durable format with clearer product language for
portable files such as `/tmp/project.canvas.json`. New saves include
`kind: "hudson.canvas.workspace"`, optional focus mode state, and
tag-derived workspace groups. `restore` and `restore-workspace` recreate those
saved tmux and artifact nodes with their previous bounds, z-order, tags, groups,
selection, focused node, viewport, Graphite metadata, and artifact metadata. Use
`--state-file PATH` or `TERMINI_CANVAS_STATE_FILE` for a different lane.

For direct executable runs, a startup reattach set can be provided with:

```sh
TERMINI_CANVAS_REATTACH_IDS="hudson.lab.termini.canvas.0042.shell,hudson.lab.agents.codex.0007.worker" \
TERMINI_CANVAS_REATTACH_REMOTE_HOST="user@host" \
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/canvas CanvasApp
```

The case-study configuration restores `/tmp/hudson-canvas-practice-state.json`
on launch when that file exists and contains durable nodes. Remove that file to
see the bundled practice manifest again.
