// ---------------------------------------------------------------------------
// createAppApiClient (HUD-008)
//
// Browser-safe per-app HTTP / SSE client. Defaults to same-origin
// `/api/{app.id}` routes; supports absolute `apiBase` + optional health probe
// for sibling services. Network failures are absorbed into a synthetic
// `Response { status: 0 }` so caller code never has to wrap fetch in try/catch.
// ---------------------------------------------------------------------------

import type { HudsonAppBackend } from '../../types/backend';

export type AppApiServiceStatus = 'unknown' | 'checking' | 'online' | 'offline';

export type AppApiStreamEvent = 'open' | 'invalidate' | 'warning' | 'error' | string;

export interface AppApiStream {
  source: EventSource;
  close(): void;
  addEventListener<T = unknown>(
    event: AppApiStreamEvent,
    listener: (event: MessageEvent<T>) => void,
  ): () => void;
}

export interface AppApiStatusStore {
  get(): AppApiServiceStatus;
  subscribe(listener: (status: AppApiServiceStatus) => void): () => void;
}

export interface AppApiClient {
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

  /** One-shot probe. Returns true for same-origin / no-healthCheck clients. */
  checkHealth(): Promise<boolean>;
}

export interface AppApiClientAppLike {
  id: string;
  backend?: HudsonAppBackend;
}

const DEFAULT_HEALTH_TIMEOUT_MS = 2_000;
const OFFLINE_BACKOFF_MS = [5_000, 10_000, 20_000, 30_000] as const;

function isAbsolute(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function joinPath(base: string, path: string): string {
  if (!path) return base;
  if (isAbsolute(path)) return path;
  const trimmedBase = stripTrailingSlash(base);
  const leadingSlash = path.startsWith('/') ? '' : '/';
  return `${trimmedBase}${leadingSlash}${path}`;
}

function resolveBaseUrl(app: AppApiClientAppLike): string {
  const explicit = app.backend?.apiBase;
  if (explicit) return stripTrailingSlash(explicit);
  return `/api/${app.id}`;
}

function resolveHealthUrl(baseUrl: string, healthPath: string): string {
  if (isAbsolute(healthPath)) return healthPath;
  return joinPath(baseUrl, healthPath);
}

function offlineResponse(): Response {
  return new Response(null, { status: 0, statusText: 'Network unavailable' });
}

function createStatusStore(initial: AppApiServiceStatus): {
  store: AppApiStatusStore;
  set(next: AppApiServiceStatus): void;
} {
  let current = initial;
  const listeners = new Set<(status: AppApiServiceStatus) => void>();
  return {
    store: {
      get: () => current,
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    set(next) {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener(current);
    },
  };
}

export function createAppApiClient(app: AppApiClientAppLike): AppApiClient {
  const baseUrl = resolveBaseUrl(app);
  const healthPath = app.backend?.healthCheck;
  const healthTimeoutMs = app.backend?.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const probesEnabled = Boolean(healthPath);

  const { store, set } = createStatusStore(probesEnabled ? 'unknown' : 'online');

  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let probeToken = 0;

  function clearRetry() {
    if (retryTimer != null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  async function runProbe(): Promise<boolean> {
    if (!probesEnabled || !healthPath) return true;
    const token = ++probeToken;
    if (store.get() !== 'online') set('checking');
    const url = resolveHealthUrl(baseUrl, healthPath);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), healthTimeoutMs);
    let ok = false;
    try {
      const r = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      ok = r.ok;
    } catch {
      ok = false;
    } finally {
      clearTimeout(timer);
    }
    if (token !== probeToken) return ok;
    if (ok) {
      attempt = 0;
      set('online');
    } else {
      set('offline');
      const delay = OFFLINE_BACKOFF_MS[Math.min(attempt, OFFLINE_BACKOFF_MS.length - 1)];
      attempt += 1;
      clearRetry();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void runProbe();
      }, delay);
    }
    return ok;
  }

  async function safeFetch(path: string, init?: RequestInit): Promise<Response> {
    const url = joinPath(baseUrl, path);
    try {
      return await fetch(url, init);
    } catch {
      return offlineResponse();
    }
  }

  const client: AppApiClient = {
    baseUrl,
    serviceStatus: store,
    fetch: safeFetch,
    get(path, init) {
      return safeFetch(path, { ...init, method: 'GET' });
    },
    post(path, init) {
      return safeFetch(path, { ...init, method: 'POST' });
    },
    patch(path, init) {
      return safeFetch(path, { ...init, method: 'PATCH' });
    },
    delete(path, init) {
      return safeFetch(path, { ...init, method: 'DELETE' });
    },
    stream(path) {
      const url = joinPath(baseUrl, path);
      const source = new EventSource(url);
      return {
        source,
        close() {
          source.close();
        },
        addEventListener(event, listener) {
          const handler = listener as EventListener;
          source.addEventListener(event, handler);
          return () => source.removeEventListener(event, handler);
        },
      };
    },
    retry() {
      if (!probesEnabled) return;
      attempt = 0;
      clearRetry();
      void runProbe();
    },
    async checkHealth() {
      if (!probesEnabled) return true;
      return runProbe();
    },
  };

  if (probesEnabled) {
    // Kick off the first probe asynchronously so consumers see `unknown` first.
    Promise.resolve().then(() => {
      void runProbe();
    });
  }

  return client;
}
