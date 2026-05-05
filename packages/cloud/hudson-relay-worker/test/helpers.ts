import type { Env, HudSession, PushSubscriptionJSON } from '../src/types';
import { InMemoryD1 } from './d1-mock';

export const encryptionKey = '0123456789abcdef0123456789abcdef';

export function env(overrides: Partial<Env> = {}): Env & { HUD_DB: InMemoryD1 } {
  return {
    HUD_DB: new InMemoryD1(),
    HUD_SESSION_SECRET: 'test-session-secret',
    HUD_GITHUB_CLIENT_ID: 'github-client-id',
    HUD_GITHUB_CLIENT_SECRET: 'github-client-secret',
    HUD_PUSH_TOKEN_ENCRYPTION_KEY: encryptionKey,
    ...overrides,
  } as Env & { HUD_DB: InMemoryD1 };
}

export function session(userId = 'user-x'): HudSession {
  return { provider: 'github', providerUserId: userId, login: `login-${userId}`, email: `${userId}@example.com`, expiresAt: Date.now() + 60_000 };
}

export function subscription(id = 'one'): PushSubscriptionJSON {
  return {
    endpoint: `https://push.example.test/send/${id}`,
    keys: { p256dh: 'A'.repeat(88), auth: 'B'.repeat(22) },
  };
}

export function jsonRequest(path: string, body: unknown, init: RequestInit = {}): Request {
  const text = JSON.stringify(body);
  return new Request(`https://relay.example.test${path}`, {
    method: 'POST',
    body: text,
    headers: { 'content-type': 'application/json', 'content-length': String(new TextEncoder().encode(text).byteLength), ...(init.headers as Record<string, string> | undefined) },
    ...init,
  });
}

export async function readJson(res: Response): Promise<any> { return res.json(); }

export async function register(envValue: Env, user: HudSession, deviceId: string, sub = subscription(deviceId)): Promise<Response> {
  const { handlePush } = await import('../src/push');
  return handlePush(jsonRequest('/v1/push/devices/register', { deviceId, subscription: sub }), envValue, user) as Promise<Response>;
}

export const okPushFetcher: typeof fetch = async () => new Response('', { status: 201 });
export const gonePushFetcher: typeof fetch = async () => new Response('gone', { status: 410 });
