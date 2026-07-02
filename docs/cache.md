---
title: "Cache"
description: "Shared cache primitive and policy direction for hudsonkit/cache"
order: 21
section: "Web"
---

# Cache

## Overview

`hudsonkit/cache` is the shared substrate apps use instead of reaching for `Map`, `localStorage`, or a bespoke fetch wrapper each time they need to remember a value. It ships TTL + stale-while-revalidate semantics, in-flight async dedupe, tag invalidation, optional `local`/`session` persistence, hydrate/dehydrate, bounded entry counts, and a React hook.

The primitive is intentionally small. The bigger idea is **caching as policy** — pick a named policy for the kind of data you're storing rather than tuning numbers per call site. That keeps app code declarative and lets us swap implementations (or graduate to TanStack Query for serious server state) without touching every call site.

> **Status.** The substrate (`createHudsonCache`, `hudsonCache`, `useCachedResource`) ships today. The named-policy surface (`cachePolicies`, `cachedFetchJson`, `useHudsonQuery`, `createDerivedCache`, `createAssetCache`) is the direction described in `docs/specs/hud-010-cache-policies.md` and is being layered in. Use the substrate now; expect a policy import to land.

## What is cache, and what isn't

Cache holds **derivable** values — things you can refetch, recompute, or rebuild if missing. Anything authoritative is **state**, not cache, and should live in a Provider, a reducer, `usePersistentState`, or `appStorage`.

| Use cache for | Use state for |
|---|---|
| API responses you re-read | The user's selection / active tool |
| Parsed/derived values from inputs | The active document |
| Image or blob metadata | Unsaved edits |
| Service status snapshots | Inspector settings persisted per user |

If invalidating it would lose user work, it's not cache.

## Policy categories

Cache decisions split cleanly by data type. Reach for the right tool per category — Hudson's primitive isn't always it.

### API data

External fetches that need freshness, dedupe, retry, and invalidation. Use `useCachedResource` (or a `cachedFetchJson` helper, once it lands) with the `apiLive` or `apiCatalog` policy. If you need pagination, optimistic mutation, dependent queries, or devtools, **adopt TanStack Query** behind a thin Hudson adapter rather than expanding the substrate.

_Examples:_ model catalog, service status, remote app manifests, workspace metadata, `/api/{app}/...` responses.

### Derived data

Memoized computations from inputs already in memory. These want **bounded memory**, not persistence — use `maxEntries` and include an algorithm/version segment in the key so stale derived values don't survive an implementation change.

_Examples:_ parsed markdown AST, computed shape bounds, rendered preview metadata, expensive search indexes, diff summaries.

### Asset / blob metadata

Hudson's cache is great for the **metadata** ("we have a preview for asset X, last touched Y"); the bytes themselves belong in IndexedDB or the Cache API. Don't serialize images or data URLs through `localStorage` — you'll hit quota and slow down hydration.

_Examples:_ generated images, data URLs, imported files, trace payloads, binary previews, rasterized SVG variants.

### Server route results

Server-side computations cache through **Next.js cache APIs** (route tags, `revalidateTag`, `fetch` cache options) — not the client primitive. Align tag names with client cache tags where it helps mental model, but treat client and server invalidation as separate mechanisms.

### Offline / static resources

HTTP responses, JS/CSS/HTML/image caching belongs to **Workbox / the Cache API / service workers**. Don't route those through the typed value cache.

### Provider state

Not cache. App-owned mutable state lives in `Provider` + reducers/`usePersistentState` + `appStorage`. Don't hide write semantics behind cache invalidation.

## Key and tag conventions

**Keys** identify exactly one entry. **Tags** group entries for batch invalidation. Don't use a tag as a key, and don't use a key as a tag.

Prefer tuple-style conceptual keys (serialize with a small helper):

```ts
['api', appId, resource, id]
['asset', assetId, variant]
['derived', appId, algorithmVersion, inputHash]
['workspace', workspaceId, thing]
```

Tags should be broad enough to invalidate meaningful groups:

```
app:${appId}
api:${resource}
asset:${assetId}
workspace:${workspaceId}
```

When the user signs out, blow away `app:${appId}`. When a model catalog refreshes, invalidate `api:models`. Don't reach for individual `delete()` calls when a tag fits.

## Policies (direction)

Apps pick a named policy instead of hand-tuning durations. The exact numbers are defaults, not doctrine — the name is the contract.

```ts
// shape we're moving toward — see docs/specs/hud-010-cache-policies.md
export const cachePolicies = {
  apiLive:       { ttlMs: 10_000,         staleWhileRevalidateMs: 60_000,        storage: null },
  apiCatalog:    { ttlMs: 5 * 60_000,     staleWhileRevalidateMs: 60 * 60_000,   storage: 'session' },
  derived:       { ttlMs: null,           staleWhileRevalidateMs: null,          storage: null, maxEntries: 500 },
  session:       { ttlMs: 30 * 60_000,    staleWhileRevalidateMs: 30 * 60_000,   storage: 'session' },
  assetMetadata: { ttlMs: 24 * 60 * 60_000, staleWhileRevalidateMs: 24 * 60 * 60_000, storage: 'local' },
} as const;
```

Picking a policy is the call. Tuning the numbers happens in one place.

## Using the substrate today

### Imperative

```ts
import { hudsonCache, createHudsonCache } from 'hudsonkit/cache';

// Shared default instance (namespace: 'hudson')
const models = await hudsonCache.getOrLoad(
  'api:hudson-ai:models',
  () => fetch('/api/ai/models').then(r => r.json()),
  { ttlMs: 5 * 60_000, staleWhileRevalidateMs: 60 * 60_000, tags: ['api:models'] },
);

// Invalidate a group
hudsonCache.invalidateTag('api:models');

// Or your own scoped instance
const previews = createHudsonCache({
  namespace: 'shaper.preview',
  defaultTtlMs: null,
  maxEntries: 250,
});
```

### React

```ts
import { useCachedResource } from 'hudsonkit/cache';

const { data, status, isStale, refresh } = useCachedResource(
  'api:hudson-ai:models',
  () => fetch('/api/ai/models').then(r => r.json()),
  { ttlMs: 5 * 60_000, staleWhileRevalidateMs: 60 * 60_000, tags: ['api:models'] },
);
```

`useCachedResource` subscribes to the cache, so any other code path that writes, deletes, or invalidates this key will re-render consumers automatically.

## API at a glance

Imported from `hudsonkit/cache`:

| Export | Kind | Purpose |
|---|---|---|
| `createHudsonCache(options?)` | factory | Build a scoped cache (namespace, default TTL/SWR, `maxEntries`, optional `'local'`/`'session'` storage) |
| `hudsonCache` | instance | Pre-built default cache (`namespace: 'hudson'`, memory-only) |
| `useCachedResource(key, loader, options?)` | hook | Subscribed read with `data` / `status` / `isStale` / `refresh` / `invalidate` |

Each cache exposes `read` / `get` / `has` / `set` / `getOrLoad` / `revalidate` / `delete` / `clear` / `invalidateTag` / `keys` / `prune` / `dehydrate` / `hydrate` / `subscribe`.

Types (also exported): `HudsonCache`, `HudsonCacheEntry`, `HudsonCacheRead`, `HudsonCacheEvent`, `HudsonCacheStatus`, `HudsonCacheStorage`, `HudsonCacheLoadOptions`, `HudsonCacheSetOptions`, `HudsonCacheOptions`, `HudsonCacheLoader`, `CachedResourceStatus`, `UseCachedResourceOptions`, `UseCachedResourceResult`.

## When to reach past Hudson's primitive

| Need | Reach for |
|---|---|
| Pagination, optimistic mutation, dependent queries, devtools | **TanStack Query** (or **SWR**) behind a Hudson adapter |
| Bounded in-memory LRU for derived computations | The substrate with `maxEntries`, or `lru-cache` / `quick-lru` if you need true LRU eviction |
| Storing megabytes (images, blobs, traces) | **IndexedDB** (via Dexie or raw) or the **Cache API** — Hudson cache holds the metadata only |
| HTTP response / offline-first asset caching | **Workbox** / service worker / Cache API |
| Server route + fetch caching | **Next.js cache APIs** — `revalidateTag`, route segment config |

The rule of thumb: if the cache primitive starts growing pagination, mutation, or background refetch policy, stop and adopt an existing framework behind a Hudson facade rather than rebuilding it.

## Non-goals

- Rebuilding TanStack Query.
- Making cache the source of truth for app state.
- Storing blobs or large data URLs in `localStorage`.
- Cross-device sync or multi-user consistency.
- A distributed Redis-like cache in v1.
- Hiding write semantics behind automatic cache mutation.

## See also

- `docs/specs/hud-010-cache-policies.md` — the in-flight spec this doc tracks.
- [Vault](./vault.md) — for secrets, not derivable cache values.
- [Settings](./settings.md) — for user-owned persistent state.
