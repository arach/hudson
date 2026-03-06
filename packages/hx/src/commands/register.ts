// ---------------------------------------------------------------------------
// hx register <id> --port <n> — Register a local service
// ---------------------------------------------------------------------------

import type { ParsedArgs } from '../lib/args';
import { daemonFetch } from '../lib/http';
import { error, success, dim, cyan } from '../lib/log';

export async function register(args: ParsedArgs) {
  const id = args.subcommand;
  if (!id) {
    error('Usage: hx register <id> --port <n> [--name "..."] [--type agent|app|api|custom] [--endpoints /a,/b]');
    process.exit(1);
  }

  const port = args.flags.port ? parseInt(args.flags.port as string, 10) : 0;
  if (!port) {
    error('--port is required');
    process.exit(1);
  }

  const body = {
    id,
    port,
    name: (args.flags.name as string) ?? id,
    type: (args.flags.type as string) ?? 'custom',
    host: (args.flags.host as string) ?? 'localhost',
    endpoints: args.flags.endpoints
      ? (args.flags.endpoints as string).split(',').map(s => s.trim())
      : undefined,
  };

  try {
    const res = await daemonFetch('/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      error(data.error ?? `HTTP ${res.status}`);
      process.exit(1);
    }
    const data = await res.json() as { service: { id: string; port: number } };
    success(`Registered ${cyan(data.service.id)} ${dim(`→ localhost:${data.service.port}`)}`);
  } catch (err) {
    error(`Could not reach daemon. Is it running? (${err instanceof Error ? err.message : err})`);
    process.exit(1);
  }
}
