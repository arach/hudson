/**
 * Unified Hudson server for Electrobun — merges the relay (WebSocket PTY) and
 * service management (templates, service executor) into a single Bun.serve on port 3600.
 */

import { executeServiceAction, probeHealth } from '../../../../app/services/executor';
import { SERVICE_CATALOG } from '../../../../app/services/catalog';
import {
  sessions,
  createSession,
  attachSession,
  detachSession,
  destroy,
  send,
} from '../../../../packages/hudson-relay/src/relay/session';
import type { ClientMessage, RelaySocket } from '../../../../packages/hudson-relay/src/relay/types';
import { transform } from 'esbuild';

const PORT = parseInt(process.env.HUDSON_PORT ?? '3600', 10);

// ---------------------------------------------------------------------------
// PATH augmentation — Electrobun apps launch with minimal macOS PATH
// ---------------------------------------------------------------------------
const HOME = process.env.HOME || '';
const EXTRA_PATHS = [
  `${HOME}/.bun/bin`,
  `${HOME}/.local/bin`,
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  `${HOME}/.nvm/current/bin`,
  `${HOME}/.cargo/bin`,
];
const currentPath = process.env.PATH || '/usr/bin:/bin';
const missing = EXTRA_PATHS.filter((p) => !currentPath.includes(p));
if (missing.length > 0) {
  process.env.PATH = [...missing, currentPath].join(':');
}

// ---------------------------------------------------------------------------
// Project root detection
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, readdir, unlink, mkdir, stat, copyFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

function findProjectRoot(): string {
  if (process.env.HUDSON_PROJECT_ROOT) return process.env.HUDSON_PROJECT_ROOT;

  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, 'packages', 'hudson-sdk'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const home = process.env.HOME || '';
  for (const candidate of [join(home, 'dev', 'hudson'), join(home, 'hudson')]) {
    if (existsSync(join(candidate, 'packages', 'hudson-sdk'))) return candidate;
  }

  return process.cwd();
}
const PROJECT_ROOT = findProjectRoot();

// ---------------------------------------------------------------------------
// Logo template management
// ---------------------------------------------------------------------------
const TEMPLATES_DIR = join(HOME, 'hudson', 'logos', '.data', 'logo-templates');
const SEED_DIR = join(PROJECT_ROOT, '.data', 'logo-templates');

let templatesSeeded = false;
async function ensureTemplatesDir() {
  await mkdir(TEMPLATES_DIR, { recursive: true });
  if (!templatesSeeded) {
    templatesSeeded = true;
    if (existsSync(SEED_DIR)) {
      const existing = new Set((await readdir(TEMPLATES_DIR)).filter(f => f.endsWith('.js')));
      const seeds = (await readdir(SEED_DIR)).filter(f => f.endsWith('.js'));
      const toSeed = seeds.filter(f => !existing.has(f));
      if (toSeed.length > 0) {
        await Promise.all(toSeed.map(f => copyFile(join(SEED_DIR, f), join(TEMPLATES_DIR, f))));
      }
    }
  }
}

function extractMeta(source: string): Record<string, unknown> {
  try {
    const match = source.match(/const\s+meta\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return {};
    const fn = new Function(`return ${match[1]};`);
    return fn() || {};
  } catch { return {}; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTemplate(id: string, source: string, mtime: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = extractMeta(source) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];
  if (meta.params) {
    for (const [key, def] of Object.entries(meta.params)) {
      params.push({ key, ...(def as object) });
    }
  }
  return {
    id, name: meta.name || id, description: meta.description || '',
    renderBody: source.trim(), builtin: meta.builtin || false, params,
    createdAt: mtime, updatedAt: mtime,
  };
}

async function readAllTemplates() {
  await ensureTemplatesDir();
  const files = await readdir(TEMPLATES_DIR);
  const templates: ReturnType<typeof parseTemplate>[] = [];
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    try {
      const fp = join(TEMPLATES_DIR, file);
      const [source, fstat] = await Promise.all([readFile(fp, 'utf-8'), stat(fp)]);
      templates.push(parseTemplate(file.replace(/\.js$/, ''), source, fstat.mtimeMs));
    } catch { /* skip */ }
  }
  return templates;
}

// ---------------------------------------------------------------------------
// Upload handler
// ---------------------------------------------------------------------------
const UPLOAD_DIR = '/tmp/hudson-uploads';

async function handleUpload(req: Request): Promise<Response> {
  const { name, data } = await req.json() as { name: string; data: string };
  if (!name || !data) return json({ error: 'Missing name or data' }, 400);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}-${name}`;
  const filepath = join(UPLOAD_DIR, filename);
  await Bun.write(filepath, Buffer.from(data, 'base64'));
  return json({ path: filepath });
}

// ---------------------------------------------------------------------------
// Compile handler (TypeScript → JavaScript via esbuild)
// ---------------------------------------------------------------------------
async function handleCompile(req: Request): Promise<Response> {
  const { source } = await req.json() as { source: string };
  if (typeof source !== 'string' || !source.trim()) {
    return json({ error: 'source is required' }, 400);
  }

  const result = await transform(source, { loader: 'ts', target: 'es2020' });
  const js = result.code;

  // Validate: the compiled JS must be executable as a function body
  try {
    const fn = new Function('p', 'vb', js);
    const testParams = {
      bgColor: '#111113', paneColor: '#ffffff', dimPaneColor: 'rgba(255,255,255,0.55)',
      channelColor: 'rgba(51,199,115,0.3)', borderRadius: 80, paneRadius: 14,
      gapWidth: 14, splitX: 0.37, splitY: 0.60, padding: 72,
    };
    const output = fn(testParams, 512);
    if (typeof output !== 'string') {
      return json({ error: `renderBody must return a string, got ${typeof output}` }, 422);
    }
  } catch (err) {
    return json({ error: `Runtime validation failed: ${err instanceof Error ? err.message : String(err)}` }, 422);
  }

  return json({ js });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg.type === 'string') return msg as ClientMessage;
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// WebSocket session tracking — map Bun ServerWebSocket to relay sessionId
// ---------------------------------------------------------------------------
interface WSData {
  sessionId: string | null;
}

// Bun's ServerWebSocket needs to be adapted to RelaySocket
function asRelay(ws: { readyState: number; send(data: string | Buffer): void }): RelaySocket {
  return ws as RelaySocket;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
export function startServiceServer() {
  const server = Bun.serve<WSData>({
    port: PORT,

    fetch: async (req, server) => {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // WebSocket upgrade
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const ok = server.upgrade(req, { data: { sessionId: null } });
        return ok ? undefined as unknown as Response : json({ error: 'WebSocket upgrade failed' }, 500);
      }

      // ── Health ────────────────────────────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, status: 'ok' });
      }

      // ── Relay HTTP routes ─────────────────────────────────────────────
      if (req.method === 'POST' && (url.pathname === '/api/compile' || url.pathname === '/api/logo/compile')) {
        try { return await handleCompile(req); }
        catch (err) { return json({ error: `Compilation failed: ${err instanceof Error ? err.message : String(err)}` }, 422); }
      }

      if (req.method === 'POST' && (url.pathname === '/api/upload' || url.pathname === '/api/relay/upload')) {
        try { return await handleUpload(req); }
        catch (err) { return json({ error: String(err) }, 500); }
      }

      // ── Service management ────────────────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/api/services') {
        const results = await Promise.all(
          SERVICE_CATALOG.map(async (svc) => {
            let status: 'running' | 'not_installed' | 'unknown' = 'unknown';
            if (svc.check.healthUrl) {
              const alive = await probeHealth(svc.check.healthUrl, 1, 0);
              status = alive ? 'running' : 'not_installed';
            }
            return { ...svc, status };
          }),
        );
        return json(results);
      }

      if (req.method === 'POST' && url.pathname === '/api/services/execute') {
        try {
          const body = await req.json();
          const { serviceId, action, triggeredBy = 'user' } = body as {
            serviceId: string;
            action: 'check' | 'install' | 'start' | 'stop';
            triggeredBy?: 'user' | 'agent' | 'system';
          };
          const result = await executeServiceAction({ serviceId, action, triggeredBy, baseCwd: PROJECT_ROOT });
          if (result.error && result.durationMs === 0) return json({ error: result.error }, 404);
          if (!result.success && result.error) return json(result, 500);
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 400);
        }
      }

      // ── Logo templates ────────────────────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/api/logo/template') {
        const templates = await readAllTemplates();
        return json({ templates });
      }

      if (req.method === 'POST' && url.pathname === '/api/logo/template') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await req.json() as Record<string, any>;
          await ensureTemplatesDir();

          if (body.action === 'delete' && body.id) {
            try { await unlink(join(TEMPLATES_DIR, `${body.id}.js`)); } catch {}
            return json({ deleted: true, id: body.id });
          }

          const templateId = body.id || randomUUID().slice(0, 8);
          const fp = join(TEMPLATES_DIR, `${templateId}.js`);

          if (body.renderBody) {
            await writeFile(fp, body.renderBody.trim() + '\n', 'utf-8');
          } else if (body.name || body.description) {
            const existing = await readFile(fp, 'utf-8');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const meta = extractMeta(existing) as Record<string, any>;
            if (body.name) meta.name = body.name;
            if (body.description) meta.description = body.description;
            const metaStr = `const meta = ${JSON.stringify(meta, null, 2)};`;
            await writeFile(fp, existing.replace(/const meta\s*=\s*\{[\s\S]*?\};/, metaStr), 'utf-8');
          } else {
            return json({ error: 'renderBody required' }, 400);
          }

          const fstat = await stat(fp);
          const source = await readFile(fp, 'utf-8');
          return json({ template: parseTemplate(templateId, source, fstat.mtimeMs) });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 500);
        }
      }

      return json({ error: 'Not found' }, 404);
    },

    // ── WebSocket handlers (relay protocol) ───────────────────────────
    websocket: {
      open(_ws) {
        // Nothing to do on open — wait for session:init or session:reconnect
      },

      message(ws, raw) {
        const msg = parseMessage(typeof raw === 'string' ? raw : raw.toString());
        if (!msg) return;

        const rws = asRelay(ws);

        switch (msg.type) {
          case 'session:init': {
            if (ws.data.sessionId) {
              const prev = sessions.get(ws.data.sessionId);
              if (prev) detachSession(prev);
            }
            const session = createSession(rws, msg);
            if (!session) break;
            ws.data.sessionId = session.id;
            send(rws, { type: 'session:ready', sessionId: session.id });
            break;
          }

          case 'session:reconnect': {
            const existing = sessions.get(msg.sessionId);
            if (existing && !existing.exited) {
              if (ws.data.sessionId && ws.data.sessionId !== msg.sessionId) {
                const prev = sessions.get(ws.data.sessionId);
                if (prev) detachSession(prev);
              }
              if (existing.ws && existing.ws !== rws) {
                send(existing.ws, { type: 'session:detached' });
              }
              ws.data.sessionId = existing.id;
              attachSession(existing, rws, msg.cols, msg.rows);
              send(rws, { type: 'session:ready', sessionId: existing.id, reconnected: true });
            } else {
              send(rws, { type: 'session:expired', sessionId: msg.sessionId });
            }
            break;
          }

          case 'terminal:input': {
            if (!ws.data.sessionId) return;
            const session = sessions.get(ws.data.sessionId);
            if (session && !session.exited) {
              session.pty.write(msg.data);
            }
            break;
          }

          case 'terminal:resize': {
            if (!ws.data.sessionId) return;
            const session = sessions.get(ws.data.sessionId);
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
      },

      close(ws) {
        if (ws.data.sessionId) {
          const session = sessions.get(ws.data.sessionId);
          if (session) detachSession(session);
          ws.data.sessionId = null;
        }
      },
    },
  });

  // Graceful shutdown — kill all PTY sessions
  const shutdown = () => {
    console.log('\n[Hudson] Shutting down...');
    for (const [id] of sessions) destroy(id);
    server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`[Hudson] Unified server running on http://localhost:${server.port} (root: ${PROJECT_ROOT})`);
  return server;
}
