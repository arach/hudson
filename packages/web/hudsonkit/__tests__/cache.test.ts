import { describe, expect, it } from 'vitest';
import { createHudsonCache, type HudsonCacheStorage } from '../src/lib/cache';

function createMemoryStorage(): HudsonCacheStorage & { dump(): Map<string, string> } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      return true;
    },
    removeItem: (key) => values.delete(key),
    keys: () => [...values.keys()],
    dump: () => values,
  };
}

describe('createHudsonCache', () => {
  it('dedupes concurrent loads for the same key', async () => {
    const cache = createHudsonCache({ namespace: 'dedupe' });
    let calls = 0;

    const first = cache.getOrLoad('profile', async () => {
      calls += 1;
      await Promise.resolve();
      return { name: 'Hudson' };
    });
    const second = cache.getOrLoad('profile', async () => {
      calls += 1;
      return { name: 'Wrong' };
    });

    await expect(first).resolves.toEqual({ name: 'Hudson' });
    await expect(second).resolves.toEqual({ name: 'Hudson' });
    expect(calls).toBe(1);
    expect(cache.get('profile')).toEqual({ name: 'Hudson' });
  });

  it('returns stale values while a background revalidation refreshes the entry', async () => {
    let clock = 1_000;
    const cache = createHudsonCache({
      namespace: 'swr',
      now: () => clock,
    });

    cache.set('doc', 'old', { ttlMs: 100, staleWhileRevalidateMs: 1_000 });
    clock = 1_150;

    const refreshed = new Promise<void>((resolve) => {
      const unsubscribe = cache.subscribe((event) => {
        if (event.type === 'set' && event.key === 'doc') {
          unsubscribe();
          resolve();
        }
      });
    });

    await expect(cache.getOrLoad('doc', async () => 'new', {
      ttlMs: 100,
      staleWhileRevalidateMs: 1_000,
    })).resolves.toBe('old');

    await refreshed;
    expect(cache.get('doc')).toBe('new');
  });

  it('round-trips persisted entries through the configured storage', () => {
    let clock = 10;
    const storage = createMemoryStorage();
    const first = createHudsonCache({
      namespace: 'persist',
      storage,
      now: () => clock,
    });

    first.set('settings', { density: 'compact' }, { ttlMs: 50, tags: ['settings'] });

    const second = createHudsonCache({
      namespace: 'persist',
      storage,
      now: () => clock,
    });

    expect(second.get('settings')).toEqual({ density: 'compact' });
    expect(second.read('settings').status).toBe('fresh');

    clock = 100;
    expect(second.read('settings').status).toBe('expired');
    expect(second.prune()).toBe(1);
    expect(storage.keys?.()).toEqual([]);
  });

  it('invalidates entries by tag across memory and storage', () => {
    const storage = createMemoryStorage();
    const cache = createHudsonCache({
      namespace: 'tags',
      storage,
    });

    cache.set('a', 1, { tags: ['group'] });
    cache.set('b', 2, { tags: ['group', 'other'] });
    cache.set('c', 3, { tags: ['other'] });

    expect(cache.invalidateTag('group')).toBe(2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    expect(storage.keys?.()).toEqual(['hudson.cache.tags.c']);
  });
});
