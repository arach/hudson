// hudsonkit preflight — scan a consumer project for known-dangerous configs
// that have, in the past, produced runaway watcher loops.
//
// Exit codes:
//   0  no findings, OR findings present without --fail-on-risk
//   1  --fail-on-risk passed AND at least one HIGH finding
//   2  invalid arguments / unreadable project

import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, isAbsolute, dirname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import process from 'node:process';

const USAGE = `hudsonkit preflight — scan for known-dangerous consumer config

USAGE
  hudsonkit preflight [--cwd <path>] [--fail-on-risk] [--json] [--no-color]

OPTIONS
  --cwd <path>      Project to scan (default: process.cwd())
  --fail-on-risk    Exit non-zero (1) if any HIGH-severity finding is reported
  --json            Print results as JSON instead of text
  --no-color        Disable ANSI colors
  --help            Show this help

CHECKS
  1. \`file:\` dep pointing at a hudsonkit source folder (HIGH)
  2. \`transpilePackages\` in next.config includes hudsonkit (HIGH)
  3. \`turbopack.root\` resolves above the project root (HIGH)
  4. Tailwind content / @source paths scan hudsonkit src or dist (HIGH)
  5. Resolved hudsonkit is missing dist/styles.css (HIGH)
  6. A Hudson dev server (\`next dev\` in a hudson checkout) is already running (MEDIUM)
`;

const SEVERITY = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

function parseArgs(argv) {
  const args = { cwd: process.cwd(), failOnRisk: false, json: false, color: process.stdout.isTTY };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--fail-on-risk') { args.failOnRisk = true; continue; }
    if (a === '--json') { args.json = true; continue; }
    if (a === '--no-color') { args.color = false; continue; }
    if (a === '--cwd') { args.cwd = resolve(argv[++i] ?? ''); continue; }
    if (a.startsWith('--cwd=')) { args.cwd = resolve(a.slice('--cwd='.length)); continue; }
    args._err = `unknown argument: ${a}`;
  }
  return args;
}

function paint(color, text, enabled) {
  if (!enabled) return text;
  const codes = { red: 31, yellow: 33, blue: 34, green: 32, dim: 2, bold: 1 };
  return `[${codes[color]}m${text}[0m`;
}

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function readTextSafe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function isHudsonkitConsumer(ctx) {
  if (existsSync(join(ctx.cwd, 'node_modules', 'hudsonkit'))) return true;
  const pkg = ctx.pkg;
  if (!pkg) return false;
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (pkg[field]?.hudsonkit) return true;
  }
  // Workspace member of a hudsonkit-hosting monorepo (Hudson itself)
  if (Array.isArray(pkg.workspaces)) {
    for (const ws of pkg.workspaces) {
      if (typeof ws === 'string' && ws.includes('hudsonkit')) return true;
      if (typeof ws === 'string' && existsSync(join(ctx.cwd, ws, 'package.json'))) {
        const wsPkg = readJSON(join(ctx.cwd, ws, 'package.json'));
        if (wsPkg?.name === 'hudsonkit') return true;
      }
    }
  }
  return false;
}

function isParentOf(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// ---------------------------------------------------------------------------
// Check 1 — file: dep to hudsonkit source folder
// ---------------------------------------------------------------------------
function checkFileDep(ctx, findings) {
  const pkg = ctx.pkg;
  if (!pkg) return;
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const block = pkg[field];
    if (!block) continue;
    for (const [name, spec] of Object.entries(block)) {
      if (name !== 'hudsonkit') continue;
      if (typeof spec !== 'string') continue;
      if (!spec.startsWith('file:') && !spec.startsWith('link:')) continue;
      const target = spec.replace(/^(file:|link:)/, '');
      // Tarballs are fine — only folder deps are dangerous
      if (target.endsWith('.tgz') || target.endsWith('.tar.gz')) continue;
      const resolved = resolve(ctx.cwd, target);
      let realPath;
      try { realPath = realpathSync(resolved); } catch { realPath = resolved; }
      const hasSrc = existsSync(join(realPath, 'src'));
      const hasTsupConfig = existsSync(join(realPath, 'tsup.config.ts'))
        || existsSync(join(realPath, 'tsup.config.js'))
        || existsSync(join(realPath, 'tsup.config.mjs'));
      if (hasSrc || hasTsupConfig) {
        findings.push({
          id: 'file-dep-to-source',
          severity: SEVERITY.HIGH,
          title: `${field}.hudsonkit points at a live source folder (${spec})`,
          detail:
            `Resolved to ${realPath}. The folder contains ${hasSrc ? 'src/' : ''}${hasSrc && hasTsupConfig ? ' and ' : ''}${hasTsupConfig ? 'tsup.config.*' : ''}, ` +
            `so the consumer ends up compiling Hudson source while Hudson's own watcher may also be running. ` +
            `Use a tarball (file:./hudsonkit-x.y.z.tgz) or the published package instead.`,
          fix:
            `Run \`bun run pack\` inside hudsonkit to produce a sealed tarball, then point this dep at the .tgz.`,
        });
      } else {
        findings.push({
          id: 'file-dep-loose',
          severity: SEVERITY.MEDIUM,
          title: `${field}.hudsonkit uses ${spec.split(':')[0]}: (${spec})`,
          detail: `Resolved to ${realPath}. No src/ or tsup config detected, but folder deps are still resolved live; prefer a sealed tarball or the published package for stable consumer integrations.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2 — transpilePackages includes hudsonkit
// ---------------------------------------------------------------------------
function checkTranspilePackages(ctx, findings) {
  for (const f of ctx.nextConfigs) {
    const src = readTextSafe(f);
    if (!src) continue;
    // Match transpilePackages: [...] block; tolerate whitespace/newlines.
    const m = src.match(/transpilePackages\s*:\s*\[([\s\S]*?)\]/);
    if (!m) continue;
    if (/['"`]hudsonkit['"`]/.test(m[1])) {
      findings.push({
        id: 'transpile-hudsonkit',
        severity: SEVERITY.HIGH,
        title: `next.config includes "hudsonkit" in transpilePackages`,
        detail:
          `Found in ${relative(ctx.cwd, f)}. transpilePackages forces Next.js to recompile Hudson's TypeScript from source on every change, ` +
          `which compounds with any watcher Hudson runs in-place. Consume the published package or a sealed tgz so you can drop this entry.`,
        fix: `Remove "hudsonkit" from transpilePackages and depend on the built dist/ output (the package ships ESM + .d.ts).`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3 — turbopack.root over-broad
// ---------------------------------------------------------------------------
function checkTurbopackRoot(ctx, findings) {
  for (const f of ctx.nextConfigs) {
    const src = readTextSafe(f);
    if (!src) continue;
    // Look for turbopack: { root: ... } — capture the whole rest of the line so
    // multi-arg expressions like `join(__dirname, "..")` survive.
    const m = src.match(/turbopack\s*:\s*{[^}]*?\broot\s*:\s*([^\n]+)/);
    if (!m) continue;
    const rawValue = m[1].replace(/[,;]\s*$/, '').trim();
    // Heuristic: any reference to `..`, parent dir join, or absolute path above cwd is risky.
    const looksLikeParent =
      /['"`][^'"`]*\.\.[^'"`]*['"`]/.test(rawValue) ||
      /join\([^)]*['"`]\.\.['"`]/.test(rawValue) ||
      /resolve\([^)]*['"`]\.\.['"`]/.test(rawValue) ||
      /dirname\(/.test(rawValue);
    if (looksLikeParent) {
      findings.push({
        id: 'turbopack-root-broad',
        severity: SEVERITY.HIGH,
        title: `turbopack.root appears to resolve outside the project root`,
        detail:
          `Found in ${relative(ctx.cwd, f)}: \`turbopack.root: ${rawValue}\`. A turbopack root above the project pulls sibling repos into the watch graph and dramatically expands the FSEvents queue.`,
        fix: `Set turbopack.root to the project directory (__dirname) and gate any sibling-repo override behind an explicit env var.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4 — Tailwind config scans hudsonkit source or dist
// ---------------------------------------------------------------------------
function checkTailwindScan(ctx, findings) {
  // Tailwind v3 config files
  for (const f of ctx.tailwindConfigs) {
    const src = readTextSafe(f);
    if (!src) continue;
    if (/hudsonkit/.test(src)) {
      findings.push({
        id: 'tailwind-scans-hudsonkit',
        severity: SEVERITY.HIGH,
        title: `Tailwind config references hudsonkit`,
        detail:
          `Found in ${relative(ctx.cwd, f)}. Scanning Hudson's source or dist for class names triggers Tailwind to walk a tree that may overlap a live source folder, multiplying watcher cost.`,
        fix: `Drop the hudsonkit path from \`content\`/\`@source\` and import the prebuilt bundle instead: \`@import 'hudsonkit/styles';\`.`,
      });
    }
  }
  // Tailwind v4 @source directives in CSS files (heuristic — check globals.css candidates)
  for (const f of ctx.cssFiles) {
    const src = readTextSafe(f);
    if (!src) continue;
    const lines = src.split('\n').filter(l => /@source/.test(l) && /hudsonkit/.test(l));
    if (lines.length > 0) {
      findings.push({
        id: 'tailwind-source-hudsonkit',
        severity: SEVERITY.HIGH,
        title: `Tailwind @source directive references hudsonkit`,
        detail:
          `Found in ${relative(ctx.cwd, f)}: ${lines[0].trim()}. Same hazard as the v3 content scan above — Tailwind will walk hudsonkit on every CSS pass.`,
        fix: `Remove the @source directive and switch to \`@import 'hudsonkit/styles';\`.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 5 — hudsonkit/dist/styles.css present?
// ---------------------------------------------------------------------------
function checkStylesPresent(ctx, findings) {
  const candidates = [
    join(ctx.cwd, 'node_modules', 'hudsonkit', 'dist', 'styles.css'),
  ];
  // Also check whatever any file:/link: dep resolves to
  const pkg = ctx.pkg;
  if (pkg) {
    for (const field of ['dependencies', 'devDependencies']) {
      const block = pkg[field] ?? {};
      const spec = block.hudsonkit;
      if (typeof spec === 'string' && (spec.startsWith('file:') || spec.startsWith('link:'))) {
        const target = spec.replace(/^(file:|link:)/, '');
        if (!target.endsWith('.tgz') && !target.endsWith('.tar.gz')) {
          candidates.push(resolve(ctx.cwd, target, 'dist', 'styles.css'));
        }
      }
    }
  }
  const present = candidates.some(p => existsSync(p));
  if (!present) {
    findings.push({
      id: 'styles-missing',
      severity: SEVERITY.HIGH,
      title: `hudsonkit/dist/styles.css is missing`,
      detail:
        `Looked for: ${candidates.map(p => relative(ctx.cwd, p)).join(', ')}. ` +
        `When this file is missing, consumers often work around it by scanning hudsonkit source from Tailwind — which is the failure mode this preflight is trying to catch.`,
      fix: `From hudsonkit's directory: \`bun run build:css\`. Add a \`prepare\` script so file: installs auto-build.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Check 6 — Hudson dev server already running?
// ---------------------------------------------------------------------------
function checkHudsonProcessRunning(ctx, findings) {
  let out = '';
  try {
    out = execSync('ps -A -o pid=,command=', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return; // can't read process table — skip silently
  }
  const lines = out.split('\n').filter(Boolean);
  const matches = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const [, pid, cmd] = m;
    // Match `next dev` against an obviously-hudson cwd or env; we can't read each cwd cheaply
    // so we settle for the command string. Filter out the current ps invocation.
    // Strict pattern: literal "next dev" (or node binary running .bin/next dev).
    // Exclude lines that look like agent/system-prompt blobs (very long commands).
    if (cmd.length > 1024) continue;
    if (/\bcomputer-use\b/i.test(cmd)) continue;
    if (/--append-system-prompt/.test(cmd)) continue;
    const isNextDev = /\bnext\s+dev\b/.test(cmd) || /\.bin\/next\b/.test(cmd);
    const looksLikeHudson = /hudson(kit)?[\/\s]/i.test(cmd);
    if (isNextDev && looksLikeHudson) {
      matches.push({ pid: Number(pid), cmd });
    }
  }
  if (matches.length > 0) {
    findings.push({
      id: 'hudson-dev-running',
      severity: SEVERITY.MEDIUM,
      title: `A Hudson dev process appears to be running already`,
      detail: matches.map(m => `  pid ${m.pid}: ${m.cmd.slice(0, 140)}`).join('\n'),
      fix: `Run \`hudsonkit status\` to inspect, or \`hudsonkit panic --yes\` to terminate. Starting a second concurrent watcher is the common trigger for the runaway loop.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Discovery — find consumer config files in the project root
// ---------------------------------------------------------------------------
function discover(cwd) {
  const pkgPath = join(cwd, 'package.json');
  const pkg = existsSync(pkgPath) ? readJSON(pkgPath) : null;

  const nextConfigCandidates = ['next.config.ts', 'next.config.js', 'next.config.mjs', 'next.config.cjs'];
  const nextConfigs = nextConfigCandidates.map(n => join(cwd, n)).filter(p => existsSync(p));

  const tailwindConfigCandidates = [
    'tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs',
  ];
  const tailwindConfigs = tailwindConfigCandidates.map(n => join(cwd, n)).filter(p => existsSync(p));

  // Common Tailwind v4 entry CSS files — check a small allowlist; don't scan the whole tree
  const cssCandidates = [
    'app/globals.css', 'src/app/globals.css', 'styles/globals.css', 'app/global.css',
  ];
  const cssFiles = cssCandidates.map(n => join(cwd, n)).filter(p => existsSync(p));

  return { cwd, pkg, nextConfigs, tailwindConfigs, cssFiles };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
function renderText(findings, ctx, color) {
  const lines = [];
  const banner = paint('bold', 'hudsonkit preflight', color);
  lines.push(`${banner}  ${paint('dim', `(${ctx.cwd})`, color)}\n`);
  if (findings.length === 0) {
    lines.push(paint('green', '✓ no findings — looks clean.', color));
    return lines.join('\n');
  }
  for (const f of findings) {
    const sev = f.severity === SEVERITY.HIGH ? paint('red', `[${f.severity}]`, color)
      : f.severity === SEVERITY.MEDIUM ? paint('yellow', `[${f.severity}]`, color)
      : paint('blue', `[${f.severity}]`, color);
    lines.push(`${sev} ${paint('bold', f.title, color)}`);
    if (f.detail) lines.push(f.detail.split('\n').map(l => `       ${l}`).join('\n'));
    if (f.fix) lines.push(`       ${paint('dim', 'fix: ' + f.fix, color)}`);
    lines.push('');
  }
  const high = findings.filter(f => f.severity === SEVERITY.HIGH).length;
  const med = findings.filter(f => f.severity === SEVERITY.MEDIUM).length;
  lines.push(paint('dim', `${high} high · ${med} medium · ${findings.length} total`, color));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
export async function run(argv) {
  const args = parseArgs(argv);
  if (args.help) { process.stdout.write(USAGE); return; }
  if (args._err) { process.stderr.write(`preflight: ${args._err}\n\n${USAGE}`); process.exit(2); }

  let stat;
  try { stat = statSync(args.cwd); } catch { stat = null; }
  if (!stat || !stat.isDirectory()) {
    process.stderr.write(`preflight: --cwd is not a directory: ${args.cwd}\n`);
    process.exit(2);
  }

  const ctx = discover(args.cwd);
  ctx.isConsumer = isHudsonkitConsumer(ctx);
  const findings = [];

  if (!ctx.isConsumer) {
    if (args.json) {
      process.stdout.write(JSON.stringify({ cwd: ctx.cwd, findings: [], note: 'not a hudsonkit consumer' }, null, 2) + '\n');
    } else {
      process.stdout.write(`${paint('bold', 'hudsonkit preflight', args.color)}  ${paint('dim', `(${ctx.cwd})`, args.color)}\n${paint('dim', 'no hudsonkit dependency or node_modules entry detected — nothing to check.', args.color)}\n`);
    }
    return;
  }

  checkFileDep(ctx, findings);
  checkTranspilePackages(ctx, findings);
  checkTurbopackRoot(ctx, findings);
  checkTailwindScan(ctx, findings);
  checkStylesPresent(ctx, findings);
  checkHudsonProcessRunning(ctx, findings);

  if (args.json) {
    process.stdout.write(JSON.stringify({ cwd: ctx.cwd, findings }, null, 2) + '\n');
  } else {
    process.stdout.write(renderText(findings, ctx, args.color) + '\n');
  }

  const highCount = findings.filter(f => f.severity === SEVERITY.HIGH).length;
  if (args.failOnRisk && highCount > 0) process.exit(1);
}
