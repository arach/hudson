/**
 * HudVault — encrypted opaque-secret store for the web. Mirrors the Apple
 * `HudVault` Swift API one-for-one; storage is IndexedDB-backed, encryption is
 * AES-GCM via `crypto.subtle` with a non-extractable CryptoKey stored in IDB.
 *
 * Threat model. Items are encrypted at rest by AES-GCM. The encryption key is
 * non-extractable (`extractable: false`) — `crypto.subtle.exportKey` will fail
 * on it. The CryptoKey object itself lives in IndexedDB and is bound to the
 * browser profile + origin. Defends against cross-origin snooping and casual
 * inspection of localStorage / IDB. Does NOT defend against:
 *   - the user clearing browsing data (data is gone, irrecoverable);
 *   - malicious code running on the same origin (it can call `get` directly);
 *   - other users on a shared OS profile that share the browser profile.
 *
 * Browser support requires `crypto.subtle` (HTTPS or localhost) and IndexedDB.
 * Both are universal in modern browsers; HudVault throws `HudVaultError` with
 * code `idb_unsupported` / `crypto_unsupported` when missing.
 */

export type HudVaultErrorCode =
  | 'idb_unsupported'
  | 'crypto_unsupported'
  | 'encoding_failed'
  | 'idb_failed'
  | 'crypto_failed';

export class HudVaultError extends Error {
  readonly code: HudVaultErrorCode;
  readonly cause?: unknown;

  constructor(code: HudVaultErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'HudVaultError';
    this.code = code;
    this.cause = cause;
  }
}

export interface HudVaultOptions {
  /** Namespace string — each service gets its own IndexedDB database so
   *  consuming apps don't collide. Conventional form: reverse-DNS, e.g.
   *  `com.example.api-keys`. */
  service: string;
}

interface StoredItem {
  iv: Uint8Array;
  ct: Uint8Array;
}

const ITEMS_STORE = 'items';
const KEYS_STORE = 'keys';
const MASTER_KEY_NAME = 'master';

export class HudVault {
  readonly service: string;
  private dbPromise?: Promise<IDBDatabase>;
  private cryptoKeyPromise?: Promise<CryptoKey>;

  constructor(options: HudVaultOptions) {
    this.service = options.service;
  }

  async set(key: string, value: string): Promise<void> {
    const bytes = new TextEncoder().encode(value);
    return this.setBytes(key, bytes);
  }

  async setBytes(key: string, value: Uint8Array): Promise<void> {
    const cryptoKey = await this.getOrCreateCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let ct: ArrayBuffer;
    try {
      ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        cryptoKey,
        value as BufferSource
      );
    } catch (e) {
      throw new HudVaultError('crypto_failed', 'AES-GCM encrypt failed', e);
    }
    const stored: StoredItem = { iv, ct: new Uint8Array(ct) };
    await this.idbWrite(ITEMS_STORE, key, stored);
  }

  async get(key: string): Promise<string | null> {
    const bytes = await this.getBytes(key);
    if (!bytes) return null;
    try {
      return new TextDecoder().decode(bytes);
    } catch (e) {
      throw new HudVaultError('encoding_failed', 'value is not valid UTF-8', e);
    }
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    const stored = await this.idbRead<StoredItem>(ITEMS_STORE, key);
    if (!stored) return null;
    const cryptoKey = await this.getOrCreateCryptoKey();
    try {
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: stored.iv as BufferSource },
        cryptoKey,
        stored.ct as BufferSource
      );
      return new Uint8Array(pt);
    } catch (e) {
      throw new HudVaultError('crypto_failed', 'AES-GCM decrypt failed', e);
    }
  }

  async delete(key: string): Promise<void> {
    await this.idbDelete(ITEMS_STORE, key);
  }

  async list(): Promise<string[]> {
    const keys = await this.idbKeys(ITEMS_STORE);
    return keys.sort();
  }

  async clear(): Promise<void> {
    await this.idbClear(ITEMS_STORE);
  }

  // ──────────────────────────────────────────────────────────────────
  // Crypto key lifecycle
  // ──────────────────────────────────────────────────────────────────

  private getOrCreateCryptoKey(): Promise<CryptoKey> {
    if (this.cryptoKeyPromise) return this.cryptoKeyPromise;
    this.cryptoKeyPromise = (async () => {
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new HudVaultError('crypto_unsupported', 'crypto.subtle is not available (HTTPS or localhost required)');
      }
      const existing = await this.idbRead<CryptoKey>(KEYS_STORE, MASTER_KEY_NAME);
      if (existing) return existing;

      let fresh: CryptoKey;
      try {
        fresh = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable
          ['encrypt', 'decrypt']
        );
      } catch (e) {
        throw new HudVaultError('crypto_failed', 'AES-GCM key generation failed', e);
      }
      await this.idbWrite(KEYS_STORE, MASTER_KEY_NAME, fresh);
      return fresh;
    })();
    return this.cryptoKeyPromise;
  }

  // ──────────────────────────────────────────────────────────────────
  // IndexedDB plumbing
  // ──────────────────────────────────────────────────────────────────

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new HudVaultError('idb_unsupported', 'IndexedDB is not available'));
        return;
      }
      const req = indexedDB.open(`hudvault:${this.service}`, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ITEMS_STORE)) db.createObjectStore(ITEMS_STORE);
        if (!db.objectStoreNames.contains(KEYS_STORE)) db.createObjectStore(KEYS_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new HudVaultError('idb_failed', `IndexedDB open failed: ${req.error?.message}`, req.error));
    });
    return this.dbPromise;
  }

  private async idbRead<T>(store: string, key: string): Promise<T | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(new HudVaultError('idb_failed', `read failed: ${req.error?.message}`, req.error));
    });
  }

  private async idbWrite(store: string, key: string, value: unknown): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new HudVaultError('idb_failed', `write failed: ${tx.error?.message}`, tx.error));
    });
  }

  private async idbDelete(store: string, key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new HudVaultError('idb_failed', `delete failed: ${tx.error?.message}`, tx.error));
    });
  }

  private async idbClear(store: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new HudVaultError('idb_failed', `clear failed: ${tx.error?.message}`, tx.error));
    });
  }

  private async idbKeys(store: string): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).filter((k): k is string => typeof k === 'string'));
      req.onerror = () => reject(new HudVaultError('idb_failed', `keys failed: ${req.error?.message}`, req.error));
    });
  }
}
