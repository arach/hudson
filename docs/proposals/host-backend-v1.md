# HudsonKit Host Backend v1

Status: proposal

Date: 2026-07-02

Request: `WorkspaceShell` and `AppShell` accept an `environment.routes` map of
~17 optional host endpoints that the kit never ships. Hudson implements them as
a hand-written `apps/web/app/api/**` tree; Atelier (the second consumer) reimplemented
them as a ~1,146-line Vite dev-server plugin whose comments explicitly wait on
"the kit's turnkey AI host shape". This proposal defines that shape: a
framework-agnostic host backend under `hudsonkit/server`, produced by a single
`createHudsonHost(...)` factory that yields both the request handlers and the
client-side routes object, so shells and backends cannot drift.

## Problem statement

### The contract the kit demands but does not fulfil

`WorkspaceShellEnvironment` (`packages/web/hudsonkit/src/workspace/shell/WorkspaceShell.tsx:566-576`)
and `AppShellEnvironment` (`packages/web/hudsonkit/src/components/AppShell.tsx:77-84`)
both carry a `routes?: WorkspaceHostRoutes` map, defined in
`packages/web/hudsonkit/src/workspace/hostRoutes.tsx:5-23` with 17 optional
endpoint strings:

`agentActions, aiChat, apiProxy, fetchImage, imageGeneration, localEnvironment,
pipes, pipeEvents, relayUpload, services, serviceExecute, speech, traces,
voiceApiBase, voices, workspaceDecor, workspaceState`

plus two non-route bindings on `WorkspaceShellEnvironment` (`renderTerminal`,
`useHudsonAISettingsEntry`). Every key degrades gracefully when absent — but a
host that wants the shell to actually *work* (assistant chat, persisted window
state, the HudLogger feed, voice replies, the data bus) must implement most of
them. The kit specifies the client half of ~17 HTTP contracts and ships zero
server halves.

### Consumer #1: Hudson's `apps/web/app/api/**` tree

Hudson binds the contract in `apps/web/app/lib/hudsonShellEnvironment.tsx`, whose header
comment narrates the friction directly:

> This lives in app/ (not the kit) because it imports Hudson's own apps. The
> shell stays app-agnostic and reaches these only through the `environment`
> prop — which is what lets the shell move into hudsonkit while Hudson keeps
> supplying its apps. As more reaches are inverted (intents, service registry,
> /api endpoints) they get bound here.

The server halves are ~20 Next.js route handlers: `apps/web/app/api/agent-actions/`,
`apps/web/app/api/ai/` (chat, generate-image, models), `apps/web/app/api/proxy/`,
`apps/web/app/api/fetch-image/`, `apps/web/app/api/pipes/` (+ `/stream` SSE), `apps/web/app/api/relay/upload/`,
`apps/web/app/api/services/` (+ `/execute`), `apps/web/app/api/settings/environment/`,
`apps/web/app/api/traces/`, `apps/web/app/api/workspace-decor/`, `apps/web/app/api/workspace-state/`,
`apps/web/app/api/hudson-voice/**`, `apps/web/app/api/intents/`, plus the TTS routes at
`apps/web/app/v1/audio/speech/` and `apps/web/app/v1/voices/`. Most of them are thin, generic
glue: `apps/web/app/api/workspace-state/route.ts` is 57 lines of read-JSON /
shallow-merge-JSON against `.data/workspace-state/<id>.json`;
`apps/web/app/api/agent-actions/route.ts` is 108 lines of JSONL tail/append;
`apps/web/app/api/traces/route.ts` and `apps/web/app/api/workspace-decor/route.ts` are the same
file-CRUD pattern again. Nothing about them is Hudson-specific except the fact
that they live in Hudson.

### Consumer #2: Atelier's hand-rolled Vite plugin

Atelier consumes `hudsonkit` from npm/file and had to rebuild the entire host
surface as one Vite `configureServer` middleware:
`/Users/art/dev/atelier/vite.host-services.ts` (~1,146 lines). It hand-rolls
request-body buffering (`readBody`/`readJson`), JSON responses (`sendJson`),
two separate SSE implementations, a streaming reverse proxy to Hudson's dev
server (`proxyToHudsonAi` + `pipeWebResponse`), a process manager for the relay
service, and keychain→env credential mirroring. Its own comments state the gap:

- `/Users/art/dev/atelier/src/hostServices.ts:63` — *"Atelier's /api/ai/*
  delegates to the configured Hudson AI backend (pi-ai + Codex) while the
  kit's turnkey AI host shape lands."*
- `/Users/art/dev/atelier/src/hostServices.ts:69` — *"HUD-008 app backend
  mounting is not wired in this adapter yet."*
- `vite.host-services.ts:1066-1068` — *"Persistence + telemetry the shell
  pings on boot. Atelier doesn't persist sessions or ship a log sink yet, so
  absorb these as no-ops instead of letting them 404 into the console."*
  (`/api/workspace-state` returns `{}`, `/api/agent-actions` returns
  `{ok:true}` — the shell's boot pings are stubbed, not served.)
- `vite.host-services.ts:1081-1082` — *"Atelier has no cross-app pipe broker
  yet, so hold the stream open and empty rather than 404 + reconnect-storm."*

So the second consumer's steady state is: 7 of 17 routes wired
(`/Users/art/dev/atelier/src/HostView.tsx:7-17`,
`/Users/art/dev/atelier/src/AppShellView.tsx:12-19`), several of those as
deliberate no-ops, and zero persistence for workspace state, decor, agent
actions, or traces — because implementing them all by hand was not worth it.

### Generic infra stranded in the app

Three pieces of app-local Hudson code are generic kit infrastructure in the
wrong layer:

1. **`apps/web/app/lib/intent.ts`** — the server `intent()` registry. It imports
   `ServerIntent` from `hudsonkit` (the type lives at
   `packages/web/hudsonkit/src/types/intent.ts:46`) and produces exactly that
   catalog shape via `intentMetaToServerIntent()`. The mechanism (register,
   instrument with trace spans, list, catalog) has nothing Hudson-specific in
   it; only the registered intents do.
2. **`apps/web/app/lib/agent-log-core.ts`** — the agent-action JSONL writer. Its own
   comment (`apps/web/app/lib/agent-log-core.ts:20-23`) admits the mirroring: *"Event
   shapes — match `HObservation` in hudsonkit so HudLogger renders them
   natively."* The `LogEvent`/`SpanEvent` interfaces are hand-copied subsets
   of `HLogEvent`/`HTraceSpan` from
   `packages/web/hudsonkit/src/types/observability.ts`. When the kit types
   move, this file drifts silently.
3. **`scripts/agent-action.ts`** — the CLI envelope tool (`start`/`log`/
   `complete`/`fail`/`run`) that every agent workflow in `CLAUDE.md` depends
   on. It is a thin wrapper over `agent-log-core` and is unavailable to any
   consumer that isn't the Hudson repo.

### Groundwork that already exists

- The kit already ships a **`hudsonkit/server`** subpath export
  (`packages/web/hudsonkit/package.json` `"./server"`, built by
  `packages/web/hudsonkit/tsup.server.config.ts` as a separate node-platform
  pass with a `server-only` guard). Today `packages/web/hudsonkit/src/server.ts`
  exports two HUD-008 helpers: `appStorage` (the `~/hudson/{id}/.data` +
  `{project}/.data/{id}` seed-if-empty pattern,
  `src/lib/server/appStorage.ts`) and `createFsWatchEventStream` (generalized
  SSE, `src/lib/server/createFsWatchEventStream.ts`). Hudson's
  `apps/web/app/api/pipes/stream/route.ts` already consumes the app-side twin of the
  latter.
- **HUD-008** (`docs/specs/hud-008-app-backends.md`, status "Implemented (helpers +
  types; route migrations pending)") established the per-*app* backend
  convention (`HudsonApp.backend`, `createAppApiClient`, `useAppApiStatus`).
  This proposal is the *shell-level* counterpart: HUD-008 gives each app a
  backend namespace; the host backend gives the **shell itself** its backend.
- **`@hudsonkit/ai`** (`packages/web/ai-backends`) already defines the
  provider-neutral `Backend.streamUI(...)` interface plus pi-ai and vercel-ai
  adapters. Both consumers' `aiChat` implementations are already built on it
  (`apps/web/app/api/ai/chat/route.ts` via `createPiAiBackend()`; Atelier's
  `handleAtelierAiChat` likewise). The AI *provider* seam exists — only the
  HTTP handler around it is duplicated.

## Goals

1. **Turnkey handlers.** `hudsonkit/server` exports a host backend whose
   handlers are framework-agnostic functions — Fetch-API `Request →
   Promise<Response>` — runnable under Next.js route handlers, Vite dev
   middleware, Bun.serve, or plain Node with thin adapters.
2. **One factory, no drift.** `createHudsonHost({...})` returns both the
   server dispatch (`host.fetch`) and the client `routes:
   WorkspaceHostRoutes` object. A consumer passes `host.routes` into
   `environment.routes`; path strings are never written twice.
3. **Defaults where sane, providers where necessary.** File-backed
   `workspaceState`/`workspaceDecor`/`traces`/`pipes`/`agentActions` work with
   zero configuration (plus an in-memory store for tests/ephemeral hosts). AI
   chat, image generation, and speech require host-supplied providers with
   narrow interfaces (`@hudsonkit/ai` `Backend`, a `generateImage` function, a
   TTS provider).
4. **Graduate the stranded infra.** `intent()` and the agent-action JSONL
   writer move into `hudsonkit/server`, importing `ServerIntent` and
   `HObservation` from the kit's own types instead of mirroring them. The
   envelope CLI ships under the existing `hudsonkit` bin.
5. **Delete real code in both consumers.** Phase 1 must remove — not wrap —
   handler code from `apps/web/app/api/**` and `vite.host-services.ts`.
6. **Compile-time completeness.** The host's route manifest is typed against
   `keyof WorkspaceHostRoutes`, so adding a new key to the client contract is
   a build error in the kit until the manifest handles it or explicitly
   exempts it.

## Non-goals for v1

- **No hosted/multi-tenant backend.** Single-user, local-first,
  filesystem-backed — same trust model as today's `apps/web/app/api`.
- **No database layer.** The storage interface is deliberately small
  (JSON documents + JSONL append + watch); a DB-backed store can implement it
  later without changing handlers.
- **No auth framework.** Handlers accept an optional request-guard hook
  (same-origin by default for mutating routes); real auth is HUD-004's
  territory.
- **No voice runtime.** `voiceApiBase` fronts a native, WebSocket-RPC Vox
  runtime (`apps/web/app/api/hudson-voice/**`, `apps/web/app/lib/hudsonVoiceRuntime.ts`); that
  stays host-specific. See the contract table.
- **No production hardening promises for `apiProxy`/`fetchImage`** beyond a
  pluggable URL policy with safer defaults than today (see Open questions).
- **Not a rewrite of Hudson's app-specific routes** (`/api/logo/**`,
  `/api/shaper/**`, `/api/theme-designer`, …) — those are HUD-008 per-app
  backends and out of scope here.

## Proposed architecture

### Package placement

Everything lands under the existing server-only entrypoint, with two adapter
subpaths so framework deps never leak into the core:

```ts
import { createHudsonHost } from 'hudsonkit/server';        // core, Fetch-API only
import { toNextRouteHandlers } from 'hudsonkit/server/next'; // Next.js adapter
import { hudsonHostPlugin } from 'hudsonkit/server/vite';    // Vite dev-middleware adapter
```

`hudsonkit/server` keeps its current build shape (separate tsup pass,
`platform: 'node'`, `server-only` guard — `tsup.server.config.ts`). The
adapters are additional entries in the same pass. `next` stays out of the
kit's dependency graph: the Next adapter needs nothing from `next` because
App-Router route handlers already speak Fetch `Request`/`Response`; it is a
naming/mounting convenience only. The Vite adapter types against
`vite`/`connect` as an optional peer.

### The factory

```ts
export interface HudsonHostConfig {
  /** Prefix for all generated routes. Default '/api'. */
  basePath?: string;
  /** Storage root for kit-default stores. Default `${cwd}/.data`. */
  dataDir?: string;
  /** Swap the storage engine wholesale (tests, ephemeral hosts). */
  store?: HostStore;

  /** Provider-required capabilities — omit a key and its routes are not
   *  registered, so `host.routes` omits the string and the shell degrades
   *  exactly as it does today. */
  ai?: {
    backend: Backend;                       // from @hudsonkit/ai
    loadToolset: (id: string, context: Record<string, unknown>) => Promise<LoadedToolset>;
    loadCredentials?: () => Promise<Record<string, string>>;
    defaultModels?: Record<string, string>;
    /** Full takeover for hosts with bespoke modes (Hudson's CLI mode,
     *  Atelier's per-toolset routing). Receives the parsed chat body and the
     *  default pipeline as a fallback. */
    handleChat?: (body: AiChatBody, next: () => Promise<Response>) => Promise<Response>;
  };
  imageGeneration?: {
    generate: (req: { prompt: string; model?: string; aspectRatio?: string })
      => Promise<{ dataUrl: string; mediaType: string }>;
  };
  speech?: {
    synthesize: (req: SpeechRequest) => Promise<{ base64: string; mimeType: string }>;
    listVoices?: (q: { provider?: string; model?: string }) => Promise<VoiceCatalog>;
  };
  services?: {
    catalog: ServiceDefinition[];
    execute: (req: ServiceExecuteRequest) => Promise<ServiceActionResult>;
    probeHealth?: (def: ServiceDefinition) => Promise<ServiceStatus>;
  };
  environment?: {
    /** Default implementation writes `${cwd}/.env.local`. */
    secretStore?: HostSecretStore;          // vault seam; plaintext-file default
    suggestedKeys?: string[];
  };
  proxy?: {
    /** URL policy for apiProxy + fetchImage. Default: http/https only,
     *  loopback and private ranges denied unless explicitly allowed. */
    allowUrl?: (url: URL, surface: 'apiProxy' | 'fetchImage') => boolean;
    maxResponseBytes?: number;              // default 10 MB (matches app/api/proxy)
  };
  relayUpload?: { dir?: string };           // default os tmp + 'hudson-uploads'

  /** Per-key path overrides for migration (e.g. Hudson keeping speech at
   *  '/v1/audio/speech' during transition). */
  paths?: Partial<Record<HostRouteKey, string>>;
  /** Request guard applied before every handler. Default: same-origin check
   *  on mutating methods, everything else allowed. */
  guard?: (req: Request, key: HostRouteKey) => Response | undefined;
}

export interface HudsonHost {
  /** Client half — pass as `environment.routes` (WorkspaceShell) or
   *  `environment.routes` (AppShell). Only registered capabilities appear. */
  routes: WorkspaceHostRoutes;
  /** Server half — single dispatcher. Returns undefined for unmatched paths
   *  so hosts can fall through to their own routing. */
  fetch: (req: Request) => Promise<Response | undefined>;
  /** Per-key handlers for hosts that mount routes individually. */
  handlers: Record<HostRouteKey, (req: Request) => Promise<Response>>;
  /** The typed manifest (key → path, methods, transport) for tooling. */
  manifest: HostRouteManifest;
}
```

Two properties do the anti-drift work:

- `host.routes` is *derived from* the same manifest `host.fetch` dispatches
  on. There is no second place to typo `/api/workspace-state`.
- `HostRouteManifest` is declared as `Record<Exclude<keyof
  WorkspaceHostRoutes, HostSpecificRouteKey>, RouteSpec>` with
  `HostSpecificRouteKey = 'voiceApiBase'` as the single documented exemption.
  Adding key #18 to `WorkspaceHostRoutes` without teaching the host about it
  fails the kit's own typecheck.

### Storage interface

The kit-default handlers share one tiny engine instead of each opening files:

```ts
export interface HostStore {
  /** Namespaced JSON documents — workspace-state, workspace-decor, traces, pipes. */
  readDoc(ns: string, id: string): Promise<unknown | null>;
  writeDoc(ns: string, id: string, value: unknown): Promise<void>;
  deleteDoc(ns: string, id: string): Promise<void>;
  listDocs(ns: string): Promise<unknown[]>;
  /** Append-only lines — agent-actions JSONL. */
  appendLine(ns: string, line: string): Promise<void>;
  tailLines(ns: string, limit: number): Promise<string[]>;
  /** Invalidation stream for SSE routes (pipes). */
  watch?(ns: string, onInvalidate: () => void): () => void;
}

export function fileHostStore(dataDir: string): HostStore;   // default; matches today's .data/* layout
export function memoryHostStore(): HostStore;                // tests, static demos
```

`fileHostStore` reproduces Hudson's current on-disk layout exactly
(`.data/workspace-state/<id>.json`, `.data/traces/<id>.json`,
`.data/pipes/<id>.json`, `.data/workspace-decor/<id>.json`,
`.data/agent-actions.jsonl`) so migration is a code deletion, not a data
migration. `watch` is implemented over `fs.watch` via the already-shipped
`createFsWatchEventStream` machinery.

### Adapters

**Next.js** — one catch-all route file replaces the generic tree:

```ts
// app/api/[...hudson]/route.ts
import { toNextRouteHandlers } from 'hudsonkit/server/next';
import { host } from '@/app/lib/host';

export const runtime = 'nodejs';
export const { GET, POST, PUT, DELETE } = toNextRouteHandlers(host);
```

`toNextRouteHandlers` is ~20 lines: call `host.fetch(request)`, return the
`Response`, 404 on `undefined`. Because Next route handlers already receive
Fetch `Request`s and return Fetch `Response`s (including streaming bodies and
SSE), no translation layer exists to get wrong.

**Vite** — one plugin replaces the middleware ladder:

```ts
// vite.config.ts
import { hudsonHostPlugin } from 'hudsonkit/server/vite';
plugins: [hudsonHostPlugin(host)]
```

The plugin owns the one genuinely fiddly bit — bridging Node
`IncomingMessage`/`ServerResponse` to Fetch `Request`/`Response` with
streaming intact (SSE/NDJSON/AI data streams). That is precisely the code
Atelier hand-rolled in `readBody`, `sendJson`, `pipeWebResponse`, and its two
bespoke SSE writers; it should exist exactly once, in the kit, tested.

**Bun/Node standalone** — `host.fetch` is already a `Bun.serve`-compatible
fetch handler; a `toNodeListener(host)` helper covers bare `http.createServer`
for anyone else.

### Capability tiers

- **Kit-default (work with zero config):** `workspaceState`,
  `workspaceDecor`, `traces`, `pipes` + `pipeEvents`, `agentActions`,
  `relayUpload`, `localEnvironment` (plaintext `.env.local` default; vault via
  `secretStore`), `apiProxy` + `fetchImage` (default URL policy).
- **Provider-required (routes appear only when configured):** `aiChat`
  (`ai.backend` + `ai.loadToolset`), `imageGeneration`, `speech` + `voices`,
  `services` + `serviceExecute`.
- **Host-specific (out of the host core):** `voiceApiBase` — the shell treats
  it as an opaque base URL and the reference implementation
  (`apps/web/app/api/hudson-voice/**` → native Vox runtime over WS RPC) cannot be made
  turnkey. Hosts that have a runtime set the key themselves; the manifest
  documents the sub-path contract (`/health`, `/v1/voice/devices`,
  `/v1/voice/live` NDJSON stream, `/v1/voice/live/{id}/stop|cancel`) without
  shipping an implementation.

### The `aiChat` handler in particular

The kit handler parses the body Hudson and Atelier already agree on —
`{ messages, toolset, context, mode?, provider?, model?, sessionId? }`
(see `apps/web/app/api/ai/chat/route.ts` and `useHudsonAI`'s `buildHudsonAIRequestBody`
in `packages/web/hudsonkit/src/hooks/useHudsonAI.ts:64-89`) — resolves the
toolset via `ai.loadToolset`, and returns
`ai.backend.streamUI({...})`'s AI-SDK UI-message stream `Response` unchanged.
Both consumers keep their quirks through `ai.handleChat`:

- Hudson wraps the default to intercept `mode: 'cli'` and delegate to its
  `claude`-CLI streamer (`apps/web/app/api/ai/chat/cli.ts`, 363 lines, deliberately
  staying host-side).
- Atelier wraps it to route non-owned toolsets to a remote Hudson origin,
  replacing `proxyToHudsonAi`/`pipeWebResponse` with a one-line
  `fetch(HUDSON_AI_ORIGIN + path, ...)` since the adapter now handles response
  piping.

## Graduating the app-local generic infra

### `intent()` registry → `hudsonkit/server`

Move `apps/web/app/lib/intent.ts` essentially verbatim into
`packages/web/hudsonkit/src/lib/server/intents.ts`, exported from
`hudsonkit/server` as `intent()`, `listIntents()`, `getIntent()`,
`intentMetaToServerIntent()`, `_resetIntentRegistry()`. The kit already owns
the output type (`ServerIntent`, `packages/web/hudsonkit/src/types/intent.ts:46`);
today the app imports that type back from the kit to build it —
the classic inverted dependency. The instrumentation calls
(`appendAgentSpanStart`/`appendAgentSpanEnd`) bind to the graduated
agent-action log (below) via the host's store rather than a hardcoded path.

Catalog composition (`apps/web/app/lib/intent-catalog.ts` + `apps/web/app/api/intents/route.ts`)
stays app-side in v1: it composes `allWorkspaces` and per-app `AppIntent`
declarations, which are host policy. `WorkspaceHostRoutes` gains no `intents`
key in v1 (nothing in the kit's client fetches it — agents and CLI do). If a
kit surface later wants the catalog, adding an `intents` route key + a
`catalog` provider slot is additive.

### Agent-action JSONL writer → `hudsonkit/server`

Move `apps/web/app/lib/agent-log-core.ts` into
`packages/web/hudsonkit/src/lib/server/agentActionLog.ts`, with one structural
change: delete the local `BaseEvent`/`LogEvent`/`SpanEvent` mirrors and type
the writers against `HLogEvent`/`HTraceSpan`/`HObservation` imported from
`../../types/observability` — ending the "match `HObservation` in hudsonkit"
copy noted at `apps/web/app/lib/agent-log-core.ts:20-23`. Public API:

```ts
export function createAgentActionLog(opts?: { store?: HostStore; ns?: string }): {
  appendLog(input: AgentLogInput): Promise<void>;
  appendTaskLog(input: AgentTaskLogInput): Promise<void>;
  appendSpanStart(input: SpanStartInput): Promise<void>;
  appendSpanEnd(input: SpanEndInput): Promise<void>;
  appendObservation(input: unknown): Promise<boolean>;   // validating client-POST path
  read(limit: number): Promise<HObservation[]>;
  makeTraceId(): string;
  logger: HudsonLogger;                                   // scoped milestone logger
};
```

Redaction (`redactAgentActionValue`, the `set_environment_variable.value`
special case), the 16 KB line cap, and the 2 MB GET tail all move as-is — they
are contract, exercised by `apps/web/test/lib/agent-intent.test.ts` today; those tests
move to the kit's vitest suite. The kit's `agentActions` route handler is then
a ~30-line wrapper over `read`/`appendObservation`, replacing
`apps/web/app/api/agent-actions/route.ts`. `apps/web/app/lib/agent-log.ts` (Next `server-only`
wrapper) shrinks to re-exports.

### CLI → `hudsonkit` bin

`scripts/agent-action.ts` becomes `hudsonkit agent-action
<start|log|complete|fail|run> ...` under the package's existing `bin`
(`packages/web/hudsonkit/package.json` → `bin/hudsonkit.mjs`), reading the same
`HUDSON_AGENT_LOG_FILE_OVERRIDE` / `.data/agent-actions.jsonl` defaults. The
Hudson script stays as a two-line shim during migration so `CLAUDE.md`
playbooks keep working, then the docs update. This is what makes the envelope
protocol available to Atelier and any other consumer for free.

## Phased delivery

### Phase 1 — host core + the slice that deletes real code

Scope: `createHudsonHost` core (manifest, dispatcher, `fileHostStore` /
`memoryHostStore`, guard hook), the Next and Vite adapters, and four
capabilities: **`workspaceState`, `workspaceDecor`, `agentActions`
(including the graduated JSONL writer), and `aiChat`**.

Why this slice:

- `workspaceState` + `agentActions` are the two routes the shell pings
  unconditionally on boot (`WorkspaceShell.tsx:639` persist subscription;
  `:675`/`:1081` state loads) — they are the reason Atelier wrote no-op stubs
  rather than accept console 404 storms (`vite.host-services.ts:1066-1076`).
  Shipping them turns Atelier's stubs into working persistence by deletion.
- `workspaceDecor` is the same document-store pattern as `workspaceState`
  (~103 lines in Hudson, `apps/web/app/api/workspace-decor/route.ts`) — near-zero
  marginal cost once the store exists, and it is a visible feature (decor
  survives reloads).
- `aiChat` is the largest single duplication: Hudson's handler + Atelier's
  `handleAtelierAiChat` + proxy plumbing, all sitting on the already-shared
  `@hudsonkit/ai` `Backend` seam. It is also the route with the strictest
  client expectations (AI-SDK data stream), so proving the adapters stream
  correctly in phase 1 de-risks every later streaming route.
- The agent-action writer graduation rides along because the `agentActions`
  handler needs it anyway, and it deletes the type-mirroring hazard.

Deletions on completion:

- Hudson: `apps/web/app/api/workspace-state/route.ts`, `apps/web/app/api/workspace-decor/route.ts`,
  `apps/web/app/api/agent-actions/route.ts`, the generic body of
  `apps/web/app/api/ai/chat/route.ts` (CLI mode remains as an `ai.handleChat`
  wrapper), and most of `apps/web/app/lib/agent-log-core.ts` (re-export shim).
  `apps/web/app/lib/hudsonShellEnvironment.tsx` starts from `...host.routes` and only
  overrides host-specific keys.
- Atelier: the workspace-state/agent-actions/settings stubs, `readBody`/
  `readJson`/`sendJson`, `proxyToHudsonAi`/`pipeWebResponse`, and the
  `/api/ai/chat` branch of the middleware ladder; `HostView.tsx` /
  `AppShellView.tsx` route maps become `host.routes`. `persistSession` can
  turn on.

Exit criteria: both consumers boot their shells against kit handlers; kit
vitest covers store round-trips, redaction, manifest completeness, and an
adapter-level streaming test (SSE + AI data stream through the Vite bridge).

### Phase 2 — the file-backed and policy-backed remainder

`traces`, `pipes` + `pipeEvents` (store `watch` + `createFsWatchEventStream`),
`relayUpload`, `localEnvironment` (with `secretStore` seam; Hudson plugs its
existing vault from `apps/web/app/lib/localEnvironment.ts`), `apiProxy` + `fetchImage`
behind the shared URL policy (this *upgrades* security: today
`apps/web/app/api/fetch-image/route.ts` fetches any URL with no scheme/host check,
while `apps/web/app/api/proxy/route.ts` at least enforces http/https).

### Phase 3 — provider-required surfaces + intents

`imageGeneration`, `speech` + `voices` (Hudson supplies its Vox bridge from
`apps/web/app/lib/tts/voxBridge.ts`; path override keeps `/v1/audio/speech` +
`/v1/voices` serving during transition), `services` + `serviceExecute`
(catalog + execute providers; evaluate afterwards whether Hudson's
`apps/web/app/services/executor.ts` process manager is worth generalizing into an
optional `localProcessExecutor` — Atelier hand-rolled a third copy for its
relay, so the demand signal exists). `intent()` registry graduation and the
`hudsonkit agent-action` CLI land here.

### Phase 4 — declared host-specific

`voiceApiBase` stays a documented contract (sub-paths + NDJSON stream shape in
the manifest docs) with no kit implementation. Revisit only if a second
consumer acquires a voice runtime.

### Migration story

Hudson: introduce `apps/web/app/lib/host.ts` building `createHudsonHost` from existing
provider code (`apps/web/app/api/ai/providers.ts` credentials/models,
`apps/web/app/api/ai/toolsets`, later voxBridge/executor); mount the catch-all at
`apps/web/app/api/[...hudson]/route.ts`; delete migrated route files per phase. Old and
new can coexist per-route throughout — the catch-all only claims paths in the
manifest, and `paths` overrides let any route keep its legacy URL during a
deprecation window. `.data/*` layouts are unchanged, so no data migration.

Atelier: replace the middleware ladder's generic half with
`hudsonHostPlugin(host)`; keep app-specific endpoints (`/api/assets`,
`/api/logo/**`, `/api/host/status`) as ordinary middleware after
`host.fetch` returns `undefined`. Its `hostServices.ts` capability
descriptions ("while the kit's turnkey AI host shape lands") get to come true.

## Route contract table

Shapes are as observed at the kit's client call sites (file:line refs are in
`packages/web/hudsonkit/src`). "Hudson" = `apps/web/app/api/**` implementation;
"Atelier" = `vite.host-services.ts`. Dispositions: **kit-handler** (works with
defaults), **provider-required** (kit handler + host-supplied provider),
**host-specific** (contract documented, no kit implementation).

| Key | Observed contract (client side) | Hudson today | Atelier today | Disposition |
|---|---|---|---|---|
| `agentActions` | GET `?limit=` → `{ events: HObservation[] }` (`useAgentActionLog.ts:24-33`); POST `{ event }` fire-and-forget (`WorkspaceShell.tsx:180-191`) | `apps/web/app/api/agent-actions/route.ts` → `.data/agent-actions.jsonl` (tail 2 MB, cap 16 KB/line) | No-op stub (`{ok:true}`) | **kit-handler** (phase 1; graduated JSONL writer) |
| `aiChat` | POST, AI-SDK UI-message stream via `DefaultChatTransport`; body = messages + `{ toolset, context, mode, provider, model }` (`useHudsonAI.ts:64-89,205,281-295`) | `apps/web/app/api/ai/chat/route.ts` → `@hudsonkit/ai` `createPiAiBackend().streamUI`; CLI mode spawns `claude` (`chat/cli.ts`) | pi-ai for owned toolsets; proxies rest to Hudson origin | **provider-required** (phase 1; `ai.backend` + `loadToolset`; `handleChat` escape hatch) |
| `apiProxy` | POST `{ method, url, headers, body? }` → `{ status, statusText, headers, body, bodyType, size, timing }` (`ApiInspectorProvider.tsx:152-190`) | `apps/web/app/api/proxy/route.ts` (http/https only, 10 MB cap) | Not implemented | **kit-handler** (phase 2; URL policy hook) |
| `fetchImage` | GET `?url=` → `{ dataUrl, sourceUrl, size }` (`WorkspaceShell.tsx:2699-2701`) | `apps/web/app/api/fetch-image/route.ts` — **no scheme/host validation today** | Endpoint exists but route key never wired | **kit-handler** (phase 2; shares URL policy — tightens current behavior) |
| `imageGeneration` | POST `{ prompt, aspectRatio }` → `{ image: { dataUrl } }` / `{ error }` (`WorkspaceShell.tsx:2743-2745`) | `apps/web/app/api/ai/generate-image/route.ts` — `ai` + `@ai-sdk/google` Imagen | pi-ai `generateOneImage` | **provider-required** (phase 3; `generate` fn) |
| `localEnvironment` | GET/POST/DELETE one URL; `{ key, value }` bodies → `{ entries: [{ key, value, source }] }`, `source:'vault'` = masked (`HudsonEnvironmentEditor.tsx:61-139`, `WorkspaceShell.tsx:2657-2677`) | `apps/web/app/api/settings/environment/route.ts` → `.env.local` + secret vault (keychain/file) | GET-only stub `{}` | **kit-handler** (phase 2; plaintext default + `secretStore` seam) |
| `pipes` | GET → `{ pipes: PipeDefinition[] }`; POST `{ pipe }` / `{ action:'delete'\|'update-pushed', pipe:{id} }` (`DataBusContext.tsx:150-258`) | `apps/web/app/api/pipes/route.ts` → `.data/pipes/<id>.json` | Not registered | **kit-handler** (phase 2) |
| `pipeEvents` | `EventSource`, named `invalidate` event triggers refetch; poll fallback on error (`DataBusContext.tsx:166-171`) | `apps/web/app/api/pipes/stream/route.ts` — SSE via `createFsWatchEventStream` | Held-open empty SSE | **kit-handler** (phase 2; store `watch`) |
| `relayUpload` | POST `{ name, data: base64 }` → `{ path }` (`WorkspaceShell.tsx:2806-2807`) | `apps/web/app/api/relay/upload/route.ts` → `/tmp/hudson-uploads/` | Not implemented | **kit-handler** (phase 2; configurable dir) |
| `services` | GET (prefixed `${serviceApiUrl}` from `usePlatform()`) → `Array<{ id, status, ... }>` (`useServiceRegistry.ts:19,76-85`) | `apps/web/app/api/services/route.ts` — catalog + health probes | Hand-rolled, relay only | **provider-required** (phase 3; `catalog` + optional `probeHealth`) |
| `serviceExecute` | POST (same prefix) `{ serviceId, action: check\|install\|start\|stop, triggeredBy }` → `ServiceActionResult`; also `sendBeacon` stop on unload (`useServiceRegistry.ts:129,253`; `HudsonTerminal.tsx:150-152`) | `apps/web/app/api/services/execute/route.ts` → `apps/web/app/services/executor.ts` (spawn/lsof/kill, 333 lines) | Hand-rolled relay spawn/stop | **provider-required** (phase 3; `execute` fn; optional kit local-process executor later) |
| `speech` | POST `{ text, provider, model, voice, rate, format, metadata }` → JSON `{ audio:{ base64, mimeType } }` (or legacy `audioBase64`/`mimeType`) (`WorkspaceAI.tsx:489-490`; `HudsonVoiceSettingsEditor.tsx:230-233`) | `apps/web/app/v1/audio/speech/route.ts` (note: outside `/api`) → Vox bridge | Not implemented | **provider-required** (phase 3; `synthesize` fn; `paths` override preserves `/v1` alias) |
| `traces` | GET → `{ traces: TraceSummary[] }`; GET `?id=` → `{ trace: AgentTrace }`; polled (`TraceProvider.tsx:45-97`) | `apps/web/app/api/traces/route.ts` → `.data/traces/<id>.json` (also POST create/delete) | Not implemented | **kit-handler** (phase 2) |
| `voiceApiBase` | Base URL; client appends `/health`, `/v1/voice/devices[/default]`, `/v1/voice/live` (**NDJSON stream**), `/v1/voice/live/{id}/stop\|cancel` (`lib/hudsonVoiceClient.ts:29-36,168-179`) | `apps/web/app/api/hudson-voice/**` → WS JSON-RPC to native Vox runtime | Not implemented | **host-specific** (contract documented; no kit implementation) |
| `voices` | GET `?provider=&model=` → `{ providers?, models?, voices?: [{ id, label, previewText }] }` (`HudsonVoiceSettingsEditor.tsx:112-120`) | `apps/web/app/v1/voices/route.ts` → Vox voice catalog | Not implemented | **provider-required** (phase 3; `listVoices`, defaults ship client-side already) |
| `workspaceDecor` | GET `?id=` → `DecorState` (validated, `updatedAt` compared); POST `{ id, state }` replace (`WorkspaceDecorContext.tsx:197-276`) | `apps/web/app/api/workspace-decor/route.ts` → `.data/workspace-decor/<id>.json` | Not implemented | **kit-handler** (phase 1) |
| `workspaceState` | GET `?id=` → `{ disabledApps?, visibleApps?, ... }`; POST `{ id, state }` **shallow merge** (two independent save paths depend on merge semantics) (`WorkspaceShell.tsx:675-700,1081-1109`) | `apps/web/app/api/workspace-state/route.ts` → `.data/workspace-state/<id>.json`, merge + `updatedAt` | No-op stub | **kit-handler** (phase 1; merge semantics are contract) |

Non-route environment members: `renderTerminal` and `useHudsonAISettingsEntry`
(`WorkspaceShell.tsx:569-575`) are client-side app bindings, correctly outside
this proposal.

## Open questions

1. **`speech`/`voices` canonical paths.** Hudson serves them at `/v1/audio/speech`
   and `/v1/voices` (outside `/api`), presumably for OpenAI-style path
   compatibility with external clients. Kit default should be
   `${basePath}/tts/speech` + `${basePath}/tts/voices` with Hudson using
   `paths` overrides — but should the kit bless the `/v1` aliases as a
   documented convention instead? A Next catch-all under `apps/web/app/api/` cannot
   serve `/v1/*`, so keeping them requires either a second mount or the
   override story.
2. **URL policy default for `fetchImage`/`apiProxy`.** Proposed default denies
   non-http(s) and private/loopback ranges, which *changes behavior*:
   `apps/web/app/api/fetch-image` currently fetches anything, and localhost proxying is
   a real dev workflow for the API Inspector. Ship permissive-in-dev /
   strict-otherwise, or require explicit `allowUrl` to loosen? Needs a call.
3. **`localEnvironment` secrets.** Does the kit ship Hudson's vault behavior
   (secret-shaped keys diverted to keychain/file vault,
   `apps/web/app/lib/localEnvironment.ts` + `apps/web/app/lib/localSecretVault.ts`) or only the
   `secretStore` seam with a plaintext `.env.local` default? Shipping the
   vault is more turnkey but drags keychain integration into the kit.
4. **Generic local-process service executor.** Three copies exist (Hudson's
   `apps/web/app/services/executor.ts`, Atelier's relay manager, and whatever the next
   consumer writes). Spawning/killing processes from a web-adjacent handler is
   the most security-sensitive capability in the set — graduate it, or keep
   `execute` forever host-supplied?
5. **`workspaceState` merge semantics.** The shallow-merge POST is load-bearing
   (disabled-apps and visible-apps save independently) but undocumented; the
   kit handler codifies it. Is shallow-merge-with-`updatedAt` the contract we
   want, or should v1 introduce per-field PATCH before freezing it?
6. **Intent catalog exposure.** Should `WorkspaceHostRoutes` eventually gain an
   `intents` key (kit UI for browsing/executing server intents), or does the
   catalog stay an agent/CLI-only surface reached outside the shell contract?
7. **Stale doc pointer.** `CLAUDE.md` cites
   `docs/HUD-007-agent-intent-instrumentation.md`, which does not exist (the
   HUD-007 label is used by `docs/specs/hud-007-app-controls.md` and the native
   workflow kit note). When the intent/agent-log graduation lands, its design
   doc should claim a fresh HUD number and `CLAUDE.md` should be corrected.
8. **Observability wiring.** Should kit-default handlers auto-emit
   `HObservation` spans through the graduated writer (server-side twin of the
   shell's `HObservabilityDefault` persistence), or is that noise until
   HudLogger grows server-trace views?
