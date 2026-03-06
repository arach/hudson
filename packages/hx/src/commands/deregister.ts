// ---------------------------------------------------------------------------
// hx deregister <id> — Remove a service
// ---------------------------------------------------------------------------

import type { ParsedArgs } from '../lib/args';
import { daemonFetch } from '../lib/http';
import { error, success, cyan } from '../lib/log';

export async function deregister(args: ParsedArgs) {
  const id = args.subcommand;
  if (!id) {
    error('Usage: hx deregister <id>');
    process.exit(1);
  }

  try {
    const res = await daemonFetch(`/services/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      error(data.error ?? `HTTP ${res.status}`);
      process.exit(1);
    }
    success(`Deregistered ${cyan(id)}`);
  } catch (err) {
    error(`Could not reach daemon. Is it running? (${err instanceof Error ? err.message : err})`);
    process.exit(1);
  }
}
