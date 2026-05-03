import type { IncomingMessage, ServerResponse } from 'http';

/** GET /health — simple liveness check. */
export function handleHealth(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}
