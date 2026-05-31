# HUD-007: Agent Intent Instrumentation

Status: phase 1 shipped
Author: hudson.feat-share-primitive (claude opus 4.7)
Date: 2026-05-28
Revised: 2026-05-28 (after codex review — see §7)

## TL;DR

Close the loop between the existing intent catalog, the `docs/hudson-playbooks/` corpus, and the HUD Logger by adding (a) one importable logger module, (b) a thin `intent(meta, fn)` wrapper that colocates metadata with server-side functions and auto-emits span logs, and (c) a one-paragraph CLAUDE.md convention. No HTTP dispatch layer. No MCP server. No sidecar markdown bodies. Existing `app/apps/*/intents.ts` declarations continue to work; the new wrapper is additive and lives alongside.

## 1. Context

### 1.1 Existing surfaces

| Surface | Location | Role |
|---|---|---|
| Intent declarations | `app/apps/<id>/intents.ts` | Per-app `AppIntent` arrays — `commandId`, `title`, `description`, `keywords`. |
| Catalog builder | `app/lib/intent-catalog.ts` | Walks workspace apps, aggregates intents into an index. |
| Catalog endpoint | `app/api/intents/route.ts` | `GET /api/intents?workspace=...` returns the catalog. |
| Client dispatch | `app/hooks/useIntentExecutor.ts` | Resolves `commandId` → `CommandOption.action()` React closure. |
| Playbooks corpus | `docs/hudson-playbooks/*.md` | Multi-step agentic recipes (e.g. `brand-commission.md`). |
| Agent snapshot | `scripts/agent-snapshot.ts` | Derives live app registry / ports / intents from code. |
| Commission log | `.coordination/commissions.md` | Append-only "what I delivered" record. |
| Agent log writer | `app/lib/agent-log.ts` | `appendAgentLog({...})` → one JSONL line to `.data/agent-actions.jsonl`. |
| Agent log API | `app/api/agent-actions/route.ts` | `GET /api/agent-actions?limit=N` tails the file. |
| Agent log viewer | `HudLogger` primitive | `replayEvents` prop merges file rows with live in-memory emits. |
| Scout twins | `scout who` shows `hudson.<branch>.<host>` agents registered. |

### 1.2 What's not glued together

1. Server code that *actually does work* (e.g. `compileLogoRenderBody`, `/api/logo/template`) doesn't write to `.data/agent-actions.jsonl`. HudLogger renders the agent-actions feed; the feed is empty.
2. The intent catalog only knows about UI-side `AppIntent` declarations. Server-runnable functions don't appear in the catalog, so the @hudson agent can't reliably enumerate "what code can I call to fulfill this Scout request."
3. The @hudson agent has no consistent convention for narrating its work into a machine-readable feed.

### 1.3 Non-goals

- No MCP server. The @hudson session has `Bash` + `Read` + `Edit`; it doesn't need an extra protocol.
- No deprecation of `docs/hudson-playbooks/`. Playbooks remain prose-form recipes for multi-step workflows.
- No renaming of existing `AppIntent` declarations for UI-only intents.
- No automatic Scout broker → Hudson dispatch endpoint. Scout delivers a message; the agent fulfills it using its own tools.
- No log rotation. The JSONL file is dev-local; we'll size it later if needed.

## 2. Design

### 2.1 `hudsonLog` — importable logger

`app/lib/agent-log.ts` exports a logger value:

```ts
import { hudsonLog } from '@/app/lib/agent-log';

hudsonLog.info('Picked template mono-stamp');
hudsonLog.info('Compiled 4 variations', { variants: ['a', 'b', 'c', 'd'] });
hudsonLog.warn('Falling back to default palette', { reason: 'no brand spec' });
hudsonLog.error('Compile failed', err);

// Optional context binding
const scoped = hudsonLog.scope({ playbook: 'logo.creation', traceId: 'tr_abc' });
scoped.info('Wrote outputs to ~/hudson/logo/.data/');
```

Each call appends one JSONL line via the existing `appendAgentLog` writer. `scope(...)` returns a logger that merges fields into every subsequent emit, so server functions and agent-authored scripts can stamp every line with a playbook/intent identifier without repeating themselves.

Shape:

```ts
interface HudsonLogger {
  info(message: string, payload?: LogPayload): void;
  warn(message: string, payload?: LogPayload): void;
  error(message: string, error?: unknown, payload?: LogPayload): void;
  scope(context: LogContext): HudsonLogger;
}

interface LogPayload {
  data?: Record<string, unknown>;
  target?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface LogContext {
  source?: string;       // 'intent' | 'playbook' | 'route' | custom
  playbook?: string;     // intent id or playbook slug
  traceId?: string;      // groups multiple emits under one invocation
  appId?: string;
  workspaceId?: string;
  target?: string;
}
```

### 2.2 `intent(meta, fn)` — colocated metadata + auto-logging

`app/lib/intent.ts` exposes:

```ts
export type IntentRuntime = 'server' | 'ui';

export interface IntentMeta {
  id: string;
  summary: string;
  keywords?: string[];
  runtime: IntentRuntime;     // default 'server' when used via intent()
  body?: string;              // optional agentic-body markdown (template string)
  appId?: string;             // optional ownership hint
}

export function intent<TArgs extends unknown[], TResult>(
  meta: IntentMeta,
  fn: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult>;

export function listIntents(): IntentMeta[];
export function getIntent(id: string): IntentRegistryEntry | undefined;
```

Usage:

```ts
// app/api/logo/intents.ts
import { intent } from '@/app/lib/intent';
import { compileLogoRenderBody, normalizeLogoRenderSource, stripTemplateMetaBlock } from './renderCompiler';

export const compileLogo = intent(
  {
    id: 'logo.compile',
    summary: 'Compile a logo render body from source',
    keywords: ['logo', 'compile', 'render'],
    runtime: 'server',
    body: `
      Validates and compiles a render body string into executable JS.
      Always validates by running the compiled output with a test parameter
      set. If validation fails, surface the runtime error to the caller —
      don't try to repair the source.
    `,
  },
  async (rawSource: string): Promise<string> => {
    const stripped = stripTemplateMetaBlock(rawSource).trim();
    const source = normalizeLogoRenderSource(stripped);
    const js = await compileLogoRenderBody(source);
    // validation...
    return js;
  },
);
```

`intent(...)` does three things:

1. **Registers** `meta` in a module-level `Map<string, IntentRegistryEntry>` keyed by `id`.
2. **Wraps** `fn` so each invocation:
   - generates a fresh `traceId`,
   - emits a `started` log via `hudsonLog.scope({ playbook: meta.id, traceId })`,
   - times the call,
   - emits a `completed` or `failed` log with `durationMs` and (on failure) the error,
   - rethrows on failure (the caller still sees the original throw).
3. **Returns** the wrapped function. The intent and the production code path are the same value — calling it from a route handler, a script, or a server action all flow through the same auto-instrumentation.

### 2.3 Catalog updates

`buildIntentCatalog(workspace)` continues to read `app/apps/*/intents.ts` for UI-only declarations (these power command palettes, status surfaces, etc.). It also calls `listIntents()` and includes server-runnable entries in the same shape, with a `runtime` discriminator:

```ts
type CatalogEntry = {
  id: string;
  summary: string;            // was 'description' in AppIntent; alias both
  keywords: string[];
  runtime: 'server' | 'ui';
  bodyPath?: string;          // for UI-only intents that link to a playbook
  body?: string;              // inline for intent()-wrapped server intents
  source?: { file: string; line: number };  // optional (see §3.3)
};
```

`/api/intents` returns the merged list. The @hudson agent calls this once and knows both what UI intents exist (descriptive) and what server intents it can actually invoke (callable from a Bun script).

### 2.4 Module discovery

For `listIntents()` to be populated before `/api/intents` responds, intent-defining modules must be imported eagerly. Approach: a barrel `app/intents-registry.ts` re-exports every intent-bearing module:

```ts
// app/intents-registry.ts — imported by /api/intents/route.ts and any
// other route that needs the registry populated.
export * from './api/logo/intents';
export * from './api/shaper/intents';
// ...added as new intent() definitions appear
```

The catalog route imports the barrel as a side effect; the registry is filled before the first request returns.

Alternative considered: scan filesystem for `intent(` calls. Rejected — fragile and indirect when a single explicit barrel works.

### 2.5 Agent convention (CLAUDE.md addition)

```markdown
## Fulfilling Scout requests as @hudson

When a Scout message comes in:

1. Check `docs/hudson-playbooks/` — if a playbook matches the shape of the
   ask, follow it.
2. Otherwise, run `bun scripts/agent-snapshot.ts` to see live apps + intents,
   or `curl localhost:3500/api/intents` if the dev server is up.
3. Server intents (those wrapped with `intent(...)`) are directly callable
   — import them in a script or `bun -e` one-liner. Each call auto-logs.
4. For ad-hoc sub-actions outside of an intent call, import `hudsonLog`:

   ```ts
   import { hudsonLog } from '@/app/lib/agent-log';
   hudsonLog.info('Read the brief from docs/specs/...');
   ```

   Use it for the milestones a human would want to see in HudLogger — picked
   a template, wrote a file, finished a build — not every keystroke.
5. Reply to Scout with the result. The HudLogger trail is your record of
   what you did; you don't need to retype it into the reply.
```

## 3. Cross-cutting concerns

### 3.1 File-append safety

Multiple intent invocations may concurrently call `appendFile` on the same JSONL. POSIX `O_APPEND` guarantees atomicity for writes under `PIPE_BUF` (4096 bytes on macOS). Hudson agent log lines are typically <2KB. For occasional larger payloads (full template source, etc.), interleaving is possible but acceptable for dev-local observability. **Mitigation if it bites:** add a small async write queue keyed by file path. Out of scope for this HUD.

### 3.2 HMR registry duplication

Next.js HMR re-evaluates modules on edit. Each re-eval calls `intent(...)` again, which calls `registry.set(id, ...)` — the new wrapper replaces the old one. Existing call sites (already-imported function references) will keep calling the old wrapper until they themselves re-evaluate. Acceptable; matches how every other module re-registration behaves under HMR.

### 3.3 Source-location capture (optional)

`intent(...)` can inspect `new Error().stack` at registration time to record the file and line where it was called. Pure ergonomics — lets the agent jump directly from the catalog entry to the implementation. Cheap to add; ship in phase 1 if low-risk.

### 3.4 UI dispatch of server intents

Open question (§5.1). One reading: a server intent could become invokable from the React UI via `fetch('/api/intents/dispatch', { commandId, args })`. That'd unify UI and agent surfaces. Adds a dispatcher route (which we said we didn't want). Defer; revisit if UI demand arises.

## 4. Migration

| Phase | Change | Risk |
|---|---|---|
| 1 (this HUD) | Add `hudsonLog`, `intent()`, merge registry into catalog. Wire one real server intent (`logo.compile`). | Low. Additive. |
| 2 | Convert 2–3 more server routes (logo template, shaper save) to `intent(...)`. | Low. Mechanical. |
| 3 | Add CLAUDE.md paragraph; let it ride in real Scout work. Observe what's missing. | None. Convention. |
| 4 | Decide UI-dispatch question based on real demand. | Deferred. |
| 5 (separate HUD) | Demolish `/api/openscout` + openscout app — orthogonal cleanup. | Medium. Unwiring required. |

## 5. Open questions

### 5.1 UI dispatch of server intents

Should `runtime: 'server'` intents be reachable from the React UI via a thin dispatcher route, unifying the two dispatch surfaces? Or strictly agent-only (UI keeps `CommandOption.action` closures)?

### 5.2 Auto-source-location

Worth recording `file:line` for every `intent(...)` registration via stack inspection? Or rely on grep?

### 5.3 Span shape in JSONL

`appendAgentLog` currently writes `kind: 'log'` rows with a `data.status` field (`'started' | 'completed' | 'failed'`). The HudLogger types support real `kind: 'span'` events. Do we keep using `kind: 'log'` with status (simpler; what we have) or switch to real spans (closer to the existing observability primitives, supports duration as a first-class field)?

### 5.4 Discovery without the dev server

`scripts/agent-snapshot.ts` already derives intents by importing app modules in a Bun process. For the @hudson agent to enumerate server intents without `curl`, the snapshot script should also import `app/intents-registry.ts` and dump `listIntents()`. Trivial extension; flagging here so it's not forgotten.

### 5.5 Where do intent-defining files live?

This HUD proposes `app/api/<area>/intents.ts` (next to the API routes that use them). Alternative: a top-level `app/intents/<area>.ts` that imports from `app/api/.../*` and applies `intent(...)`. The first is colocated with implementation; the second centralizes the catalog. Preference: colocated. Open for codex disagreement.

## 6. Deliverables for phase 1

- `app/lib/agent-log.ts` — `hudsonLog` importable logger (`info` / `warn` / `error` / `debug` / `scope`) returning `Promise<void>` so callers can `await` for durability. Plus separate writers for `kind: 'log'` (`appendAgentLog`) and `kind: 'span'` (`appendAgentSpanStart`, `appendAgentSpanEnd`).
- `app/lib/intent.ts` — `intent({...}, fn)` wrapper, registry, `listIntents()`, `getIntent()`, `intentMetaToServerIntent()`. Auto-emits real `kind: 'span'` events for start/end; rethrows on failure with `status: 'error'`.
- `app/intents-registry.ts` — eager side-effect barrel; initially imports `./api/logo/intents`.
- `app/api/logo/intents.ts` — `logo.compile` as the first real intent, with `importPath`/`exportName`/`params` schema, plus the markdown body.
- `app/api/logo/compile/route.ts` — thin wrapper calling `compileLogo`.
- `app/lib/intent-catalog.ts` — `buildIntentCatalog(workspace, { serverIntents? })`. Pure / client-safe; server intents land on a separate `IntentCatalog.serverIntents` field, never in `index` or `apps[].intents`.
- `app/api/intents/route.ts` — `export const runtime = 'nodejs'`; imports `app/intents-registry` for side effects; passes `serverIntents` to the catalog builder.
- `packages/web/hudsonkit/src/types/intent.ts` — new `ServerIntent` type; `IntentCatalog.serverIntents?: ServerIntent[]`. `AppIntent` unchanged.
- `scripts/agent-action.ts` — CLI task envelope. `run -- <command>` emits paired `started` + `completed`/`failed` events automatically; manual `start` is for multi-step work and must be closed with `complete` or `fail`.
- `CLAUDE.md` — `@hudson` paragraph linking to this HUD.
- `test/lib/agent-intent.test.ts` — tests covering redaction, size cap, awaitable returns, scope precedence, task terminal events, span writers, intent start/end + error, duplicate-id detection, HMR replacement, catalog split, registry projection.
- No deletes in phase 1 (`/api/openscout` cleanup is a separate HUD).

## 7. Codex review notes (applied)

The first draft of this HUD was reviewed by a fresh codex-harness session via Scout (`scout up /Users/arach/dev/hudson --harness codex`). The review surfaced several issues that were applied before phase 1 shipped:

- **Catalog split is load-bearing.** Original §2.3 merged server intents into `buildIntentCatalog()`'s `index` and `apps[].intents`. That poisoned the client bundle (the client hook `useIntentCatalog` imports `buildIntentCatalog`, which would have transitively pulled `fs/promises` into the browser) and would have spammed `useIntentExecutor`'s warn loop on every server intent. Final shape: `IntentCatalog.serverIntents?: ServerIntent[]` as a separate field; `index` stays UI-only. `buildIntentCatalog(workspace, { serverIntents? })` takes the registry projection as a parameter so it stays pure.
- **Server intents need callable metadata, not just prose.** Added required `importPath` + `exportName` on `IntentMeta` so an agent can construct `import { exportName } from importPath`. `params: IntentParameter[]` is still optional but recommended; when present, `intent()` uses param names to key the args block in span logs.
- **`hudsonLog` redaction + size cap.** Ported `redactAgentActionValue` from `hudsonkit/observability/agent-actions`; applied to `args`/`metadata`/`data` on every emit. Per-line cap of 16 KB; oversized payloads have their large fields replaced with `[truncated]`. If still too big, the line collapses to a stub envelope.
- **Logger methods return `Promise<void>`.** Callers can `void` for fire-and-forget or `await` for durability.
- **Scope precedence.** Per-call payload overrides scoped context for collisions (`payload.target ?? context.target`).
- **Duplicate-id detection.** `intent(...)` captures source location (best-effort via `Error.stack`); same-source re-registration is silent (HMR), different-source warns once with both file paths.
- **Real spans, not log+status.** `intent()` emits `kind: 'span'` events with `status: 'active'` / `'ok'` / `'error'`, `startTime`, `endTime`, `durationMs` — matching HudLogger's existing span rendering. Manual `hudsonLog.info(...)` calls remain `kind: 'log'`.
- **`runtime: 'nodejs'`** explicitly set on `/api/intents/route.ts` as a clarity guard.

### Codex disagreements left as future work

- **§3.1 PIPE_BUF wording was incorrect.** PIPE_BUF applies to pipes/FIFOs, not regular files. The practical risk story is unchanged — `O_APPEND` gives atomic positioning per write on local filesystems and Hudson's emit rate is too low for interleaving to bite. The 16 KB per-line cap is the meaningful mitigation; a per-process queue is deferred unless we observe corruption.
- **§5.4 snapshot extension** still deferred; not blocking phase 1.

### Codex deferrals retained

- **§5.1 UI dispatch of server intents:** agent-only for now; if ever added, require schema/auth/CSRF per intent.
- **§5.3:** resolved — using real spans.
