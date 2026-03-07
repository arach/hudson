---
title: "Relay: Terminal Server"
description: Bridge WebSocket connections from the browser to PTY sessions on the host.
section: cli
order: 3
---

# Relay -- Terminal Server

`@hudson/relay` is a standalone server that bridges WebSocket connections from the browser to PTY sessions on the host machine. It powers the embedded terminal experience in Hudson apps via the `useTerminalRelay` hook (see [API Reference](../npm/sdk/api-reference.md#useterminalrelay)).

## What It Does

The relay server:

1. Accepts WebSocket connections from Hudson apps running in the browser.
2. Spawns PTY processes (currently Claude CLI sessions) on the host.
3. Streams terminal I/O between the WebSocket and the PTY in real time.
4. Supports session persistence -- disconnected sessions stay alive for reconnection.
5. Exposes HTTP endpoints for TypeScript compilation and file uploads.

## Installation

The relay is a private package within the Hudson monorepo. It requires native dependencies (`node-pty`, `ws`).

```bash
cd packages/hudson-relay
bun install
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `node-pty` | Spawn and manage pseudo-terminal processes |
| `ws` | WebSocket server |
| `esbuild` | TypeScript-to-JavaScript compilation for the `/api/compile` endpoint |

## Starting the Server

```bash
# Default port (3600)
bun run relay

# Custom port
bun run relay -- --port 4000

# Via node directly
node --no-warnings --import tsx packages/hudson-relay/src/index.ts --port 3600
```

The server listens on a single port for both HTTP and WebSocket traffic.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAY_PORT` | `3600` | Listen port. Overridden by `--port` flag. |
| `CLAUDE_BIN` | Auto-detected via `which claude` | Path to the Claude CLI binary. |

## Connecting from an App

Use the `useTerminalRelay` hook from `@hudsonos/sdk` to connect to the relay from a React component. The hook manages the WebSocket lifecycle, session init, reconnection, and data streaming.

```tsx
import { useTerminalRelay } from '@hudsonos/sdk';

function MyTerminal() {
  const relay = useTerminalRelay({
    url: 'ws://localhost:3600',
    cwd: '/Users/me/project',
    systemPrompt: 'You are a helpful coding assistant.',
    autoConnect: true,
  });

  // relay.status, relay.onData, relay.sendInput, etc.
}
```

See [API Reference -- useTerminalRelay](../npm/sdk/api-reference.md#useterminalrelay) for the full API.

## WebSocket Protocol

All messages are JSON-encoded strings. The client sends `ClientMessage` types and the server responds with server messages.

### Client Messages

#### session:init

Sent once after the WebSocket opens. Creates a new PTY session.

```typescript
interface SessionInitMessage {
  type: 'session:init';
  cols: number;
  rows: number;
  systemPrompt?: string;
  cwd?: string;
  workspaceFiles?: Record<string, string>;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `cols` | Yes | Terminal width in columns. Minimum 20. |
| `rows` | Yes | Terminal height in rows. Minimum 4. |
| `systemPrompt` | No | System prompt passed to the CLI session. |
| `cwd` | No | Working directory for the PTY. Defaults to `$HOME`. Supports `~` expansion. |
| `workspaceFiles` | No | Map of relative paths to file contents. Files are created in the CWD if they do not already exist. Useful for bootstrapping project scaffolding before the CLI starts. |

#### session:reconnect

Resumes an existing session on a new WebSocket connection.

```typescript
interface SessionReconnectMessage {
  type: 'session:reconnect';
  sessionId: string;
  cols?: number;
  rows?: number;
}
```

The server replays buffered output (up to 512 KB) so the terminal UI rebuilds its state. If the session has expired, the server responds with `session:expired`.

#### terminal:input

Sends raw keystrokes to the PTY.

```typescript
interface TerminalInputMessage {
  type: 'terminal:input';
  data: string;
}
```

#### terminal:resize

Resizes the remote terminal.

```typescript
interface TerminalResizeMessage {
  type: 'terminal:resize';
  cols: number;
  rows: number;
}
```

### Server Messages

#### session:ready

Sent after a successful `session:init` or `session:reconnect`.

```json
{ "type": "session:ready", "sessionId": "a1b2c3d4" }
```

On reconnect, includes `"reconnected": true`.

#### session:error

Sent when session creation fails (e.g., Claude CLI not found).

```json
{ "type": "session:error", "error": "Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code" }
```

#### session:expired

Sent in response to `session:reconnect` when the session no longer exists.

```json
{ "type": "session:expired", "sessionId": "a1b2c3d4" }
```

#### session:exit

Sent when the PTY process exits.

```json
{ "type": "session:exit", "exitCode": 0 }
```

If the process crashed (non-zero exit within 5 seconds of start), includes a `reason` field with cleaned-up output from the PTY buffer.

#### session:detached

Sent to a previously-attached WebSocket when another client reconnects to the same session.

```json
{ "type": "session:detached" }
```

#### terminal:data

Streams raw terminal output from the PTY.

```json
{ "type": "terminal:data", "data": "$ " }
```

## Session Lifecycle

```
Client                              Server
  |                                   |
  |-- WebSocket connect ------------->|
  |-- session:init { cols, rows } --->|  spawn PTY
  |<-- session:ready { sessionId } ---|
  |                                   |
  |<-- terminal:data { data } --------|  (continuous)
  |-- terminal:input { data } ------->|
  |-- terminal:resize { cols, rows }->|
  |                                   |
  |-- WebSocket close --------------->|  session becomes orphaned
  |                                   |  (kept alive for 5 minutes)
  |                                   |
  |-- WebSocket connect ------------->|
  |-- session:reconnect { id } ------>|  reattach
  |<-- session:ready { reconnected }--|  replay buffered output
  |<-- terminal:data { buffer } ------|
```

### Orphaned Sessions

When a WebSocket disconnects, the PTY session is not killed immediately. It enters an orphaned state and lives for 5 minutes, waiting for a reconnect. This handles browser tab refreshes and transient network issues gracefully.

After 5 minutes without reconnection, the session is destroyed and the PTY process is killed.

### Output Buffering

The server maintains a rolling output buffer of up to 512 KB per session. On reconnect, the entire buffer is replayed so the terminal UI (typically xterm.js) can rebuild the screen state.

## HTTP Endpoints

The relay also serves HTTP endpoints on the same port.

### GET /health

Liveness check.

```json
{ "ok": true }
```

### POST /api/compile

Compiles TypeScript source to JavaScript using esbuild. Used by the logo designer for live template compilation.

Request:

```json
{ "source": "const x: number = 42; return String(x);" }
```

Response:

```json
{ "js": "const x = 42;\nreturn String(x);\n" }
```

Returns `422` if the source fails to compile or the compiled output does not produce a valid function.

### POST /api/upload

Saves a base64-encoded file to `/tmp/hudson-uploads/`.

Request:

```json
{ "name": "logo.png", "data": "iVBORw0KGgo..." }
```

Response:

```json
{ "path": "/tmp/hudson-uploads/abc123-logo.png" }
```

## Configuration

The relay has minimal configuration, controlled by CLI flags and environment variables:

| Setting | Flag | Env Var | Default |
|---------|------|---------|---------|
| Listen port | `--port` | `RELAY_PORT` | `3600` |
| Claude binary | -- | `CLAUDE_BIN` | Auto-detected |
| Terminal type | -- | -- | `xterm-256color` |
| Orphan timeout | -- | -- | 5 minutes |
| Buffer size | -- | -- | 512 KB |

## Graceful Shutdown

On `SIGINT` or `SIGTERM`, the server destroys all active PTY sessions, closes the WebSocket server, and shuts down the HTTP server cleanly.
