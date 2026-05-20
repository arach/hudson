// hudsonkit panic — terminate detected Hudson-related processes.
//
// DEFAULTS TO DRY-RUN. You must pass --yes to actually signal processes.
// SIGTERM first, then SIGKILL after a configurable grace period.
//
// Exit codes:
//   0  no targets / dry-run completed / all targets terminated
//   1  one or more targets refused to die after SIGKILL
//   2  invalid arguments

import process from 'node:process';
import { discoverHudsonProcesses } from '../lib/discover.mjs';

const USAGE = `hudsonkit panic — terminate Hudson-related processes

USAGE
  hudsonkit panic [--yes] [--grace <ms>] [--signal <name>]
                  [--filter <role>] [--include-self] [--json] [--no-color]

OPTIONS
  --yes              Actually send signals. WITHOUT --yes this is a dry-run that
                     only prints what would happen.
  --grace <ms>       Milliseconds to wait between SIGTERM and SIGKILL (default 3000).
  --signal <name>    Initial signal (default SIGTERM). Use SIGKILL to skip the
                     graceful phase.
  --filter <role>    Only target processes with this role (e.g. next-dev,
                     tsup-watch). May be passed multiple times.
  --include-self     Include the panic process itself (default: excluded).
  --json             Print results as JSON
  --no-color         Disable ANSI colors
  --help             Show this help

SAFETY
  Detection uses the same logic as \`hudsonkit status\`. If you don't trust the
  match set, run \`hudsonkit status\` first; panic without --yes only prints.
`;

function parseArgs(argv) {
  const args = {
    yes: false, grace: 3000, signal: 'SIGTERM',
    filters: [], includeSelf: false,
    json: false, color: process.stdout.isTTY,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { ...args, help: true };
    else if (a === '--yes') args.yes = true;
    else if (a === '--grace') args.grace = Number(argv[++i] ?? '3000');
    else if (a.startsWith('--grace=')) args.grace = Number(a.slice('--grace='.length));
    else if (a === '--signal') args.signal = String(argv[++i] ?? 'SIGTERM');
    else if (a.startsWith('--signal=')) args.signal = a.slice('--signal='.length);
    else if (a === '--filter') args.filters.push(String(argv[++i] ?? ''));
    else if (a.startsWith('--filter=')) args.filters.push(a.slice('--filter='.length));
    else if (a === '--include-self') args.includeSelf = true;
    else if (a === '--json') args.json = true;
    else if (a === '--no-color') args.color = false;
    else return { ...args, _err: `unknown argument: ${a}` };
  }
  if (!Number.isFinite(args.grace) || args.grace < 0) return { ...args, _err: '--grace must be a non-negative number' };
  if (!/^SIG[A-Z]+$/.test(args.signal)) return { ...args, _err: '--signal must be a POSIX name like SIGTERM' };
  return args;
}

function paint(color, text, enabled) {
  if (!enabled) return text;
  const codes = { red: 31, yellow: 33, blue: 34, green: 32, dim: 2, bold: 1, cyan: 36 };
  return `\x1b[${codes[color]}m${text}\x1b[0m`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function killOne(p, args, results) {
  const r = { pid: p.pid, role: p.role, attempts: [], outcome: 'pending' };
  try {
    process.kill(p.pid, args.signal);
    r.attempts.push({ signal: args.signal, ok: true });
  } catch (err) {
    r.attempts.push({ signal: args.signal, ok: false, error: err?.code ?? String(err) });
    r.outcome = err?.code === 'ESRCH' ? 'already-dead' : 'signal-failed';
    results.push(r);
    return;
  }
  if (args.signal === 'SIGKILL') {
    await sleep(50);
    r.outcome = pidAlive(p.pid) ? 'still-alive' : 'terminated';
    results.push(r);
    return;
  }
  // SIGTERM path: wait for grace, escalate to SIGKILL
  const deadline = Date.now() + args.grace;
  while (Date.now() < deadline) {
    if (!pidAlive(p.pid)) {
      r.outcome = 'terminated';
      results.push(r);
      return;
    }
    await sleep(100);
  }
  // Escalate
  try {
    process.kill(p.pid, 'SIGKILL');
    r.attempts.push({ signal: 'SIGKILL', ok: true });
  } catch (err) {
    r.attempts.push({ signal: 'SIGKILL', ok: false, error: err?.code ?? String(err) });
  }
  await sleep(100);
  r.outcome = pidAlive(p.pid) ? 'still-alive' : 'terminated';
  results.push(r);
}

export async function run(argv) {
  const args = parseArgs(argv);
  if (args.help) { process.stdout.write(USAGE); return; }
  if (args._err) { process.stderr.write(`panic: ${args._err}\n\n${USAGE}`); process.exit(2); }

  let procs = discoverHudsonProcesses({ includeSelf: args.includeSelf });
  if (args.filters.length > 0) {
    procs = procs.filter(p => args.filters.includes(p.role));
  }

  if (procs.length === 0) {
    const msg = paint('green', '✓ no Hudson processes detected — nothing to do.', args.color);
    if (args.json) process.stdout.write(JSON.stringify({ dryRun: !args.yes, targets: [], results: [] }, null, 2) + '\n');
    else process.stdout.write(msg + '\n');
    return;
  }

  // Print plan
  if (!args.json) {
    const heading = args.yes
      ? paint('red', `! Will signal ${procs.length} process${procs.length === 1 ? '' : 'es'} with ${args.signal} (grace ${args.grace}ms → SIGKILL)`, args.color)
      : paint('yellow', `[dry-run] Would signal ${procs.length} process${procs.length === 1 ? '' : 'es'} with ${args.signal}. Re-run with --yes to act.`, args.color);
    process.stdout.write(heading + '\n');
    for (const p of procs) {
      process.stdout.write(`  pid ${p.pid}  role=${p.role ?? '?'}  ${paint('dim', (p.command ?? '').slice(0, 100), args.color)}\n`);
    }
  }

  if (!args.yes) {
    if (args.json) process.stdout.write(JSON.stringify({ dryRun: true, targets: procs, results: [] }, null, 2) + '\n');
    return;
  }

  const results = [];
  await Promise.all(procs.map(p => killOne(p, args, results)));

  if (args.json) {
    process.stdout.write(JSON.stringify({ dryRun: false, targets: procs, results }, null, 2) + '\n');
  } else {
    for (const r of results) {
      const colorByOutcome = {
        terminated: 'green', 'already-dead': 'dim',
        'still-alive': 'red', 'signal-failed': 'red',
      };
      const c = colorByOutcome[r.outcome] ?? 'yellow';
      process.stdout.write(`  pid ${r.pid}  ${paint(c, r.outcome, args.color)}  ${r.attempts.map(a => `${a.signal}${a.ok ? '' : `(${a.error})`}`).join(' → ')}\n`);
    }
  }

  const stuck = results.filter(r => r.outcome === 'still-alive' || r.outcome === 'signal-failed').length;
  if (stuck > 0) process.exit(1);
}
