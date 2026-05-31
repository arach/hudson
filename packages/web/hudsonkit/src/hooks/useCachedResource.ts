'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hudsonCache,
  type HudsonCache,
  type HudsonCacheEntry,
  type HudsonCacheLoadContext,
  type HudsonCacheLoadOptions,
  type HudsonCacheLoader,
  type HudsonCacheRead,
  type HudsonCacheStatus,
} from '../lib/cache';

export type CachedResourceStatus = HudsonCacheStatus | 'loading' | 'error';

export interface UseCachedResourceOptions extends HudsonCacheLoadOptions {
  cache?: HudsonCache;
  enabled?: boolean;
}

export interface UseCachedResourceResult<T> {
  data: T | undefined;
  entry: HudsonCacheEntry<T> | undefined;
  status: CachedResourceStatus;
  error: unknown;
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  refresh: () => Promise<T | undefined>;
  invalidate: () => void;
}

function readCache<T>(cache: HudsonCache, key: string): HudsonCacheRead<T> {
  return cache.read<T>(key);
}

export function useCachedResource<T>(
  key: string,
  loader: HudsonCacheLoader<T>,
  options: UseCachedResourceOptions = {},
): UseCachedResourceResult<T> {
  const {
    cache = hudsonCache,
    enabled = true,
    ...loadOptions
  } = options;

  const loaderRef = useRef(loader);
  const optionsRef = useRef(loadOptions);
  loaderRef.current = loader;
  optionsRef.current = loadOptions;

  const [read, setRead] = useState(() => readCache<T>(cache, key));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setRead(readCache<T>(cache, key));
    setError(null);
  }, [cache, key]);

  useEffect(() => {
    return cache.subscribe((event) => {
      if (event.key && event.key !== key) return;
      setRead(readCache<T>(cache, key));
    });
  }, [cache, key]);

  const load = useCallback(async (force: boolean): Promise<T | undefined> => {
    const current = readCache<T>(cache, key);
    setRead(current);
    setError(null);
    setIsLoading(true);

    try {
      const value = await cache.getOrLoad<T>(
        key,
        (ctx: HudsonCacheLoadContext) => loaderRef.current(ctx),
        { ...optionsRef.current, force },
      );
      setRead(readCache<T>(cache, key));
      return value;
    } catch (err) {
      setError(err);
      setRead(readCache<T>(cache, key));
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [cache, key]);

  useEffect(() => {
    if (!enabled) return;
    void load(false);
  }, [enabled, load]);

  const refresh = useCallback(() => load(true), [load]);

  const invalidate = useCallback(() => {
    cache.delete(key);
    setRead(readCache<T>(cache, key));
  }, [cache, key]);

  const status: CachedResourceStatus = (() => {
    if (error && (!read.entry || read.status === 'expired')) return 'error';
    if (isLoading && (!read.entry || read.status === 'expired')) return 'loading';
    return read.status;
  })();

  return {
    data: read.entry?.value,
    entry: read.entry,
    status,
    error,
    isLoading,
    isError: Boolean(error),
    isStale: read.status === 'stale',
    refresh,
    invalidate,
  };
}
