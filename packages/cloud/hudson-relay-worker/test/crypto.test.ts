import { describe, expect, it } from 'vitest';
import { constantTimeEqual, decryptJson, encryptJson, signToken, verifyToken } from '../src/crypto';
import { __test } from '../src/push';
import { env } from './helpers';

describe('crypto defenses', () => {
  it('roundtrips an HMAC-signed bearer payload and rejects tampering', async () => {
    const secret = 'session-secret';
    const payload = { provider: 'github', providerUserId: '123', login: 'alice', email: 'alice@example.test', expiresAt: Date.now() + 1000 };
    const token = await signToken(payload, secret);

    await expect(verifyToken(token, secret)).resolves.toEqual(payload);
    await expect(verifyToken(`${token.slice(0, -1)}x`, secret)).resolves.toBeUndefined();
  });

  it('roundtrips AES-GCM JSON encryption', async () => {
    const value = { endpoint: 'https://push.example.test/send/1', keys: { p256dh: 'A'.repeat(88), auth: 'B'.repeat(22) } };
    const sealed = await encryptJson(value, '0123456789abcdef0123456789abcdef');

    expect(sealed).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(decryptJson(sealed, '0123456789abcdef0123456789abcdef')).resolves.toEqual(value);
  });

  it('compares strings in constant-time-compatible form with correct equality semantics', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('atomically increments an existing rate-limit bucket then refunds denied increments', async () => {
    const e = env();
    const first = await __test.chargeBucket(e, 'user:u1', 'minute', 60, 1);
    const denied = await __test.chargeBucket(e, 'user:u1', 'minute', 60, 1);

    expect(first).toEqual({ ok: true });
    expect(denied).toMatchObject({ ok: false, window: 'minute' });
    expect(denied.ok === false ? denied.retryAfterSeconds : 0).toBeGreaterThan(0);
    expect(e.HUD_DB.rateBuckets).toHaveLength(1);
    expect(e.HUD_DB.rateBuckets[0].count).toBe(1);
  });
});
