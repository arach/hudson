import { createServer } from 'http';
import type { IncomingMessage } from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws') as typeof import('ws');

import {
  sessions,
  createSession,
  attachSession,
  detachSession,
  destroy,
  resizeSession,
  send,
  sessionOwnsSocket,
  writeSession,
} from './relay/session';
import type { ClientMessage, RelaySocket } from './relay/types';
import { handleCompile } from './routes/compile';
import { handleUpload } from './routes/upload';
import { handleHealth } from './routes/health';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg.type === 'string') return msg as ClientMessage;
  } catch {}
  return null;
}

function cors(res: import('http').ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function startServer(port: number) {
  const server = createServer((req, res) => {
    cors(res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`);

    switch (url.pathname) {
      case '/health':
        handleHealth(req, res);
        break;
      case '/api/compile':
        handleCompile(req, res);
        break;
      case '/api/upload':
        handleUpload(req, res);
        break;
      // Backwards-compat: support the Next.js route paths too
      case '/api/logo/compile':
        handleCompile(req, res);
        break;
      case '/api/relay/upload':
        handleUpload(req, res);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  // WebSocket server on the same HTTP server
  const wss = new WebSocketServer({ server });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wss.on('connection', (ws: any, _req: IncomingMessage) => {
    let sessionId: string | null = null;

    ws.on('message', (raw: Buffer | string) => {
      const msg = parseMessage(raw.toString());
      if (!msg) return;

      switch (msg.type) {
        case 'session:init': {
          // Detach from any previous session on this socket
          if (sessionId) {
            const prev = sessions.get(sessionId);
            if (prev && sessionOwnsSocket(prev, ws)) detachSession(prev);
          }
          const session = createSession(ws, msg);
          if (!session) break; // Pre-flight failed — error already sent to client
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
              if (prev && sessionOwnsSocket(prev, ws)) detachSession(prev);
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
          if (session && sessionOwnsSocket(session, ws)) {
            writeSession(session, msg.data);
          }
          break;
        }

        case 'terminal:resize': {
          if (!sessionId) return;
          const session = sessions.get(sessionId);
          if (session && sessionOwnsSocket(session, ws)) {
            const cols = Math.max(msg.cols || 80, 20);
            const rows = Math.max(msg.rows || 24, 4);
            resizeSession(session, cols, rows);
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session && sessionOwnsSocket(session, ws)) detachSession(session);
        sessionId = null;
      }
    });

    ws.on('error', (err: Error) => {
      console.error('[relay] WebSocket error:', err.message);
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session && sessionOwnsSocket(session, ws)) detachSession(session);
        sessionId = null;
      }
    });
  });

  server.listen(port, () => {
    console.log(`[relay] Server listening on http://localhost:${port} (HTTP + WebSocket)`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[relay] Shutting down...');
    for (const [id] of sessions) destroy(id);
    wss.close();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}
