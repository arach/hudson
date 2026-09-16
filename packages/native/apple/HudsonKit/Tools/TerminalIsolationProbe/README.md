# Terminal isolation feasibility probe

An isolated macOS XPC/IOSurface/Metal experiment for Hudson's proposed terminal
core. It is not a terminal engine or a stable SDK product. No release target
imports it. See `docs/native-terminal-isolation.md` at the repository root.

```sh
HUDSON_TERMINAL_PROBE_OUTPUT=/absolute/path/to/evidence \
  bun packages/native/apple/HudsonKit/Tools/TerminalIsolationProbe/run.ts --window
```

Omit `--window` for the IPC/pool checks without visible presentation. The windowed
mode briefly opens an AppKit window without activating the app, runs automatically,
and closes it. Neither mode uses SwiftUI.

## What runs

The runner builds an ad-hoc signed app and embedded XPC helper with the installed
Command Line Tools and macOS 26.5 SDK. The worker has a fixed three-buffer pool
(512×256 BGRA, 1.5 MiB total) and renders a synthetic color on the GPU. It publishes
an IOSurface only after successful producer GPU completion. No CPU pixel writes
produce the frame, and frame pixels are not serialized through XPC.

The client verifies separate PIDs, shared pixels, bounded credits, held-buffer
immutability, and stale/duplicate ACK rejection. Its advisory heartbeat count is
not a timing assertion: macOS can coalesce GCD timers.

Windowed mode adds an AppKit `NSView`/`CAMetalLayer` presenter. One asynchronous
request is in flight at a time on a dedicated queue. The presenter imports the
shared texture, draws into its drawable, reads back **one pixel for verification**,
and releases the worker lease only after successful consumer GPU completion.
The tiny debug readback is test instrumentation, not a production frame copy.
A 300 ms sample must show GPU completions entirely inside a verified 500 ms
main-thread stall. GPU completion does not prove the exact time pixels reached
the display; scanout latency is not measured.

## Bounds and cleanup

Each synchronous test-orchestration reply has a five-second timeout; the runner
also owns a twenty-second client watchdog. The presenter itself is asynchronous
and performs no main-thread IPC waits. It drains its current GPU lease on stop.
The helper exits on connection invalidation, including client death; the runner
verifies normal helper exit before removing the bundle. It only observes its
returned worker PID, never kills a process by name.

Scratch lives under `~/Library/Caches/codex-builds/` and is removed in `finally`.
Logs/results go to the selected output directory (default: ignored `results/`).
If normal helper exit cannot be confirmed, the runner fails and preserves the
bundle for diagnosis. The runner does not install an app, register a launch
agent, accept Xcode license terms, or restart Scout.

## Deliberate limits

- No Ghostty, PTY, terminal input/IME, selection or accessibility implementation.
- Synthetic single-pane producer; no terminal performance claim.
- Fixed producer dimensions; no resize pool retirement, generations, peer signing
  authentication, reconnect or crash recovery. Same-user check is fixture-only.
- Fixture requests a frame every 16 ms after completion. A real terminal must
  wake on dirty state/display demand and do no frame work for idle panes.
- The lease sequence is scoped to one connection. Production tokens need worker
  and surface generations, and pending requests need cancellation/deadline policy.
- Desktop shader is compiled through the runtime Metal API. Building a modified
  Ghostty engine additionally needs Apple's offline Metal compiler and Zig.

## Source map

- `Protocol.swift`: private XPC contract and deterministic lease table.
- `GPU.swift`: shared format validation and worker-owned GPU producer.
- `Worker.swift`: embedded XPC service and serial pool owner.
- `Presenter.swift`: AppKit view and dedicated asynchronous Metal presenter.
- `Client.swift`: contract checks, window fixture and stalled-main-thread check.
- `run.ts`: bounded build/run, signing, evidence and cleanup.
