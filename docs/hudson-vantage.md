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
own its own control lane.

Generic command helper:

```sh
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait status
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait tile 8 8
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait reattach --session hudson-lab --create
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait reattach --remote user@host --session hudson-lab
```

Set custom control paths for product-specific surfaces:

```sh
HUDSON_VANTAGE_CONTROL_FILE=/tmp/scout-vantage-control.jsonl \
HUDSON_VANTAGE_RESPONSE_FILE=/tmp/scout-vantage-control.responses.jsonl \
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait status
```

## Startup Reattach

Hosts can seed a Vantage at launch with environment variables:

```sh
HUDSON_VANTAGE_REATTACH_IDS="hudson.lab.termini.canvas.0042.shell" \
HUDSON_VANTAGE_REATTACH_SESSIONS="hudson-lab" \
HUDSON_VANTAGE_REATTACH_CREATE=1 \
HUDSONKIT_WITH_TERMINAL=1 swift run --package-path examples/termini-canvas TerminiCanvas
```

Legacy `TERMINI_CANVAS_REATTACH_*` variables still work for the case-study app.

## Current Boundary

Hudson Vantage owns:

- spatial canvas, pan/zoom, minimap, selection, side panels, inspector
- runtime nodes and layout state
- JSONL control plane
- local tmux, remote tmux over SSH, and Graphite-style IDs
- Termini terminal rendering and virtualization policy

Still intentionally thin / next to extract:

- adapter protocol for Scout, Fabric, and non-terminal runtimes
- persisted canvas documents and named saved views
- product-level command palette actions
- richer health checks and lifecycle events
