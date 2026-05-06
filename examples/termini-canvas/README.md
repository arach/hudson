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

This example intentionally does not register anything in the existing web demo.
