import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Build the helper as part of its host's ordinary packaging pipeline. It is not
// an independently launched app. The engine is statically linked only here.
export async function buildTerminalWorker(output: string, hostIdentifier: string, hostTeam: string) {
  const engine = process.env.HUDSON_GHOSTTY_XCFRAMEWORK;
  const provenance = process.env.HUDSON_GHOSTTY_BUILD_PROVENANCE;
  if (!engine || !provenance) throw new Error('Terminal helper requires HUDSON_GHOSTTY_XCFRAMEWORK and HUDSON_GHOSTTY_BUILD_PROVENANCE');
  if (!/^[a-zA-Z0-9.-]+$/.test(hostIdentifier) || !/^[A-Z0-9]{10}$/.test(hostTeam)) throw new Error('Invalid signed host identity');
  const engineDirectory = join(engine, process.arch === 'arm64' ? 'macos-arm64' : 'macos-x86_64');
  const library = join(engineDirectory, 'libghostty-internal-fat.a');
  const evidence = await Bun.file(provenance).json();
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(library)) hash.update(chunk);
  if (evidence.status !== 'PASS' || evidence.librarySHA256 !== hash.digest('hex')) throw new Error('Engine provenance does not match linked archive');
  await mkdir(output, { recursive: true });
  const shared = resolve(import.meta.dir, '../../Sources/HudsonTerminal/IPC/HudTerminalIPCProtocol.swift');
  const worker = join(import.meta.dir, 'Worker.swift');
  const swiftc = execFileSync('xcrun', ['--find', 'swiftc'], { encoding: 'utf8' }).trim();
  const sdk = process.env.HUDSON_MACOS_SDK ?? execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { encoding: 'utf8' }).trim();
  const command = [swiftc, '-O', '-whole-module-optimization', '-parse-as-library',
    '-sdk', sdk, '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos26.0`,
    shared, worker, '-I', join(engineDirectory, 'Headers'), library, '-lc++',
    ...['AppKit', 'IOSurface', 'Metal', 'Carbon', 'CoreText', 'CoreGraphics', 'QuartzCore', 'IOKit', 'CoreVideo'].flatMap(name => ['-framework', name]),
    '-o', join(output, 'HudsonTerminalWorker')];
  const child = Bun.spawn(command, { stdout: 'inherit', stderr: 'inherit' });
  const status = await child.exited;
  if (status !== 0) throw new Error(`Terminal worker compiler exited ${status}`);
  const requirement = `anchor apple generic and certificate leaf[subject.OU] = "${hostTeam}" and identifier "${hostIdentifier}"`;
  const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  await writeFile(join(output, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>app.hudson.TerminalWorker</string><key>CFBundleExecutable</key><string>HudsonTerminalWorker</string>
<key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>26.0</string><key>HudsonHostRequirement</key><string>${xml(requirement)}</string>
<key>XPCService</key><dict><key>ServiceType</key><string>Application</string><key>RunLoopType</key><string>NSRunLoop</string></dict>
</dict></plist>`);
  await writeFile(join(output, 'engine-build.json'), JSON.stringify({ ...evidence, hostIdentifier, hostTeam, configuration: 'release', command }, null, 2));
}
if (import.meta.main) {
  const [output, identifier, team] = process.argv.slice(2);
  if (!output || !identifier || !team) throw new Error('Usage: build.ts OUTPUT_DIRECTORY HOST_IDENTIFIER HOST_TEAM');
  await buildTerminalWorker(resolve(output), identifier, team);
}
