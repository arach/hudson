import { afterEach, describe, expect, it, vi } from 'vitest';
import { HudAuthClient } from '../src/auth';
import { HudPushClient } from '../src/push';
import { hudPushSwHandler } from '../src/push/sw';

const originals = new Map<PropertyKey, unknown>();

function setGlobal(key: PropertyKey, value: unknown) {
  if (!originals.has(key)) originals.set(key, (globalThis as any)[key]);
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, value] of originals) {
    if (value === undefined) delete (globalThis as any)[key];
    else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  originals.clear();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

function installWindowStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
  setGlobal('window', { localStorage, location: { assign: vi.fn() } });
  return localStorage;
}

describe('HudAuthClient', () => {
  it('redirects GitHub sign-in to the Worker OAuth start endpoint', () => {
    installWindowStorage();
    const auth = new HudAuthClient({ workerUrl: 'https://relay.example/' });

    auth.signIn({ provider: 'github', returnTo: '/dashboard' });

    expect(window.location.assign).toHaveBeenCalledWith('https://relay.example/v1/auth/github/start?return_to=%2Fdashboard');
  });

  it('reads the current session through the Worker cookie boundary', async () => {
    const session = { provider: 'github', providerUserId: '123', login: 'alice', email: 'a@example.com', expiresAt: Date.now() + 60_000 };
    const fetchMock = vi.fn(async () => jsonResponse({ authenticated: true, session }));
    setGlobal('fetch', fetchMock);
    const auth = new HudAuthClient({ workerUrl: 'https://relay.example' });

    await expect(auth.getSession()).resolves.toEqual(session);

    expect(fetchMock).toHaveBeenCalledWith(new URL('https://relay.example/v1/auth/session'), expect.objectContaining({ credentials: 'include' }));
  });

  it('attaches a localStorage bearer in signedFetch', async () => {
    installWindowStorage();
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    setGlobal('fetch', fetchMock);
    const auth = new HudAuthClient({ workerUrl: 'https://relay.example', bearerStorage: 'localStorage' });
    auth.setBearer('payload.sig');

    await auth.signedFetch()('https://api.example/protected', { method: 'POST' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer hud_session_payload.sig');
    expect(init.credentials).toBe('include');
  });

  it('signs out through the Worker and clears localStorage bearer', async () => {
    const localStorage = installWindowStorage();
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    setGlobal('fetch', fetchMock);
    const auth = new HudAuthClient({ workerUrl: 'https://relay.example', bearerStorage: 'localStorage' });
    auth.setBearer('hud_session_payload.sig');

    await auth.signOut();

    expect(fetchMock).toHaveBeenCalledWith(new URL('https://relay.example/v1/auth/logout'), expect.objectContaining({ method: 'POST' }));
    expect(localStorage.removeItem).toHaveBeenCalledWith('hudson.auth.bearer');
  });
});

describe('HudPushClient', () => {
  it('wraps Notification.requestPermission', async () => {
    setGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'granted') });
    const push = new HudPushClient({ auth: vi.fn(), pushPublicKey: 'AQID' });

    await expect(push.requestPermission()).resolves.toBe(true);
  });

  it('subscribes and registers the web push payload expected by the Worker', async () => {
    setGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    const fetcher = vi.fn(async () => jsonResponse({ ok: true, device: { deviceId: 'dev_1', platform: 'web' } }));
    const registration = {
      pushManager: {
        subscribe: vi.fn(async () => ({
          toJSON: () => ({ endpoint: 'https://push.example/e', keys: { p256dh: 'abc', auth: 'def' } }),
        })),
      },
    } as unknown as ServiceWorkerRegistration;
    const push = new HudPushClient({
      auth: { workerUrl: 'https://relay.example', signedFetch: () => fetcher } as any,
      pushPublicKey: 'AQID',
    });

    await expect(push.register({ deviceId: 'dev_1', kind: 'web', serviceWorkerRegistration: registration })).resolves.toMatchObject({ deviceId: 'dev_1', platform: 'web' });

    expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(fetcher).toHaveBeenCalledWith('https://relay.example/v1/push/devices/register', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      deviceId: 'dev_1',
      kind: 'web',
      platform: 'web',
      authorizationStatus: 'granted',
      subscription: { endpoint: 'https://push.example/e', keys: { p256dh: 'abc', auth: 'def' } },
    });
  });

  it('returns delivered counts for successful sends', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true, delivered: 2, failed: 1, rateLimited: 0 }));
    const push = new HudPushClient({ auth: { workerUrl: 'https://relay.example', signedFetch: () => fetcher } as any, pushPublicKey: 'AQID' });

    await expect(push.send({ itemId: 'msg_42', kind: 'message', urgency: 'normal' })).resolves.toEqual({ ok: true, delivered: 2, failed: 1, rateLimited: 0 });

    expect(fetcher).toHaveBeenCalledWith('https://relay.example/v1/push', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string)).toEqual({ itemId: 'msg_42', kind: 'message', urgency: 'normal' });
  });

  it('returns rate-limit metadata on 429 sends', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: 'rate_limited', retryAfterSeconds: 17, rateLimitWindow: 'minute' }, { status: 429 }));
    const push = new HudPushClient({ auth: { workerUrl: 'https://relay.example', signedFetch: () => fetcher } as any, pushPublicKey: 'AQID' });

    await expect(push.send({ itemId: 'msg_42', kind: 'message' })).resolves.toEqual({
      ok: false,
      rateLimited: true,
      retryAfterSeconds: 17,
      rateLimitWindow: 'minute',
      error: 'rate_limited',
    });
  });

  it('lists devices, usage, and audit responses', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/devices')) return jsonResponse({ devices: [{ device_id: 'dev_1', platform: 'web', authorization_status: 'granted' }] });
      if (url.endsWith('/usage')) return jsonResponse({ usage: [{ day: '2026-05-05', delivered_count: 1 }] });
      return jsonResponse({ audit: [{ action: 'send', outcome: 'sent' }] });
    });
    const push = new HudPushClient({ auth: { workerUrl: 'https://relay.example', signedFetch: () => fetcher } as any, pushPublicKey: 'AQID' });

    await expect(push.devices()).resolves.toMatchObject([{ deviceId: 'dev_1', platform: 'web', authorizationStatus: 'granted' }]);
    await expect(push.usage()).resolves.toEqual([{ day: '2026-05-05', delivered_count: 1 }]);
    await expect(push.audit()).resolves.toEqual([{ action: 'send', outcome: 'sent' }]);
  });
});

describe('hudPushSwHandler', () => {
  it('shows a default notification for generic push payloads', async () => {
    const showNotification = vi.fn(async () => undefined);
    setGlobal('self', { registration: { showNotification } });
    const waitUntil = vi.fn((promise: Promise<void>) => promise);
    const handler = hudPushSwHandler();

    handler({
      data: { json: () => ({ generic: 'An item needs attention', itemId: 'msg_42', kind: 'message' }) },
      waitUntil,
    } as unknown as PushEvent);

    await waitUntil.mock.results[0].value;
    expect(showNotification).toHaveBeenCalledWith('An item needs attention', expect.objectContaining({
      body: 'New message update',
      tag: 'hudson:message:msg_42',
      data: { itemId: 'msg_42', kind: 'message' },
    }));
  });

  it('allows apps to customize notification formatting', async () => {
    const showNotification = vi.fn(async () => undefined);
    setGlobal('self', { registration: { showNotification } });
    const waitUntil = vi.fn((promise: Promise<void>) => promise);
    const handler = hudPushSwHandler({ format: ({ kind }) => ({ title: 'Custom', body: kind }) });

    handler({ data: { json: () => ({ itemId: 'job_1', kind: 'job' }) }, waitUntil } as unknown as PushEvent);

    await waitUntil.mock.results[0].value;
    expect(showNotification).toHaveBeenCalledWith('Custom', expect.objectContaining({ body: 'job' }));
  });
});
