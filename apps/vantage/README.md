# Vantage

Native macOS product — a spatial runtime canvas for tmux sessions, terminals,
and workspace artifacts. Built on **HudsonVantage** (`HudVantageHost*` host kit +
`HudVantageSurface` canvas). Ships as **Vantage** (`com.hudsonkit.vantage`).

Run it from the repo root:

```sh
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/vantage VantageCanvas
```

For day-to-day use, build a real `.app` bundle with icon, menus, settings, and a
menu-bar companion:

```sh
apps/vantage/scripts/run-app.sh
apps/vantage/scripts/run-app.sh --install   # copies to ~/Applications
```

The bundle lands at `dist/Hudson Vantage.app` by default. State persists under
`~/Library/Application Support/Hudson/Vantage/` instead of `/tmp`.

## Host app

`VantageCanvas` is the thin SwiftPM executable — all chrome lives in **HudsonVantage**:

| HudsonKit type | Role |
|----------------|------|
| `HudVantageHostAppModel` | Host state, control-path helpers, status subscription |
| `HudVantageHostRootView` | Embeds `HudVantageSurface` + About sheet |
| `HudVantageHostScenes` | Window, menu bar extra, settings, commands |
| `HudVantageConfiguration.hostApplication(...)` | Default paths and persistence wiring |

`VantageCanvasApp.swift` only supplies repo-specific setup manifest paths and
calls `HudVantageHostApplication.activateOnLaunch()`.

The native host includes:

- Dock icon generated from `scripts/generate-app-icon.swift`
- Standard macOS menus (`Workspace`, `Canvas`, `Appearance`)
- Settings window (`⌘,`) with control-lane paths
- Menu bar extra with live node/status readout
- About panel with control-path copy/reveal helpers

Menu actions post into `HudVantageSurface` through `VantageHostCommandCenter`.
The surface publishes live status back via `HudVantageHostStatusCenter`.

**Menu bar companion** (Lattices-style):

- **Left click** the status icon → transient popover with live status and quick actions
- **Right click** → context menu (show, palette, lens, save, paths, settings, quit)
- Template **2×2 grid** icon in the menu bar; popover warms up on launch

On first launch, when no saved state exists, the app applies the practice
manifest at:

```sh
apps/vantage/fixtures/hudson-vantage-practice.setup.json
```

That practice workspace lays out two tmux sessions, two Hudson source files, a
plan document, and a running diff placeholder. It is deliberately just a
manifest: agents and host apps can replace it with their own project setup
without Vantage needing a top-down product model.

## What belongs where

This app is a pressure-test for native HudsonKit canvas APIs. Most of the
canvas behavior still lives locally in the sample so it can change quickly.

Hudson Vantage-owned:

- Termini terminal node creation and local PTY wiring.
- JSONL control API under `/tmp`.
- 8x8 tiling and renderer virtualization experiments.
- tmux/Graphite prototype models.
- Native Vantage shell with navigator, tag filters, inspector, minimap, and
  viewport tools.

Expected upstream targets:

- Pan/zoom viewport state and world/screen transforms.
- Trackpad scroll and magnify gesture handling.
- Minimap, zoom HUD, viewport readout, resizable panels.
- Selection, Space-drag panning, modifier-aware marquee hit testing, z-order,
  drag/resize cards.

Termini-owned:

- Local PTY process lifecycle and child cleanup.

See [Hudson Vantage](../../docs/hudson-vantage.md) for the reusable surface
contract.

## Local control API

While running, the app watches a JSONL command file:

```sh
/tmp/hudson-vantage-control.jsonl
```

Responses are appended to:

```sh
/tmp/hudson-vantage-control.responses.jsonl
```

Example commands:

```sh
printf '{"id":"grid-8x8","action":"tile","columns":8,"rows":8,"width":300,"height":200,"gap":18}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"tmux-lab","action":"reattach","sessions":["hudson-lab"],"createIfMissing":true}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"tmux-ids","action":"reattach","ids":["hudson.lab.termini.canvas.0042.shell","hudson.lab.agents.codex.0007.worker"]}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.vantage.command","id":"select","action":"select","nodeIDs":["NODE_ID_PREFIX"]}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.vantage.command","id":"inspect","action":"inspect"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.vantage.command","id":"focus-mode","action":"focus-mode"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.vantage.command","id":"popout","action":"popout"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"apiVersion":"v0","kind":"hudson.vantage.command","id":"metrics","action":"metrics"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"save","action":"save"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"workspace","action":"save-workspace","statePath":"/tmp/project.vantage.json"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"restore","action":"restore","createIfMissing":true}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"status","action":"status"}\n' >> /tmp/hudson-vantage-control.jsonl
printf '{"id":"reset","action":"reset"}\n' >> /tmp/hudson-vantage-control.jsonl
```

Agents can use the `canvasctl` wrapper instead of hand-writing JSON:

```sh
apps/vantage/scripts/vantagectl.sh --wait status
apps/vantage/scripts/vantagectl.sh --wait tile 8 8 --width 300 --height 200 --gap 18
apps/vantage/scripts/vantagectl.sh --wait reattach --session hudson-lab --create
apps/vantage/scripts/vantagectl.sh --wait reattach --remote user@host --session hudson-lab
apps/vantage/scripts/vantagectl.sh --wait reattach \
  --id hudson.lab.termini.canvas.0042.shell \
  --id hudson.lab.agents.codex.0007.worker
apps/vantage/scripts/vantagectl.sh --wait select NODE_ID_PREFIX
apps/vantage/scripts/vantagectl.sh --wait inspect
apps/vantage/scripts/vantagectl.sh --wait focus
apps/vantage/scripts/vantagectl.sh --wait focus-mode
apps/vantage/scripts/vantagectl.sh --wait popout
apps/vantage/scripts/vantagectl.sh --wait exit-focus
apps/vantage/scripts/vantagectl.sh --wait metrics
apps/vantage/scripts/vantagectl.sh --wait style --scope workspace --preset jade --terminal-theme hudson-paper
apps/vantage/scripts/vantagectl.sh --wait style --scope tag --tag focus --terminal-theme jade-night
apps/vantage/scripts/vantagectl.sh --wait setup --manifest apps/vantage/fixtures/hudson-vantage-practice.setup.json --create --fit
apps/vantage/scripts/vantagectl.sh --wait setup --manifest apps/vantage/fixtures/scout-vantage.setup.json --create --fit
apps/vantage/scripts/vantagectl.sh --wait tmux-health --session hudson-lab
apps/vantage/scripts/vantagectl.sh --wait tmux-health --remote user@host --session hudson-lab
apps/vantage/scripts/vantagectl.sh --wait tmux-health --remote user@host --session hudson-lab --probe-remote --timeout-ms 750
apps/vantage/scripts/vantagectl.sh --wait perf-harness --prefix hudson-perf-lab --sessions 64 --active 32 --mode tail --rate-ms 250
apps/vantage/scripts/vantagectl.sh --wait perf-cleanup --prefix hudson-perf-lab
apps/vantage/scripts/vantagectl.sh --wait viewport --fit
apps/vantage/scripts/vantagectl.sh --wait viewport --pan-x -120 --pan-y 44 --scale 0.25
apps/vantage/scripts/vantagectl.sh --wait ensure-tmux --confirm
apps/vantage/scripts/vantagectl.sh --wait save
apps/vantage/scripts/vantagectl.sh --wait save-workspace --state-file /tmp/project.vantage.json
apps/vantage/scripts/vantagectl.sh --wait restore --create
apps/vantage/scripts/vantagectl.sh --wait restore-workspace --state-file /tmp/project.vantage.json --create
apps/vantage/scripts/vantagectl.sh --wait raw '{"action":"metrics","includeNodes":false}'
```

That means a Claude, Codex, or shell session outside the app can instantiate
or reconstruct the visible canvas while the macOS app keeps running.

The v0 command envelope is `apiVersion: "v0"` and
`kind: "hudson.vantage.command"`. The app still accepts older flat commands,
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
natively by Vantage. A React/Shiki/Diffs renderer can still consume the same JSON
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
/ `confirmInstall: true` before Vantage runs an installer.

`save` persists the current durable canvas state to:

```sh
/tmp/hudson-vantage-practice-state.json
```

`save-workspace` is the same durable format with clearer product language for
portable files such as `/tmp/project.vantage.json`. New saves include
`kind: "hudson.vantage.workspace"`, optional focus mode state, and
tag-derived workspace groups. `restore` and `restore-workspace` recreate those
saved tmux and artifact nodes with their previous bounds, z-order, tags, groups,
selection, focused node, viewport, Graphite metadata, and artifact metadata. Use
`--state-file PATH` or `TERMINI_CANVAS_STATE_FILE` for a different lane.

For direct executable runs, a startup reattach set can be provided with:

```sh
TERMINI_CANVAS_REATTACH_IDS="hudson.lab.termini.canvas.0042.shell,hudson.lab.agents.codex.0007.worker" \
TERMINI_CANVAS_REATTACH_REMOTE_HOST="user@host" \
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/vantage VantageCanvas
```

The case-study configuration restores `/tmp/hudson-vantage-practice-state.json`
on launch when that file exists and contains durable nodes. Remove that file to
see the bundled practice manifest again.
