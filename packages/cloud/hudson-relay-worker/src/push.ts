import type { Env, HudSession, PushDeviceRow, PushSubscriptionJSON } from './types';
import { decryptJson, encryptJson, sha256Base64Url, signWebPushJwt } from './crypto';
import { ip, json, positiveInt, randomId, readJsonWithCap } from './util';

const GENERIC = 'An item needs attention';
const DEFAULT_BODY_MAX = 16 * 1024;
const DEFAULT_PAYLOAD_MAX = 1024;

interface RegisterBody { deviceId?: string; kind?: string; platform?: string; subscription?: PushSubscriptionJSON; authorizationStatus?: string }
interface SendBody { itemId?: string; kind?: string; urgency?: 'low' | 'normal' | 'high'; deviceId?: string }

export async function handlePush(request: Request, env: Env, session: HudSession | undefined, fetcher: typeof fetch = fetch): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/v1/push/health') return json(200, { ok: true, service: 'hudson-relay-worker' });
  if (!url.pathname.startsWith('/v1/push')) return undefined;
  if (!session) return json(401, { error: 'unauthorized' });

  if (request.method === 'POST' && url.pathname === '/v1/push/devices/register') return registerDevice(request, env, session);
  if (request.method === 'POST' && url.pathname === '/v1/push/devices/unregister') return unregisterDevice(request, env, session);
  if (request.method === 'GET' && url.pathname === '/v1/push/devices') return listDevices(env, session);
  if (request.method === 'POST' && url.pathname === '/v1/push') return sendPush(request, env, session, fetcher);
  if (request.method === 'GET' && url.pathname === '/v1/push/usage') return usage(env, session);
  if (request.method === 'GET' && url.pathname === '/v1/push/audit') return audit(env, session);
  return undefined;
}

async function registerDevice(request: Request, env: Env, session: HudSession): Promise<Response> {
  const body = await readJsonWithCap<RegisterBody>(request, positiveInt(env.HUD_PUSH_BODY_MAX, DEFAULT_BODY_MAX));
  if (!body.ok) { await auditLog(env, request, session.providerUserId, 'register', body.error); return json(body.status, { error: body.error }); }
  const { deviceId, subscription } = body.value;
  const platform = body.value.platform ?? body.value.kind ?? 'web';
  if (!deviceId || !/^[A-Za-z0-9._:-]{1,128}$/.test(deviceId)) return deny(env, request, session, 'register', 400, 'invalid_device_id');
  if (platform !== 'web') return deny(env, request, session, 'register', 400, 'unsupported_platform');
  const valid = validateSubscription(subscription);
  if (!valid.ok) return deny(env, request, session, 'register', 400, valid.error);

  const cap = positiveInt(env.HUD_PUSH_DEVICE_CAP, 50);
  const count = await env.HUD_DB.prepare('SELECT COUNT(*) AS count FROM hud_push_devices WHERE user_id = ? AND revoked_at IS NULL').bind(session.providerUserId).first<{ count: number }>();
  if ((count?.count ?? 0) >= cap) return deny(env, request, session, 'register', 429, 'denied_device_cap');

  const tokenHash = await sha256Base64Url(subscription!.endpoint);
  const existing = await env.HUD_DB.prepare('SELECT user_id FROM hud_push_devices WHERE token_hash = ? AND revoked_at IS NULL').bind(tokenHash).first<{ user_id: string }>();
  if (existing && existing.user_id !== session.providerUserId) return deny(env, request, session, 'register', 403, 'denied_token_owned_by_other_user');

  const now = Date.now();
  const id = randomId('dev');
  const sealed = await encryptJson(subscription, env.HUD_PUSH_TOKEN_ENCRYPTION_KEY);
  await env.HUD_DB.prepare(`INSERT INTO hud_push_devices (id,user_id,device_id,platform,endpoint,token_hash,encrypted_subscription,authorization_status,created_at,updated_at,last_seen_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,device_id,platform) DO UPDATE SET endpoint=excluded.endpoint, token_hash=excluded.token_hash, encrypted_subscription=excluded.encrypted_subscription, authorization_status=excluded.authorization_status, revoked_at=NULL, updated_at=excluded.updated_at, last_seen_at=excluded.last_seen_at`).bind(id, session.providerUserId, deviceId, platform, subscription!.endpoint, tokenHash, sealed, body.value.authorizationStatus ?? 'granted', now, now, now).run();
  await auditLog(env, request, session.providerUserId, 'register', 'registered', JSON.stringify({ deviceId, platform }));
  return json(200, { ok: true, device: { deviceId, platform } });
}

async function unregisterDevice(request: Request, env: Env, session: HudSession): Promise<Response> {
  const body = await readJsonWithCap<{ deviceId?: string }>(request, positiveInt(env.HUD_PUSH_BODY_MAX, DEFAULT_BODY_MAX));
  if (!body.ok) return json(body.status, { error: body.error });
  if (!body.value.deviceId) return deny(env, request, session, 'unregister', 400, 'invalid_device_id');
  await env.HUD_DB.prepare('UPDATE hud_push_devices SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND device_id = ?').bind(Date.now(), Date.now(), session.providerUserId, body.value.deviceId).run();
  await auditLog(env, request, session.providerUserId, 'unregister', 'unregistered', JSON.stringify({ deviceId: body.value.deviceId }));
  return json(200, { ok: true });
}

async function listDevices(env: Env, session: HudSession): Promise<Response> {
  const rows = await env.HUD_DB.prepare('SELECT device_id, platform, authorization_status, revoked_at FROM hud_push_devices WHERE user_id = ?').bind(session.providerUserId).all();
  return json(200, { devices: rows.results ?? [] });
}

async function sendPush(request: Request, env: Env, session: HudSession, fetcher: typeof fetch): Promise<Response> {
  const body = await readJsonWithCap<SendBody>(request, positiveInt(env.HUD_PUSH_BODY_MAX, DEFAULT_BODY_MAX));
  if (!body.ok) { await auditLog(env, request, session.providerUserId, 'send', body.error); return json(body.status, { error: body.error }); }
  const itemId = clean(body.value.itemId, 160);
  const kind = clean(body.value.kind, 48);
  if (!itemId || !kind) return deny(env, request, session, 'send', 400, 'invalid_payload');
  const payload = { generic: GENERIC, itemId, kind };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > positiveInt(env.HUD_PUSH_PAYLOAD_MAX, DEFAULT_PAYLOAD_MAX)) return deny(env, request, session, 'send', 413, 'payload_too_large');

  const userLimit = await chargeUserLimits(env, session.providerUserId);
  if (!userLimit.ok) { await auditLog(env, request, session.providerUserId, 'send', userLimit.outcome); return json(429, { error: 'rate_limited', retryAfterSeconds: userLimit.retryAfterSeconds, rateLimitWindow: userLimit.window }); }

  const sql = body.value.deviceId ? 'SELECT * FROM hud_push_devices WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL' : 'SELECT * FROM hud_push_devices WHERE user_id = ? AND revoked_at IS NULL';
  const stmt = body.value.deviceId ? env.HUD_DB.prepare(sql).bind(session.providerUserId, body.value.deviceId) : env.HUD_DB.prepare(sql).bind(session.providerUserId);
  const rows = (await stmt.all<PushDeviceRow>()).results ?? [];
  let delivered = 0, failed = 0, rateLimited = 0;
  let deviceRetryAfterSeconds: number | undefined;
  for (const row of rows.filter(r => r.platform === 'web')) {
    const devLimit = await chargeDeviceLimit(env, session.providerUserId, row.device_id);
    if (!devLimit.ok) { rateLimited++; deviceRetryAfterSeconds ??= devLimit.retryAfterSeconds; await attempt(env, session.providerUserId, row.device_id, itemId, kind, 'rate_limited'); continue; }
    const sub = await decryptJson<PushSubscriptionJSON>(row.encrypted_subscription, env.HUD_PUSH_TOKEN_ENCRYPTION_KEY);
    const res = await deliverWebPush(fetcher, env, sub, payload, body.value.urgency ?? 'normal');
    if (res.status === 404 || res.status === 410) await revokeDevice(env, row.id);
    if (res.ok) delivered++; else failed++;
    await attempt(env, session.providerUserId, row.device_id, itemId, kind, res.ok ? 'delivered' : 'failed', res.status, res.reason);
  }
  await usageUpsert(env, session.providerUserId, delivered, failed);
  await auditLog(env, request, session.providerUserId, 'send', delivered > 0 ? 'sent' : 'no_delivery', JSON.stringify({ itemId, kind, delivered, failed, rateLimited }));
  if (body.value.deviceId && rateLimited > 0 && delivered === 0 && failed === 0) return json(429, { error: 'rate_limited', retryAfterSeconds: deviceRetryAfterSeconds, rateLimitWindow: 'device-minute' });
  return json(200, { ok: true, delivered, failed, rateLimited });
}

async function deliverWebPush(fetcher: typeof fetch, env: Env, sub: PushSubscriptionJSON, payload: unknown, urgency: string): Promise<{ ok: boolean; status: number; reason?: string }> {
  if (!env.HUD_PUSH_PRIVATE_KEY || !env.HUD_PUSH_PUBLIC_KEY || !env.HUD_PUSH_SUBJECT) return { ok: false, status: 500, reason: 'push_not_configured' };
  const endpoint = new URL(sub.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  const jwt = await signWebPushJwt(audience, env.HUD_PUSH_SUBJECT, env.HUD_PUSH_PRIVATE_KEY);
  const res = await fetcher(sub.endpoint, { method: 'POST', headers: { authorization: `vapid t=${jwt}, k=${env.HUD_PUSH_PUBLIC_KEY}`, 'content-type': 'application/json', ttl: '3600', urgency }, body: JSON.stringify(payload) });
  return { ok: res.ok || res.status === 201 || res.status === 202, status: res.status, reason: await res.text().catch(() => '') };
}

async function chargeUserLimits(env: Env, userId: string) {
  for (const [kind, seconds, limit] of [['minute',60,positiveInt(env.HUD_PUSH_RATE_PER_MINUTE,10)], ['hour',3600,positiveInt(env.HUD_PUSH_RATE_PER_HOUR,100)], ['day',86400,positiveInt(env.HUD_PUSH_RATE_PER_DAY,500)]] as const) {
    const charged = await chargeBucket(env, `user:${userId}`, kind, seconds, limit);
    if (!charged.ok) return { ...charged, outcome: `denied_rate_user_${kind}` };
  }
  return { ok: true as const };
}
async function chargeDeviceLimit(env: Env, userId: string, deviceId: string) { return chargeBucket(env, `device:${userId}:${deviceId}`, 'minute', 60, positiveInt(env.HUD_PUSH_DEVICE_RATE_PER_MINUTE,3)); }
async function chargeBucket(env: Env, key: string, window: string, seconds: number, limit: number): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number; window: string }> {
  const start = Math.floor(Date.now() / (seconds * 1000)) * seconds * 1000;
  const row = await env.HUD_DB.prepare(`INSERT INTO hud_push_rate_buckets (bucket_key, window_kind, window_start, count, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(bucket_key, window_kind, window_start) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at RETURNING count`).bind(key, window, start, Date.now()).first<{ count: number }>();
  if ((row?.count ?? 1) <= limit) return { ok: true };
  await env.HUD_DB.prepare('UPDATE hud_push_rate_buckets SET count = count - 1 WHERE bucket_key = ? AND window_kind = ? AND window_start = ?').bind(key, window, start).run();
  return { ok: false, retryAfterSeconds: Math.ceil((start + seconds * 1000 - Date.now()) / 1000), window };
}

function validateSubscription(sub: unknown): { ok: true } | { ok: false; error: string } {
  const s = sub as PushSubscriptionJSON | undefined;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 2048) return { ok: false, error: 'invalid_subscription' };
  try { const u = new URL(s.endpoint); if (u.protocol !== 'https:') return { ok: false, error: 'invalid_subscription_endpoint' }; } catch { return { ok: false, error: 'invalid_subscription_endpoint' }; }
  if (!s.keys || !validB64Url(s.keys.p256dh, 40, 256) || !validB64Url(s.keys.auth, 8, 64)) return { ok: false, error: 'invalid_subscription_keys' };
  return { ok: true };
}
function validB64Url(v: unknown, min: number, max: number): boolean { return typeof v === 'string' && v.length >= min && v.length <= max && /^[A-Za-z0-9_-]+$/.test(v); }
function clean(v: unknown, max: number): string | undefined { return typeof v === 'string' && v.length > 0 && v.length <= max && /^[\w:./-]+$/.test(v) ? v : undefined; }

async function deny(env: Env, request: Request, session: HudSession, action: string, status: number, outcome: string): Promise<Response> { await auditLog(env, request, session.providerUserId, action, outcome); return json(status, { error: outcome }); }
async function revokeDevice(env: Env, id: string): Promise<void> { await env.HUD_DB.prepare('UPDATE hud_push_devices SET revoked_at = ?, updated_at = ? WHERE id = ?').bind(Date.now(), Date.now(), id).run(); }
async function attempt(env: Env, userId: string, deviceId: string | undefined, itemId: string, kind: string, status: string, pushStatus?: number, reason?: string): Promise<void> { await env.HUD_DB.prepare('INSERT INTO hud_push_attempts (id,user_id,device_id,item_id,kind,status,push_status,push_reason,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(randomId('att'), userId, deviceId ?? null, itemId, kind, status, pushStatus ?? null, reason ?? null, Date.now()).run(); }
async function usageUpsert(env: Env, userId: string, delivered: number, failed: number): Promise<void> { const day = new Date().toISOString().slice(0,10); await env.HUD_DB.prepare('INSERT INTO hud_push_usage_daily (user_id,day,attempted_count,delivered_count,failed_count,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET attempted_count=attempted_count+excluded.attempted_count, delivered_count=delivered_count+excluded.delivered_count, failed_count=failed_count+excluded.failed_count, updated_at=excluded.updated_at').bind(userId, day, delivered + failed, delivered, failed, Date.now()).run(); }
async function usage(env: Env, session: HudSession): Promise<Response> { const rows = await env.HUD_DB.prepare('SELECT * FROM hud_push_usage_daily WHERE user_id = ? ORDER BY day DESC LIMIT 30').bind(session.providerUserId).all(); return json(200, { usage: rows.results ?? [] }); }
async function audit(env: Env, session: HudSession): Promise<Response> { const rows = await env.HUD_DB.prepare('SELECT action,outcome,detail,created_at FROM hud_push_audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(session.providerUserId).all(); return json(200, { audit: rows.results ?? [] }); }
async function auditLog(env: Env, request: Request, userId: string | undefined, action: string, outcome: string, detail?: string): Promise<void> { await env.HUD_DB.prepare('INSERT INTO hud_push_audit_log (id,user_id,action,outcome,detail,ip,user_agent,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(randomId('aud'), userId ?? null, action, outcome, detail ?? null, ip(request) ?? null, request.headers.get('user-agent') ?? null, Date.now()).run(); }

export const __test = { chargeBucket };
