# HUD-008 — App Backends Convention

**Status**: Implemented (helpers + types; route migrations pending)
**Owner**: TBD
**Date**: 2026-05-19

> Implementation landed in `packages/web/hudsonkit/src/`: `HudsonApp.backend`
> type, `createAppApiClient` + `useAppApiStatus` on the root `hudsonkit`
> entrypoint, and `appStorage` + `createFsWatchEventStream` on the new
> `hudsonkit/server` subpath. The Logo Designer route migration described
> below is intentionally a separate PR.

## Summary

Hudson apps already behave as if each app owns a backend namespace and a local storage namespace:

- HTTP routes live under `/api/{app-id}/...`.
- User-writable files live under `~/hudson/{storage-id}/.data/...`.
- Bundled seeds live under `{project}/.data/{storage-id}/...`.
- File-backed routes often seed on first read.
- Streaming endpoints use a `/stream` suffix and Server-Sent Events (SSE).

That convention is currently implicit. HUD-008 makes it explicit with a small, additive hudsonkit surface:

1. `HudsonApp.backend` — a manifest field describing the app's backend namespace and storage namespace.
2. `createAppApiClient(app)` — a browser-safe HTTP/SSE client that defaults to same-origin `/api/{id}` routes and optionally supports sibling-service health checks.
3. `appStorage(appId)` — a server-only helper exported from `hudsonkit/server` for the `~/hudson/{id}/.data` + `{project}/.data/{id}` pattern.
4. `createFsWatchEventStream(...)` — a generalized server-only SSE helper, also exported from `hudsonkit/server`.

The goal is not a framework rewrite. It is to make “give this app a backend” a trivial, local decision instead of a copy/paste exercise or a reason to create a new sibling service.

## Problem statement

Today, a new Hudson app with server needs has to discover conventions by reading existing routes. That causes three failure modes:

1. **Copy/paste drift** — each route hand-rolls path joins, seed checks, filesystem guards, and streaming headers.
2. **Unnecessary sibling services** — a backend need can push an app toward a separate port/process even when a Next route would suffice.
3. **Cross-app coupling** — an app may route work through another app or service because that path already exists. Logo's animation affordance currently couples to Preframe via data-bus instead of owning `/api/logo/animate/...`.

HUD-008 formalizes the existing convention without breaking hand-rolled routes.

## Existing evidence

### Logo Designer

Logo is the canonical migration reference because it already has a complete app-local backend:

| Route | Role |
| --- | --- |
| `apps/web/app/api/logo/compile/route.ts` | LLM-escape normalization + esbuild validation |
| `apps/web/app/api/logo/template/route.ts` | CRUD over template files |
| `apps/web/app/api/logo/template/stream/route.ts` | SSE filesystem invalidation |
| `apps/web/app/api/logo/export/route.ts` | sharp + archiver PNG/ZIP export |
| `apps/web/app/api/logo/export/icon-composer/route.ts` | macOS Icon Composer integration |

The template route shows the repeated storage plumbing HUD-008 should remove: direct `fs/promises`, `fs`, and `path` imports at `apps/web/app/api/logo/template/route.ts:1-5`; user and seed directories at `apps/web/app/api/logo/template/route.ts:15-22`; seed-on-first-read at `apps/web/app/api/logo/template/route.ts:115-146`; and direct user path reads/writes throughout `apps/web/app/api/logo/template/route.ts:148-298`.

The stream route repeats a smaller copy of that setup: Node filesystem imports and project paths at `apps/web/app/api/logo/template/stream/route.ts:1-12`, seed setup at `apps/web/app/api/logo/template/stream/route.ts:14-31`, then an SSE helper call at `apps/web/app/api/logo/template/stream/route.ts:34-40`.

### Existing SSE helper

`apps/web/app/lib/server/createFsWatchEventStream.ts` already has the right shape for v1: it watches one or more paths, emits an `invalidate` event, emits `warning` events for watch failures, and sends comment pings (`: ping ...`) to keep the connection alive. Its current public surface is visible at `apps/web/app/lib/server/createFsWatchEventStream.ts:3-9`, with headers and event encoding at `apps/web/app/lib/server/createFsWatchEventStream.ts:11-20` and stream behavior at `apps/web/app/lib/server/createFsWatchEventStream.ts:22-92`.

### Preframe safe-fetch pattern

Preframe's catalog client is the model for sibling-service resilience. It resolves a base URL once, catches fetch failures into a synthetic `Response` with `status: 0`, and exposes a health probe (`/api/health`) with timeout handling at `/Users/arach/dev/preframe/catalog/lib/api-client.ts:13-55`. Its provider keeps `serviceStatus: 'unknown' | 'checking' | 'online' | 'offline'`, retry state, and backoff polling at `/Users/arach/dev/preframe/catalog/Provider.tsx:25-28` and `/Users/arach/dev/preframe/catalog/Provider.tsx:277-340`.

HUD-008 should make that pattern reusable, while keeping same-origin Hudson routes simple.

### hudsonkit extension points

`HudsonApp` currently has identity, mode, slots, hooks, settings, ports, exports, and services, but no backend declaration. The field should slot near other static capability declarations in `packages/web/hudsonkit/src/types/app.ts`, after `services?: ServiceDependency[]` or near `manifest?: AppManifest`.

`hudsonkit` already uses subpath exports (`hudsonkit/chrome`, `hudsonkit/controls`, etc.) via `packages/web/hudsonkit/tsup.config.ts` and `packages/web/hudsonkit/package.json`. `hudsonkit/server` should join this family, but must be built separately from the client-bannered entrypoints.

## Design goals

- **Make app-local backends obvious**: default to `/api/{app.id}` and `~/hudson/{app.id}/.data`.
- **Keep hudsonkit optional**: existing `fetch('/api/shaper/save')` calls continue working.
- **Avoid browser bundle leaks**: anything importing `node:*`, `fs`, `path`, `archiver`, `sharp`, or similar server-only modules lives under `hudsonkit/server` only.
- **Support same-origin first**: apps embedded in Hudson should not need a health probe for normal `/api/{id}` routes.
- **Support sibling services intentionally**: the same client can point at `http://localhost:3100` and enable `healthCheck` for graceful degradation.
- **Keep the abstraction thin**: plain HTTP routes, plain JSON, plain SSE. No RPC layer.

## Proposed API

### `HudsonApp.backend`

Add an optional `backend` field to `HudsonApp`:

```ts
export interface HudsonAppBackend {
  /** HTTP API base. Defaults to `/api/${app.id}`. May be absolute for a sibling service. */
  apiBase?: string;

  /**
   * Storage namespace under `~/hudson/{dataDir}/.data` and `{project}/.data/{dataDir}`.
   * Defaults to `app.id`.
   *
   * Namespace-only: this is a single relative directory name, not an absolute path.
   * Use it only for genuine off-default storage namespaces, not to grandfather legacy paths.
   */
  dataDir?: string;

  /**
   * Optional health endpoint used by createAppApiClient.
   * Omit for same-origin Hudson routes. Provide e.g. `/api/health` for sibling services.
   */
  healthCheck?: string;

  /** Optional request timeout for health probes. Defaults to 2_000ms. */
  healthTimeoutMs?: number;
}

export interface HudsonApp {
  id: string;
  name: string;
  // ...existing fields...
  backend?: HudsonAppBackend;
}
```

Default derivation:

| Field | Default for `app.id = 'logo'` |
| --- | --- |
| `backend.apiBase` | `/api/logo` |
| `backend.dataDir` | `logo` |
| `backend.healthCheck` | omitted / disabled |
| `backend.healthTimeoutMs` | `2_000` when `healthCheck` is present |

Recommended Logo declaration after HUD-008 adoption:

```ts
export const logoApp: HudsonApp = {
  id: 'logo',
  name: 'Logo',
  backend: {}, // documents that the app accepts the app.id-derived defaults
  // ...
};
```

`backend.dataDir` is a storage namespace, not a route namespace and not a filesystem path. It is relative to `~/hudson/` for user data and `{project}/.data/` for seeds. It may differ from `app.id` only for genuine off-default storage needs; do not use it to preserve grandfathered paths. If a legacy path exists, migrate it to the app-id-derived namespace.

### `createAppApiClient(app)`

Export from the browser-safe `hudsonkit` entrypoint:

```ts
type AppApiServiceStatus = 'unknown' | 'checking' | 'online' | 'offline';

type AppApiStreamEvent = 'open' | 'invalidate' | 'warning' | 'error' | string;

interface AppApiStream {
  source: EventSource;
  close(): void;
  addEventListener<T = unknown>(
    event: AppApiStreamEvent,
    listener: (event: MessageEvent<T>) => void,
  ): () => void;
}

interface AppApiStatusStore {
  get(): AppApiServiceStatus;
  subscribe(listener: (status: AppApiServiceStatus) => void): () => void;
}

interface AppApiClient {
  readonly baseUrl: string;
  readonly serviceStatus: AppApiStatusStore;

  fetch(path: string, init?: RequestInit): Promise<Response>;
  get(path: string, init?: RequestInit): Promise<Response>;
  post(path: string, init?: RequestInit): Promise<Response>;
  patch(path: string, init?: RequestInit): Promise<Response>;
  delete(path: string, init?: RequestInit): Promise<Response>;

  /** Open an EventSource against a resolved API path. */
  stream(path: string): AppApiStream;

  /** Manual health retry. No-op unless `backend.healthCheck` is configured. */
  retry(): void;

  /** One-shot probe. Returns true for same-origin/no-healthCheck clients. */
  checkHealth(): Promise<boolean>;
}

function createAppApiClient(app: Pick<HudsonApp, 'id' | 'backend'>): AppApiClient;

function useAppApiStatus(client: AppApiClient): {
  serviceStatus: AppApiServiceStatus;
  retry(): void;
};
```

Path resolution rules:

- `createAppApiClient({ id: 'logo' })` resolves `baseUrl` to `/api/logo`.
- `client.get('/template')` and `client.get('template')` both fetch `/api/logo/template`.
- Query strings are preserved: `client.get('template?t=123')` fetches `/api/logo/template?t=123`.
- Absolute `backend.apiBase` values are allowed for sibling services, e.g. `http://localhost:3100`.
- `backend.healthCheck` is resolved relative to `apiBase` unless it is absolute.

Safe fetch behavior:

- `fetch/get/post/patch/delete` never throw for network failure. They return `new Response(null, { status: 0, statusText: 'Network unavailable' })`, matching Preframe's current catalog client.
- HTTP error statuses are not swallowed. A 404/500 response returns as-is.
- Caller code remains responsible for `r.ok ? await r.json() : ...`.

Health behavior:

- **Same-origin default**: if `backend.healthCheck` is omitted, the client treats the backend as `online` and does not poll. `checkHealth()` resolves `true`; `retry()` is a no-op.
- **Opt-in health probe**: if `backend.healthCheck` is set, the client starts at `unknown`, probes with timeout, transitions through `checking`, `online`, or `offline`, and retries offline probes with Preframe's backoff shape: `5s`, `10s`, `20s`, `30s`, then capped at `30s`.
- **Manual retry**: `retry()` clears backoff state and probes immediately.
- **React integration**: `useAppApiStatus(client)` is part of v1. It subscribes to `client.serviceStatus` with `useSyncExternalStore` and returns `{ serviceStatus, retry }`. Same-origin/no-healthCheck clients return `online` and a no-op retry, so UI code can be uniform across local routes and sibling services.

Example same-origin app usage:

```ts
const logoApi = createAppApiClient(logoApp);
const response = await logoApi.post('template', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const templates = logoApi.stream('template/stream');
templates.addEventListener('invalidate', () => refreshTemplates());
```

Example sibling-service usage:

```ts
const catalogApi = createAppApiClient({
  id: 'catalog',
  backend: {
    apiBase: 'http://localhost:3100',
    healthCheck: '/api/health',
  },
});
```

Example opt-in remote backend status UI:

```tsx
const logoVideoApi = createAppApiClient({
  id: 'logo-video-renderer',
  backend: {
    apiBase: 'http://localhost:3700',
    healthCheck: '/api/health',
  },
});

function RenderToVideoButton() {
  const { serviceStatus, retry } = useAppApiStatus(logoVideoApi);
  const offline = serviceStatus === 'offline';
  const checking = serviceStatus === 'checking' || serviceStatus === 'unknown';

  return (
    <div>
      <button disabled={offline || checking} onClick={() => renderToVideo()}>
        {offline ? 'Renderer offline' : checking ? 'Checking renderer…' : 'Render to video'}
      </button>
      {offline ? <button onClick={retry}>Retry renderer</button> : null}
    </div>
  );
}
```

### `hudsonkit/server`

Create a server-only subpath export. It should contain all helpers that import Node modules:

```ts
import { appStorage, createFsWatchEventStream } from 'hudsonkit/server';
```

#### `appStorage(appId)`

Recommended public shape:

```ts
interface AppStoragePaths {
  user: string;
  seed: string;
}

interface AppStorageSeedOptions {
  /** Subdirectory inside userDir/seedDir. Defaults to `.`. */
  rel?: string;
  /** Filename predicate. Defaults to all directory entries. */
  match?: (name: string) => boolean;
  /** Copy bundled seed files that are missing from the user dir before empty check. */
  copyMissing?: boolean;
  /** Called if the user dir still has no matching files after seed copy. */
  fallback?: (ctx: { userDir: string; seedDir: string }) => Promise<void> | void;
}

interface AppStorage {
  readonly appId: string;
  readonly storageId: string;
  readonly userDir: string;
  readonly seedDir: string;

  /** Ensure the user directory, or a child path, exists. Returns the absolute path. */
  ensure(rel?: string): Promise<string>;

  /** Resolve a path under both user and seed roots. Rejects traversal outside the roots. */
  paths(rel?: string): AppStoragePaths;

  /** Seed user storage from bundled data and/or fallback generation. */
  seedIfEmpty(options?: AppStorageSeedOptions): Promise<void>;
}

function appStorage(appId: string, options?: {
  /** Namespace override relative to `~/hudson/` and `{project}/.data/`. Defaults to appId. */
  dataDir?: string;
  /** Defaults to process.env.HOME. */
  homeDir?: string;
  /** Defaults to process.cwd(). */
  projectDir?: string;
}): AppStorage;
```

Default paths:

```txt
storageId = dataDir ?? appId
userDir = ${HOME}/hudson/${storageId}/.data
seedDir = ${process.cwd()}/.data/${storageId}
```

`dataDir` is namespace-only here too: no absolute paths, no `..`, and no path separators. The default is unambiguously sourced from `appId`.

Storage rules:

- `paths(rel)` must normalize and reject `..` traversal that escapes `userDir` or `seedDir`.
- `ensure(rel)` creates only user-storage directories, never seed directories.
- `seedIfEmpty()` creates the target user directory first.
- If `copyMissing` is true, missing matching files from `seedDir` are copied into the user directory.
- After copy, if the user directory still has no matching files, `fallback` may synthesize app-owned defaults.
- The helper should not expose JSON-specific or file-type-specific methods in v1. Apps keep domain parsing local.

`appStorage` belongs in `hudsonkit/server`, not a new `@hudsonkit/storage` package, because:

- The helper is tiny and coupled to Hudson's app manifest convention.
- Existing hudsonkit subpaths already establish a discoverable API family.
- A new package would create dependency/version overhead before there is evidence of an independent storage abstraction.

If a future non-Next server runtime needs this helper without hudsonkit's web dependency graph, revisit extraction then.

### Streaming endpoint convention

HTTP route convention:

```txt
/api/{app-id}/{operation}/stream
```

Examples:

```txt
/api/logo/template/stream
/api/openscout/stream
/api/pipes/stream
```

SSE event shape:

```txt
: connected 1779230000000

event: invalidate
data: {"ts":1779230000123}

event: warning
data: {"path":"/path/to/watch","message":"..."}

: ping 1779230025000
```

Required headers:

```txt
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Server helper:

```ts
interface CreateFsWatchEventStreamOptions {
  request: Request;
  watchPaths: string[];
  ensure?: () => Promise<void> | void;
  debounceMs?: number; // default 120
  pingMs?: number;     // default 25_000
  invalidateEvent?: string; // default 'invalidate'
  initialComment?: string;  // default `connected ${Date.now()}`
}

function createFsWatchEventStream(options: CreateFsWatchEventStreamOptions): Promise<Response>;
```

Route requirements:

- Export `runtime = 'nodejs'` for filesystem-backed streams.
- Export `dynamic = 'force-dynamic'` for streams in Next routes.
- Call `ensure` before watching.
- Watch failures should not terminate the stream; emit `warning` and keep pings alive.
- Client code should treat `invalidate` as a hint to refetch, not as data payload.

## Build and export strategy

`hudsonkit/server` must be impossible to accidentally pull into the browser bundle.

Implementation requirements for the future PR:

1. Add `src/server.ts` that exports only server helpers.
2. Build `server` in a separate `tsup` config block with:
   - no `'use client'` banner,
   - `splitting: false`,
   - `treeshake: true`,
   - `platform: 'node'` or equivalent Node-safe externalization,
   - Node built-ins and heavy server dependencies externalized.
3. Add the export map:

   ```json
   "./server": {
     "types": "./dist/server.d.ts",
     "import": "./dist/server.js",
     "default": "./dist/server.js"
   }
   ```

4. Add or preserve package-level tree-shaking metadata while keeping CSS imports side-effectful:

   ```json
   "sideEffects": ["*.css"]
   ```

   Do not use bare `false` unless CSS has a separate proven preservation path. Hudsonkit exports `./styles`, and Tailwind/PostCSS CSS imports must not be tree-shaken away. The `server` subpath itself should remain side-effect free; the package-level exception exists only for CSS assets.

5. Keep the root `hudsonkit` entry browser-safe. It may export `createAppApiClient`, `useAppApiStatus`, and backend types, but not `appStorage` or `createFsWatchEventStream`.
6. Any file importing `node:fs`, `node:fs/promises`, `node:path`, `node:os`, `child_process`, `archiver`, `sharp`, or similar server-only dependencies must be reachable only from `hudsonkit/server` or app route files.
7. Avoid sharing chunks between client-bannered entrypoints and `server`. The existing `theme-script` config is the closest precedent for a no-client-banner subpath; `server` needs the same isolation plus Node externalization.

## Logo migration plan

Logo is the worked example, but migration is a separate PR. HUD-008 should first land the spec and helpers, then migrate routes incrementally.

### Phase 0 — rename `logo-designer` → `logo`

Pre-HUD-008, the app id was `logo-designer` but its route namespace (`/api/logo/...`) and display name ("Logo") already used the shorter form. Rather than reshape routes and storage to match the longer id, HUD-008 renames the app id to `logo` and lets the existing `/api/logo` namespace stay. This makes the app-id-derived defaults align with the existing routes for free, and removes the only reason the spec had previously prescribed a route move.

### Phase 1 — declare backend and migrate legacy storage

After the rename, Logo's app id is `logo`, so HUD-008 adoption aligns storage to that id. Do not use `backend.dataDir: 'logos'` to preserve the legacy path.

```ts
backend: {}
```

Default derivation gives Logo:

```txt
apiBase = /api/logo
userDir = ~/hudson/logo/.data
seedDir = {project}/.data/logo
```

Prescribe a one-time idempotent storage-namespace migration from the grandfathered path:

```txt
~/hudson/logos/.data/  →  ~/hudson/logo/.data/
```

`appStorage('logo', { migrateFromDataDir: 'logos' }).ensure()` performs this rename on first run before creating the default directory. It is safe to call repeatedly: if the new directory already exists, do nothing; if only the old directory exists, rename it; if both exist, leave both untouched and log a warning for manual cleanup rather than merging automatically. The user's hand-curated files in `~/hudson/logos/*.svg|.js|.md` are untouched — only the `.data/` namespace migrates.

Because the app id matches the route namespace, no route move is needed. `/api/logo/...` is the app-id-derived default.

### Phase 2 — replace client-side bespoke paths

Current Logo provider code constructs direct stream URLs such as `/api/logo/template/stream`. Replace local API constants with:

```ts
const api = createAppApiClient(logoApp);
const stream = api.stream('template/stream'); // /api/logo/template/stream
```

After the `logo-designer` → `logo` rename, the app-id-derived `/api/logo/...` namespace already matches the existing route files — no compatibility wrappers needed.

### Phase 3 — reduce storage routes

Illustrative shape for `apps/web/app/api/logo/template/route.ts` only. This is not an implementation patch.

Before, the route owns storage roots and seed plumbing inline:

```ts
import { readFile, writeFile, readdir, unlink, mkdir, stat, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const HOME = process.env.HOME || '';
const TEMPLATES_DIR = join(HOME, 'hudson', 'logos', '.data', 'logo-templates');
const SEED_DIR = join(process.cwd(), '.data', 'logo-templates');

let seeded = false;
async function ensureDir() {
  await mkdir(TEMPLATES_DIR, { recursive: true });
  // copy bundled seed files, synthesize built-ins if empty, etc.
}
```

After HUD-008 helpers, route-level code should collapse to storage intent:

```ts
import { appStorage } from 'hudsonkit/server';

const storage = appStorage('logo', { migrateFromDataDir: 'logos' });
const templates = storage.paths('logo-templates');

async function ensureTemplates() {
  await storage.seedIfEmpty({
    rel: 'logo-templates',
    match: (file) => file.endsWith('.js'),
    copyMissing: true,
    fallback: async ({ userDir }) => {
      await Promise.all(
        Object.entries(builtinRenderBodies).map(([id, def]) =>
          writeFile(join(userDir, `${id}.js`), builtInAsFile(id, def), 'utf-8'),
        ),
      );
    },
  });
}
```

The domain logic remains in the route: parsing `meta`, protecting built-in IDs, compiling file content, and returning `NextResponse`. The helper only removes directory derivation, traversal safety, mkdir, seed copy, and “empty fallback” ceremony.

### Phase 4 — move stream helper import

Before:

```ts
import { createFsWatchEventStream } from '../../../../lib/server/createFsWatchEventStream';
```

After:

```ts
import { appStorage, createFsWatchEventStream } from 'hudsonkit/server';
```

Illustrative stream route:

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = appStorage('logo', { migrateFromDataDir: 'logos' });
const templatePaths = storage.paths('logo-templates');

export async function GET(request: Request) {
  return createFsWatchEventStream({
    request,
    watchPaths: [templatePaths.user],
    ensure: () => storage.seedIfEmpty({
      rel: 'logo-templates',
      match: (file) => file.endsWith('.js'),
      copyMissing: true,
    }),
  });
}
```

## Adoption story for existing apps

HUD-008 is compatible with apps that are not yet hudsonkit-aware:

- Shaper can keep `fetch('/api/shaper/save')`.
- Theme Designer can keep `fetch('/api/theme-designer')`.
- OpenScout can keep `/api/openscout` and `/api/openscout/stream`.
- Workspace state/decor routes can remain project-level routes unless/until they become app-owned.
- Existing route directories do not move just because HUD-008 exists; moves happen only when an app opts in. Logo did not need a route move because the `logo-designer` → `logo` id rename aligned the app id with the existing `/api/logo/...` namespace.

Adopting `HudsonApp.backend` only documents and centralizes defaults. Adopting `createAppApiClient` only replaces local URL construction and network-safe fetch wrappers. Adopting `appStorage` only replaces server route boilerplate.

Recommended adoption order:

1. New apps: declare `backend` if they add any `/api/{id}` route.
2. Existing apps with direct HTTP calls: use `createAppApiClient` when next editing the provider/client code.
3. Existing storage routes: use `appStorage` when next touching filesystem logic.
4. Existing stream routes: import `createFsWatchEventStream` from `hudsonkit/server` after the subpath exists.

## Non-goals for v1

- Job queue or durable async task framework.
- Typed RPC layer.
- Cross-app calls or service composition primitives.
- Auth scopes or authorization model.
- Multi-tenancy or instance-specific storage.
- Cross-app data sharing; the data-bus port system stays as-is.
- Deciding whether Preframe should be embedded into Hudson.
- Replacing app-domain route code with generic CRUD helpers.
- Migrating existing routes in the same PR as the spec/helper introduction.

## Resolved decisions

1. **Logo storage aligns to app id, and the app id changes**: pre-HUD-008 the app id was `logo-designer` but its routes lived at `/api/logo/...`. HUD-008 renames the app id to `logo` so routes, storage, and id all derive from the same string. Storage namespace migrates `~/hudson/logos/.data/` → `~/hudson/logo/.data/`; no route move is needed.
2. **`backend.dataDir` is namespace-only**: it is a relative storage namespace under `~/hudson/` and `{project}/.data/`, not a full path. No absolute-path overrides in v1.
3. **`useAppApiStatus` ships in v1**: consumers get `{ serviceStatus, retry }` from an `AppApiClient` and can gate remote-backend controls without reimplementing the Preframe status pattern.
4. **Keep `seedIfEmpty({ copyMissing })`**: the name is acceptable for v1. `copyMissing` specifically means “copy seed files that do not already exist in the user directory.”
5. **CSS remains side-effectful**: package metadata should use `"sideEffects": ["*.css"]`, not bare `false`, so Tailwind/PostCSS CSS exports are preserved while JS remains tree-shakeable.
