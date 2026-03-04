import { executeServiceAction, probeHealth } from '../../../../app/services/executor';
import { SERVICE_CATALOG } from '../../../../app/services/catalog';

const PORT = parseInt(process.env.HUDSON_SERVICE_PORT ?? '3601', 10);

// Electrobun apps launch with a minimal macOS PATH (/usr/bin:/bin:/usr/sbin:/sbin).
// Augment PATH so spawned processes (bun, node, claude) can be found.
const HOME = process.env.HOME || '';
const EXTRA_PATHS = [
  `${HOME}/.bun/bin`,       // bun
  `${HOME}/.local/bin`,     // claude, pip-installed tools
  '/opt/homebrew/bin',      // Homebrew (Apple Silicon)
  '/opt/homebrew/sbin',
  '/usr/local/bin',         // Homebrew (Intel) / system tools
  `${HOME}/.nvm/current/bin`, // nvm
  `${HOME}/.cargo/bin`,     // Rust
];
const currentPath = process.env.PATH || '/usr/bin:/bin';
const missing = EXTRA_PATHS.filter((p) => !currentPath.includes(p));
if (missing.length > 0) {
  process.env.PATH = [...missing, currentPath].join(':');
}

// Walk up from cwd to find the project root (contains packages/hudson-sdk).
// In dev mode, cwd is inside the app bundle but still within the project tree.
import { existsSync } from 'fs';
import { dirname, join } from 'path';
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, 'packages', 'hudson-sdk'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd(); // fallback
}
const PROJECT_ROOT = findProjectRoot();

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

export function startServiceServer() {
  const server = Bun.serve({
    port: PORT,
    fetch: async (req) => {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // GET /health
      if (req.method === 'GET' && url.pathname === '/health') {
        return json({ status: 'ok' });
      }

      // GET /api/services — list all with live status
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

      // POST /api/services/execute
      if (req.method === 'POST' && url.pathname === '/api/services/execute') {
        try {
          const body = await req.json();
          const { serviceId, action, triggeredBy = 'user' } = body as {
            serviceId: string;
            action: 'check' | 'install' | 'start' | 'stop';
            triggeredBy?: 'user' | 'agent' | 'system';
          };

          const result = await executeServiceAction({ serviceId, action, triggeredBy, baseCwd: PROJECT_ROOT });

          if (result.error && result.durationMs === 0) {
            return json({ error: result.error }, 404);
          }
          if (!result.success && result.error) {
            return json(result, 500);
          }
          return json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return json({ error: message }, 400);
        }
      }

      return json({ error: 'Not found' }, 404);
    },
  });

  console.log(`[Hudson] Service server running on http://localhost:${server.port} (root: ${PROJECT_ROOT})`);
  return server;
}
