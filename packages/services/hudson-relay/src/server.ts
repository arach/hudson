import { createServer } from 'http';
import { createRequire } from 'module';
import type { IncomingMessage, ServerResponse } from 'http';

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
  verifyReconnectToken,
  writeSession,
  ackSessionOutput,
  RELAY_CAPABILITIES,
} from './relay/session';
import type { ClientMessage } from './relay/types';
import { handleCompile } from './routes/compile';
import { handleUpload } from './routes/upload';
import { handleHealth } from './routes/health';
import { authToken, extractToken, isAllowedOrigin, tokenMatches } from './relay/access';

// ---------------------------------------------------------------------------
// Access control
//
// The relay hands out interactive shells, so it never trusts the network:
//  - binds to loopback unless HUDSON_RELAY_HOST is set explicitly
//  - browser clients must come from a loopback origin (or an origin listed in
//    HUDSON_RELAY_ALLOWED_ORIGINS) — this blocks DNS-rebinding and random
//    webpages driving the relay
//  - if HUDSON_RELAY_TOKEN is set, every HTTP route (except /health) and every
//    WebSocket connection must present it
// See ./relay/access for the origin/token helpers.
// ---------------------------------------------------------------------------

function cors(res: ServerResponse, origin: string | undefined) {
  if (!origin || !isAllowedOrigin(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Relay-Token');
}

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

function deny(res: ServerResponse, status: number, error: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error }));
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function startServer(port: number, host = process.env.HUDSON_RELAY_HOST || '127.0.0.1') {
  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    cors(res, origin);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (origin && !isAllowedOrigin(origin)) {
      deny(res, 403, 'Origin not allowed');
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname !== '/health' && !tokenMatches(extractToken(req, url))) {
      deny(res, 401, 'Missing or invalid relay token');
      return;
    }

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
        deny(res, 404, 'Not found');
    }
  });

  // WebSocket server on the same HTTP server
  const wss = new WebSocketServer({ server });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wss.on('connection', (ws: any, req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      console.warn(`[relay] Rejected WebSocket from disallowed origin: ${origin}`);
      send(ws, { type: 'session:error', error: 'Origin not allowed' });
      ws.close(1008, 'Origin not allowed');
      return;
    }
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    if (!tokenMatches(extractToken(req, url))) {
      console.warn('[relay] Rejected WebSocket with missing or invalid relay token');
      send(ws, { type: 'session:error', error: 'Missing or invalid relay token' });
      ws.close(1008, 'Unauthorized');
      return;
    }

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
          send(ws, {
            type: 'session:ready',
            sessionId: session.id,
            reconnectToken: session.reconnectToken,
            capabilities: RELAY_CAPABILITIES,
          });
          break;
        }

        case 'session:reconnect': {
          const existing = sessions.get(msg.sessionId);
          if (existing && !existing.exited) {
            // Reattaching steals the PTY from whoever holds it, so it demands
            // the ownership token from the original session:ready. Clients
            // without it (stale or hostile) are told to start fresh.
            if (!verifyReconnectToken(existing, msg.reconnectToken)) {
              console.warn(`[relay] Session ${existing.id}: reconnect refused (bad ownership token)`);
              send(ws, { type: 'session:expired', sessionId: msg.sessionId });
              break;
            }
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
            attachSession(existing, ws, msg.cols, msg.rows, msg.clientCapabilities);
            send(ws, {
              type: 'session:ready',
              sessionId: existing.id,
              reconnectToken: existing.reconnectToken,
              reconnected: true,
              capabilities: RELAY_CAPABILITIES,
            });
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

        case 'terminal:ack':
          if (!sessionId) return;
          {
            const session = sessions.get(sessionId);
            if (session && sessionOwnsSocket(session, ws)) {
              ackSessionOutput(session, msg.seq);
            }
          }
          break;
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

  server.listen(port, host, () => {
    console.log(`[relay] Server listening on http://${host}:${port} (HTTP + WebSocket)`);
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
      console.warn('[relay] WARNING: relay is bound to a non-loopback interface. Set HUDSON_RELAY_TOKEN to require auth.');
    }
    if (authToken()) console.log('[relay] Token auth enabled (HUDSON_RELAY_TOKEN)');
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
