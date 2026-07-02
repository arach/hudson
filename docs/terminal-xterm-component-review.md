# HudsonKit xterm terminal component review

Date: 2026-07-01
Scope: local working changes in `packages/web/hudsonkit/src/components/TerminalRelay.tsx`, `src/hooks/useTerminalRelay.ts`, `src/terminal.ts`, package exports, and `docs/terminal-xterm-component-spec.md`.

## Validation performed

- Ran `bun run build:js` from `packages/web/hudsonkit` successfully.
- Verified `hudsonkit/terminal` emits `dist/terminal.js` and `dist/terminal.d.ts`.
- Did not run a browser/relay integration session in this pass.

## 1. Gaps and risks

### Flow control and ACKs

- The client hook now understands `terminal:data` messages with `seq` and ACKs after `term.write(data, ack)`, which is the right direction.
- ACKs are currently client-only future support. The bundled relay under `packages/services/hudson-relay` still emits unsequenced `terminal:data` and does not accept `terminal:ack`, so donation-quality flow control is not end-to-end yet.
- The `ack` closure is not idempotent. A buggy/custom sink could double-ACK a chunk.
- If an output chunk is handed to a primary sink and that sink never calls `ack` (dispose during write, custom sink bug, xterm callback starvation), the relay can deadlock once server-side flow control is implemented.
- `MAX_PENDING_OUTPUT` is hard-coded at 512 KiB and not configurable. It ACKs dropped buffered chunks, which avoids deadlock, but consumers cannot tune or observe loss.

### Resize handling

- `ResizeObserver -> fit -> resize()` exists and initial dimensions are sent. Good baseline.
- Resize sends on every observer callback even when cols/rows did not change. In tiling UIs this can spam the relay during drags.
- There is no explicit zero-size/hidden recovery policy beyond ResizeObserver. Hidden tabs/tiles often need a deferred `fit()` on reveal, one or two `requestAnimationFrame`s, and a public `fit()`/`refit()` imperative method for hosts.
- Resizes are sent after `initSentRef.current`, but the hook has no last-sent dimensions guard.

### Stable mount identity

- `TerminalRelay` recreates xterm when `readOnly` changes because the init effect depends on `sendTerminalInput`, which depends on `readOnly`.
- `scrollback` and `renderer` changes also recreate xterm. Renderer changes may require this; `readOnly` should not.
- Cleanup does not set `ready` back to false. During re-init windows there is risk of an old data binding writing into a disposed or half-created terminal.
- The component currently exposes the raw xterm `Terminal` instance via `onReady`; useful, but it couples the public root `hudsonkit` declarations to the optional `@xterm/xterm` peer.

### Backend/session contract

- The hook advertises `backend: 'zellij'` plus `zellijSession` and `zellijSocketDir`, but the local relay types still only accept `'pty' | 'tmux'`.
- `terminalSession`, `tmuxSession`, and `zellijSession` are parallel optional fields. That will get ambiguous as more backends and shared/observe modes are added.
- Read-only is only a UI/component gate. It does not tell the relay that this client is an observer, and it does not prevent another route from sending input through the same handle.
- Multi-tile safety is documented but not enforced. Passing one relay handle to two `TerminalRelay` components means the last `onData` registration wins.

### Read-only mode

- Keyboard xterm input is blocked by `sendTerminalInput`, but voice events can still connect a disconnected relay before no-oping input.
- Paste/drop image paths still perform uploads in read-only mode before `sendTerminalInput` drops the result. That is a side effect and should be blocked.
- Drag-over/drop UI still activates in read-only mode.

### Renderer fallback

- WebGL addon load is gracefully caught, and context loss reports DOM fallback.
- Import failures for `@xterm/xterm` / fit addon, `new Terminal()`, `loadAddon`, and `open()` are not caught as a component state. They log or throw rather than surfacing a renderer/error callback or a deterministic fallback overlay.
- `renderer: 'auto'` always attempts WebGL when the addon is present. That may be too aggressive for WKWebView/Safari/tiled-heavy layouts.

### Reusability boundary

- `TerminalRelay` mixes reusable xterm rendering with Hudson product behavior: relay service overlay, image upload endpoint, global voice events, `captureWorkspace`, and `usePlatform`.
- `isElementVisible()` currently requires an ancestor with `data-hudson-terminal-drawer-content="true"`, which makes global voice support drawer-specific and surprising in a reusable terminal tile.
- The component assumes image upload to `${apiBaseUrl}/api/relay/upload`; this should be host-provided or an opt-in wrapper.

### Theming and ARIA

- `colorScheme` dark/light/auto and contrast ratios are good defaults.
- Donation-quality reuse should also expose xterm theme overrides, screen reader mode, focus policy, and more ARIA metadata.
- `role="application"` is reasonable for a terminal, but hosts may need to override it; xterm `screenReaderMode` should be configurable.

### Packaging

- `hudsonkit/terminal` subpath is good and builds.
- Root `hudsonkit` still re-exports terminal symbols. The generated root `dist/index.d.ts` imports `@xterm/xterm`, which can break TypeScript consumers who use `hudsonkit` but do not install optional xterm peers.

## 2. Recommended API adjustments

### Split core rendering from Hudson-specific conveniences

Keep the current ergonomic wrapper if desired, but introduce/clarify layers:

```ts
// pure xterm rendering + relay handle binding
<TerminalRelayView relay={relay} />

// Hudson app wrapper: service overlay, upload, voice, settings CTA
<HudsonTerminalRelay relay={relay} uploadImages voiceTarget="focused" />
```

If renaming is too disruptive, make the existing `TerminalRelay` the reusable core and move upload/voice/service-overlay behavior behind explicit opt-in props.

### Use a backend discriminated union

Replace the parallel backend/session options with an additive union, while keeping old fields as deprecated compatibility aliases:

```ts
type TerminalBackendConfig =
  | { type: 'pty'; command?: string; args?: string[]; env?: Record<string, string> }
  | { type: 'tmux'; session: string; window?: string; pane?: string }
  | { type: 'zellij'; session: string; socketDir?: string; pane?: string }
  | { type: 'custom'; protocol: string; params?: Record<string, unknown> };

useTerminalRelay({ backend: { type: 'tmux', session: 'hudson-main' } });
```

### Make control mode explicit

```ts
type TerminalControlMode = 'owner' | 'takeover' | 'observe';

useTerminalRelay({
  sessionKey: 'tile-a',
  controlMode: 'owner',
});

<TerminalRelay relay={relay} readOnly={controlMode === 'observe'} />
```

Send this to the relay in `session:init` / `session:reconnect` so shared viewing is a protocol decision, not just a UI convention.

### Add flow-control knobs and protocol types

```ts
interface TerminalFlowControlOptions {
  mode?: 'auto' | 'ack' | 'none';
  ackStage?: 'xterm-write' | 'enqueue';
  maxBufferedBytes?: number;
  ackTimeoutMs?: number;
  onBufferOverflow?: (info: { droppedBytes: number; droppedChunks: number }) => void;
}
```

Export message types from `hudsonkit/terminal`:

```ts
type TerminalRelayServerMessage =
  | { type: 'session:ready'; sessionId: string; capabilities?: string[] }
  | { type: 'terminal:data'; data: string; seq?: number };

type TerminalRelayClientMessage =
  | { type: 'terminal:ack'; seq: number }
  | { type: 'terminal:resize'; cols: number; rows: number };
```

### Add an imperative terminal ref

```ts
interface TerminalRelayRef {
  focus(): void;
  fit(): { cols: number; rows: number } | null;
  clear(): void;
  getDimensions(): { cols: number; rows: number } | null;
  getXterm(): unknown; // or TerminalLike, not raw @xterm type in root exports
}
```

### Make renderer state richer

```ts
type TerminalRendererState = {
  requested: 'auto' | 'dom' | 'webgl';
  actual: 'dom' | 'webgl';
  fallbackReason?: 'preference' | 'addon-missing' | 'load-error' | 'context-loss' | 'construction-error';
};
```

### Theme/accessibility props

```ts
interface TerminalRelayProps {
  theme?: import('@xterm/xterm').ITheme; // terminal subpath only, or structural type
  screenReaderMode?: boolean;
  autoFocus?: boolean | 'on-connect';
  role?: React.AriaRole;
  ariaDescription?: string;
}
```

For root `hudsonkit`, either stop re-exporting terminal runtime/types or replace raw xterm imports with a structural `TerminalInstance` type so non-terminal consumers do not need xterm installed.

## 3. Next concrete implementation pass

1. **Stabilize mount identity and read-only behavior first.**
   - Store `readOnly` and `sendInput` in refs so changing `readOnly` does not recreate xterm.
   - Set `ready=false` during terminal disposal/re-init.
   - Block voice connect, paste upload, drag-over, and drop entirely when `readOnly` is true.
   - Make ACK closures idempotent.

2. **Make resize robust for tiling.**
   - Track last sent `{cols, rows}` and only send changed, positive dimensions.
   - Debounce or `requestAnimationFrame` coalesce `ResizeObserver` callbacks.
   - Add `ref.fit()` / `relayViewRef.fit()` and document that tiling hosts call it on reveal/layout commit.

3. **Lock the protocol contract.**
   - Add exported client/server message TypeScript types.
   - Update `packages/services/hudson-relay` to either support `seq` + `terminal:ack` or explicitly advertise no flow control through capabilities.
   - Do not advertise zellij as supported until relay types and server implementation accept it, or gate it as a custom backend passthrough.

4. **Separate reusable core from Hudson app features.**
   - Move voice, service startup overlay, and image upload behind optional props or a wrapper component.
   - Remove drawer-specific visibility checks from the core terminal; use focus/active-instance targeting instead.

5. **Harden renderer fallback.**
   - Catch dynamic import, constructor, addon, and `open()` failures.
   - Report `onRendererChange` with requested/actual/fallback reason.
   - Consider making `auto` default to DOM for WKWebView or when many terminals are mounted, with hosts opting into WebGL.

6. **Tests/docs.**
   - Add mocked-xterm tests for ACK timing, dropped-buffer ACKs, read-only blocking, mount identity, and resize dedupe.
   - Add one browser integration path for hidden tile reveal + resize.
   - Expand `docs/terminal-xterm-component-spec.md` with the final protocol schema, backend matrix, and explicit one-writer/observe examples.

## Small immediate changes that are safe to land

- Keep `hudsonkit/terminal` export and `src/terminal.ts`; build passes.
- Land the ACK-after-write client shape, but mark server flow control as pending until relay support exists.
- Land read-only props only after blocking upload/voice side effects.
- Keep the HudTiling drag-threshold/stability fix separate from terminal API work; it is useful but should be reviewed/tested as a native primitive change, not bundled into the web terminal API contract.
