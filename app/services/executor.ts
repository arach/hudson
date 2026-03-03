import { SERVICE_CATALOG } from './catalog';

// In-memory PID tracking (survives within a single process lifecycle)
const pidMap = new Map<string, number>();

const isBun = typeof Bun !== 'undefined';

export interface ServiceActionResult {
  serviceId: string;
  action: string;
  triggeredBy: string;
  success: boolean;
  status: string;
  pid?: number;
  command?: string;
  output?: string;
  exitCode?: number | null;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Cross-runtime spawn helpers (Bun.spawn in Electrobun, child_process in Node)
// ---------------------------------------------------------------------------

function shellExecSync(command: string, opts: { cwd?: string; timeout?: number }): string {
  if (isBun) {
    const result = Bun.spawnSync(command.split(' '), {
      cwd: opts.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString();
      throw new Error(stderr || `Command failed with exit code ${result.exitCode}`);
    }
    return result.stdout.toString();
  }
  // Node.js fallback
  const { execSync } = require('child_process');
  return execSync(command, { cwd: opts.cwd, encoding: 'utf-8', timeout: opts.timeout });
}

function spawnDetached(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string | undefined> },
): { pid: number; stdout: ReadableStream | null; stderr: ReadableStream | null; nodeProc?: import('child_process').ChildProcess } {
  if (isBun) {
    const proc = Bun.spawn([cmd, ...args], {
      cwd: opts.cwd,
      env: opts.env as Record<string, string>,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    // Allow parent process to exit without waiting for this child
    proc.unref();
    return {
      pid: proc.pid,
      stdout: proc.stdout as ReadableStream | null,
      stderr: proc.stderr as ReadableStream | null,
    };
  }
  // Node.js fallback
  const { spawn } = require('child_process');
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: opts.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.unref();
  return {
    pid: child.pid!,
    stdout: null,
    stderr: null,
    nodeProc: child,
  };
}

export async function probeHealth(
  url: string,
  retries = 3,
  delayMs = 1000,
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {}
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export function findProcessByPort(port: number): number | null {
  try {
    const out = shellExecSync(`lsof -ti :${port}`, {}).trim();
    const pid = parseInt(out.split('\n')[0], 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function killProcess(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

export async function executeServiceAction(params: {
  serviceId: string;
  action: 'check' | 'install' | 'start' | 'stop';
  triggeredBy?: 'user' | 'agent' | 'system';
  /** Override for process.cwd() — needed in Electrobun where cwd is the app bundle. */
  baseCwd?: string;
}): Promise<ServiceActionResult> {
  const { serviceId, action, triggeredBy = 'user', baseCwd = process.cwd() } = params;

  const svc = SERVICE_CATALOG.find((s) => s.id === serviceId);
  if (!svc) {
    return {
      serviceId,
      action,
      triggeredBy,
      success: false,
      status: 'error',
      error: `Unknown service: ${serviceId}`,
      durationMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    // ── Check ──────────────────────────────────────────────────────────
    if (action === 'check') {
      const alive = svc.check.healthUrl
        ? await probeHealth(svc.check.healthUrl, 1, 0)
        : false;
      return {
        serviceId,
        action,
        triggeredBy,
        success: true,
        status: alive ? 'running' : 'not_installed',
        durationMs: Date.now() - startTime,
      };
    }

    // ── Install ────────────────────────────────────────────────────────
    if (action === 'install') {
      const cwd = svc.install.cwd
        ? `${baseCwd}/${svc.install.cwd}`
        : baseCwd;
      const output = shellExecSync(svc.install.command, {
        cwd,
        timeout: 60_000,
      });
      return {
        serviceId,
        action,
        triggeredBy,
        success: true,
        status: 'installed',
        command: svc.install.command,
        output,
        exitCode: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // ── Start ──────────────────────────────────────────────────────────
    if (action === 'start') {
      // Already running?
      if (svc.check.healthUrl) {
        const alive = await probeHealth(svc.check.healthUrl, 1, 0);
        if (alive) {
          const pid =
            pidMap.get(serviceId) ??
            (svc.check.port ? findProcessByPort(svc.check.port) : null);
          return {
            serviceId,
            action,
            triggeredBy,
            success: true,
            status: 'running',
            pid: pid ?? undefined,
            output: 'Service already running',
            durationMs: Date.now() - startTime,
          };
        }
      }

      const [cmd, ...args] = svc.start.command.split(' ');
      const cwd = svc.start.cwd
        ? `${baseCwd}/${svc.start.cwd}`
        : baseCwd;
      const spawned = spawnDetached(cmd, args, {
        cwd,
        env: { ...process.env, ...svc.start.env },
      });

      const pid = spawned.pid;
      pidMap.set(serviceId, pid);

      // Collect early output
      let output = '';
      if (spawned.nodeProc) {
        // Node.js: use event-based streams
        spawned.nodeProc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
        spawned.nodeProc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
      }

      // Wait for health
      await new Promise((r) => setTimeout(r, 2000));
      const alive = svc.check.healthUrl
        ? await probeHealth(svc.check.healthUrl)
        : true;

      return {
        serviceId,
        action,
        triggeredBy,
        success: alive,
        status: alive ? 'running' : 'error',
        pid,
        command: svc.start.command,
        output:
          output ||
          (alive ? 'Started successfully' : 'Health check failed after start'),
        durationMs: Date.now() - startTime,
      };
    }

    // ── Stop ───────────────────────────────────────────────────────────
    if (action === 'stop') {
      let killed = false;
      let output = '';
      let pid: number | undefined;

      // Try tracked PID first
      const trackedPid = pidMap.get(serviceId);
      if (trackedPid) {
        killed = killProcess(trackedPid);
        if (killed) {
          pid = trackedPid;
          output = `Sent SIGTERM to PID ${trackedPid}`;
        }
        pidMap.delete(serviceId);
      }

      // Fallback: find by port
      if (!killed && svc.check.port) {
        const portPid = findProcessByPort(svc.check.port);
        if (portPid) {
          killed = killProcess(portPid);
          pid = portPid;
          output = `Sent SIGTERM to PID ${portPid} (found by port ${svc.check.port})`;
        }
      }

      if (!killed) {
        output = 'No running process found';
      }

      return {
        serviceId,
        action,
        triggeredBy,
        success: killed,
        status: killed ? 'installed' : 'not_installed',
        pid,
        output,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      serviceId,
      action,
      triggeredBy,
      success: false,
      status: 'error',
      error: `Unknown action: ${action}`,
      durationMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      serviceId,
      action,
      triggeredBy,
      success: false,
      status: 'error',
      error: message,
      durationMs: Date.now() - startTime,
    };
  }
}
