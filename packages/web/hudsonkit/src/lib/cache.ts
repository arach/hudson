import { safeLocalStorage, safeSessionStorage } from './safe-storage';

export type HudsonCacheStatus = 'miss' | 'fresh' | 'stale' | 'expired';
export type HudsonCacheStorageKind = 'local' | 'session';
export type HudsonCacheEventType =
  | 'set'
  | 'delete'
  | 'clear'
  | 'invalidate'
  | 'hydrate'
  | 'revalidate'
  | 'error';

export interface HudsonCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  keys?(): string[];
}

export interface HudsonCacheEntry<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
  freshUntil?: number;
  expiresAt?: number;
  tags: string[];
  meta?: Record<string, unknown>;
}

export interface HudsonCacheRead<T = unknown> {
  key: string;
  status: HudsonCacheStatus;
  entry?: HudsonCacheEntry<T>;
  ageMs?: number;
}

export interface HudsonCacheEvent<T = unknown> {
  type: HudsonCacheEventType;
  key?: string;
  tags?: string[];
  entry?: HudsonCacheEntry<T>;
  error?: unknown;
}

export type HudsonCacheListener = (event: HudsonCacheEvent) => void;

export interface HudsonCacheSetOptions {
  ttlMs?: number | null;
  staleWhileRevalidateMs?: number | null;
  tags?: readonly string[];
  meta?: Record<string, unknown>;
  persist?: boolean;
}

export interface HudsonCacheLoadContext {
  key: string;
  cache: HudsonCache;
  signal?: AbortSignal;
}

export type HudsonCacheLoader<T> = (ctx: HudsonCacheLoadContext) => T | Promise<T>;

export interface HudsonCacheLoadOptions extends HudsonCacheSetOptions {
  allowStale?: boolean;
  force?: boolean;
  revalidate?: 'background' | 'blocking' | 'none';
  signal?: AbortSignal;
}

export interface HudsonCacheDehydrateOptions {
  includeExpired?: boolean;
}

export interface HudsonCacheHydrateOptions {
  persist?: boolean;
}

export interface HudsonCacheGetOptions {
  allowStale?: boolean;
}

export interface HudsonCacheOptions {
  namespace?: string;
  defaultTtlMs?: number | null;
  defaultStaleWhileRevalidateMs?: number | null;
  maxEntries?: number;
  storage?: HudsonCacheStorageKind | HudsonCacheStorage | null;
  storagePrefix?: string;
  now?: () => number;
}

export interface HudsonCache {
  readonly namespace: string;

  read<T = unknown>(key: string): HudsonCacheRead<T>;
  get<T = unknown>(key: string, options?: HudsonCacheGetOptions): T | undefined;
  has(key: string, options?: HudsonCacheGetOptions): boolean;
  set<T = unknown>(key: string, value: T, options?: HudsonCacheSetOptions): HudsonCacheEntry<T>;
  getOrLoad<T = unknown>(
    key: string,
    loader: HudsonCacheLoader<T>,
    options?: HudsonCacheLoadOptions,
  ): Promise<T>;
  revalidate<T = unknown>(
    key: string,
    loader: HudsonCacheLoader<T>,
    options?: HudsonCacheLoadOptions,
  ): Promise<T>;
  delete(key: string): boolean;
  clear(): number;
  invalidateTag(tag: string): number;
  keys(): string[];
  prune(): number;
  dehydrate(options?: HudsonCacheDehydrateOptions): HudsonCacheEntry[];
  hydrate(entries: readonly HudsonCacheEntry[], options?: HudsonCacheHydrateOptions): void;
  subscribe(listener: HudsonCacheListener): () => void;
}

interface StoredEnvelope {
  version: 1;
  namespace: string;
  entry: HudsonCacheEntry;
}

const STORAGE_VERSION = 1;
const DEFAULT_NAMESPACE = 'hudson';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeMs(value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  return Math.max(0, value);
}

function uniqueTags(tags: readonly string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  return [...new Set(tags.filter(tag => tag.length > 0))];
}

function resolveStorage(storage: HudsonCacheOptions['storage']): HudsonCacheStorage | null {
  if (!storage) return null;
  if (storage === 'local') return safeLocalStorage;
  if (storage === 'session') return safeSessionStorage;
  return storage;
}

function isStoredEntry(value: unknown): value is HudsonCacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HudsonCacheEntry>;
  return (
    typeof entry.key === 'string' &&
    'value' in entry &&
    isFiniteNumber(entry.updatedAt) &&
    (entry.freshUntil === undefined || isFiniteNumber(entry.freshUntil)) &&
    (entry.expiresAt === undefined || isFiniteNumber(entry.expiresAt)) &&
    Array.isArray(entry.tags) &&
    entry.tags.every(tag => typeof tag === 'string') &&
    (entry.meta === undefined || (entry.meta !== null && typeof entry.meta === 'object'))
  );
}

function parseEnvelope(raw: string, namespace: string): HudsonCacheEntry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope>;
    if (
      parsed.version !== STORAGE_VERSION ||
      parsed.namespace !== namespace ||
      !isStoredEntry(parsed.entry)
    ) {
      return null;
    }
    return parsed.entry;
  } catch {
    return null;
  }
}

function cacheStatus(entry: HudsonCacheEntry, now: number): Exclude<HudsonCacheStatus, 'miss'> {
  if (entry.expiresAt !== undefined && now >= entry.expiresAt) return 'expired';
  if (entry.freshUntil !== undefined && now >= entry.freshUntil) return 'stale';
  return 'fresh';
}

function shouldReturnValue(status: HudsonCacheStatus, allowStale: boolean): boolean {
  return status === 'fresh' || (allowStale && status === 'stale');
}

export function createHudsonCache(options: HudsonCacheOptions = {}): HudsonCache {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const storage = resolveStorage(options.storage);
  const storagePrefix = options.storagePrefix ?? `hudson.cache.${namespace}.`;
  const now = options.now ?? Date.now;
  const memory = new Map<string, HudsonCacheEntry>();
  const inflight = new Map<string, Promise<unknown>>();
  const listeners = new Set<HudsonCacheListener>();

  function storageKey(key: string): string {
    return `${storagePrefix}${key}`;
  }

  function emit(event: HudsonCacheEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('hudsonkit/cache listener failed', error);
      }
    }
  }

  function removePersisted(key: string): void {
    try {
      storage?.removeItem(storageKey(key));
    } catch {
      // Storage adapters are best-effort; memory remains the source of truth.
    }
  }

  function persistEntry(entry: HudsonCacheEntry, persist = true): void {
    if (!storage) return;
    if (!persist) {
      removePersisted(entry.key);
      return;
    }
    const envelope: StoredEnvelope = {
      version: STORAGE_VERSION,
      namespace,
      entry,
    };
    try {
      storage.setItem(storageKey(entry.key), JSON.stringify(envelope));
    } catch {
      removePersisted(entry.key);
    }
  }

  function readPersisted(key: string): HudsonCacheEntry | undefined {
    if (!storage) return undefined;
    let raw: string | null = null;
    try {
      raw = storage.getItem(storageKey(key));
    } catch {
      return undefined;
    }
    if (!raw) return undefined;
    const entry = parseEnvelope(raw, namespace);
    if (!entry || entry.key !== key) {
      removePersisted(key);
      return undefined;
    }
    memory.set(key, entry);
    return entry;
  }

  function knownKeys(): string[] {
    const out = new Set(memory.keys());
    if (storage?.keys) {
      try {
        for (const key of storage.keys()) {
          if (key.startsWith(storagePrefix)) out.add(key.slice(storagePrefix.length));
        }
      } catch {
        // Ignore custom storage enumeration failures.
      }
    }
    return [...out];
  }

  function readEntry(key: string): HudsonCacheEntry | undefined {
    return memory.get(key) ?? readPersisted(key);
  }

  function enforceMaxEntries(): void {
    const maxEntries = options.maxEntries;
    if (!maxEntries || maxEntries < 1 || memory.size <= maxEntries) return;

    cache.prune();
    if (memory.size <= maxEntries) return;

    const overflow = memory.size - maxEntries;
    const oldest = [...memory.values()]
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, overflow);

    for (const entry of oldest) {
      memory.delete(entry.key);
      removePersisted(entry.key);
      emit({ type: 'delete', key: entry.key, entry });
    }
  }

  function buildEntry<T>(
    key: string,
    value: T,
    setOptions: HudsonCacheSetOptions | undefined,
  ): HudsonCacheEntry<T> {
    const timestamp = now();
    const ttlMs = normalizeMs(setOptions?.ttlMs ?? options.defaultTtlMs);
    const swrMs = normalizeMs(
      setOptions?.staleWhileRevalidateMs ?? options.defaultStaleWhileRevalidateMs,
    );
    const freshUntil = ttlMs === undefined ? undefined : timestamp + ttlMs;
    const expiresAt = freshUntil === undefined
      ? undefined
      : freshUntil + (swrMs ?? 0);

    return {
      key,
      value,
      updatedAt: timestamp,
      freshUntil,
      expiresAt,
      tags: uniqueTags(setOptions?.tags),
      meta: setOptions?.meta,
    };
  }

  function setEntry<T>(
    key: string,
    value: T,
    setOptions?: HudsonCacheSetOptions,
  ): HudsonCacheEntry<T> {
    const entry = buildEntry(key, value, setOptions);
    memory.set(key, entry);
    persistEntry(entry, setOptions?.persist ?? true);
    enforceMaxEntries();
    emit({ type: 'set', key, entry });
    return entry;
  }

  async function loadAndStore<T>(
    key: string,
    loader: HudsonCacheLoader<T>,
    loadOptions: HudsonCacheLoadOptions | undefined,
  ): Promise<T> {
    const active = inflight.get(key);
    if (active) return active as Promise<T>;

    const promise = Promise.resolve()
      .then(() => loader({ key, cache, signal: loadOptions?.signal }))
      .then((value) => {
        setEntry(key, value, loadOptions);
        emit({ type: 'revalidate', key, entry: readEntry(key) });
        return value;
      })
      .catch((error: unknown) => {
        emit({ type: 'error', key, error });
        throw error;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise;
  }

  const cache: HudsonCache = {
    namespace,

    read<T = unknown>(key: string): HudsonCacheRead<T> {
      const entry = readEntry(key) as HudsonCacheEntry<T> | undefined;
      if (!entry) return { key, status: 'miss' };
      const timestamp = now();
      return {
        key,
        status: cacheStatus(entry, timestamp),
        entry,
        ageMs: Math.max(0, timestamp - entry.updatedAt),
      };
    },

    get<T = unknown>(key: string, getOptions: HudsonCacheGetOptions = {}): T | undefined {
      const result = cache.read<T>(key);
      if (!result.entry) return undefined;
      return shouldReturnValue(result.status, getOptions.allowStale ?? false)
        ? result.entry.value
        : undefined;
    },

    has(key: string, getOptions: HudsonCacheGetOptions = {}): boolean {
      const result = cache.read(key);
      return Boolean(result.entry && shouldReturnValue(result.status, getOptions.allowStale ?? false));
    },

    set: setEntry,

    async getOrLoad<T = unknown>(
      key: string,
      loader: HudsonCacheLoader<T>,
      loadOptions: HudsonCacheLoadOptions = {},
    ): Promise<T> {
      const revalidate = loadOptions.revalidate ?? 'background';
      const allowStale = loadOptions.allowStale ?? true;

      if (!loadOptions.force) {
        const result = cache.read<T>(key);
        if (result.entry && result.status === 'fresh') return result.entry.value;
        if (result.entry && result.status === 'stale' && allowStale) {
          if (revalidate === 'background') {
            void loadAndStore(key, loader, loadOptions).catch(() => undefined);
          } else if (revalidate === 'blocking') {
            return loadAndStore(key, loader, loadOptions);
          }
          return result.entry.value;
        }
      }

      return loadAndStore(key, loader, loadOptions);
    },

    revalidate<T = unknown>(
      key: string,
      loader: HudsonCacheLoader<T>,
      loadOptions: HudsonCacheLoadOptions = {},
    ): Promise<T> {
      return loadAndStore(key, loader, { ...loadOptions, force: true });
    },

    delete(key: string): boolean {
      const entry = readEntry(key);
      const deleted = memory.delete(key);
      removePersisted(key);
      if (entry || deleted) emit({ type: 'delete', key, entry });
      return Boolean(entry || deleted);
    },

    clear(): number {
      const keys = knownKeys();
      for (const key of keys) {
        memory.delete(key);
        removePersisted(key);
      }
      if (keys.length > 0) emit({ type: 'clear' });
      return keys.length;
    },

    invalidateTag(tag: string): number {
      let count = 0;
      for (const key of knownKeys()) {
        const entry = readEntry(key);
        if (!entry?.tags.includes(tag)) continue;
        memory.delete(key);
        removePersisted(key);
        count += 1;
        emit({ type: 'invalidate', key, tags: [tag], entry });
      }
      return count;
    },

    keys: knownKeys,

    prune(): number {
      let count = 0;
      const timestamp = now();
      for (const key of knownKeys()) {
        const entry = readEntry(key);
        if (!entry || cacheStatus(entry, timestamp) !== 'expired') continue;
        memory.delete(key);
        removePersisted(key);
        count += 1;
        emit({ type: 'delete', key, entry });
      }
      return count;
    },

    dehydrate(dehydrateOptions: HudsonCacheDehydrateOptions = {}): HudsonCacheEntry[] {
      const includeExpired = dehydrateOptions.includeExpired ?? false;
      const entries: HudsonCacheEntry[] = [];
      const timestamp = now();
      for (const key of knownKeys()) {
        const entry = readEntry(key);
        if (!entry) continue;
        if (!includeExpired && cacheStatus(entry, timestamp) === 'expired') continue;
        entries.push(entry);
      }
      return entries;
    },

    hydrate(entries: readonly HudsonCacheEntry[], hydrateOptions: HudsonCacheHydrateOptions = {}): void {
      for (const entry of entries) {
        if (!isStoredEntry(entry)) continue;
        memory.set(entry.key, entry);
        persistEntry(entry, hydrateOptions.persist ?? true);
        emit({ type: 'hydrate', key: entry.key, entry });
      }
      enforceMaxEntries();
    },

    subscribe(listener: HudsonCacheListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return cache;
}

export const hudsonCache = createHudsonCache();
