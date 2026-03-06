// ---------------------------------------------------------------------------
// hx down — Stop the daemon
// ---------------------------------------------------------------------------

import { readFile, unlink } from 'fs/promises';
import { PID_PATH } from '../lib/config';
import { error, success, warn } from '../lib/log';

export async function down() {
  let pid: number;
  try {
    pid = parseInt(await readFile(PID_PATH, 'utf-8'), 10);
  } catch {
    warn('No PID file found — daemon may not be running.');
    return;
  }

  if (isNaN(pid)) {
    warn('Invalid PID file.');
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    success(`Daemon stopped (pid ${pid}).`);
  } catch {
    warn(`Process ${pid} not found — cleaning up stale PID file.`);
  }

  try {
    await unlink(PID_PATH);
  } catch {
    // Already gone
  }
}
