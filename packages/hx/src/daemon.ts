// ---------------------------------------------------------------------------
// hx daemon — HTTP server (Node-compatible, no framework)
// ---------------------------------------------------------------------------

import { createServer } from 'http';
import * as registry from './registry';
import type { HxService } from './types';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

const startedAt = Date.now();

export async function startDaemon(port: number) {
  await registry.load();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const { pathname } = url;
    const method = req.method || 'GET';
    const headers = corsHeaders();

    const json = (data: unknown, status = 200) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(data, null, 2) + '\n');
    };

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }

    // --- Health ---
    if (pathname === '/health') {
      json({
        status: 'ok',
        uptime: Date.now() - startedAt,
        services: registry.getAll().length,
        timestamp: Date.now(),
      });
      return;
    }

    // --- Services list ---
    if (pathname === '/services' && method === 'GET') {
      json({ services: registry.getAll() });
      return;
    }

    // --- Register service ---
    if (pathname === '/services' && method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as Partial<HxService>;
        if (!body.id || !body.port) {
          json({ error: 'id and port are required' }, 400);
          return;
        }
        const svc = registry.register({
          id: body.id,
          name: body.name ?? body.id,
          port: body.port,
          host: body.host ?? 'localhost',
          type: body.type ?? 'custom',
          endpoints: body.endpoints,
          meta: body.meta,
          registeredAt: 0,
          lastSeenAt: 0,
        });
        json({ service: svc }, 201);
      } catch (err) {
        json({ error: err instanceof Error ? err.message : String(err) }, 400);
      }
      return;
    }

    // --- Single service / deregister ---
    const svcMatch = pathname.match(/^\/services\/([^/]+)$/);
    if (svcMatch) {
      const id = svcMatch[1];
      if (method === 'GET') {
        const svc = registry.get(id);
        if (!svc) { json({ error: 'Not found' }, 404); return; }
        json({ service: svc });
        return;
      }
      if (method === 'DELETE') {
        const deleted = registry.deregister(id);
        if (!deleted) { json({ error: 'Not found' }, 404); return; }
        json({ deleted: true, id });
        return;
      }
    }

    // --- Proxy ---
    const proxyMatch = pathname.match(/^\/proxy\/([^/]+)(\/.*)?$/);
    if (proxyMatch) {
      const serviceId = proxyMatch[1];
      const rest = proxyMatch[2] ?? '/';
      const svc = registry.get(serviceId);
      if (!svc) { json({ error: `Service '${serviceId}' not found` }, 404); return; }

      const target = `http://${svc.host ?? 'localhost'}:${svc.port}${rest}${url.search}`;
      try {
        const proxyReqInit: RequestInit = { method };
        if (method !== 'GET' && method !== 'HEAD') {
          proxyReqInit.body = await readBody(req);
          proxyReqInit.headers = { 'Content-Type': req.headers['content-type'] || 'application/json' };
        }
        const proxyRes = await fetch(target, proxyReqInit);
        const resHeaders = corsHeaders();
        proxyRes.headers.forEach((v, k) => {
          if (k.toLowerCase() !== 'access-control-allow-origin') {
            resHeaders[k] = v;
          }
        });
        const body = await proxyRes.text();
        res.writeHead(proxyRes.status, resHeaders);
        res.end(body);
      } catch (err) {
        json({ error: `Proxy failed: ${err instanceof Error ? err.message : String(err)}` }, 502);
      }
      return;
    }

    json({ error: 'Not found' }, 404);
  });

  server.listen(port, () => {
    console.log(`[hx] Daemon listening on http://localhost:${port}`);
  });

  return server;
}
