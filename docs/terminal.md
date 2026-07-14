---
title: "Terminal"
description: "Hudson-themed terminal surface (Termini-backed)"
order: 20
section: "macOS Apps"
---

# Terminal

## Overview

`HudsonTerminal` is a Hudson-vocabulary layer over [Termini](https://github.com/arach/Termini) — the renderer + local PTY + SSH stack at `/Users/arach/dev/termini`. Hudson owns the design contract (theme, status overlay, focus, chrome); Termini owns the renderer and transport.

Termini is heavy (NIO, NIOSSH, renderer), so the module is gated behind `HUDSONKIT_WITH_TERMINAL=1`. Main `HudsonKit` ships with zero terminal dependencies.

```sh
HUDSONKIT_WITH_TERMINAL=1 swift build
# or
make build-terminal
```

Without the flag, `HudsonTerminal` is not compiled and Termini is not linked.

## HudTerminalSurface

Base surface — wraps `TerminiTerminalView` with Hudson appearance, focus behavior, and accessibility identifiers. SSH consumers pass a `HudTerminalSSHSession`; low-level local PTY consumers can still pass a `TerminiTerminalController`.

```swift
import SwiftUI
import HudsonTerminal
import Termini

struct TerminalPane: View {
    @State private var workspace = TerminiLocalPTYWorkspace()

    var body: some View {
        HudTerminalSurface(
            controller: workspace.controller,
            showsSystemKeyboard: true,
            appearance: .default,
            onTap: { /* focus tracking */ }
        )
        .onAppear { workspace.start() }
        .onDisappear { workspace.stop() }
    }
}
```

Tap-to-focus calls `controller?.focus()`. Surface sets `accessibilityIdentifier("hudson-terminal")` for UI tests.

## HudTerminalSSHSurface

Complete SSH-backed surface for demos and simple host apps. Loads SSH demo environment configuration on appear, auto-connects when credentials are present, and overlays a Hudson-styled status pane when disconnected.

```swift
import HudsonTerminal

struct SSHPane: View {
    var body: some View {
        HudTerminalSSHSurface(
            hostLabel: "demo.example.com",
            connection: HudTerminalSSHConnection(
                name: "Hudson Terminal",
                host: "demo.example.com",
                username: "operator",
                authentication: .privateKey(pem: privateKeyPEM),
                startup: .exec(command: "tmux new -A -s hudson")
            ),
            autoConnect: true,
            onStateChange: { state in /* isConnected, columns, rows... */ }
        )
    }
}
```

Overlay uses `HudStatusDot`, `HudButton`, Hudson typography — pulsing warn dot while connecting, info dot while idle, "Connect" and "Load env" actions.

## Host-owned SSH sessions

Production hosts normally own provisioning and recovery UI while Hudson owns terminal mechanics. Create one `HudTerminalSSHSession`, then pass it to `HudTerminalSurface` or `HudTerminalSSHSurface`. The host does not import Termini or TerminiSSH.

```swift
import HudsonTerminal

let connection = HudTerminalSSHConnection(
    name: "Paired Mac",
    host: provisionedHost,
    port: provisionedPort,
    username: provisionedUsername,
    authentication: .privateKey(pem: provisionedPrivateKey),
    startup: .exec(command: "tmux new -A -s app"),
    hostKeyPolicy: .requireStoredHostKey,
    hostKeyFingerprint: provisionedFingerprint
)

let session = HudTerminalSSHSession(connection: connection)

HudTerminalSurface(
    session: session,
    showsSystemKeyboard: false,
    appearance: .default
)

Task { await session.connect() }
session.send("ls -la")
```

`HudTerminalSSHSession.snapshot` exposes connection state, status text, PTY grid and cell dimensions, renderer diagnostics, and parsed visible text for contextual settings or troubleshooting UI. Hudson also provides `HudTerminalHostedKeyboard`, which writes the same translated PTY byte sequences for every host.

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

Default theme. Graphite background (`#0A0F14`), pale-ink foreground (`#E6EDF3`), emerald cursor (`#6CE5B1`), ANSI palette of cyan/teal/blue/emerald — never purple. Defined as a `TerminiTerminalTheme` extension so any Termini surface can adopt it.

## Notes

- Keep the build flag off for apps that don't need a terminal — Termini pulls in NIO + NIOSSH.
- `HudTerminalSSHSurface` is the complete simple-host treatment. Production hosts can share a host-owned `HudTerminalSSHSession` with either Hudson surface.
- SSH consumers should not import `TerminiSSH`; HudsonTerminal owns that dependency and its lifecycle conventions.
- Low-level local PTY or custom-renderer consumers may still import `Termini` and pass a controller to `HudTerminalSurface`.
