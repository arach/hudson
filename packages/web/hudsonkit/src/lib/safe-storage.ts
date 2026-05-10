/**
 * Safe wrappers around `localStorage` / `sessionStorage`.
 *
 * Cross-origin iframes (especially on iPhone Safari) can throw `SecurityError`
 * the moment any code touches `window.localStorage` or `window.sessionStorage`
 * — even just reading the property. Private mode and disabled-storage
 * configurations throw on `getItem`/`setItem`. SSR has neither object at all.
 *
 * Every helper here:
 *   - Returns `null` / no-ops when storage is unavailable.
 *   - Catches access errors thrown by the property getter itself.
 *   - Catches per-call errors (quota, locked-down environments).
 *
 * Use these instead of touching `localStorage` / `sessionStorage` directly
 * unless the call site already has its own try/catch. See
 * `usePersistentState.ts` for the canonical hooked variant.
 */

type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Cross-origin iframes can throw `SecurityError` on the property getter.
    return null;
  }
}

function readItem(kind: StorageKind, key: string): string | null {
  const storage = getStorage(kind);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(kind: StorageKind, key: string, value: string): boolean {
  const storage = getStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // QuotaExceededError, locked-down environment, etc.
    return false;
  }
}

function deleteItem(kind: StorageKind, key: string): boolean {
  const storage = getStorage(kind);
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function listKeys(kind: StorageKind): string[] {
  const storage = getStorage(kind);
  if (!storage) return [];
  try {
    // Use Storage's `length` + `key(i)` API rather than `Object.keys()` —
    // the latter walks own properties, which on real `Storage` objects are
    // hidden behind the [[GetOwnProperty]] interceptor and on jsdom mocks
    // include unrelated method names (`getItem`, `setItem`, ...).
    const out: string[] = [];
    const len = storage.length;
    for (let i = 0; i < len; i++) {
      const k = storage.key(i);
      if (typeof k === 'string') out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

/** Safe `localStorage` wrapper. Each method gracefully no-ops when storage is
 *  unavailable (SSR, cross-origin iframe, private mode, locked-down browser). */
export const safeLocalStorage = {
  /** Returns the value, or `null` if missing or storage is unavailable. */
  getItem(key: string): string | null {
    return readItem('local', key);
  },
  /** Returns `true` on success, `false` if storage is unavailable or the
   *  write threw (quota, locked down). */
  setItem(key: string, value: string): boolean {
    return writeItem('local', key, value);
  },
  /** Returns `true` on success, `false` if storage is unavailable. */
  removeItem(key: string): boolean {
    return deleteItem('local', key);
  },
  /** Returns the list of keys, or `[]` if storage is unavailable. */
  keys(): string[] {
    return listKeys('local');
  },
  /** Returns `true` if `localStorage` is reachable and writable. Uses a
   *  throwaway probe key so we don't pay the cost of `setItem` until we
   *  actually need it. */
  isAvailable(): boolean {
    return getStorage('local') !== null;
  },
} as const;

/** Safe `sessionStorage` wrapper. Same shape as {@link safeLocalStorage}. */
export const safeSessionStorage = {
  getItem(key: string): string | null {
    return readItem('session', key);
  },
  setItem(key: string, value: string): boolean {
    return writeItem('session', key, value);
  },
  removeItem(key: string): boolean {
    return deleteItem('session', key);
  },
  keys(): string[] {
    return listKeys('session');
  },
  isAvailable(): boolean {
    return getStorage('session') !== null;
  },
} as const;

export type SafeStorage = typeof safeLocalStorage;
