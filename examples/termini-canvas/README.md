# Termini Canvas

A minimal native macOS HudsonKit instantiation focused only on:

- `HudAppShell`
- `HudCanvas`
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

## What belongs where

This app is a pressure-test for native HudsonKit canvas APIs. Most of the
canvas behavior still lives locally in the sample so it can change quickly.

Sample-owned for now:

- Termini terminal node creation and local PTY wiring.
- JSONL control API under `/tmp`.
- 8x8 tiling and renderer virtualization experiments.
- tmux/Graphite prototype models.

Expected upstream targets:

- Pan/zoom viewport state and world/screen transforms.
- Trackpad scroll and magnify gesture handling.
- Minimap, zoom HUD, viewport readout, resizable panels.
- Selection, marquee hit testing, z-order, drag/resize cards.

Termini-owned:

- Local PTY process lifecycle and child cleanup.

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
printf '{"id":"status","action":"status"}\n' >> /tmp/termini-canvas-control.jsonl
printf '{"id":"reset","action":"reset"}\n' >> /tmp/termini-canvas-control.jsonl
```
