# HUD-010 — Cache Policies

**Status**: Draft
**Owner**: TBD

## Summary

Hudson should treat caching as policy-based infrastructure, not as one general-purpose cache that every app uses directly.

The shared `hudsonkit/cache` primitive gives Hudson common cache language: keys, TTL, stale-while-revalidate windows, in-flight dedupe, tags, persistence, pruning, hydrate/dehydrate, and a React hook. That is the substrate. Apps should normally choose a named policy or a narrow helper for the kind of data they are working with.

The goal is to keep Hudson lightweight while avoiding another round of ad hoc `Map`, `localStorage`, and bespoke fetch cache implementations.

## Current State

Hudson now has a small cache primitive in `hudsonkit/cache`:

- `createHudsonCache`
- `hudsonCache`
- `useCachedResource`
- TTL and stale-while-revalidate semantics
- in-flight async dedupe
- tag invalidation
- optional local/session storage
- memory cache lifecycle helpers

Before that, caching was scattered across app-local `Map`s, local/sessionStorage helpers, Next route behavior, and route-specific runtime files. Those are useful patterns, but they do not form a shared policy layer.

## Survey Read

The broader cache ecosystem suggests a split by data type:

- **TanStack Query**: best-in-class for serious API/server-state, including retries, garbage collection, focus/reconnect refetch, pagination, optimistic mutation, and devtools.
- **SWR**: light React data fetching with stale-while-revalidate, request dedupe, focus/reconnect revalidation, polling, and mutate.
- **async-cache-dedupe**: close to Hudson's core primitive: async function cache, TTL, stale windows, dedupe, and storage backends.
- **lru-cache / quick-lru**: strong fit for bounded memory caches and expensive derived computations.
- **Next.js cache APIs**: server-side route/component/fetch caching with tags and revalidation; separate from client app state.
- **Workbox / Cache API**: HTTP response and offline resource caching.
- **Dexie / IndexedDB**: storage substrate for large structured data and blobs, not a policy layer by itself.

Hudson should borrow the boundaries, not copy the whole frameworks.

## Cache Categories

### Provider State

Provider state is not cache. It is the app's source of truth.

Use React context, reducers, `usePersistentState`, or explicit app storage. Do not hide app-owned mutable state behind cache invalidation.

Examples:

- selected shape
- editor tool
- active document
- unsaved workspace state
- inspector settings

### API Data

API data is cache. It needs freshness policy, dedupe, retry behavior, and invalidation.

For simple API reads, use a Hudson wrapper around `useCachedResource`. If server-state needs grow into pagination, optimistic mutation, dependent queries, or complex retries, Hudson should adopt TanStack Query or SWR behind a Hudson adapter rather than rebuilding that feature set.

Examples:

- model catalog
- OpenScout agent list
- service status
- remote app manifests
- route responses under `/api/{app}/...`

### Derived Data

Derived data is cache. It should usually be memory-only and bounded.

This category wants LRU or max-size behavior more than persistence. Keys should include an algorithm/version segment so stale derived values do not survive implementation changes.

Examples:

- parsed markdown AST
- computed shape bounds
- rendered preview metadata
- expensive search indexes
- diff summaries

### Large Assets And Blobs

Large assets are cache, but not localStorage cache.

Use IndexedDB or the browser Cache API with size limits and cleanup. `hudsonkit/cache` can coordinate policy and metadata, but payload storage should live in an adapter built for large values.

Examples:

- generated images
- data URLs
- imported files
- trace payloads
- binary previews
- rasterized SVG variants

### Server Route Results

Server route results should use Next.js cache APIs where that is the right layer.

Route handlers, server components, and server-side computations can use Next tags and revalidation. Tag names should align with Hudson client cache tags where possible, but client invalidation and server invalidation are separate mechanisms.

Examples:

- cached route fetches
- generated metadata
- server-side catalog computation
- shared filesystem reads

### Offline And Static Resources

Offline/static resource caching belongs to Workbox, service workers, or the Cache API.

Do not route offline HTML, JS, CSS, image response caching through the typed value cache.

## Proposed Public Shape

### Policies

Add named policies as values, not magic global behavior:

```ts
export const cachePolicies = {
  apiLive: {
    ttlMs: 10_000,
    staleWhileRevalidateMs: 60_000,
    storage: null,
  },
  apiCatalog: {
    ttlMs: 5 * 60_000,
    staleWhileRevalidateMs: 60 * 60_000,
    storage: 'session',
  },
  derived: {
    ttlMs: null,
    staleWhileRevalidateMs: null,
    storage: null,
    maxEntries: 500,
  },
  session: {
    ttlMs: 30 * 60_000,
    staleWhileRevalidateMs: 30 * 60_000,
    storage: 'session',
  },
  assetMetadata: {
    ttlMs: 24 * 60 * 60_000,
    staleWhileRevalidateMs: 24 * 60 * 60_000,
    storage: 'local',
  },
} as const;
```

The exact numbers are defaults, not doctrine. The policy name matters more than the first duration values.

### API Helpers

Add a narrow API helper before reaching for a full server-state framework:

```ts
const models = await cachedFetchJson(
  hudsonCache,
  ['api', 'hudson-ai', 'models'],
  '/api/ai/models',
  cachePolicies.apiCatalog,
);
```

And a React hook:

```ts
const models = useHudsonQuery(
  ['api', 'hudson-ai', 'models'],
  () => fetch('/api/ai/models').then(r => r.json()),
  cachePolicies.apiCatalog,
);
```

`useHudsonQuery` should stay intentionally smaller than TanStack Query. If it starts accumulating pagination, mutations, optimistic updates, and devtools, stop and adopt an existing framework behind the Hudson API.

### Derived Cache

Add a bounded memory cache helper:

```ts
const previewCache = createDerivedCache({
  namespace: 'shaper.preview',
  maxEntries: 250,
});
```

This may wrap the existing cache primitive or adopt an internal LRU implementation. The important behavior is bounded memory, deterministic keys, and no persistence by default.

### Asset Cache

Add a payload-aware storage adapter for large values:

```ts
const assetCache = createAssetCache({
  namespace: 'assets',
  storage: 'indexeddb',
  maxBytes: 250 * 1024 * 1024,
});
```

The metadata can still use Hudson cache entries. The bytes should not be serialized into localStorage.

## Key And Tag Convention

Prefer tuple-style conceptual keys, serialized by helpers:

```ts
['api', appId, resource, id]
['asset', assetId, variant]
['derived', appId, algorithmVersion, inputHash]
['workspace', workspaceId, thing]
```

Tag names should be broad enough for invalidation:

```ts
app:${appId}
api:${resource}
asset:${assetId}
workspace:${workspaceId}
```

Do not use a tag as a key. Keys identify one cache entry. Tags identify invalidation groups.

## Relationship To Existing Hudson Pieces

- `usePersistentState` remains the hook for small durable app preferences and state.
- `appStorage` remains the server-side filesystem convention for app-owned durable data.
- `createAppApiClient` remains the route/client transport helper.
- `hudsonkit/cache` is the shared policy substrate.
- Next.js cache APIs remain server-side cache controls.
- Workbox/Cache API remains the right place for offline/static response caching.

## Non-Goals

- Rebuilding TanStack Query.
- Making cache the source of truth for app state.
- Storing blobs or large data URLs in localStorage.
- Solving cross-device sync.
- Solving multi-user consistency.
- Adding a Redis-like distributed cache in v1.
- Hiding write semantics behind automatic cache mutation.

## Migration Path

1. Keep the current `hudsonkit/cache` primitive.
2. Add `cachePolicies`.
3. Add `cachedFetchJson` and `useHudsonQuery`.
4. Convert obvious API reads first: model catalogs, OpenScout lists, service status.
5. Add bounded derived caches where apps already hold expensive `Map`s.
6. Add an IndexedDB or Cache API storage adapter before moving large asset/data URL caches.
7. Revisit TanStack Query or SWR only if API/server-state needs outgrow the small Hudson wrapper.

## Open Questions

- Should `useHudsonQuery` refetch on focus/reconnect by default, or should that be opt-in per policy?
- Should cache policies live in `hudsonkit/cache` or a new `hudsonkit/policies` entrypoint?
- Should storage adapters be separate packages so IndexedDB and service-worker code do not enter the main bundle?
- Do we want cache inspection in Hudson devtools, or is event subscription enough for now?
