# Hudson Vantage

`HudsonVantage` is the native Hudson surface for live, durable runtimes. It is
not a standalone product by itself. A product can embed **a Vantage** when it
needs a spatial operating view over terminals, agents, tmux sessions, remote
hosts, or cloud runtimes.

Examples:

- Scout can expose a Scout Vantage for agents, tmux sessions, and invocations.
- Talkie can expose a Talkie Vantage for workflows, transcripts, and actions.
- Fabric can expose a Vantage for local and cloud sandboxes.

The first implementation is terminal-oriented and backed by Termini.

## SwiftPM

Enable terminal-backed Hudson modules:

```sh
HUDSONKIT_WITH_TERMINAL=1 swift build
```

Then embed the surface:

```swift
import SwiftUI
import HudsonVantage

struct ScoutRuntimeView: View {
    var body: some View {
        HudVantageSurface(
            configuration: HudVantageConfiguration(
                surfaceTitle: "Scout Vantage",
                surfaceSubtitle: "agents, sessions, and remote runtimes",
                commandURL: URL(fileURLWithPath: "/tmp/scout-vantage-control.jsonl"),
                responseURL: URL(fileURLWithPath: "/tmp/scout-vantage-control.responses.jsonl"),
                stateURL: URL(fileURLWithPath: "/tmp/scout-vantage-state.json"),
                workingDirectoryURL: URL(fileURLWithPath: "/Users/arach/dev/openscout")
            )
        )
    }
}
```

The Termini case-study app now uses this exact pattern via
`HudVantageConfiguration.terminiCanvasCaseStudy`.

## Control Plane

`HudVantageSurface` watches a JSONL command file and writes JSONL responses.
The command path is supplied by `HudVantageConfiguration`, so each product can
own its own control lane. Commands already present when the app starts are
processed, which lets an outside agent queue a workspace before opening the
native surface.

Generic command helper:

```sh
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait status
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait tile 8 8
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait reattach --session hudson-lab --create
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait reattach --remote user@host --session hudson-lab
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait ensure-tmux --confirm
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait save
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait restore --create
```

Set custom control paths for product-specific surfaces:

```sh
HUDSON_VANTAGE_CONTROL_FILE=/tmp/scout-vantage-control.jsonl \
HUDSON_VANTAGE_RESPONSE_FILE=/tmp/scout-vantage-control.responses.jsonl \
HUDSON_VANTAGE_STATE_FILE=/tmp/scout-vantage-state.json \
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait status
```

### Commands

The JSONL command contract is intentionally small and durable:

| Action | Purpose |
|--------|---------|
| `status` | Report app PID, state path, node count, and structured node summaries |
| `tile` / `grid` | Create a local PTY grid for performance and layout trials |
| `spawn` / `new` | Add local PTY nodes |
| `reattach` / `attach` / `tmux` | Attach tmux `sessions`, raw `targets`, or Graphite-style `ids` |
| `ensure-tmux` / `install-tmux` | Detect local tmux and install it with Homebrew after explicit confirmation |
| `save` / `snapshot` | Persist durable tmux-backed nodes, bounds, z-order, selection, and viewport |
| `restore` / `load` | Recreate saved tmux-backed nodes from a state file |
| `clear` | Remove all nodes |
| `reset` | Return to the two-terminal local PTY starter layout |

`save` and `restore` use the configured `stateURL` unless a command includes
`statePath`. The current restore slice intentionally persists tmux-backed nodes
only. Local PTYs remain useful as cheap scratch terminals, but tmux is the
durable runtime boundary.

`ensure-tmux` is permission-gated. If tmux is already available, it simply
returns the detected path. If tmux is missing, the UI shows a confirmation
dialog before running Homebrew, and control-plane callers must pass
`confirmInstall: true`. Without that field, Vantage returns
`requiresPermission: true` and does not start the installer.

## Startup Reattach

Hosts can seed a Vantage at launch with environment variables:

```sh
HUDSON_VANTAGE_REATTACH_IDS="hudson.lab.termini.canvas.0042.shell" \
HUDSON_VANTAGE_REATTACH_SESSIONS="hudson-lab" \
HUDSON_VANTAGE_REATTACH_CREATE=1 \
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path examples/termini-canvas TerminiCanvas
```

Legacy `TERMINI_CANVAS_REATTACH_*` variables still work for the case-study app.

## Startup Restore

Hosts can also restore from a saved state file at launch:

```sh
HUDSON_VANTAGE_STATE_FILE=/tmp/scout-vantage-state.json \
HUDSON_VANTAGE_RESTORE_ON_LAUNCH=1 \
HUDSON_VANTAGE_RESTORE_CREATE=1 \
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path examples/termini-canvas TerminiCanvas
```

`HudVantageConfiguration.terminiCanvasCaseStudy` opts into launch restore and
uses `/tmp/termini-canvas-state.json`. If the state file is missing or contains
no durable tmux nodes, the sample falls back to its starter local PTY layout.

## Response Shape

Responses echo the request `id` when provided and include `ok`, `message`,
`workspaceID`, `nodeCount`, `commandPath`, `responsePath`, `statePath`, and
`timestamp`. Responses also expose `tmuxPath`, `tmuxInstallInProgress`,
`requiresPermission`, and `installerCommand` when relevant. `status` and normal
command responses include a `nodes` array with node IDs, bounds, z-order,
runtime kind, tmux target, Graphite path, and remote host when present.

## Current Boundary

Hudson Vantage owns:

- spatial canvas, pan/zoom, minimap, selection, side panels, inspector
- runtime nodes and layout state
- JSONL control plane
- state snapshots for durable tmux-backed nodes
- local tmux, remote tmux over SSH, and Graphite-style IDs
- Termini terminal rendering and virtualization policy

Still intentionally thin / next to extract:

- adapter protocol for Scout, Fabric, and non-terminal runtimes
- full canvas documents and named saved views
- product-level command palette actions
- richer health checks and lifecycle events
