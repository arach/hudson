# Terminal isolation feasibility probe

An isolated macOS XPC/IOSurface/Metal experiment for Hudson's proposed terminal
core. The default mode uses a synthetic producer; `--terminal` uses real Ghostty.
It is not a stable SDK product. No release target
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
also owns a twenty-second client watchdog (thirty seconds in terminal mode). The presenter itself is asynchronous
and performs no main-thread IPC waits. It drains its current GPU lease on stop.
The helper exits on connection invalidation, including client death; the runner
verifies normal helper exit before removing the bundle. It only observes its
returned worker PID, never kills a process by name.

Scratch lives under `~/Library/Caches/codex-builds/` and is removed in `finally`.
Logs/results go to the selected output directory (default: ignored `results/`).
If normal helper exit cannot be confirmed, the runner fails and preserves the
bundle for diagnosis. The runner does not install an app, register a launch
agent, accept Xcode license terms, or restart Scout.

## Real terminal mode

```sh
HUDSON_GHOSTTY_XCFRAMEWORK=/absolute/path/to/GhosttyKit.xcframework \
HUDSON_TERMINAL_PROBE_OUTPUT=/absolute/path/to/evidence \
  bun packages/native/apple/HudsonKit/Tools/TerminalIsolationProbe/run.ts --terminal
```

Optionally set `HUDSON_GHOSTTY_BUILD_PROVENANCE` to the compiler validation
artifact’s `provenance.json`. The runner requires a successful build record and
verifies its library SHA-256 against the exact archive linked into the helper.
It copies that record into the evidence and includes it in the result; without
it, engine build qualification is explicitly unspecified.

This needs the native XCFramework built with Termini's experimental
`ghostty-terminal-frame-export.patch`, based on Ghostty `07d31666e`. The runner
links the engine into the helper only. The host imports no Ghostty module.

`GhosttyWorker.swift` owns the PTY, parser and renderer. A renderer-thread callback
appends a GPU copy into the bounded export pool before the engine command buffer
is committed. A cheap credit callback skips GPU frame encoding when the pool is
full, retaining dirty state. Returning credit schedules a fresh frame even after
output becomes idle. Ready frames coalesce; terminal bytes are never dropped.
The host requests a frame asynchronously and can cancel an idle pending request.

The helper uses the `NSRunLoop` XPC run-loop mode so AppKit work executes on its
actual main thread. Its NSView is an offscreen platform anchor, with no hidden
worker window and no local layer presentation. Viewport size travels through the
engine's resize mailbox. The fixture keeps a single fixed viewport.

`TerminalClient.swift` checks actual glyph pixels, GPU drawable pixel integrity,
presentation within a verified host main-thread stall, PTY input/output round
trip, continued parsing with all three frame credits held, held-buffer integrity,
recovery after idle credit return, stale ACK rejection, and explicit PTY reap.
It saves one recovered GPU frame as `terminal-frame.png` for visual inspection;
that one-time CPU image export is diagnostic evidence, outside the frame path.

The test shell is a fixed trusted workload. `readScreen` returns a bounded
viewport snapshot only for test assertions; no terminal transcript stream is
used for host rendering. No per-pane host polling or SwiftUI rendering is involved.

The initial 2026-09-16 engine build used a private SDK compatibility overlay.
The subsequent clean build used Xcode 26.3, stock macOS 26.2 SDK and Zig 0.15.2;
its checksum-matched framework passed this fixture locally. See the architecture
document and Termini patch notes for the CI record and remaining platform gates.
Xcode 27 is not required to build the engine.

## Deliberate limits

- Default mode is synthetic; terminal mode supports diagnostic text input only,
  without full keyboard/IME, selection or accessibility integration.
- Single fixed-size pane; no comparative terminal performance claim.
- Fixed producer dimensions; no resize pool retirement, generations, peer signing
  authentication, reconnect or crash recovery. Same-user check is fixture-only.
- Fixture requests a frame every 16 ms after completion; the terminal worker
  holds one pending request while idle. A real terminal must
  wake on dirty state/display demand and do no frame work for idle panes.
- The lease sequence is scoped to one connection. Production tokens need worker
  and surface generations, and pending requests need cancellation/deadline policy.
- Desktop shader is compiled through the runtime Metal API. Building a modified
  Ghostty engine additionally needs Apple's offline Metal compiler and Zig.

## Source map

- `Protocol.swift`: private XPC contract and deterministic lease table.
- `GPU.swift`: shared format validation and worker-owned GPU producer.
- `Worker.swift`: synthetic XPC service and serial pool owner.
- `GhosttyWorker.swift`: real PTY/engine worker and bounded export pool.
- `TerminalClient.swift`: actual terminal, backpressure and teardown checks.
- `Checks.swift`: bounded fixture-only synchronous test helpers.
- `Presenter.swift`: AppKit view and dedicated asynchronous Metal presenter.
- `Client.swift`: contract checks, window fixture and stalled-main-thread check.
- `run.ts`: bounded build/run, signing, evidence and cleanup.
