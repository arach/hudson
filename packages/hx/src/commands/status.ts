// ---------------------------------------------------------------------------
// hx status — Daemon health + service summary
// ---------------------------------------------------------------------------

import { readFile } from 'fs/promises';
import { PID_PATH } from '../lib/config';
import { daemonFetch } from '../lib/http';
import { bold, cyan, dim, error, green, red, gray } from '../lib/log';

export async function status() {
  // Check PID file
  let pid: number | null = null;
  try {
    pid = parseInt(await readFile(PID_PATH, 'utf-8'), 10);
    if (isNaN(pid)) pid = null;
  } catch {
    // No PID file
  }

  console.log();
  console.log(`  ${bold('hx')} ${dim('— service registry')}`);
  console.log();

  try {
    const res = await daemonFetch('/health');
    const data = await res.json() as {
      status: string;
      uptime: number;
      services: number;
      timestamp: number;
    };

    const uptimeSecs = Math.floor(data.uptime / 1000);
    const uptimeStr = uptimeSecs < 60
      ? `${uptimeSecs}s`
      : uptimeSecs < 3600
        ? `${Math.floor(uptimeSecs / 60)}m ${uptimeSecs % 60}s`
        : `${Math.floor(uptimeSecs / 3600)}h ${Math.floor((uptimeSecs % 3600) / 60)}m`;

    console.log(`  ${dim('Status:')}   ${green('running')}`);
    console.log(`  ${dim('PID:')}      ${pid ?? gray('unknown')}`);
    console.log(`  ${dim('Uptime:')}   ${uptimeStr}`);
    console.log(`  ${dim('Services:')} ${data.services}`);
  } catch {
    console.log(`  ${dim('Status:')}   ${red('not running')}`);
    if (pid) {
      console.log(`  ${dim('PID:')}      ${gray(`${pid} (stale)`)}`);
    }
  }
  console.log();
}
