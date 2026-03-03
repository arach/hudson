import { createRequire } from 'module';
import { execSync } from 'child_process';
import type { WebSocket } from 'ws';
import type { IPty } from 'node-pty';

const require = createRequire(import.meta.url);
const pty = require('node-pty') as typeof import('node-pty');

import type { SessionInitMessage } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long an orphaned session lives before being reaped (5 minutes). */
const ORPHAN_TTL_MS = 5 * 60 * 1000;

/** Maximum size of the raw output buffer for reconnect replay (~512 KB). */
const MAX_BUFFER_SIZE = 512 * 1024;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  pty: IPty;
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

export const sessions = new Map<string, Session>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function send(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export function createSession(ws: WebSocket, msg: SessionInitMessage): Session {
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

  const env: Record<string, string | undefined> = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' };
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
  console.log(`[relay] Session ${id} created (${cols}x${rows})`);
  return session;
}

/** Attach a WebSocket to an existing session (reconnect). */
export function attachSession(session: Session, ws: WebSocket, cols?: number, rows?: number) {
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

  console.log(`[relay] Session ${session.id} reconnected`);
}

/** Detach the WebSocket from a session (keeps PTY alive). */
export function detachSession(session: Session) {
  session.ws = null;

  if (session.exited) {
    scheduleReap(session, 5_000);
  } else {
    scheduleReap(session, ORPHAN_TTL_MS);
    console.log(`[relay] Session ${session.id} detached (orphaned for ${ORPHAN_TTL_MS / 1000}s)`);
  }
}

export function scheduleReap(session: Session, delay: number) {
  if (session.reapTimer) clearTimeout(session.reapTimer);
  session.reapTimer = setTimeout(() => {
    if (!session.ws) {
      destroy(session.id);
    }
  }, delay);
}

/** Hard destroy — kill PTY, remove from map. */
export function destroy(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.reapTimer) clearTimeout(session.reapTimer);
  try { session.pty.kill(); } catch {}
  sessions.delete(sessionId);
  console.log(`[relay] Session ${sessionId} destroyed`);
}
