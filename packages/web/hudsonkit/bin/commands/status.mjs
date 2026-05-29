// hudsonkit status — list Hudson-related processes on this host.
//
// Exit codes:
//   0  always (status is informational)
//   2  invalid arguments

import process from 'node:process';
import { discoverHudsonProcesses } from '../lib/discover.mjs';

const USAGE = `hudsonkit status — list Hudson-related processes

USAGE
  hudsonkit status [--json] [--no-color]

OPTIONS
  --json       Print results as JSON
  --no-color   Disable ANSI colors
  --help       Show this help

DETECTION
  Processes are matched by, in order of confidence:
    1. HUDSONKIT_RUN_ID / HUDSONKIT_ROLE / HUDSONKIT_ROOT env vars
    2. Run registry at ~/Library/Application Support/HudsonKit/runs/*.json
    3. Command-line heuristics: \`next dev\` in a hudson checkout,
       \`tsup --watch\` against hudsonkit, vitest watch, embed-worker wrangler.
`;

function parseArgs(argv) {
  const args = { json: false, color: process.stdout.isTTY };
  for (const a of argv) {
    if (a === '--help' || a === '-h') return { ...args, help: true };
    if (a === '--json') args.json = true;
    else if (a === '--no-color') args.color = false;
    else return { ...args, _err: `unknown argument: ${a}` };
  }
  return args;
}

function paint(color, text, enabled) {
  if (!enabled) return text;
  const codes = { red: 31, yellow: 33, blue: 34, green: 32, dim: 2, bold: 1, cyan: 36 };
  return `\x1b[${codes[color]}m${text}\x1b[0m`;
}

function renderText(procs, color) {
  if (procs.length === 0) {
    return paint('green', '✓ no Hudson processes detected.', color) + '\n';
  }
  const lines = [paint('bold', `${procs.length} Hudson-related process${procs.length === 1 ? '' : 'es'}`, color), ''];
  const w = {
    pid: Math.max(3, ...procs.map(p => String(p.pid).length)),
    role: Math.max(4, ...procs.map(p => (p.role ?? '?').length)),
    etime: Math.max(5, ...procs.map(p => (p.etime ?? '').length)),
  };
  lines.push(
    paint('dim',
      `${'PID'.padEnd(w.pid)}  ${'ROLE'.padEnd(w.role)}  ${'TIME'.padEnd(w.etime)}  CONF  COMMAND`,
      color),
  );
  for (const p of procs) {
    const confColor = p.confidence === 'high' ? 'green' : p.confidence === 'medium' ? 'yellow' : 'dim';
    const cmd = (p.command ?? '').slice(0, 140);
    lines.push(
      `${String(p.pid).padEnd(w.pid)}  ${paint('cyan', (p.role ?? '?').padEnd(w.role), color)}  ${(p.etime ?? '').padEnd(w.etime)}  ${paint(confColor, (p.confidence ?? '').padEnd(4), color)}  ${paint('dim', cmd, color)}`,
    );
    if (p.runId) lines.push(`  ${paint('dim', `run=${p.runId}${p.root ? `  root=${p.root}` : ''}`, color)}`);
  }
  return lines.join('\n') + '\n';
}

export async function run(argv) {
  const args = parseArgs(argv);
  if (args.help) { process.stdout.write(USAGE); return; }
  if (args._err) { process.stderr.write(`status: ${args._err}\n\n${USAGE}`); process.exit(2); }

  const procs = discoverHudsonProcesses();

  if (args.json) {
    process.stdout.write(JSON.stringify({ count: procs.length, processes: procs }, null, 2) + '\n');
  } else {
    process.stdout.write(renderText(procs, args.color));
  }
}
