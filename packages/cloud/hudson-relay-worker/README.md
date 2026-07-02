# hudson-relay-worker

Cloudflare Worker template implementing the auth + push relay for Hudson apps. Reference impl for HUD-004 phase 1 (TypeScript-only, GitHub auth, Web Push, no APNs).

This is the **server-side** half. The client-side libraries (`hudsonkit/auth`, `hudsonkit/push`, `hudsonkit/push/sw`) and the `hudson auth init` / `hudson push init` CLI ship separately.

## What you get

- 11 endpoints (4 auth + 7 push, last is unauth health)
- 5 D1 tables: `hud_push_devices`, `hud_push_attempts`, `hud_push_usage_daily`, `hud_push_rate_buckets`, `hud_push_audit_log`
- All defenses from the spec: stateless signed bearer, OAuth state CSRF, verified-email-only, constant-time HMAC, AES-GCM at rest, atomic check-and-increment with refund, per-user + per-device sliding-window rate limits, generic-alert-text-only payloads, audit log on every state change AND denial, stale-subscription auto-revoke on 410/404

## One-time setup

### 1. Cloudflare account + D1

```bash
bunx wrangler d1 create hudson-relay-db
# Copy the printed `database_id` into wrangler.jsonc → d1_databases[0].database_id
```

### 2. Apply migrations

```bash
bunx wrangler d1 migrations apply hudson-relay-db --remote
```

### 3. GitHub OAuth app

- developer.github.com → Settings → Developer settings → OAuth Apps → New OAuth App
- **Authorization callback URL**: `https://<your-worker-domain>/v1/auth/github/callback`
- Save. Note the **Client ID**, generate a **Client Secret**.

### 4. Web Push signing keys

Generate an ES256 keypair (the Web Push spec calls these the "VAPID" keys; we use Hudson naming on the public surface):

```bash
# One-liner with openssl + node, or use the hudson push init CLI when it ships
openssl ecparam -genkey -name prime256v1 -noout -out push-private.pem
openssl ec -in push-private.pem -pubout -out push-public.pem
# Convert to base64url-encoded uncompressed point for HUD_PUSH_PUBLIC_KEY
# Convert PKCS8 PEM to single-line for HUD_PUSH_PRIVATE_KEY
```

The CLI (P1.3) automates this. Until then, follow [Web Push: VAPID key generation](https://datatracker.ietf.org/doc/html/rfc8292).

### 5. Upload secrets + config

```bash
# Required secrets (private — uploaded via `wrangler secret put`):
echo -n "$(head -c 32 /dev/urandom | base64)" | bunx wrangler secret put HUD_SESSION_SECRET
echo -n "<github_client_id>"                 | bunx wrangler secret put HUD_GITHUB_CLIENT_ID
echo -n "<github_client_secret>"             | bunx wrangler secret put HUD_GITHUB_CLIENT_SECRET
echo -n "$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')" | bunx wrangler secret put HUD_PUSH_TOKEN_ENCRYPTION_KEY
cat push-private.pem                          | bunx wrangler secret put HUD_PUSH_PRIVATE_KEY
echo -n "mailto:you@example.com"             | bunx wrangler secret put HUD_PUSH_SUBJECT

# Public config — edit wrangler.jsonc → vars → HUD_PUSH_PUBLIC_KEY directly
```

### 6. Deploy

```bash
bunx wrangler deploy
# → https://hudson-relay-worker.<your-subdomain>.workers.dev
```

Test the auth path:

```
https://<your-worker>/v1/auth/github/start?return_to=/
```

## Optional env vars (rate limit tuning)

All env-tunable; defaults baked in:

| Var | Default |
|---|---|
| `HUD_PUSH_RATE_PER_MINUTE` | 10 |
| `HUD_PUSH_RATE_PER_HOUR` | 100 |
| `HUD_PUSH_RATE_PER_DAY` | 500 |
| `HUD_PUSH_DEVICE_RATE_PER_MINUTE` | 3 |
| `HUD_PUSH_DEVICE_CAP` | 50 |
| `HUD_PUSH_BODY_MAX` | 16384 (16 KB) |
| `HUD_PUSH_PAYLOAD_MAX` | 1024 (1 KB) |
| `HUD_SESSION_TTL_SECONDS` | 2592000 (30 d) |
| `HUD_GITHUB_REDIRECT_URI` | `<origin>/v1/auth/github/callback` |
| `HUD_ALLOWED_ORIGINS` | _(empty)_ — comma-separated extra origins allowed on cookie-authenticated mutating requests. The worker's own origin and the `HUD_GITHUB_REDIRECT_URI` origin are always allowed. Cookie-authed POSTs must send a matching `Origin` header (CSRF guard); bearer-authenticated requests are exempt. |

## Endpoints

### Auth

- `GET  /v1/auth/github/start?return_to=…` — begin OAuth, sets state cookie, redirects to GitHub
- `GET  /v1/auth/github/callback?code=…&state=…` — verify state, exchange code, fetch identity, issue session
- `GET  /v1/auth/session` — introspect current session
- `POST /v1/auth/logout` — clear session cookie

### Push (all require a valid session bearer)

- `POST /v1/push/devices/register` — register a device's Web Push subscription
- `POST /v1/push/devices/unregister`
- `GET  /v1/push/devices` — list user's registered devices
- `POST /v1/push` — send a generic-text + opaque-IDs notification to one or all of the user's devices
- `GET  /v1/push/usage` — daily counts (last 30 days)
- `GET  /v1/push/audit` — recent audit log entries (last 100)
- `GET  /v1/push/health` — unauthenticated health probe

## Bearer format

```
hud_session_<base64url(jsonPayload)>.<base64url(hmac256(payload, HUD_SESSION_SECRET))>
```

Payload:

```json
{
  "provider": "github",
  "providerUserId": "12345",
  "login": "alice",
  "email": "alice@example.com",
  "expiresAt": 1758000000000
}
```

`providerUserId` is the trust boundary for every push-side query. Browsers receive the bearer as a `Set-Cookie`; native clients receive it via custom URL scheme and use `Authorization: Bearer <bearer>` on subsequent calls.

## What's NOT here (deferred)

- APNs (v2 — adds `platform = 'ios'` rows + `.p8` signing path)
- Multi-provider auth (X, Apple, Gmail — each is a `fetchIdentity()` swap)
- Per-user revoke API (v1 = rotate `HUD_SESSION_SECRET`)
- Multi-recipient broadcast / topic fan-out

See [`docs/specs/hud-004-auth-and-push.md`](../../../docs/specs/hud-004-auth-and-push.md) for the full design context.

## Testing (TODO — P1.1.5)

`vitest.config.ts` is wired but no tests yet. Defense paths to cover before this Worker hits production:

- Cross-user 403 (token-hash uniqueness)
- Rate-limit 429 with `retryAfterSeconds`
- Device cap
- Payload-size cap
- OAuth state mismatch
- Unverified-email rejection
- Stale-subscription auto-revoke on 410/404

Plan: dedicated follow-up PR.
