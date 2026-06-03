# Hudson

Native macOS Hudson app. Its main window is the Vantage spatial runtime canvas
for tmux sessions, terminals, and workspace artifacts. A separate menu-bar
helper owns microphone permission and long-running local services.

It ships as:

- **Hudson** (`com.hudsonkit.hudson`) - the regular app with the Vantage main window.
- **Hudson Menu** (`com.hudsonkit.hudson.menu`) - the LSUIElement menu helper and voice daemon host.

Run it from the repo root:

```sh
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/hudson/native HudsonApp
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/hudson/native HudsonMenuApp
```

For day-to-day use, build real `.app` bundles with icon, menus, settings, and
the menu helper:

```sh
apps/hudson/scripts/run-app.sh
apps/hudson/scripts/run-app.sh --install   # copies to ~/Applications
```

The bundles land at `dist/Hudson.app` and `dist/Hudson Menu.app` by default.
Vantage state persists under `~/Library/Application Support/Hudson/Vantage/`;
the embedded Vox runtime state persists under `~/Library/Application Support/Hudson/Vox/`.

## Host app

`HudsonApp` is the SwiftPM executable. Vantage canvas chrome still lives in
**HudsonVantage**, while this app owns product-level services:

| HudsonKit type | Role |
|----------------|------|
| `HudVantageHostAppModel` | Host state, control-path helpers, status subscription |
| `HudVantageHostRootView` | Embeds `HudVantageSurface` + About sheet |
| `HudVantageHostCommands` | Vantage menu commands |
| `HudVantageConfiguration.hostApplication(...)` | Default paths and persistence wiring |

`HudsonApp.swift` supplies repo-specific setup manifest paths and the regular
Vantage main window. It does not own microphone capture or daemon lifecycle.

The native host includes:

- Dock icon generated from `scripts/generate-app-icon.swift`
- Standard macOS menus (`Workspace`, `Canvas`, `Appearance`)
- Settings window (`Cmd+,`) for Vantage
- About panel with control-path copy/reveal helpers

Menu actions post into `HudVantageSurface` through `VantageHostCommandCenter`.
The surface publishes live status back via `HudVantageHostStatusCenter`.

## Menu helper

`HudsonMenuApp` is the LSUIElement helper. It has no Dock icon and stays alive
independently of the main window. It owns:

- Menu bar status and quick actions.
- Microphone permission management for Hudson-owned voice.
- Embedded `VoxService.VoxRuntimeService` hosting from `../vox/swift`.
- A long-running process boundary for local services.
- Show/launch action for the main Hudson app.

The helper requests microphone permission on first launch. Once permission is
granted, it starts the embedded Vox runtime on `127.0.0.1:42138` by default
(`HUDSON_VOICE_VOX_PORT` overrides the port).

On first launch, when no saved state exists, the app applies the practice
manifest at:

```sh
apps/hudson/fixtures/hudson-vantage-practice.setup.json
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

See `docs/_internal/hudson-vantage.md` for the reusable surface contract.

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
apps/hudson/scripts/vantagectl.sh --wait status
apps/hudson/scripts/vantagectl.sh --wait tile 8 8 --width 300 --height 200 --gap 18
apps/hudson/scripts/vantagectl.sh --wait reattach --session hudson-lab --create
apps/hudson/scripts/vantagectl.sh --wait reattach --remote user@host --session hudson-lab
apps/hudson/scripts/vantagectl.sh --wait reattach \
  --id hudson.lab.termini.canvas.0042.shell \
  --id hudson.lab.agents.codex.0007.worker
apps/hudson/scripts/vantagectl.sh --wait select NODE_ID_PREFIX
apps/hudson/scripts/vantagectl.sh --wait inspect
apps/hudson/scripts/vantagectl.sh --wait focus
apps/hudson/scripts/vantagectl.sh --wait focus-mode
apps/hudson/scripts/vantagectl.sh --wait popout
apps/hudson/scripts/vantagectl.sh --wait exit-focus
apps/hudson/scripts/vantagectl.sh --wait metrics
apps/hudson/scripts/vantagectl.sh --wait style --scope workspace --preset jade --terminal-theme hudson-paper
apps/hudson/scripts/vantagectl.sh --wait style --scope tag --tag focus --terminal-theme jade-night
apps/hudson/scripts/vantagectl.sh --wait setup --manifest apps/hudson/fixtures/hudson-vantage-practice.setup.json --create --fit
apps/hudson/scripts/vantagectl.sh --wait setup --manifest apps/hudson/fixtures/scout-vantage.setup.json --create --fit
apps/hudson/scripts/vantagectl.sh --wait tmux-health --session hudson-lab
apps/hudson/scripts/vantagectl.sh --wait tmux-health --remote user@host --session hudson-lab
apps/hudson/scripts/vantagectl.sh --wait tmux-health --remote user@host --session hudson-lab --probe-remote --timeout-ms 750
apps/hudson/scripts/vantagectl.sh --wait perf-harness --prefix hudson-perf-lab --sessions 64 --active 32 --mode tail --rate-ms 250
apps/hudson/scripts/vantagectl.sh --wait perf-cleanup --prefix hudson-perf-lab
apps/hudson/scripts/vantagectl.sh --wait viewport --fit
apps/hudson/scripts/vantagectl.sh --wait viewport --pan-x -120 --pan-y 44 --scale 0.25
apps/hudson/scripts/vantagectl.sh --wait ensure-tmux --confirm
apps/hudson/scripts/vantagectl.sh --wait save
apps/hudson/scripts/vantagectl.sh --wait save-workspace --state-file /tmp/project.vantage.json
apps/hudson/scripts/vantagectl.sh --wait restore --create
apps/hudson/scripts/vantagectl.sh --wait restore-workspace --state-file /tmp/project.vantage.json --create
apps/hudson/scripts/vantagectl.sh --wait raw '{"action":"metrics","includeNodes":false}'
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
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path apps/hudson/native HudsonApp
```

The case-study configuration restores `/tmp/hudson-vantage-practice-state.json`
on launch when that file exists and contains durable nodes. Remove that file to
see the bundled practice manifest again.
