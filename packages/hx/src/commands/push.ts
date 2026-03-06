// ---------------------------------------------------------------------------
// hx push trace <file> — Push a trace to Hudson
// hx push context <file> — Push arbitrary context data
// ---------------------------------------------------------------------------

import { readFile } from 'fs/promises';
import type { ParsedArgs } from '../lib/args';
import { hudsonFetch } from '../lib/http';
import { error, success, dim, cyan, bold } from '../lib/log';

async function readInput(filePath: string | undefined): Promise<string> {
  if (filePath === '-' || !filePath) {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
  return readFile(filePath, 'utf-8');
}

async function pushTrace(args: ParsedArgs) {
  const file = args.positional[0];
  const raw = await readInput(file);
  let trace: Record<string, unknown>;

  try {
    trace = JSON.parse(raw);
  } catch {
    error('Input is not valid JSON.');
    process.exit(1);
  }

  // Allow overrides
  if (args.flags.name) trace.name = args.flags.name;
  if (args.flags.agent) trace.agent = args.flags.agent;

  const res = await hudsonFetch('/api/traces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trace }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    error(data.error ?? `Hudson returned ${res.status}`);
    process.exit(1);
  }

  const data = await res.json() as { trace?: { id: string } };
  success(`Pushed trace ${cyan(data.trace?.id ?? 'unknown')}`);
}

async function pushContext(args: ParsedArgs) {
  const file = args.positional[0];
  const raw = await readInput(file);

  const body: Record<string, unknown> = {
    content: raw,
  };
  if (args.flags.label) body.label = args.flags.label;

  const res = await hudsonFetch('/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    error(data.error ?? `Hudson returned ${res.status}`);
    process.exit(1);
  }

  const data = await res.json() as { item?: { id: string } };
  success(`Pushed context ${cyan(data.item?.id ?? 'unknown')}`);
}

export async function push(args: ParsedArgs) {
  const kind = args.subcommand;

  if (kind === 'trace') {
    try {
      await pushTrace(args);
    } catch (err) {
      error(`Could not reach Hudson. (${err instanceof Error ? err.message : err})`);
      process.exit(1);
    }
    return;
  }

  if (kind === 'context') {
    try {
      await pushContext(args);
    } catch (err) {
      error(`Could not reach Hudson. (${err instanceof Error ? err.message : err})`);
      process.exit(1);
    }
    return;
  }

  error(`Usage: hx push ${bold('trace')}|${bold('context')} <file> [--name "..."] [--agent "..."]`);
  console.log(`  ${dim('Use - to read from stdin')}`);
  process.exit(1);
}
