import { describe, expect, it } from 'vitest';
import { handleAuth } from '../src/auth';
import { signToken } from '../src/crypto';
import { handlePush } from '../src/push';
import { OAUTH_STATE_COOKIE } from '../src/util';
import { env, jsonRequest, okPushFetcher, readJson, register, session, subscription } from './helpers';

const vapidPrivateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsY1epPgWBMxKOrNc
5gn+nOiPACGW+o7tzyiKBniUD9yhRANCAATFWCuA2okHyhnwcawD6ZZnXOnM5LO5
35VnEGJoKIOEAK+zSGU+CkALfXHcPe+1NdaBvW9fV+rLw4qlISrx5p0R
-----END PRIVATE KEY-----`;

function pushEnv(overrides = {}) {
  return env({ HUD_PUSH_PRIVATE_KEY: vapidPrivateKey, HUD_PUSH_PUBLIC_KEY: 'public-key', HUD_PUSH_SUBJECT: 'mailto:test@example.test', ...overrides });
}

async function send(e: ReturnType<typeof env>, user = session('user-x'), body: Record<string, unknown> = { itemId: 'item-1', kind: 'alert' }, fetcher: typeof fetch = okPushFetcher) {
  return handlePush(jsonRequest('/v1/push', body), e, user, fetcher) as Promise<Response>;
}

describe('push worker defense paths', () => {
  it('rejects cross-user registration for an existing subscription token hash with 403', async () => {
    const e = env();
    const sub = subscription('shared');
    expect((await register(e, session('user-x'), 'device-a', sub)).status).toBe(200);

    const denied = await register(e, session('user-y'), 'device-b', sub);

    expect(denied.status).toBe(403);
    expect(await readJson(denied)).toEqual({ error: 'denied_token_owned_by_other_user' });
  });

  it.each([
    ['minute', { HUD_PUSH_RATE_PER_MINUTE: '1', HUD_PUSH_RATE_PER_HOUR: '99', HUD_PUSH_RATE_PER_DAY: '99' }, 'minute'],
    ['hour', { HUD_PUSH_RATE_PER_MINUTE: '99', HUD_PUSH_RATE_PER_HOUR: '1', HUD_PUSH_RATE_PER_DAY: '99' }, 'hour'],
    ['day', { HUD_PUSH_RATE_PER_MINUTE: '99', HUD_PUSH_RATE_PER_HOUR: '99', HUD_PUSH_RATE_PER_DAY: '1' }, 'day'],
  ])('returns 429 with retryAfterSeconds for per-%s user limits', async (_name, limits, window) => {
    const e = pushEnv(limits);
    const user = session(`user-${window}`);
    await register(e, user, 'device-a');
    expect((await send(e, user)).status).toBe(200);

    const denied = await send(e, user);
    const body = await readJson(denied);

    expect(denied.status).toBe(429);
    expect(body).toMatchObject({ error: 'rate_limited', rateLimitWindow: window });
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('returns 429 with retryAfterSeconds for a targeted per-device limit', async () => {
    const e = pushEnv({ HUD_PUSH_RATE_PER_MINUTE: '99', HUD_PUSH_RATE_PER_HOUR: '99', HUD_PUSH_RATE_PER_DAY: '99', HUD_PUSH_DEVICE_RATE_PER_MINUTE: '1' });
    const user = session('user-device-rate');
    await register(e, user, 'device-a');
    expect((await send(e, user, { itemId: 'item-1', kind: 'alert', deviceId: 'device-a' })).status).toBe(200);

    const denied = await send(e, user, { itemId: 'item-2', kind: 'alert', deviceId: 'device-a' });
    const body = await readJson(denied);

    expect(denied.status).toBe(429);
    expect(body).toMatchObject({ error: 'rate_limited', rateLimitWindow: 'device-minute' });
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('enforces HUD_PUSH_DEVICE_CAP with default-compatible cap behavior', async () => {
    const e = env({ HUD_PUSH_DEVICE_CAP: '2' });
    const user = session('user-cap');
    expect((await register(e, user, 'device-1')).status).toBe(200);
    expect((await register(e, user, 'device-2')).status).toBe(200);

    const denied = await register(e, user, 'device-3');

    expect(denied.status).toBe(429);
    expect(await readJson(denied)).toEqual({ error: 'denied_device_cap' });
  });

  it('enforces HUD_PUSH_PAYLOAD_MAX before delivery', async () => {
    const e = pushEnv({ HUD_PUSH_PAYLOAD_MAX: '80' });
    const user = session('user-payload');
    await register(e, user, 'device-a');

    const denied = await send(e, user, { itemId: 'x'.repeat(70), kind: 'alert' });

    expect(denied.status).toBe(413);
    expect(await readJson(denied)).toEqual({ error: 'payload_too_large' });
  });

  it('enforces HUD_PUSH_BODY_MAX by content length', async () => {
    const e = env({ HUD_PUSH_BODY_MAX: '20' });
    const res = await handlePush(jsonRequest('/v1/push/devices/register', { deviceId: 'device-a', subscription: subscription('a') }), e, session('user-body')) as Response;

    expect(res.status).toBe(413);
    expect(await readJson(res)).toEqual({ error: 'body_too_large' });
  });

  it('rejects OAuth callback state mismatch and clears the forged state cookie', async () => {
    const e = env();
    const forged = await signToken({ nonce: 'real', returnTo: '/', expiresAt: Date.now() + 60_000 }, e.HUD_SESSION_SECRET);
    const req = new Request('https://relay.example.test/v1/auth/github/callback?code=abc&state=forged', { headers: { cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(forged)}` } });

    const res = await handleAuth(req, e, async () => new Response('{}')) as Response;

    expect(res.status).toBe(403);
    expect(await readJson(res)).toEqual({ error: 'invalid_oauth_state' });
    expect(res.headers.get('set-cookie')).toContain(`${OAUTH_STATE_COOKIE}=`);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects GitHub identity without a verified primary email', async () => {
    const e = env();
    const state = await signToken({ nonce: 'nonce', returnTo: '/', expiresAt: Date.now() + 60_000 }, e.HUD_SESSION_SECRET);
    const req = new Request('https://relay.example.test/v1/auth/github/callback?code=abc&state=nonce', { headers: { cookie: `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}` } });
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/access_token')) return new Response(JSON.stringify({ access_token: 'gho_test' }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.endsWith('/user')) return new Response(JSON.stringify({ id: 42, login: 'octo' }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify([{ email: 'octo@example.test', primary: true, verified: false }]), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const res = await handleAuth(req, e, fetcher) as Response;

    expect(res.status).toBe(403);
    expect(await readJson(res)).toMatchObject({ error: 'verified_email_required' });
  });

  it.each([410, 404])('auto-revokes stale subscriptions when push gateway returns %s', async (status) => {
    const e = pushEnv({ HUD_PUSH_RATE_PER_MINUTE: '99', HUD_PUSH_RATE_PER_HOUR: '99', HUD_PUSH_RATE_PER_DAY: '99' });
    const user = session(`user-stale-${status}`);
    await register(e, user, 'device-a');

    const res = await send(e, user, { itemId: 'item-1', kind: 'alert' }, async () => new Response(status === 410 ? 'gone' : 'not found', { status }));

    expect(res.status).toBe(200);
    expect((await readJson(res))).toMatchObject({ delivered: 0, failed: 1 });
    expect(e.HUD_DB.devices[0].revoked_at).toEqual(expect.any(Number));
  });
});
