/**
 * Tests for the safe-storage helper.
 *
 * The helper exists to harden Hudson against `SecurityError` thrown by
 * `localStorage`/`sessionStorage` access in cross-origin iframes (notably
 * iPhone Safari) and other locked-down environments.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { safeLocalStorage, safeSessionStorage } from '../../../../packages/web/hudsonkit/src/lib/safe-storage';

function makeMockStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    api: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
  };
}

function installLocalStorage(value: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true });
}

function installLocalStorageGetterThrows() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('SecurityError', 'SecurityError'); },
  });
}

function installSessionStorageGetterThrows() {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new DOMException('SecurityError', 'SecurityError'); },
  });
}

function restoreLocalStorage() {
  installLocalStorage(makeMockStorage().api);
}

function restoreSessionStorage() {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: makeMockStorage().api,
  });
}

describe('safeLocalStorage', () => {
  afterEach(() => {
    restoreLocalStorage();
  });

  it('round-trips a value through getItem / setItem / removeItem', () => {
    expect(safeLocalStorage.setItem('safe-storage-test', 'hello')).toBe(true);
    expect(safeLocalStorage.getItem('safe-storage-test')).toBe('hello');
    expect(safeLocalStorage.removeItem('safe-storage-test')).toBe(true);
    expect(safeLocalStorage.getItem('safe-storage-test')).toBe(null);
  });

  it('returns null for missing keys without throwing', () => {
    expect(safeLocalStorage.getItem('definitely-not-here')).toBe(null);
  });

  it('reports availability when storage is reachable', () => {
    expect(safeLocalStorage.isAvailable()).toBe(true);
  });

  it('returns null and no-ops when the property getter itself throws (cross-origin iframe simulation)', () => {
    installLocalStorageGetterThrows();

    expect(safeLocalStorage.isAvailable()).toBe(false);
    expect(safeLocalStorage.getItem('any')).toBe(null);
    expect(safeLocalStorage.setItem('any', 'value')).toBe(false);
    expect(safeLocalStorage.removeItem('any')).toBe(false);
    expect(safeLocalStorage.keys()).toEqual([]);
  });

  it('returns null/false when getItem itself throws (locked-down storage)', () => {
    installLocalStorage({
      getItem: () => { throw new Error('boom'); },
      setItem: () => { throw new Error('boom'); },
      removeItem: () => { throw new Error('boom'); },
    });

    expect(safeLocalStorage.getItem('any')).toBe(null);
    expect(safeLocalStorage.setItem('any', 'value')).toBe(false);
    expect(safeLocalStorage.removeItem('any')).toBe(false);
  });

  it('returns false when setItem throws QuotaExceededError', () => {
    installLocalStorage({
      getItem: () => null,
      setItem: () => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem: () => {},
    });

    expect(safeLocalStorage.setItem('any', 'value')).toBe(false);
  });

  it('returns [] for keys() when the property getter throws', () => {
    installLocalStorageGetterThrows();
    expect(safeLocalStorage.keys()).toEqual([]);
  });

  it('lists keys when storage is reachable', () => {
    safeLocalStorage.setItem('safe-key-a', '1');
    safeLocalStorage.setItem('safe-key-b', '2');
    const keys = safeLocalStorage.keys();
    expect(keys).toContain('safe-key-a');
    expect(keys).toContain('safe-key-b');
    safeLocalStorage.removeItem('safe-key-a');
    safeLocalStorage.removeItem('safe-key-b');
  });
});

describe('safeSessionStorage', () => {
  afterEach(() => {
    restoreSessionStorage();
  });

  it('returns null and no-ops when the property getter throws', () => {
    installSessionStorageGetterThrows();

    expect(safeSessionStorage.isAvailable()).toBe(false);
    expect(safeSessionStorage.getItem('any')).toBe(null);
    expect(safeSessionStorage.setItem('any', 'value')).toBe(false);
    expect(safeSessionStorage.removeItem('any')).toBe(false);
    expect(safeSessionStorage.keys()).toEqual([]);
  });
});
