# Native terminal canvas roadmap

> ADR-style implementation roadmap for turning the Termini canvas sample, native HudsonKit canvas primitives, and tmux durable identity into a shippable small-team plan.

## Status

Proposed. Builds on [Native canvas workspace](./native-canvas-workspace.md) and [tmux + Graphite workspaces](./tmux-graphite-workspaces.md).

## Decision

Treat the current Termini canvas work as the proving ground, but separate the work into four lanes:

- The sample validates behavior and exposes performance constraints.
- HudsonShell receives generic canvas primitives only after the sample proves them.
- Terminal runtime identity is owned by tmux/Graphite registry records, not SwiftUI view lifetime.
- Group actions and offshoot workspaces arrive after selection, z-order, persistence, and reattach are stable.

The team should optimize for stable identities, async control, and incremental extraction over a large rewrite.

## Current home vs rightful home

This commit is a case-study milestone, not the final package shape. The
implementation is intentionally concentrated in the sample so we can feel the
tool before freezing public API.

| Capability | Lives now | Rightful home |
|---|---|---|
| Native app host and launcher | `apps/canvas` | First-party Canvas product |
| Pan/zoom viewport math | `HudCanvasSurface` | `HudsonShell` as `HudCanvasTransform` + `HudCanvasViewportState` |
| Trackpad scroll/magnify bridge | `HudCanvasSurface` | `HudsonShell`, possibly via an AppKit-backed viewport adapter |
| Infinite grid background | `HudCanvasSurface` | `HudsonShell` canvas viewport, reusing `HudGridBackground` ideas |
| Zoom HUD and viewport readout | `HudCanvasSurface` | `HudsonShell` chrome primitives |
| Left navigator, minimap, right inspector | `HudCanvasSurface` | `HudsonShell` workspace chrome primitives |
| Terminal card drag/resize/z-order | `HudCanvasSurface` | `HudsonShell` as `HudCanvasCard` + node store |
| Preview/live renderer policy | `HudCanvasSurface` | `HudsonShell` as generic virtualization policy |
| Local JSONL control API | `apps/canvas` | Sample/dev harness only |
| Graphite path and registry models | `apps/canvas` | Shared terminal/workspace runtime layer after API proves out |
| tmux command boundary | `apps/canvas` | `HudsonTerminal` or a terminal runtime backend module |
| PTY child cleanup | `Termini` repo | Termini local PTY process layer |

The extraction rule is simple: if it knows about Termini, tmux, shells, or the
JSONL control harness, it does not belong in `HudsonShell`. If it only knows
about world coordinates, nodes, gestures, selection, panels, or virtualization,
it is a HudsonShell candidate.

## Ownership lanes

| Lane | Owns | Avoids |
|---|---|---|
| Sample lane | `apps/canvas` fixtures, product README, profiling notes | Public HudsonShell API churn |
| Canvas lane | Generic viewport, transforms, cards, selection, persistence in HudsonShell | Terminal process orchestration |
| Terminal lane | tmux backend, Graphite registry, attach/detach/reattach control plane | Canvas gesture and layout internals |
| Product lane | Commands, group actions, offshoot workspace flows, docs | Low-level renderer/process code |

Use feature branches and narrow PRs by lane. Shared contracts should be introduced as small protocol/model PRs before implementation PRs depend on them.

## Phase 1: Sample hardening and tmux/Graphite prototype

Goal: make the sample honest enough to guide extraction.

Work:

- Keep hardening the 64-terminal canvas sample with real local terminals.
- Add lightweight placeholder nodes before renderer attachment.
- Prototype Graphite path allocation and tmux target creation outside the main UI path.
- Preserve node identity while moving, resizing, focusing, and changing z-order.
- Profile renderer cost, process lifetime, gesture responsiveness, and relaunch behavior.

Acceptance criteria:

- An 8x8 grid can be created as lightweight nodes, then terminal renderers attach progressively.
- Pan, zoom, select, drag, and resize remain responsive with 64 nodes present.
- Bring-to-front updates z-order without array reordering or renderer recreation.
- tmux control calls are async and do not block the main actor.
- Sample README records measured bottlenecks and cleanup behavior.

## Phase 2: Upstream core canvas primitives into HudsonShell

Goal: move generic canvas behavior out of the sample.

Work:

- Extract viewport state, world/screen transforms, zoom tool, grid drawing, and gesture routing.
- Extract stable node/card primitives for drag, resize, selection, z-order, and persistence.
- Add virtualization policy hooks so hosted views can render as placeholder, preview, or live surfaces.
- Replace sample-local canvas logic with HudsonShell primitives incrementally.

Acceptance criteria:

- The sample composes HudsonShell canvas primitives instead of owning duplicate viewport math.
- Node bounds, selection, viewport, and focus persist and restore by stable ids.
- Heavy hosted views are not recreated during common canvas gestures.
- Virtualization can keep offscreen or low-priority terminals detached from live renderers.
- The extracted API names map cleanly to existing web Hudson concepts.

## Phase 3: tmux-backed terminal orchestration and reattach/restore

Goal: make terminal runtime identity durable across Hudson relaunch.

Work:

- Introduce a tmux backend that creates sessions, windows, panes, and records target metadata.
- Persist a Graphite-style registry linking canvas node id, path, tmux target, bounds, and z-index.
- Reconcile persisted registry records against live tmux state on launch.
- Attach Termini renderers only when the viewport/render policy requests them.
- Add explicit detach, restart, kill, and cleanup paths.

Acceptance criteria:

- Hudson can relaunch and restore attachable terminal nodes from registry plus tmux inspection.
- Existing tmux targets can be reattached without changing canvas node identity.
- Missing tmux targets appear as detached/failed nodes with a restart path.
- Process cleanup is explicit for kill, workspace deletion, and failed creation.
- Terminal creation, listing, and attach operations stream status without blocking the main actor.

## Phase 4: Group actions and offshoot workspaces

Goal: turn durable identity and selection into workspace-level workflows.

Work:

- Promote selection to a first-class model that supports ids, path queries, namespace filters, and search results.
- Add group move, tile, send, capture, detach, kill, and restart actions.
- Add offshoot workspace creation for selected nodes with move, link, and clone policies.
- Keep runtime movement/linking/cloning asynchronous after the canvas operation commits.

Acceptance criteria:

- Multi-select works through click, shift-click, marquee, and Graphite path query.
- Group actions operate on spatial nodes and tmux targets consistently.
- A selected group can become a new workspace without tearing down live terminals.
- Move/link/clone policies are visible in the command flow and recoverable if runtime work fails.
- Workspace branching preserves bounds, z-order, selection context, and terminal identity policy.

## Key risks from the sample

- **64 terminal renderer cost:** real Termini surfaces are expensive; placeholders and staged attachment are required.
- **Virtualization:** visible, selected, and zoomed-in nodes should get live renderers first; others need preview or placeholder modes.
- **Process cleanup:** tmux sessions/windows/panes must have explicit cleanup and failure recovery paths.
- **Z-order identity:** do not reorder node arrays to change focus; update `zIndex` or overlay ordering instead.
- **Main actor safety:** tmux and control APIs must be async and must never wait inside gesture handlers or view construction.

## Non-goals

- Do not redesign Termini rendering in this roadmap.
- Do not require every native app to become tmux-backed.
- Do not upstream sample-only terminal policy as generic HudsonShell canvas behavior.
