# HUD-006: Live Surfaces

## Status

Accepted for first native implementation.

## Context

Hudson views increasingly render things that are not static documents: tmux
sessions, agent tails, file-backed diffs, plans, remote workspaces, and
application previews. The producer can be tRPC, WebSocket, a JSONL command file,
a local file watcher, SQLite polling, or something product-specific. The UI
still needs one shared language for "this view is plugged into something real."

Scout's tail firehose is a useful precedent. Scout owns discovery and emission:
it watches harness transcripts, emits typed events, keeps bounded replay buffers,
and exposes broker subscriptions. Hudson should not absorb that ownership. The
Hudson-shaped part is the consumption contract and the visual treatment of a
live surface.

## Decision

Hudson defines a transport-agnostic live surface primitive:

- `HudLiveStatus`: connecting, replaying, live, stale, paused, error, offline.
- `HudLiveEvent`: cursor-addressable event metadata.
- `HudLiveSourceDescriptor`: what a view knows about its backing source.
- `HudLiveSnapshot`: optional current-state snapshot.
- `HudLiveSource`: adapter protocol for producers that can supply snapshots and
  event streams.
- `HudLiveIndicator`: shared UI chrome for live status.

Apps and products own event generation. Hudson owns the normalized consumption
shape and the UI vocabulary.

## Ownership Split

Hudson owns:

- source status semantics
- cursor/replay vocabulary
- stale/error/paused UI language
- live badges, inspector rows, status-bar treatment
- throttling/coalescing guidance for view updates

Apps own:

- file watching, tRPC, WebSocket, JSONL, SQLite, or tmux polling adapters
- source-specific payload parsing
- permissions and trust prompts
- durable storage decisions
- product-specific grouping, filtering, and orchestration

## Initial Implementation

The first slice is native HudsonKit:

- Add a new `HudsonLive` package target for the contract.
- Add `HudLiveIndicator` to `HudsonUI`.
- Wire Canvas path-backed document/diff artifacts to publish file-watch status
  through `HudLiveSourceDescriptor`.

This deliberately keeps Canvas's existing file watcher in Canvas. Hudson sees
only the normalized live descriptor.

## Non-Goals

- Hudson does not run a broker.
- Hudson does not define Scout's tail schema.
- Hudson does not require tRPC or WebSocket.
- Hudson does not own transcript discovery, tmux identity, or external process
  inventory.
- Hudson does not persist every live event.

## Future Work

- Add web HudsonKit mirror types and a React hook once a web consumer needs the
  same primitive.
- Add common stale timers and event coalescing helpers.
- Add an inspector section for live source health, cursor, and capabilities.
- Let Canvas manifests declare live source bindings explicitly.
- Bridge Scout `tail.events` into Canvas as a source adapter.
