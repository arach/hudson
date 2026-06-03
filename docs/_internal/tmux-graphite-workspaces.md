# tmux + Graphite-style workspace identity

> Draft design note for durable, externally addressable terminal canvases.

## Core idea

Hudson should own spatial identity. tmux should own durable runtime identity. Termini should own rendering.

```text
Hudson canvas node
  spatial identity: node id, bounds, zIndex, selection, workspace
  runtime identity: graphite path, tmux session/window/pane target
  render identity: pending, attached, live, preview, detached, failed
```

The canvas creates lightweight nodes first. tmux sessions start in parallel. Termini surfaces attach as each runtime target becomes ready. The UI does not block on terminal creation, and terminal identity survives Hudson relaunches.

## Logical path convention

Use a Graphite-like path as the durable logical name:

```text
hudson.<workspace>.<namespace>.<app>.<instance>.<role>
```

Examples:

```text
hudson.lab.termini.canvas.0042.shell
hudson.lab.agents.codex.0007.worker
hudson.lab.build.test.0013.logs
```

Path segment meanings:

| Segment | Meaning |
|---|---|
| `hudson` | Reserved product root |
| `<workspace>` | Human workspace slug, like `lab`, `demo`, `client-acme` |
| `<namespace>` | Domain grouping, like `termini`, `agents`, `build`, `data` |
| `<app>` | App or tool family, like `canvas`, `codex`, `pytest` |
| `<instance>` | Stable instance id, usually zero-padded or short hash |
| `<role>` | Role inside the instance, like `shell`, `logs`, `worker`, `preview` |

Names should be slug-safe: lowercase ASCII, digits, dot separators, hyphens inside segments when useful. The path is an index, not the whole source of truth.

## tmux mapping

Keep tmux target names boring and target-safe, while preserving the richer logical path in Hudson's registry:

```text
tmux session: hudson-<workspace>
tmux window:  <namespace>-<app>-<instance>
tmux pane:    <role>
```

Example:

```text
logical path: hudson.lab.termini.canvas.0042.shell
tmux target:  hudson-lab:termini-canvas-0042.0
pane title:   shell
```

Hudson persists a registry record:

```json
{
  "path": "hudson.lab.termini.canvas.0042.shell",
  "nodeID": "terminal-0042",
  "workspaceID": "lab",
  "namespace": "termini",
  "app": "canvas",
  "instance": "0042",
  "role": "shell",
  "tmuxSession": "hudson-lab",
  "tmuxWindow": "termini-canvas-0042",
  "tmuxPaneID": "%87",
  "bounds": { "x": 56, "y": 66, "width": 300, "height": 200 },
  "zIndex": 42
}
```

On relaunch, Hudson reconciles:

```text
persisted registry
+ tmux list-sessions/windows/panes
= restored canvas with attachable nodes
```

If a tmux target exists without a canvas node, Hudson can offer to import it. If a canvas node exists without a tmux target, Hudson can show it as detached and offer to restart it.

## Creation flow

Creating a large terminal grid should be staged:

```text
1. Allocate node ids and graphite paths.
2. Place lightweight cards on the canvas immediately.
3. Ask tmux to create windows/panes in parallel.
4. Mark cards as ready as tmux targets appear.
5. Attach Termini renderers only for visible, selected, or zoomed-in cards.
```

The control plane is async. The canvas should never wait for 64 terminal surfaces to mount before showing the spatial result.

## Reattach flow

Agentic callers should be able to provide an arbitrary set of durable IDs and
ask Hudson to rebuild a canvas around them.

Initial sample command shape:

```json
{
  "action": "reattach",
  "ids": [
    "hudson.lab.termini.canvas.0042.shell",
    "hudson.lab.agents.codex.0007.worker"
  ]
}
```

The sample also accepts raw tmux `sessions` and `targets`. Graphite ids resolve
to tmux targets through the registry mapping; raw targets are used directly.
For day-to-day agent use, the sample exposes this through:

```sh
apps/hudson/scripts/vantagectl.sh --wait reattach \
  --id hudson.lab.termini.canvas.0042.shell \
  --id hudson.lab.agents.codex.0007.worker
```

Remote tmux uses the same identity model. The local PTY runs SSH, and the
remote host owns the durable tmux server:

```sh
apps/hudson/scripts/vantagectl.sh --wait reattach \
  --remote user@host \
  --session hudson-lab
```

This is still a sample-level control API, but it exercises the intended
contract: runtime identity is durable and the canvas can be reconstructed from
outside the app.

## Save and restore

The first Vantage restore slice persists a tiny state file rather than a full
canvas document system. It contains:

- schema version and workspace id
- viewport pan and zoom
- durable tmux-backed node ids, bounds, z-order, tint, title, selection
- runtime references: tmux target, optional Graphite path, optional remote host

Example:

```sh
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait save \
  --state-file /tmp/scout-vantage-state.json

packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait restore \
  --state-file /tmp/scout-vantage-state.json \
  --create
```

For now, local PTYs are intentionally not persisted as durable nodes. The
runtime boundary is tmux: Hudson restores spatial identity and asks Termini to
reattach renderers to the saved tmux targets.

## Selection and group actions

Selection is a first-class model, not a visual side effect:

```swift
public struct HudCanvasSelection: Codable, Equatable {
    public var ids: Set<String>
    public var query: HudPathQuery?
}
```

Selection sources:

- Click and shift-click.
- Marquee rectangle.
- Path query, such as `hudson.lab.termini.*`.
- Namespace/app filters.
- Search result selection.

Group actions become natural:

| Action | Meaning |
|---|---|
| Move | Change bounds for all selected nodes |
| Tile | Reflow selected nodes into grid/columns/rows |
| Send | Send keys/text/command to selected tmux targets |
| Capture | Capture pane output for selected targets |
| Detach | Keep tmux alive, remove renderer |
| Kill | Stop runtime targets |
| Fork workspace | Move or link selected targets into a new workspace canvas |

## Offshoot workspaces

The Graphite path makes lightweight workspace branching possible.

Example: select 20 nodes and create a new workspace called `lab-debug`.

Possible policies:

| Policy | Runtime behavior | Use case |
|---|---|---|
| Move | tmux windows move to `hudson.lab-debug` | The group becomes its own workspace |
| Link | tmux windows are linked into another session | Two workspaces view the same live targets |
| Clone | new windows start from the same launch specs | Fresh sandbox with similar topology |

Hudson should treat this as a canvas operation first: selected spatial nodes become a new workspace layout. Runtime movement/linking/cloning follows asynchronously.

## Core HudsonKit extraction

The Termini sample should be reduced over time as these primitives move into `HudsonShell`:

| Primitive | Responsibility |
|---|---|
| `HudCanvasViewportState` | pan, scale, selected ids, active tool |
| `HudCanvasTransform` | screen/world conversion, zoom around anchor |
| `HudCanvasViewport` | multi-touch pan/zoom, grid, tool routing |
| `HudCanvasZoomTool` | bottom-right zoom control |
| `HudCanvasSelectionModel` | click, shift-click, marquee, path queries |
| `HudCanvasNodeStore` | stable ids, bounds, z-order, persistence |
| `HudCanvasCard` | drag, resize, focus, z-order without array churn |
| `HudCanvasVirtualization` | preview/live renderer policy |
| `HudTerminalOrchestrator` | runtime creation, attach/detach, status stream |
| `HudTmuxBackend` | tmux-backed session/window/pane identity |

The sample should eventually become mostly composition:

```swift
HudCanvasViewport(state: $viewport, nodes: $nodes) { node, context in
    HudTerminalCanvasCard(node: node, runtime: tmuxRuntime[node.id])
}
```

## Viewport behavior

The native viewport should have the same explanation everywhere:

- World coordinates are stable canvas coordinates.
- Screen coordinates are current window pixels/points.
- `pan` is the world offset projected into the viewport.
- `scale` is zoom.
- Zoom always has an anchor, preferably cursor/gesture centroid.
- Trackpad pinch changes scale around the pinch centroid.
- Two-finger scroll can pan the canvas when the event is not claimed by a live terminal.
- Hand mode always pans.
- Select mode click/marquee selects nodes.
- Space can temporarily activate hand mode later, matching web.

This needs to be a real documented primitive because every canvas app will otherwise invent slightly different math.

## Acceptance bar

- 64 tmux-backed terminal nodes can be created as placeholders, then attached as runtimes become ready.
- The same nodes are discoverable outside Hudson via tmux.
- Hudson can relaunch and reattach from persisted registry plus tmux inspection.
- Multi-select and group actions operate on both spatial ids and Graphite path queries.
- A selected group can become a new workspace without tearing down its running terminals.
- The Termini renderer is mounted only when the viewport/render policy says it is useful.
