# Notes from OpenScout: GitHub Auth + Push Notifications

> Cross-project knowledge transfer. I (Claude, working in OpenScout) just shipped two things you might want to crib from: a Cloudflare-Worker-backed GitHub auth flow, and a defended push-notification relay that fans out to APNs without ever putting Apple creds on a user's machine. This is what I built, why I built it that way, and what you'd need to do to recreate either piece.
>
> Audience: a fellow dev/agent on Hudson. You know your project's direction better than I do — extract whatever's useful, ignore the rest.

## Why these two together

They're paired. The push relay only exists because it's gated by the auth flow: a user can only register their own devices and only push to themselves. Without the auth piece, the relay is a public APNs cannon. So I'll cover auth first, then push relay on top of it.

Both run in a single Cloudflare Worker (`apps/mesh-front-door` in the OpenScout repo). One Worker, one D1 database, ~1500 LOC of TypeScript. No external auth providers beyond GitHub OAuth, no third-party push services.

---

## Part 1 — GitHub OAuth + signed sessions

### What I built

A Cloudflare Worker that:
1. Bounces users to GitHub for OAuth.
2. On callback, reads their `id`/`login`/verified email via the GitHub API.
3. Mints a signed bearer token (HMAC-SHA256 over a JSON payload) and returns it as either a `Set-Cookie` (for browser flows) or a query param on a custom URL scheme (for native flows).
4. Validates that bearer on every subsequent request via a single middleware.

No database for sessions. No Redis. The bearer is self-contained and verifiable with just `OPENSCOUT_SESSION_SECRET`.

### Why I made each call this way

**Why GitHub specifically.** OpenScout is dev-tooling — every user has a GitHub account already. Lowest friction. Adding Google/Apple later is a swap of the OAuth client + the `fetchIdentity()` function; the bearer-issuing piece is provider-agnostic.

**Why stateless tokens, no session DB.** At our scale (zero users, single-user dogfood) a sessions table would be 100% overhead. The signed bearer is *self-validating*: payload + HMAC, the worker only needs the secret. Trade-off: revocation requires rotating the secret (which invalidates everyone's session). For our threat model that's fine; if you need per-user revoke, add a `revoked_at` column on a sessions table and check it in the middleware.

**Why two delivery modes (cookie + bearer).** Browser users want a cookie so navigation just works. Native apps and server-to-server callers want an `Authorization: Bearer …` header (cookies are awkward in non-browser HTTP clients). The middleware reads from either:

```ts
const token = readBearerSessionToken(request) ?? readCookie(request, COOKIE_NAME);
```

Caller picks the mode that's natural for them.

**Why a custom URL scheme for native.** The OAuth callback has to be an HTTPS URL Apple/GitHub will redirect to. But we want the resulting session to land in a native iOS app, not in Safari. So the worker accepts a `return_to=/v1/auth/native/complete` query param at OAuth start, and on completion, instead of setting a cookie, it does a 302 to `openscout://osn-auth?session=<token>&expires_at=…`. iOS handles the custom scheme, the app reads `session`, stores it in Keychain. From that point on, the app sends `Authorization: Bearer osn_session_<token>` on every API call.

**Why prefix the bearer with `osn_session_`.** The `Authorization` header is a global namespace. By forcing the prefix, you can later add other bearer types (admin tokens, machine credentials) without ambiguity. The middleware strips the prefix before verifying.

### The bearer format

```
<base64url(json_payload)>.<base64url(hmac256(payload, SESSION_SECRET))>
```

The payload is just:

```ts
{
  provider: "github",
  providerUserId: "12345",       // GitHub user.id, immutable
  login: "alice",
  email: "alice@example.com",
  expiresAt: 1758_000_000_000     // ms since epoch
}
```

`providerUserId` is the *trust boundary* — it's what every downstream feature (push relay, mesh membership, etc.) uses to scope per-user data. Don't use `login` for this; logins can be renamed on GitHub.

### Step-by-step to recreate this

#### 1. Set up the GitHub OAuth app

- developer.github.com → Settings → Developer settings → OAuth Apps → "New OAuth App"
- **Application name**: whatever shows in the consent screen
- **Homepage URL**: your app's marketing site
- **Authorization callback URL**: `https://your-worker-domain.example/v1/auth/github/callback`
- Save. You get a **Client ID** (public-ish) and can generate a **Client Secret** (treat like a password).

#### 2. Set up the Cloudflare Worker

```bash
bunx wrangler init my-auth-worker
cd my-auth-worker
```

In `wrangler.jsonc`, add a custom domain route and (optionally) a D1 binding if you'll use D1 for anything else. Sessions don't need D1.

#### 3. Wire the worker secrets

```bash
bunx wrangler secret put OPENSCOUT_GITHUB_CLIENT_ID
bunx wrangler secret put OPENSCOUT_GITHUB_CLIENT_SECRET
bunx wrangler secret put OPENSCOUT_SESSION_SECRET   # any long random string
```

For the session secret: `head -c 32 /dev/urandom | base64`. Anything ≥32 bytes of entropy is fine. Treat it like a password — rotating it invalidates every session.

#### 4. Implement the four endpoints

You need:

- `GET /v1/auth/github/start?return_to=…` — bounces to GitHub with state cookie
- `GET /v1/auth/github/callback?code=…&state=…` — exchanges code, fetches identity, issues session
- `GET /v1/auth/session` — for clients to introspect their own session
- `POST /v1/auth/logout` — clears the cookie

The reference implementation is ~400 LOC at `apps/mesh-front-door/src/auth.ts` in OpenScout. Key shapes:

```ts
export async function readOpenScoutSessionFromRequest(
  request: Request,
  env: { OPENSCOUT_SESSION_SECRET?: string },
): Promise<OpenScoutSession | undefined> {
  const token = readBearerSessionToken(request) ?? readCookie(request, COOKIE_NAME);
  if (!token) return undefined;
  const session = await verifySignedToken<OpenScoutSession>(token, env.OPENSCOUT_SESSION_SECRET);
  if (!session || session.expiresAt <= Date.now()) return undefined;
  return session;
}
```

That one function is the auth surface for every other handler. Every protected endpoint starts with:

```ts
const session = await readOpenScoutSessionFromRequest(request, env);
if (!session) return json(401, { error: "unauthorized" });
const userId = session.providerUserId;  // trust boundary
```

#### 5. State-cookie CSRF

When you bounce to GitHub at step `start`, set a short-lived signed `osn_oauth_state` cookie containing the same `state` value you send to GitHub. On callback, verify GitHub's returned `state` matches. Without this, a phisher could forge a callback and pin a session to a victim's browser.

#### 6. Watch out for

- **Verified email only.** Read `/user/emails`, take a `primary && verified` address. If GitHub returns no verified email, fail the callback — don't let unverified-email accounts in.
- **Constant-time HMAC compare.** Use a constant-time string compare for the signature check, otherwise timing attacks can leak it. (See `constantTimeEqual` in the reference.)
- **Cookies on HTTP locally.** In dev (no HTTPS) the `Secure` cookie attribute is invalid — strip it conditionally based on `request.url`.
- **Don't store GitHub's access token.** You only need it during the callback to fetch identity. After that, throw it away. Storing it expands the blast radius of a worker compromise.

### Things that worked, things I'd revisit

- **Worked**: a single sub-400-LOC file is the entire auth surface. No framework, no library beyond `crypto.subtle` (built into Workers). Easy to read, easy to fork.
- **Worked**: making `readSessionFromRequest` the canonical entry point. Every feature added later (push relay, mesh memberships) just calls it; no duplicated cookie/bearer logic.
- **Would revisit**: 30-day session TTL is long for a native app stashing a bearer in plain Keychain. Consider 24h with refresh.
- **Would revisit**: I never wired multi-provider. The codepath is OAuth-shaped (start/exchange/identity), so adding Google would be ~200 more LOC; not free, but bounded.

---

## Part 2 — Push notifications via a Cloudflare relay

### What I built

A second set of routes on the same worker (`/v1/push/*`) backed by Cloudflare D1, that:

1. Accepts device-token registrations from authenticated users (the bearer from Part 1).
2. Encrypts each device token with AES-GCM before storing in D1.
3. On send, mints an ES256 JWT for APNs, calls Apple's HTTP/2 endpoint, records the attempt.
4. Defends aggressively: per-user/per-device sliding-window rate limits, device caps, body/payload size caps, token format validation, cross-user access denial, audit log.

Native iOS app talks to a local Mac broker (over a paired LAN connection); the broker holds the user's session bearer and is the only thing that talks to the relay. iOS never has APNs creds, never has the relay bearer.

### Why a relay at all

If you ship APNs creds to every user's machine you have a key-management nightmare and you're one leaked dotenv away from someone else's notifications going to your users. The relay model keeps the APNs `.p8` and the encryption key in *one place* (Cloudflare secrets), and every send goes through code you control.

The relay also makes "generic alert text only" enforceable. The APNs payload from the relay always says *"Scout needs attention"* / *"A local agent needs your input."* — never a prompt, never an agent reply, never a file path. The actual content stays behind the user's local broker; the push is just a "wake the app" tap. For us this is privacy + content-rating safety. Alert text inside an APNs payload is opaquely transmitted but it sits in Apple's logs and can show up on lock screens regardless of app state.

### Why D1 instead of Workers KV or Durable Objects

- **Devices** are relational (per-user, indexed by token hash, scoped to bundle ID + APNs env). SQL fits. KV would bake in a single index choice.
- **Rate buckets** need atomic increment-with-limit. D1's `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count` is one round-trip and atomic. KV would race.
- **Audit log** is queryable by user — again, SQL.
- **Durable Objects** would work but you'd need one DO per user for isolation, which is a lot of objects for our scale.

### Why per-user rate limits with sliding-window buckets

Three windows: 10/min, 100/hr, 500/day per user. Plus a 4th bucket: 3/min per device. The reasoning:

- **Per-minute**: catches stuck loops (an agent in a tight retry loop pushing every 100ms).
- **Per-hour**: catches "loud user" patterns that aren't clearly bugs but are unfriendly to the recipient.
- **Per-day**: nobody wants more than 500 notifications a day from one app. If we hit it, something is wrong.
- **Per-device**: separate bucket because one user with multiple devices shouldn't have a single noisy session burn everyone's notifs.

All limits are env vars (`OPENSCOUT_PUSH_RATE_PER_*`, `OPENSCOUT_PUSH_DEVICE_RATE_PER_MINUTE`, etc.). Defaults baked in but tunable without code changes — important so you don't end up with magic numbers when you need to debug.

### Why atomic check-and-increment

The naive flow is:

```ts
const count = await readBucket(...);
if (count >= limit) return 429;
await incrementBucket(...);
```

Five concurrent requests at `count = limit - 1` all read `limit - 1`, all increment, all proceed. The cap is ~5x what you set. Bad.

The fix: do it in one statement that returns the post-increment count, and refund the increment if you need to reject:

```sql
INSERT INTO osn_push_rate_buckets (bucket_key, window_kind, window_start, count, updated_at)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(bucket_key, window_kind, window_start) DO UPDATE SET
  count = count + 1,
  updated_at = excluded.updated_at
RETURNING count
```

If `RETURNING count > limit`, decrement and return 429. The decrement isn't strictly necessary — slight over-count under load is acceptable — but it keeps the bucket honest and the math obvious in the audit log.

### Why generic alert text + "opaque IDs" in the custom payload

The APNs payload has two parts: `aps.alert` (the text Apple displays) and arbitrary keys you can attach (`scout: { itemId, kind, ... }`). I never put real content in either. The pattern:

- `aps.alert.body` is one of three pre-vetted strings keyed off `kind`.
- `scout` only carries `itemId` (an opaque string), `kind` (a small enum), `destination: "inbox"`. No prompts, no agent text, no file paths.

When the user taps the notification, the iOS app fetches the actual content from the local broker over the paired connection. The relay never sees the content.

### Defenses I added and why each one matters

| Defense | Threat |
|---|---|
| Session-required on every endpoint except `/health` | Anonymous fan-out |
| `userId = session.providerUserId` on every read/write | Cross-user access |
| Token-hash uniqueness check across users | Token takeover ("steal" by re-registering someone else's APNs token) |
| 64-hex APNs token format validation | Malformed tokens that break downstream parsing or smuggle data |
| Device cap per user (default 50) | Registration storm to fill D1 |
| Per-user rate limits (min/hr/day) | Loud user / runaway loop / deliberate abuse |
| Per-device per-minute limit | One device burning the user's whole budget |
| Atomic bucket check-and-increment | Parallel requests bypassing the cap |
| Body size cap (`Content-Length`, default 16KB) | DoS via huge bodies |
| Custom payload size cap (default 1KB after sanitize) | Abusing the `scout` field as a side channel |
| `apns-collapse-id = itemId` | Apple-side de-dupe if a runaway loop pushes the same item |
| Audit log row on every state change AND every denial | Forensics, debugging rate-limit complaints, user transparency |
| AES-GCM encryption of device tokens at rest | Reduce blast radius of D1 leak |
| `RETURNING` clauses for atomic check-then-modify | See above |
| `BadDeviceToken` / `Unregistered` from APNs → auto-revoke | Lapsed devices clog the send list |

The audit log is also exposed at `GET /v1/push/audit` (session-scoped — users see their own activity). It's lightweight observability without a separate logging stack.

### Step-by-step to recreate this

#### 1. Get APNs credentials from Apple

You need three things, all from `developer.apple.com`:

1. **Team ID**: top-right of developer.apple.com when signed into your Apple Developer account. 10 chars, alphanumeric.
2. **APNs Auth Key (`.p8` file)**:
   - Go to **Certificates, Identifiers & Profiles → Keys**.
   - Click **+** to create a new key.
   - Name it (e.g., "MyApp APNs Key").
   - Check **Apple Push Notifications service (APNs)**.
   - If your app uses multiple bundle IDs, click **Configure** next to APNs and select "All Topics" (or specific bundle IDs).
   - Click **Continue → Register**.
   - **Download the `.p8` file**. You can only download it once. Lose it and you have to make a new key.
3. **Key ID**: shown next to the key in the Keys list after creation. 10 chars.

The `.p8` file is a PKCS#8-encoded ECDSA P-256 private key in PEM format:

```
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg…
-----END PRIVATE KEY-----
```

Apple gives you a single key that can sign JWTs for any of your bundle IDs (when configured for "All Topics"). You don't need a separate cert per app. This is way better than the old per-bundle-cert path.

#### 2. Add a D1 database to your Worker

```bash
bunx wrangler d1 create my-app-db
```

Note the `database_id` it prints. Add to `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "OSN_DB",
    "database_name": "my-app-db",
    "database_id": "..."
  }
]
```

#### 3. Apply the schema

In `migrations/0001_push_relay.sql`, the tables you need (full SQL is in OpenScout's `apps/mesh-front-door/migrations/0003_push_relay_user_scoping.sql`, but the shape is):

- `osn_push_devices` — id, user_id, device_id, platform, app_bundle_id, apns_environment, token_hash, encrypted_token, authorization_status, timestamps. Unique index on `(user_id, device_id, platform, app_bundle_id, apns_environment)` and on `token_hash`.
- `osn_push_attempts` — id, user_id, device_id, item_id, kind, status, apns_id, apns_status, apns_reason, created_at.
- `osn_push_usage_daily` — user_id, day, attempted_count, delivered_count, failed_count. PK `(user_id, day)`.
- `osn_push_rate_buckets` — bucket_key, window_kind, window_start, count. PK `(bucket_key, window_kind, window_start)`.
- `osn_push_audit_log` — id, user_id, action, outcome, detail, ip, user_agent, created_at.

```bash
bunx wrangler d1 migrations apply my-app-db --remote
```

Wrangler picks up files in `migrations/` ordered by their numeric prefix (`0001_`, `0002_`, …). It tracks applied state in a `d1_migrations` system table it manages itself. No Drizzle, no Prisma — raw SQL files are simplest and the worker has no other ORM.

#### 4. Generate and upload the secrets

```bash
# 32-byte AES-GCM key for device-token-at-rest encryption
head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=' \
  | bunx wrangler secret put OPENSCOUT_PUSH_TOKEN_ENCRYPTION_KEY

# APNs creds — pipe stdin so multi-line PEM survives
echo -n "<TEAM_ID>"  | bunx wrangler secret put OPENSCOUT_APNS_TEAM_ID
echo -n "<KEY_ID>"   | bunx wrangler secret put OPENSCOUT_APNS_KEY_ID
cat AuthKey_XXXXXXXXXX.p8 | bunx wrangler secret put OPENSCOUT_APNS_PRIVATE_KEY
```

**Watch out for**: Cloudflare secrets accept multi-line input via stdin but not via copy-paste in an interactive prompt. Always use `<` redirect or pipe.

**Encryption key rotation**: this key encrypts every stored device token. Rotating it would invalidate every registration. Stash the value somewhere safe (we use macOS Keychain via a `secret` CLI wrapper) so future-you can retrieve it. Today's zero-token state is the cheapest moment to swap if you ever need to.

#### 5. Implement the relay endpoints

Reference: `apps/mesh-front-door/src/push-relay.ts` (~620 LOC). The endpoints:

- `POST /v1/push/devices/register` — body has deviceId, platform, appBundleId, apnsEnvironment, authorizationStatus, pushToken
- `POST /v1/push/devices/unregister`
- `GET  /v1/push/devices`
- `POST /v1/push` — body has itemId, kind, urgency, optional deviceId
- `GET  /v1/push/usage`
- `GET  /v1/push/audit`
- `GET  /v1/push/health` — unauth

Every endpoint except `/health` starts with:

```ts
const session = await readOpenScoutSessionFromRequest(request, env);
if (!session) return json(401, { error: "unauthorized" });
const userId = session.providerUserId;
```

#### 6. APNs JWT minting

ES256 with the `.p8` key, `iss = teamId`, `kid = keyId`, `iat = now`. Cache the JWT for ~50 min (Apple accepts up to 60). On Workers, use `crypto.subtle.importKey("pkcs8", …, { name: "ECDSA", namedCurve: "P-256" })` then `crypto.subtle.sign("ECDSA", { hash: "SHA-256" }, …)`. Send to:

- Production: `https://api.push.apple.com/3/device/<token>`
- Sandbox: `https://api.sandbox.push.apple.com/3/device/<token>`

Headers: `authorization: bearer <jwt>`, `apns-topic: <bundle-id>`, `apns-push-type: alert`, `apns-priority: 10` (or 5 for silent), and (for de-dupe) `apns-collapse-id: <itemId>`.

#### 7. Client-side wiring

Two paths depending on your app shape:

- **Native-wrapped (iOS/macOS) app**: the native side registers for remote notifications, gets a device token from APNs, hands it to your auth-bearing client (could be a local server, could be the app itself), which calls `POST /v1/push/devices/register`. When something needs to push, that client calls `POST /v1/push`.
- **Pure browser app (Hudson's likely case)**: APNs doesn't apply directly. Same architecture works for **Web Push** with **VAPID** keys instead of APNs `.p8`. Swap the JWT minting (VAPID is also ES256, just different claims) and the send target (the user's `endpoint` URL from `PushSubscription`). The defenses, audit, rate limits all transfer 1:1. The relay shape — Worker + D1 + per-user scoping — is the same.

### Things that worked, things I'd revisit

- **Worked**: putting auth on the relay was a 30-line change because `readSessionFromRequest` was already there. The cost of building the auth piece *first* paid back immediately.
- **Worked**: env-tunable defenses. When I tested with `OPENSCOUT_PUSH_RATE_PER_MINUTE=2` to write the test, I didn't have to change any code. Production stays at 10/min, tests run with 2/min.
- **Worked**: audit log in the same D1. No separate logging stack. Every denial has an outcome string (`denied_rate_user_minute`, `denied_token_owned_by_other_user`, etc.) so debugging a "why did my push fail" is one query.
- **Would revisit**: rate-bucket cleanup. The buckets table will grow without bound (one row per user per minute per kind, on send). At our scale that's nothing, but a tiny `scheduled` Worker handler doing `DELETE FROM osn_push_rate_buckets WHERE updated_at < ?` is a 20-line follow-up.
- **Would revisit**: there's no "pause notifications for an hour" feature exposed to the user. Plumbing it would be one new endpoint that writes a `paused_until` column on `osn_push_devices`, plus a check in `selectActiveDevices`.
- **Pitfall I hit**: I wrote the body-size check to read `Content-Length`. In the Worker runtime this is reliably set; in my test mocks it wasn't, so my first cap test failed. If you replicate, either explicitly set the header in tests or actually buffer-and-measure the body (slower but defensive).

---

## Translating to a Hudson app

I'm not going to prescribe shape into your toolkit — you'll know what fits. But the bits that should transfer cleanly:

**Auth as a Hudson primitive** would probably look like:
- A `hudsonkit/auth` subpath that exports `useSession()` for app code and a helper to wire the OAuth callback.
- A reference Cloudflare Worker template (or even a deployable shared worker that multiple Hudson apps point at) implementing the four endpoints + `readSessionFromRequest`. The auth code is ~400 LOC and cribbing the OpenScout `auth.ts` directly would get you 90% there.
- A bearer storage convention — `localStorage` is fine for browser, custom URL scheme + Keychain for native.

**Push as a Hudson primitive** is more nuanced because Hudson is browser-first. The relay architecture transfers, but the *transport* should be Web Push / VAPID, not APNs. Same defenses, same per-user scoping, same audit log; swap the JWT shape and the destination URL. If a Hudson app gets wrapped in Tauri/Electron/native iOS later, you can add APNs as a *second* outbound channel from the same relay (`platform = "ios"` vs `platform = "web"`).

The most copy-pasteable bits:
- The whole `auth.ts` (signed-bearer + provider-agnostic OAuth shape).
- The defense table + the SQL schema for the D1 tables.
- The atomic-bucket-with-limit pattern.
- The "generic alert text + opaque IDs in custom payload" rule.
- The audit-log-everything-including-denials pattern.

Skip these if you're going browser-only:
- The whole APNs JWT path (use VAPID).
- The custom URL scheme native callback (use a normal redirect).
- The local-broker hop (a Hudson app talks to the relay directly with the user's session cookie/bearer).

## Key files to read in OpenScout

If you want to crib code, these are the entry points:

- `apps/mesh-front-door/src/auth.ts` — the whole auth surface.
- `apps/mesh-front-door/src/push-relay.ts` — the whole relay surface, defenses included.
- `apps/mesh-front-door/migrations/0003_push_relay_user_scoping.sql` — schema with all five tables.
- `apps/mesh-front-door/test/push-relay.test.ts` — covers the defense paths (cross-user 403, rate limit 429, device cap, payload cap, format validation, etc.); useful both as a smoke test and as a spec.
- `packages/runtime/src/mobile-push.ts` — the broker-side client that holds the session bearer and talks to the relay. Mostly ignorable for a pure browser app, but the 429-handling pattern (surfacing `rateLimited`, `retryAfterSeconds`, `rateLimitWindow` to callers) is worth keeping.
- `apps/mesh-front-door/README.md` and `DEV_INSTRUCTIONS.md` — operational notes, secret setup, deploy checklist.

The full diff that introduced the user-scoping + defenses is commit `0a23ab4f` on `main`.

— Claude (working in OpenScout, May 2026)
