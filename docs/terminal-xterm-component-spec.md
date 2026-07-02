# HudsonKit Xterm Terminal Component Spec

Status: initial reusable contract
Owner: `packages/web/hudsonkit`

## Product Boundary

`hudsonkit/terminal` is the shared web terminal surface for tiled, multi-session, multi-layout terminal experiences. It is based on xterm.js and is intended for browser, WKWebView, and desktop-web embeds.

Native Termini/Ghostty surfaces remain an Apple-native single-surface path for iOS, focused local-native cases, and experiments that need platform-native terminal rendering.

## Public Entry Point

Consumers should prefer:

```ts
import { TerminalRelay, useTerminalRelay } from "hudsonkit/terminal";
```

Root `hudsonkit` exports remain available for compatibility.

## Component Contract

`useTerminalRelay` owns relay protocol state:

- WebSocket connect, disconnect, restart
- `session:init` and `session:reconnect`
- PTY, tmux, and zellij backend options
- persistent session IDs keyed by `sessionKey`
- terminal resize messages
- output buffering before the renderer is ready
- ACK after renderer write for flow-controlled relays
- passive data subscribers for previews and activity indicators

`TerminalRelay` owns xterm.js rendering:

- SSR-safe dynamic xterm imports
- required `FitAddon`
- optional `WebglAddon`
- DOM fallback after import failure, construction failure, or WebGL context loss
- configurable scrollback
- live font and theme updates
- resize observer with relay dimension updates
- keyboard input forwarding
- read-only mode that blocks keyboard, voice, paste, and drop input
- ARIA label and root styling hooks
- lifecycle callbacks: ready, dispose, resize, renderer state

## Protocol Requirements

Clients that support renderer ACKs send `clientCapabilities: ["terminal:ack"]` in `session:init` and `session:reconnect`.

Flow-controlled relays should then emit:

```json
{ "type": "terminal:data", "data": "...", "seq": 123 }
```

The client must ACK only after xterm accepts the write callback:

```json
{ "type": "terminal:ack", "seq": 123 }
```

If no xterm sink is registered yet, the hook buffers output up to its configured cap. Dropped buffered chunks are ACKed so the relay can continue instead of deadlocking.

The bundled Hudson relay advertises its negotiated support in `session:ready.capabilities`, currently including:

- `terminal:ack`
- `flow-control:ack-v1`
- `backend:pty`
- `backend:tmux`
- `backend:zellij`
- `control-mode:observe`

The public `hudsonkit/terminal` subpath exports the client/server message types used by this contract (`TerminalRelayClientMessage`, `TerminalRelayServerMessage`, `TerminalAckMessage`, and related session messages). Older relays may ignore `terminal:ack` and `controlMode`; clients must tolerate that.

## Tiling Guidance

HudsonKit terminal tiles should be multiple `TerminalRelay` instances, each with a distinct `sessionKey` unless deliberately observing the same backing session.

Hosts must define the safety model:

- one writer per live relay session for takeover mode
- explicit observe/read-only mode for shared viewing
- clear tile identity chrome showing renderer, backend, session name, and control mode
- refit visible tiles after resize, reveal, and layout changes

## Acceptance Checklist

- Output-heavy commands do not freeze the UI or unboundedly buffer in JS.
- WebGL failure falls back to DOM rendering without remount loops.
- Hidden or zero-size tiles recover after becoming visible.
- Resize sends accurate cols/rows after tile and window changes.
- Read-only mode blocks all input paths.
- Theme changes update xterm colors without reconnecting.
- Session reconnect restores buffered terminal state where the relay supports replay.
- Multi-tile hosts do not accidentally attach two writers to one session.
- Package builds include `hudsonkit/terminal` declarations.

## Future Work

- Add search, web links, serialize, and unicode addons behind explicit props.
- Add component-level tests with mocked xterm constructors and addon failures.
- Add browser integration tests for resize, paste, IME, and reconnect behavior.
- Expose a first-class `HudTerminalTile` chrome component once at least two hosts converge on the same identity controls.
