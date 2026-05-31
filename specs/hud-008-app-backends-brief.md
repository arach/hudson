# HUD-008 — Per-app backend convention brief

## What

Apps in Hudson already de-facto own their `/api/{id}/...` namespace and their `~/hudson/{id}/.data/` storage directory. This is held together by collective discipline, not by hudsonkit. New apps either (a) figure the convention out from reading existing code, (b) hand-roll their own paths with copy/paste drift, or (c) couple to another app via the data-bus port system (e.g., Logo Designer → Preframe today).

HUD-008 promotes the convention into hudsonkit:

1. **`HudsonApp.backend` manifest field** — apps declare their backend namespace (or accept defaults).
2. **`createAppApiClient(app)` browser-side factory** — typed client per app, with the safe-fetch + health-probe pattern we just landed in `preframe/catalog/lib/api-client.ts` baked in.
3. **`appStorage(appId)` server-side helper** — exported from `hudsonkit/server` (subpath, server-only). Wraps the `~/hudson/{id}/.data/` + seed-if-empty dance every storage-touching route currently reimplements.
4. **A streaming-endpoint convention** — `/api/{id}/{op}/stream` SSE, optionally backed by a generalized version of `app/lib/server/createFsWatchEventStream.ts`.

The goal: an app that needs a backend gets one trivially, without spinning up a new service and without coupling to another app's port system.

## What exists today

**Apps already shipping their own backend namespace** (informal):

```
/api/logo/compile                       LLM-escape normalization + esbuild
/api/logo/template                      CRUD over ~/hudson/logos/.data/logo-templates/*.js
/api/logo/template/stream               SSE watch on the templates dir
/api/logo/export                        sharp + archiver → PNG/ZIP
/api/logo/export/icon-composer          icon composer export
/api/shaper/save
/api/theme-designer
/api/vox/integration
/api/openscout, /api/openscout/stream
/api/workspace-decor
/api/workspace-state
```

**Conventions in the wild:**

- Routes go under `/api/{app-id}/...`.
- User-writable data lives in `~/hudson/{app}/.data/...`; bundled seeds live in `{project}/.data/{app}/...`.
- Streaming endpoints get a `/stream` suffix and emit SSE.
- Filesystem-touching routes seed-if-missing on first read.

None of this is exposed by hudsonkit, so adoption is by-osmosis.

## Why now

Two concrete pressure points:

1. **Logo Designer's "Animate" button** currently dispatches via `dataBus.pushDirect('logo-designer', 'animation-job', 'preframe-catalog', 'logo-animation-job')` — a cross-app coupling that requires Preframe to be running for an in-app affordance to work. The fix is to package Logo drawing nodes and SVG nodes as structured animatable targets (see HUD-009). For the common in-browser case there's no backend at all; for any future server-touching cases (mp4 compile, AI-authored animation programs, render farm), Logo should reach its own backend under `/api/logo/animate/...`. The convention needs to be ready and obvious.
2. **The Preframe sibling-service experience** (catalog at `localhost:3100`, Hudson at `:3500`) creates fragility — port collisions, separate dev servers, graceful-degradation work, fetch-failure error surfaces. We just hardened the catalog with a checking/online/offline state machine + safe fetch wrapper. The same primitive should ship from hudsonkit so the next app that *could* be a sibling service is instead an `/api/{id}/...` namespace by default. Sibling services become an explicit escalation, not the path of least resistance.

## Where to harvest

- **`/Users/arach/dev/hudson/app/api/logo/*/route.ts`** — five routes, two filesystem-touching with seed logic, one streaming via SSE. The canonical migration reference; the spec should treat these as the worked example. After HUD-008 lands they should be re-expressible as `~30 lines using appStorage(...)` instead of the current ~60 lines of repeated path-joining + seed plumbing.
- **`/Users/arach/dev/hudson/app/lib/server/createFsWatchEventStream.ts`** — existing SSE helper. Should it move into `hudsonkit/server` (yes), and what's its public shape?
- **`/Users/arach/dev/preframe/catalog/lib/api-client.ts`** + **`/Users/arach/dev/preframe/catalog/Provider.tsx`** — the safe-fetch + `checkHealth()` + `serviceStatus` state machine + backoff polling we just landed (2026-05-19). `createAppApiClient` should subsume this; for same-origin in-Hudson routes the health probe is unnecessary (Next.js always responds), but the contract should still expose `serviceStatus` so apps that *do* reach a sibling service via the same factory get graceful degradation for free.
- **`/Users/arach/dev/hudson/packages/web/hudsonkit/src/types/app.ts`** — `HudsonApp` interface. Where the `backend` field slots in.
- **`/Users/arach/dev/hudson/packages/web/hudsonkit/tsup.config.ts`** + **package.json `exports` map** — establishes the subpath export pattern (`hudsonkit/chrome`, `hudsonkit/controls`, etc.). A new `hudsonkit/server` subpath joins this family; it MUST NOT leak Node-only modules (`node:fs`, `node:path`) into the browser bundle.

## Hard dependencies

None. HUD-008 is a documentation + small-helpers PR. It unblocks:

- **HUD-009** (drawing documents and animatable targets) — Logo extracts its drawing component layer first, then packages drawing nodes and marked SVG nodes as structured animation targets for Preframe. HUD-009 wants the HUD-008 conventions in place so any backend escalation does not bake in another bespoke api-client.
- **Generalized Preframe decoupling** — if/when Preframe's catalog gets ported into Hudson, it lands as `/api/catalog/*` with `appStorage('catalog')`. The current sibling-service stays optional.

## What you ship

A spec at `specs/hud-008-app-backends.md`. **Not implementation code.** Cover at minimum:

- The `HudsonApp.backend` shape (`apiBase?: string`, `dataDir?: string`, defaults derived from `app.id`).
- `createAppApiClient(app)` signature: `get/post/patch/delete/fetch` mirroring the existing catalog api-client, plus `stream(path)` for SSE, plus `serviceStatus` + `retry()` accessors. Specify how the health-probe is opted-in (same-origin routes don't need it; explicit `healthCheck: '/path'` enables it).
- `appStorage(appId)` shape: `userDir`, `seedDir`, `ensure()`, `seedIfEmpty()`, `paths(rel)` resolver. Whether it lives in `hudsonkit/server` or a new `@hudsonkit/storage` package (recommend the former unless there's a server-runtime concern).
- Subpath export strategy. `hudsonkit/server` joins `hudsonkit/chrome`, `hudsonkit/controls`, etc. Document the rule that *anything* importing `node:*` lives under `hudsonkit/server` and never gets pulled into a client bundle.
- Streaming-endpoint convention: `/api/{id}/{op}/stream`, SSE shape, helper signature.
- Migration plan: Logo Designer is the canonical reference. Show the diff shape for one of the five routes (e.g., `template/route.ts`) before/after. Note that this is illustrative — actual migration is a separate PR.
- Adoption story for *not yet hudsonkit-aware* apps (Shaper, Theme Designer, etc.): convention stays compatible; their hand-rolled `fetch('/api/shaper/...')` calls continue working.
- Non-goals for v1: job queue, RPC layer, auth scopes, multi-tenancy, cross-app data sharing (data-bus stays as-is), service composition (Preframe stays a peer service, not embedded).
- Anything you can't decide cleanly — flag for human review.

## Constraints

- Web: bun, React 19, Next.js 16, Tailwind v4. No purple in designs (cyan/blue/teal/emerald).
- `hudsonkit` must remain optional. Apps that don't adopt `createAppApiClient` keep working; the manifest field is additive.
- Server-only code lives under a clearly-marked subpath. **No imports that pull `node:fs`, `node:path`, or `archiver`-style deps into the browser bundle.** This is the one hard correctness constraint.
- `hudsonkit/server` must be marked `"sideEffects": false` and tree-shake cleanly.
- Commits: gitmoji, no co-author footers.

## Out of scope (v1)

- Job queue / durable async tasks. The two routes that need durable jobs live in Preframe's worker today and stay there.
- Typed RPC layer / cross-app calls. Plain HTTP under a namespace is more than enough.
- Auth scopes. Hudson is single-user-local; punt until it isn't.
- Cross-app data sharing — the data-bus port system stays as-is for the Asset → Logo `background-svg` use case.
- Multi-tenancy / instance management.
- Service composition primitives — sibling services like Preframe stay external; HUD-008 makes embedding *easier* but doesn't take a position on which services should be embedded.

## Design provenance

The conversation that produced this brief (2026-05-19, claude session) walked from a `Failed to fetch` console error → catalog graceful-degradation hardening → unwinding the Logo→Preframe cross-app coupling → recognizing that Logo already has 5 backend routes → realizing the convention exists informally → asking why hudsonkit doesn't formalize it. The user's framing: *"shouldn't that be easy in Hudson? Should there be a shared api layer that namespaces apps and makes this trivial (no need for new service)?"*

Answer: yes, and you're 90% there — formalize the 10% that's missing.

## Reply

When the spec is written, reply on this thread with:
- The file path
- A ~150-word executive summary
- Any flagged-for-human-review items (decisions you couldn't make cleanly)
