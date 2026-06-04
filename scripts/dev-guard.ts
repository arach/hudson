#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────────────────────
// dev-guard — a watchdog around the dev server so a runaway loop can't eat the
// machine.
// ─────────────────────────────────────────────────────────────────────────────
// Turbopack's dev loader retries a failed compile forever. When something makes
// a compile fail every time (e.g. an unresolvable `@import`), that retry loop
// climbs memory until the box OOMs. This wraps `bun run dev`, watches the whole
// process tree, and kills it before it runs away:
//
//   • Memory ceiling — total RSS of the tree crosses DEV_MEM_LIMIT_MB.
//   • Error storm    — a burst of "Module not found / Can't resolve / Error:"
//                      lines in a short window (the signature of a retry loop).
//
// Run it instead of `bun dev`:   bun run dev:safe
//
// Knobs (env):
//   DEV_MEM_LIMIT_MB     ceiling in MB           (default 6144)
//   DEV_GUARD_INTERVAL_MS poll interval in ms    (default 4000)
//   DEV_ERR_WINDOW_MS    error-storm window      (default 10000)
//   DEV_ERR_MAX          max errorish lines/window (default 80)
//   DEV_CMD              command to wrap          (default "bun run dev")
// ─────────────────────────────────────────────────────────────────────────────

const MEM_LIMIT_MB = Number(process.env.DEV_MEM_LIMIT_MB ?? 6144);
const INTERVAL_MS = Number(process.env.DEV_GUARD_INTERVAL_MS ?? 4000);
const ERR_WINDOW_MS = Number(process.env.DEV_ERR_WINDOW_MS ?? 10000);
const ERR_MAX = Number(process.env.DEV_ERR_MAX ?? 80);
const DEV_CMD = process.env.DEV_CMD ?? "bun run dev";

const ERRORISH = /Module not found|Can't resolve|Error:|FATAL|JavaScript heap out of memory/i;

function log(msg: string) {
  process.stderr.write(`\x1b[33m[dev-guard]\x1b[0m ${msg}\n`);
}

// All descendant PIDs of `root` (inclusive), via one `ps` snapshot.
function processTree(root: number): number[] {
  const out = Bun.spawnSync(["ps", "-Ao", "pid=,ppid="]).stdout.toString();
  const children = new Map<number, number[]>();
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const ppid = Number(m[2]);
    (children.get(ppid) ?? children.set(ppid, []).get(ppid)!).push(pid);
  }
  const tree: number[] = [];
  const stack = [root];
  while (stack.length) {
    const pid = stack.pop()!;
    tree.push(pid);
    for (const c of children.get(pid) ?? []) stack.push(c);
  }
  return tree;
}

// Total RSS (MB) of the process tree.
function treeRssMb(root: number): number {
  const pids = new Set(processTree(root));
  const out = Bun.spawnSync(["ps", "-Ao", "pid=,rss="]).stdout.toString();
  let kb = 0;
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (m && pids.has(Number(m[1]))) kb += Number(m[2]);
  }
  return Math.round(kb / 1024);
}

function killTree(root: number, signal: NodeJS.Signals) {
  // Kill children before parents so nothing respawns mid-teardown.
  const pids = processTree(root).reverse();
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

const proc = Bun.spawn(["bash", "-lc", DEV_CMD], {
  stdin: "inherit",
  stdout: "pipe",
  stderr: "pipe",
});

log(`pid ${proc.pid} — ceiling ${MEM_LIMIT_MB} MB, polling every ${INTERVAL_MS} ms`);

let shuttingDown = false;
function shutdown(reason: string, code: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  if (reason) log(reason);
  killTree(proc.pid, "SIGTERM");
  // Hard-kill anything that ignores SIGTERM.
  setTimeout(() => {
    killTree(proc.pid, "SIGKILL");
    process.exit(code);
  }, 3000);
}

// ── error-storm detector ──────────────────────────────────────────────────────
const errTimes: number[] = [];
function inspectLine(line: string) {
  if (!ERRORISH.test(line)) return;
  const now = Date.now();
  errTimes.push(now);
  while (errTimes.length && now - errTimes[0] > ERR_WINDOW_MS) errTimes.shift();
  if (errTimes.length > ERR_MAX) {
    shutdown(
      `error storm: ${errTimes.length} error lines in ${ERR_WINDOW_MS / 1000}s — killing the dev tree before it runs away.`,
      1,
    );
  }
}

// Tee a stream to a sink while scanning lines (no buffering of the full log).
async function tee(stream: ReadableStream<Uint8Array>, sink: NodeJS.WriteStream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sink.write(value);
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      inspectLine(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
}
tee(proc.stdout, process.stdout);
tee(proc.stderr, process.stderr);

// ── memory ceiling ────────────────────────────────────────────────────────────
const timer = setInterval(() => {
  if (shuttingDown) return;
  const rss = treeRssMb(proc.pid);
  if (rss > MEM_LIMIT_MB) {
    shutdown(`memory ceiling hit: tree RSS ${rss} MB > ${MEM_LIMIT_MB} MB — killing the dev tree.`, 1);
  }
}, INTERVAL_MS);

// ── signal forwarding so Ctrl-C tears the tree down cleanly ───────────────────
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(sig, () => shutdown(`received ${sig} — shutting down dev tree.`, 0));
}

const code = await proc.exited;
if (!shuttingDown) {
  clearInterval(timer);
  process.exit(code);
}
