---
title: "Terminal"
description: "Hudson-themed terminal surface (Termini-backed)"
order: 20
section: "macOS Apps"
---

# Terminal

## Overview

`HudsonTerminal` is a Hudson-vocabulary layer over [Termini](https://github.com/arach/Termini) — the renderer + local PTY + SSH stack at `/Users/arach/dev/Termini`. Hudson owns the design contract (theme, status overlay, focus, chrome); Termini owns the renderer and transport.

Termini is heavy (NIO, NIOSSH, renderer), so the module is gated behind `HUDSONKIT_WITH_TERMINAL=1`. Main `HudsonKit` ships with zero terminal dependencies.

```sh
HUDSONKIT_WITH_TERMINAL=1 swift build
# or
make build-terminal
```

Without the flag, `HudsonTerminal` is not compiled and Termini is not linked.

## HudTerminalSurface

Base surface — wraps `TerminiTerminalView` with Hudson appearance, focus behavior, and accessibility identifiers. Accepts any `TerminiTerminalController` (local PTY, SSH session, or your own transport).

```swift
import SwiftUI
import HudsonTerminal
import Termini

struct TerminalPane: View {
    @State private var controller = TerminiTerminalController.localShell()

    var body: some View {
        HudTerminalSurface(
            controller: controller,
            showsSystemKeyboard: true,
            appearance: .default,
            onTap: { /* focus tracking */ }
        )
    }
}
```

Tap-to-focus calls `controller?.focus()`. Surface sets `accessibilityIdentifier("hudson-terminal")` for UI tests.

## HudTerminalSSHSurface

Complete SSH-backed surface for demos and simple host apps. Loads `TERMBRIDGEKIT_SSH_*` env vars on appear, auto-connects when credentials are present, and overlays a Hudson-styled status pane when disconnected.

```swift
import HudsonTerminal
import Termini

struct SSHPane: View {
    var body: some View {
        HudTerminalSSHSurface(
            hostLabel: "demo.example.com",
            connection: TerminiConnectionConfig(
                name: "Hudson Terminal",
                startupCommand: "tmux new -A -s hudson"
            ),
            autoConnect: true,
            onStateChange: { state in /* isConnected, columns, rows... */ }
        )
    }
}
```

Overlay uses `HudStatusDot`, `HudButton`, Hudson typography — pulsing warn dot while connecting, info dot while idle, "Connect" and "Load env" actions. Advanced transports (custom auth, multiplexed sessions, tunneling) should compose `HudTerminalSurface` directly.

### HudTerminalSessionState

| Field | Type | Description |
|-------|------|-------------|
| `isConnected` | `Bool` | Session is live and accepting input. |
| `isConnecting` | `Bool` | Connection is in flight. |
| `statusMessage` | `String` | Human-readable status. |
| `columns` | `Int?` | Terminal width in cells, once known. |
| `rows` | `Int?` | Terminal height in cells, once known. |

## HudTerminalAppearance

Themed presentation defaults — wraps `TerminiTerminalAppearance`.

```swift
let appearance = HudTerminalAppearance(
    theme: .hudsonGraphite,
    fontSize: 13,
    fontFamily: "SF Mono"
)

HudTerminalSurface(controller: controller, appearance: appearance)
```

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `TerminiTerminalTheme` | `.hudsonGraphite` | Color palette, cursor, selection. |
| `fontSize` | `Double?` | `nil` | Cell font size. Termini default if nil. |
| `fontFamily` | `String?` | `"SF Mono"` | Monospaced family. |

### hudsonGraphite

Default Hudson terminal theme. Graphite background (`#0A0F14`), pale-ink foreground (`#E6EDF3`), emerald cursor (`#6CE5B1`), ANSI palette built from cyan, teal, blue, and emerald — never purple. Defined as a `TerminiTerminalTheme` extension so any Termini surface can adopt it.

## Notes

- Keep the build flag off for apps that don't need a terminal — Termini pulls in NIO + NIOSSH.
- `HudTerminalSSHSurface` is for demos. Production hosts should compose `HudTerminalSurface` with their own controller lifecycle.
- HudsonKit does not re-export Termini types — import `Termini` directly for controllers, configs, or themes.
