/**
 * ai-relay — Persistent Claude CLI session relayed via WebSocket.
 *
 * Usage: bun run relay   (runs via node, not bun — node-pty requires Node's I/O layer)
 *
 * WebSocket server on port 3600. Spawns `claude` in a real PTY so the CLI
 * thinks it's in an interactive terminal. Raw PTY output is forwarded over
 * WebSocket — the browser-side xterm.js handles all rendering.
 *
 * Sessions survive WebSocket disconnects — clients can reconnect by session ID.
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);

const { WebSocketServer } = require('ws') as typeof import('ws');
type WebSocket = import('ws').WebSocket;
const pty = require('node-pty') as typeof import('node-pty');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionInitMessage {
  type: 'session:init';
  cols: number;
  rows: number;
  systemPrompt?: string;
}

interface SessionReconnectMessage {
  type: 'session:reconnect';
  sessionId: string;
  cols?: number;
  rows?: number;
}

interface TerminalInputMessage {
  type: 'terminal:input';
  data: string;
}

interface TerminalResizeMessage {
  type: 'terminal:resize';
  cols: number;
  rows: number;
}

type ClientMessage =
  | SessionInitMessage
  | SessionReconnectMessage
  | TerminalInputMessage
  | TerminalResizeMessage;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** How long an orphaned session lives before being reaped (5 minutes). */
const ORPHAN_TTL_MS = 5 * 60 * 1000;

/** Maximum size of the raw output buffer for reconnect replay (~512 KB). */
const MAX_BUFFER_SIZE = 512 * 1024;

interface Session {
  id: string;
  pty: pty.IPty;
  /** Currently attached WebSocket (null when detached/orphaned). */
  ws: WebSocket | null;
  /** Rolling buffer of raw PTY output for reconnect replay. */
  outputBuffer: string;
  /** Current terminal dimensions. */
  cols: number;
  rows: number;
  /** Set when ws detaches — session is reaped after ORPHAN_TTL_MS. */
  reapTimer: ReturnType<typeof setTimeout> | null;
  /** Whether the PTY process has exited. */
  exited: boolean;
  exitCode: number | null;
}

const sessions = new Map<string, Session>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

function createSession(ws: WebSocket, msg: SessionInitMessage): Session {
  const id = generateId();
  const cols = Math.max(msg.cols || 80, 20);
  const rows = Math.max(msg.rows || 24, 4);

  const args: string[] = ['--verbose'];
  if (msg.systemPrompt) {
    args.push('--system-prompt', msg.systemPrompt);
  }

  let claudeBin = process.env.CLAUDE_BIN || '';
  if (!claudeBin) {
    try {
      claudeBin = execSync('which claude', { encoding: 'utf8' }).trim();
    } catch {
      claudeBin = 'claude';
    }
  }

  const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' };
  delete env.CLAUDECODE;

  const ptyProcess = pty.spawn(claudeBin, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.cwd(),
    env,
  });

  const session: Session = {
    id,
    pty: ptyProcess,
    ws,
    outputBuffer: '',
    cols,
    rows,
    reapTimer: null,
    exited: false,
    exitCode: null,
  };

  ptyProcess.onData((data: string) => {
    // Append to rolling buffer (cap at MAX_BUFFER_SIZE)
    session.outputBuffer += data;
    if (session.outputBuffer.length > MAX_BUFFER_SIZE) {
      session.outputBuffer = session.outputBuffer.slice(-MAX_BUFFER_SIZE);
    }

    // Forward raw data to attached client
    if (session.ws && session.ws.readyState === 1) {
      send(session.ws, { type: 'terminal:data', data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    session.exited = true;
    session.exitCode = exitCode;
    if (session.ws) {
      send(session.ws, { type: 'session:exit', exitCode });
    }
    // Don't cleanup immediately — let the client see the exit message.
    scheduleReap(session, 10_000);
  });

  sessions.set(id, session);
  console.log(`[ai-relay] Session ${id} created (${cols}x${rows})`);
  return session;
}

/** Attach a WebSocket to an existing session (reconnect). */
function attachSession(session: Session, ws: WebSocket, cols?: number, rows?: number) {
  // Cancel any pending reap
  if (session.reapTimer) {
    clearTimeout(session.reapTimer);
    session.reapTimer = null;
  }

  session.ws = ws;

  // Resize if the client has different dimensions
  if (cols && rows) {
    const c = Math.max(cols, 20);
    const r = Math.max(rows, 4);
    if (c !== session.cols || r !== session.rows) {
      session.pty.resize(c, r);
      session.cols = c;
      session.rows = r;
    }
  }

  // Replay buffered output so xterm.js rebuilds the screen
  if (session.exited) {
    send(ws, { type: 'session:exit', exitCode: session.exitCode });
  } else if (session.outputBuffer.length > 0) {
    send(ws, { type: 'terminal:data', data: session.outputBuffer });
  }

  console.log(`[ai-relay] Session ${session.id} reconnected`);
}

/** Detach the WebSocket from a session (keeps PTY alive). */
function detachSession(session: Session) {
  session.ws = null;

  if (session.exited) {
    scheduleReap(session, 5_000);
  } else {
    scheduleReap(session, ORPHAN_TTL_MS);
    console.log(`[ai-relay] Session ${session.id} detached (orphaned for ${ORPHAN_TTL_MS / 1000}s)`);
  }
}

function scheduleReap(session: Session, delay: number) {
  if (session.reapTimer) clearTimeout(session.reapTimer);
  session.reapTimer = setTimeout(() => {
    if (!session.ws) {
      destroy(session.id);
    }
  }, delay);
}

/** Hard destroy — kill PTY, remove from map. */
function destroy(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.reapTimer) clearTimeout(session.reapTimer);
  try { session.pty.kill(); } catch {}
  sessions.delete(sessionId);
  console.log(`[ai-relay] Session ${sessionId} destroyed`);
}

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg.type === 'string') return msg as ClientMessage;
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const PORT = Number(process.env.RELAY_PORT) || 3600;

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`[ai-relay] WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  let sessionId: string | null = null;

  ws.on('message', (raw: Buffer | string) => {
    const msg = parseMessage(raw.toString());
    if (!msg) return;

    switch (msg.type) {
      case 'session:init': {
        // Detach from any previous session on this socket
        if (sessionId) {
          const prev = sessions.get(sessionId);
          if (prev) detachSession(prev);
        }
        const session = createSession(ws, msg);
        sessionId = session.id;
        send(ws, { type: 'session:ready', sessionId: session.id });
        break;
      }

      case 'session:reconnect': {
        const existing = sessions.get(msg.sessionId);
        if (existing && !existing.exited) {
          // Detach from any previous session on this socket
          if (sessionId && sessionId !== msg.sessionId) {
            const prev = sessions.get(sessionId);
            if (prev) detachSession(prev);
          }
          // Detach the session from any other socket
          if (existing.ws && existing.ws !== ws) {
            send(existing.ws, { type: 'session:detached' });
          }
          sessionId = existing.id;
          attachSession(existing, ws, msg.cols, msg.rows);
          send(ws, { type: 'session:ready', sessionId: existing.id, reconnected: true });
        } else {
          // Session gone — tell the client to start fresh
          send(ws, { type: 'session:expired', sessionId: msg.sessionId });
        }
        break;
      }

      case 'terminal:input': {
        if (!sessionId) return;
        const session = sessions.get(sessionId);
        if (session && !session.exited) {
          session.pty.write(msg.data);
        }
        break;
      }

      case 'terminal:resize': {
        if (!sessionId) return;
        const session = sessions.get(sessionId);
        if (session && !session.exited) {
          const cols = Math.max(msg.cols || 80, 20);
          const rows = Math.max(msg.rows || 24, 4);
          session.pty.resize(cols, rows);
          session.cols = cols;
          session.rows = rows;
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) detachSession(session);
      sessionId = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[ai-relay] WebSocket error:', err.message);
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) detachSession(session);
      sessionId = null;
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[ai-relay] Shutting down...');
  for (const [id] of sessions) destroy(id);
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  for (const [id] of sessions) destroy(id);
  wss.close(() => process.exit(0));
});
