# Termini Canvas

A minimal native macOS HudsonKit instantiation focused only on:

- `HudAppShell`
- `HudVantageSurface`
- draggable terminal nodes
- Termini-backed local PTY shells via `HudTerminalSurface`

Run it from the repo root:

```sh
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path examples/termini-canvas TerminiCanvas
```

For local interactive testing, prefer launching it as a real `.app` bundle:

```sh
examples/termini-canvas/scripts/run-app.sh
```

That keeps the visible macOS window and the JSONL control API in the same app process.

This example intentionally does not register anything in the existing web demo.
It is now a thin host around the reusable `HudsonVantage` module.

## What belongs where

This app is a pressure-test for native HudsonKit canvas APIs. Most of the
canvas behavior still lives locally in the sample so it can change quickly.

Hudson Vantage-owned:

- Termini terminal node creation and local PTY wiring.
- JSONL control API under `/tmp`.
- 8x8 tiling and renderer virtualization experiments.
- tmux/Graphite prototype models.
- Native Vantage shell with navigator, inspector, minimap, and viewport tools.

Expected upstream targets:

- Pan/zoom viewport state and world/screen transforms.
- Trackpad scroll and magnify gesture handling.
- Minimap, zoom HUD, viewport readout, resizable panels.
- Selection, marquee hit testing, z-order, drag/resize cards.

Termini-owned:

- Local PTY process lifecycle and child cleanup.

See [Hudson Vantage](../../docs/hudson-vantage.md) for the reusable surface
contract.

## Local control API

While running, the app watches a JSONL command file:

```sh
/tmp/termini-canvas-control.jsonl
```

Responses are appended to:

```sh
/tmp/termini-canvas-control.responses.jsonl
```

Example commands:

```sh
printf '{"id":"grid-8x8","action":"tile","columns":8,"rows":8,"width":300,"height":200,"gap":18}\n' >> /tmp/termini-canvas-control.jsonl
printf '{"id":"tmux-lab","action":"reattach","sessions":["hudson-lab"],"createIfMissing":true}\n' >> /tmp/termini-canvas-control.jsonl
printf '{"id":"tmux-ids","action":"reattach","ids":["hudson.lab.termini.canvas.0042.shell","hudson.lab.agents.codex.0007.worker"]}\n' >> /tmp/termini-canvas-control.jsonl
printf '{"id":"status","action":"status"}\n' >> /tmp/termini-canvas-control.jsonl
printf '{"id":"reset","action":"reset"}\n' >> /tmp/termini-canvas-control.jsonl
```

Agents can use the `canvasctl` wrapper instead of hand-writing JSON:

```sh
examples/termini-canvas/scripts/canvasctl.sh --wait status
examples/termini-canvas/scripts/canvasctl.sh --wait tile 8 8 --width 300 --height 200 --gap 18
examples/termini-canvas/scripts/canvasctl.sh --wait reattach --session hudson-lab --create
examples/termini-canvas/scripts/canvasctl.sh --wait reattach --remote user@host --session hudson-lab
examples/termini-canvas/scripts/canvasctl.sh --wait reattach \
  --id hudson.lab.termini.canvas.0042.shell \
  --id hudson.lab.agents.codex.0007.worker
```

That means a Claude, Codex, or shell session outside the app can instantiate
or reconstruct the visible canvas while the macOS app keeps running.

`reattach` accepts:

- `sessions`: tmux session names, attached with `tmux attach-session -t`.
- `targets`: raw tmux targets such as `hudson-lab` or `hudson-lab:window`.
- `ids`: Graphite-style ids such as `hudson.lab.termini.canvas.0042.shell`.
- `remoteHost`: optional SSH host. When set, the PTY runs
  `ssh -tt <host> tmux ...` instead of requiring local tmux.

Local `targets` must already exist. For a simple session that can be created on
demand, use `--session NAME --create`.

For direct executable runs, a startup reattach set can be provided with:

```sh
TERMINI_CANVAS_REATTACH_IDS="hudson.lab.termini.canvas.0042.shell,hudson.lab.agents.codex.0007.worker" \
TERMINI_CANVAS_REATTACH_REMOTE_HOST="user@host" \
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path examples/termini-canvas TerminiCanvas
```
