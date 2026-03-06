// ---------------------------------------------------------------------------
// hx up — Start the daemon
// ---------------------------------------------------------------------------

import { writeFile, readFile } from 'fs/promises';
import type { ParsedArgs } from '../lib/args';
import { readConfig, ensureDir, PID_PATH } from '../lib/config';
import { bold, cyan, error, success, dim } from '../lib/log';

export async function up(args: ParsedArgs) {
  await ensureDir();

  // Check for existing daemon
  try {
    const pid = parseInt(await readFile(PID_PATH, 'utf-8'), 10);
    if (pid && !isNaN(pid)) {
      try {
        process.kill(pid, 0); // Check if alive
        error(`Daemon already running (pid ${pid}). Use ${bold('hx down')} first.`);
        process.exit(1);
      } catch {
        // Stale PID file — continue
      }
    }
  } catch {
    // No PID file — continue
  }

  const config = await readConfig();
  const port = args.flags.port ? parseInt(args.flags.port as string, 10) : config.port;

  // Dynamic import to avoid loading Bun.serve in CLI-only paths
  const { startDaemon } = await import('../daemon');
  await startDaemon(port);

  // Write PID file
  await writeFile(PID_PATH, String(process.pid), 'utf-8');

  console.log();
  success(`Daemon started ${dim(`(pid ${process.pid})`)}`);
  console.log(`  ${dim('Registry:')} ${cyan(`http://localhost:${port}/services`)}`);
  console.log(`  ${dim('Health:')}   ${cyan(`http://localhost:${port}/health`)}`);
  console.log();
}
