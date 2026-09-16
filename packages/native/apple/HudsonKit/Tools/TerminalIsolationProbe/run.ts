import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

if (process.platform !== 'darwin') throw new Error('This probe requires macOS');
const terminal = process.argv.includes('--terminal');
const engine = process.env.HUDSON_GHOSTTY_XCFRAMEWORK;
if (terminal && !engine) throw new Error('--terminal requires HUDSON_GHOSTTY_XCFRAMEWORK');
const output = resolve(process.env.HUDSON_TERMINAL_PROBE_OUTPUT ?? join(import.meta.dir, 'results'));
await mkdir(output, { recursive: true });
await rm(join(output, 'result.json'), { force: true });
const cache = join(homedir(), 'Library/Caches/codex-builds');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'hudson-terminal-ipc-'));
const app = join(scratch, 'HudsonTerminalIsolationProbe.app');
const service = join(app, 'Contents/XPCServices/Worker.xpc');
const clientBinary = join(app, 'Contents/MacOS/HudsonTerminalIsolationProbe');
const workerBinary = join(service, 'Contents/MacOS/Worker');
const logs: unknown[] = [];
let workerPID: number | undefined;
let workerExited = false;
let preserveScratch = false;
const env = { ...process.env, HUDSON_TERMINAL_PROBE_OUTPUT: output, DEVELOPER_DIR: '/Library/Developer/CommandLineTools' };
async function run(command: string[], timeoutMs = 30_000) {
  const child = Bun.spawn(command, { env, stdout: 'pipe', stderr: 'pipe' });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  clearTimeout(timer);
  logs.push({ command, exitCode, timedOut, stdout, stderr });
  await Bun.write(join(output, 'execution.json'), JSON.stringify(logs, null, 2));
  if (exitCode !== 0 || timedOut) throw new Error(`${command[0]} failed (${exitCode}): ${stderr}`);
  return stdout;
}
function plist(identifier: string, executable: string, type: string, extra = '') {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${identifier}</string><key>CFBundleExecutable</key><string>${executable}</string><key>CFBundlePackageType</key><string>${type}</string><key>CFBundleVersion</key><string>1</string>${extra}</dict></plist>`;
}
try {
  await mkdir(join(app, 'Contents/MacOS'), { recursive: true });
  await mkdir(join(service, 'Contents/MacOS'), { recursive: true });
  await Bun.write(join(app, 'Contents/Info.plist'), plist('dev.hudson.TerminalIsolationProbe', 'HudsonTerminalIsolationProbe', 'APPL', '<key>LSUIElement</key><true/>'));
  await Bun.write(join(service, 'Contents/Info.plist'), plist('dev.hudson.TerminalIsolationProbe.Worker', 'Worker', 'XPC!', '<key>XPCService</key><dict><key>ServiceType</key><string>Application</string><key>RunLoopType</key><string>NSRunLoop</string></dict>'));
  const swift = '/Library/Developer/CommandLineTools/usr/bin/swiftc';
  const shared = ['-parse-as-library', '-sdk', '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos14.0`, '-framework', 'IOSurface', '-framework', 'Metal', join(import.meta.dir, 'Protocol.swift'), join(import.meta.dir, 'GPU.swift')];
  const engineDir = engine ? join(engine, process.arch === 'arm64' ? 'macos-arm64' : 'macos-x86_64') : '';
  const workerArgs = terminal ? [join(import.meta.dir, 'GhosttyWorker.swift'), '-I', join(engineDir, 'Headers'),
    join(engineDir, 'libghostty-internal-fat.a'), '-lc++', '-framework', 'AppKit', '-framework', 'Carbon', '-framework', 'CoreText',
    '-framework', 'CoreGraphics', '-framework', 'QuartzCore', '-framework', 'IOKit', '-framework', 'CoreVideo']
    : [join(import.meta.dir, 'Worker.swift')];
  await run([swift, ...shared, ...workerArgs, '-o', workerBinary], 60_000);
  await run([swift, ...shared, join(import.meta.dir, terminal ? 'TerminalClient.swift' : 'Client.swift'), join(import.meta.dir, 'Checks.swift'), join(import.meta.dir, 'Presenter.swift'), '-framework', 'AppKit', '-framework', 'QuartzCore', '-o', clientBinary]);
  await run(['/usr/bin/codesign', '--force', '--sign', '-', service]);
  await run(['/usr/bin/codesign', '--force', '--sign', '-', app]);
  const result = await run([clientBinary, ...(process.argv.includes('--window') ? ['--window'] : [])], terminal ? 30_000 : 20_000);
  const parsed = JSON.parse(result);
  workerPID = parsed.workerPID;
  if (parsed.status !== 'PASS') throw new Error('Probe did not pass');
  // Observe only our returned worker PID; never kill a name-matched process.
  const exitDeadline = Date.now() + 3_000;
  while (Date.now() < exitDeadline) {
    const child = Bun.spawn(['/bin/ps', '-p', String(workerPID), '-o', 'comm='], { stdout: 'pipe', stderr: 'pipe' });
    const [code, command] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    if (code !== 0 || command.trim() !== workerBinary) { workerExited = true; break; }
    await Bun.sleep(25);
  }
  if (!workerExited) {
    preserveScratch = true;
    throw new Error(`Owned helper ${workerPID} did not exit; preserving ${scratch} for diagnosis`);
  }
  await Bun.write(join(output, 'result.json'), JSON.stringify(parsed, null, 2));
  console.log(result);
} finally {
  if (!preserveScratch) await rm(scratch, { recursive: true, force: true });
  await Bun.write(join(output, 'cleanup.json'), JSON.stringify({ removed: preserveScratch ? null : scratch, preserved: preserveScratch ? scratch : null, workerPID, workerExited, evidence: output }, null, 2));
}
