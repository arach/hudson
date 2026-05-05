import type { Env, HudSession, OAuthState } from './types';
import { signToken, verifyToken } from './crypto';
import { SESSION_COOKIE, SESSION_PREFIX, OAUTH_STATE_COOKIE, clearCookie, cookie, json, readCookie, redirect, safeReturnTo } from './util';

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_USER = 'https://api.github.com/user';
const GITHUB_EMAILS = 'https://api.github.com/user/emails';
const USER_AGENT = 'Hudson Relay Worker';
const STATE_TTL_MS = 10 * 60_000;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

type Fetcher = typeof fetch;

export async function handleAuth(request: Request, env: Env, fetcher: Fetcher = fetch): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/v1/auth/github/start') return start(request, env);
  if (request.method === 'GET' && url.pathname === '/v1/auth/github/callback') return callback(request, env, fetcher);
  if (request.method === 'GET' && url.pathname === '/v1/auth/session') {
    const session = await readHudSessionFromRequest(request, env);
    return json(200, session ? { authenticated: true, session } : { authenticated: false });
  }
  if (request.method === 'POST' && url.pathname === '/v1/auth/logout') {
    return json(200, { ok: true }, { 'set-cookie': clearCookie(SESSION_COOKIE, request.url) });
  }
  return undefined;
}

export async function readHudSessionFromRequest(request: Request, env: Env): Promise<HudSession | undefined> {
  const token = readBearer(request) ?? readCookie(request, SESSION_COOKIE);
  const raw = token?.startsWith(SESSION_PREFIX) ? token.slice(SESSION_PREFIX.length) : token;
  const session = await verifyToken<HudSession>(raw, env.HUD_SESSION_SECRET);
  if (!session || session.provider !== 'github' || session.expiresAt <= Date.now()) return undefined;
  if (!session.providerUserId || !session.login || !session.email) return undefined;
  return session;
}

function readBearer(request: Request): string | undefined {
  const auth = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1];
}

async function start(request: Request, env: Env): Promise<Response> {
  if (!env.HUD_GITHUB_CLIENT_ID) return json(500, { error: 'github_oauth_not_configured' });
  if (!env.HUD_SESSION_SECRET) return json(500, { error: 'session_secret_not_configured' });
  const url = new URL(request.url);
  const state: OAuthState = {
    nonce: randomString(),
    returnTo: safeReturnTo(url.searchParams.get('return_to')),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const stateToken = await signToken(state, env.HUD_SESSION_SECRET);
  const dest = new URL(GITHUB_AUTHORIZE);
  dest.searchParams.set('client_id', env.HUD_GITHUB_CLIENT_ID);
  dest.searchParams.set('redirect_uri', redirectUri(request, env));
  dest.searchParams.set('scope', 'user:email');
  dest.searchParams.set('state', state.nonce);
  dest.searchParams.set('allow_signup', 'true');
  return redirect(dest, [cookie(OAUTH_STATE_COOKIE, stateToken, request.url, Math.floor(STATE_TTL_MS / 1000))]);
}

async function callback(request: Request, env: Env, fetcher: Fetcher): Promise<Response> {
  if (!env.HUD_GITHUB_CLIENT_ID || !env.HUD_GITHUB_CLIENT_SECRET) return json(500, { error: 'github_oauth_not_configured' });
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return json(400, { error: 'missing_oauth_code_or_state' });
  const expected = await verifyToken<OAuthState>(readCookie(request, OAUTH_STATE_COOKIE), env.HUD_SESSION_SECRET);
  if (!expected || expected.expiresAt <= Date.now() || expected.nonce !== state) {
    return json(400, { error: 'invalid_oauth_state' }, { 'set-cookie': clearCookie(OAUTH_STATE_COOKIE, request.url) });
  }
  const token = await exchangeCode(fetcher, env, code, redirectUri(request, env));
  if (!token.ok) return json(502, { error: 'github_token_exchange_failed', detail: token.detail });
  const identity = await fetchIdentity(fetcher, token.accessToken);
  // access token is intentionally not persisted; it dies after identity fetch.
  if (!identity.ok) return json(identity.status, { error: identity.error, detail: identity.detail });
  const ttl = Number(env.HUD_SESSION_TTL_SECONDS) > 0 ? Number(env.HUD_SESSION_TTL_SECONDS) : SESSION_TTL_SECONDS;
  const session: HudSession = { provider: 'github', providerUserId: String(identity.user.id), login: identity.user.login, email: identity.email, expiresAt: Date.now() + ttl * 1000 };
  const bearer = SESSION_PREFIX + await signToken(session, env.HUD_SESSION_SECRET);
  const returnUrl = new URL(expected.returnTo, url.origin);
  return redirect(returnUrl, [clearCookie(OAUTH_STATE_COOKIE, request.url), cookie(SESSION_COOKIE, bearer, request.url, ttl)]);
}

async function exchangeCode(fetcher: Fetcher, env: Env, code: string, uri: string): Promise<{ ok: true; accessToken: string } | { ok: false; detail: string }> {
  const res = await fetcher(GITHUB_TOKEN, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT }, body: new URLSearchParams({ client_id: env.HUD_GITHUB_CLIENT_ID!, client_secret: env.HUD_GITHUB_CLIENT_SECRET!, code, redirect_uri: uri }) });
  const body = await res.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };
  return res.ok && body.access_token ? { ok: true, accessToken: body.access_token } : { ok: false, detail: body.error_description ?? body.error ?? `HTTP ${res.status}` };
}

async function fetchIdentity(fetcher: Fetcher, accessToken: string): Promise<{ ok: true; user: { id: number; login: string }; email: string } | { ok: false; status: number; error: string; detail?: string }> {
  const userRes = await gh(fetcher, GITHUB_USER, accessToken);
  if (!userRes.ok) return { ok: false, status: 502, error: 'github_user_failed', detail: `HTTP ${userRes.status}` };
  const user = await userRes.json() as { id?: number; login?: string };
  if (!user.id || !user.login) return { ok: false, status: 502, error: 'github_user_invalid' };
  const emailRes = await gh(fetcher, GITHUB_EMAILS, accessToken);
  if (!emailRes.ok) return { ok: false, status: 502, error: 'github_email_failed', detail: `HTTP ${emailRes.status}` };
  const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
  const email = emails.find(e => e.primary && e.verified)?.email;
  if (!email) return { ok: false, status: 403, error: 'verified_email_required' };
  return { ok: true, user: { id: user.id, login: user.login }, email };
}

function gh(fetcher: Fetcher, url: string, token: string): Promise<Response> {
  return fetcher(url, { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': USER_AGENT, 'x-github-api-version': '2022-11-28' } });
}

function redirectUri(request: Request, env: Env): string {
  return env.HUD_GITHUB_REDIRECT_URI || `${new URL(request.url).origin}/v1/auth/github/callback`;
}

function randomString(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
