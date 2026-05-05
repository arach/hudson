# HUD-004 — HudAuth + HudPush Framework

- **Status:** Draft (rev 1)
- **Pairs:** HudVault (shipped), HudPermissionGate (shipped)
- **Reference implementation:** OpenScout `apps/mesh-front-door/` (GitHub OAuth + push relay), notes at `specs/from-openscout-auth-and-push.md`

## Purpose

`HudAuth` and `HudPush` are paired primitives for Hudson apps that need user identity and notifications. They are documented together because the architecture entangles them: the push relay only exists because it is gated by the auth flow — anyone triggering a push must hold a valid user session bearer, and that bearer scopes which devices can be reached. Without `HudAuth`, `HudPush` is a public push cannon. Without `HudPush`, `HudAuth` is just a sign-in button.

The pair is shipped as **library code + a Worker template + a CLI walkthrough**. Each consuming Hudson app's developer deploys their own Cloudflare Worker (free tier) once using the template and the CLI; that Worker then serves all of that app's end users. A managed tier ("Hudson runs the relay for you") may follow later but is out of scope here.

This document is a contract. It does not prescribe implementation files or include application code.

## Roles

There are two distinct actors. Conflating them is the most common reasoning error in this design.

| Role | Who | What they do | What they have |
|---|---|---|---|
| **App developer** | The author of a Hudson app (e.g., Scout, Talkie) | Deploys one Cloudflare Worker for the app, configures GitHub OAuth + Web Push keys, owns the Cloudflare account | Cloudflare secrets, OAuth client credentials, the `.p8` / push signing keys |
| **End user** | Someone using the app | Signs in with GitHub, registers their phone/laptop for push, receives notifications | A session bearer + a relay URL, nothing else |

End users **never** see infrastructure. Cloudflare secrets, push signing keys, and OAuth client credentials live in the app developer's Worker only. The end-user-facing client only knows the public relay URL and its own session bearer.

This is also the monetization seam: a future Hudson hosted tier serves app developers ("I want notifications without running a Worker"), not end users. End users always pay nothing.

## Reference patterns harvested

OpenScout shipped both pieces in production at `apps/mesh-front-door/`. The notes file at `specs/from-openscout-auth-and-push.md` captures the *why* behind every architectural choice. Highlights worth re-stating, with the auth-side defenses called out explicitly because they're easy to drop:

**Auth side (must-have defenses)**

- **Stateless signed bearers** — no sessions DB. The bearer is `base64url(jsonPayload).base64url(hmac256(payload, SESSION_SECRET))`. Trade-off: revocation = rotate the secret = invalidates everyone. Acceptable at small scale; if not, add a `revoked_at` column on a sessions table.
- **`providerUserId` is the trust boundary** — never the username. GitHub usernames can be renamed; the immutable numeric `id` is what every downstream feature scopes on.
- **Two delivery modes for the bearer** — `Set-Cookie` for browser flows, `Authorization: Bearer` for native and server-to-server. Native uses a custom URL scheme to redirect from the OAuth callback into the app, which then stows the bearer in the OS keychain.
- **OAuth state cookie / CSRF** — at `start`, set a short-lived signed `hud_oauth_state` cookie containing the same `state` value sent to GitHub. On callback, verify GitHub's returned `state` matches. Without this, a phisher can forge a callback and pin a session to a victim's browser.
- **Verified primary email only** — read `/user/emails`, take a `primary && verified` address. If no verified email, fail the callback. Never let unverified-email accounts in.
- **Constant-time HMAC compare** — use a constant-time string compare for the signature check; default `===` leaks bytes via timing.
- **Dev-mode cookie attribute** — strip `Secure` from cookies when the request is plain HTTP (local dev), otherwise the cookie is silently rejected by the browser.
- **Don't store the provider access token** — only needed during the callback to fetch identity. Throw it away after. Storing it expands the blast radius of a Worker compromise.

**Push side (must-have defenses)**

- **D1 (not KV/DOs) for atomic check-and-increment** — `INSERT ON CONFLICT ... RETURNING count` is one round-trip and atomic. KV would race; DOs would be one-per-user (excessive).
- **AES-GCM at-rest encryption of device subscription material** — encrypt before storing in D1. The encryption key lives only in Cloudflare secrets.
- **Token-hash uniqueness across users** — index on `token_hash`; reject re-registration of a token already owned by another user (prevents token-takeover).
- **Subscription validation** — reject malformed Web Push subscription payloads (endpoint URL shape, `keys.p256dh` and `keys.auth` base64url, length bounds).
- **Stale-subscription auto-revoke** — when Web Push returns `410 Gone` or `404`, mark the device unregistered (don't keep retrying). Same for `BadDeviceToken` / `Unregistered` from APNs.
- **Per-user *and* per-device sliding-window rate limits** — all env-tunable. Defaults: 10/min, 100/hr, 500/day per user; 3/min per device.
- **Generic alert text + opaque IDs** — push payload says "An item needs attention" with `{ itemId, kind }` only. Real content is fetched on tap. Privacy + content-rating safety.
- **Body-size cap with measurement fallback** — primary check is `Content-Length`; fallback is buffer-and-measure for clients that omit the header (slower but defensive).
- **Audit log on every state change AND every denial** — outcome strings like `denied_rate_user_minute`, `denied_token_owned_by_other_user`. Single source of truth for "why did my push fail".

## Non-goals (v1)

- Provider expansion beyond GitHub. X, Apple, Gmail follow as `fetchIdentity()` swap-outs but are not in v1.
- APNs / native push. Web Push only in v1; APNs is added as a second `platform` row in v2 once the relay shape is proven. The CLI does **not** scaffold APNs assets in v1.
- Native (Swift) `HudAuth` / `HudPush` clients. v1 ships TypeScript only; Swift mirrors the same nouns in v2.
- Hudson-hosted shared relay. v1 is BYO-Cloudflare; managed tier is a separate later effort, possibly on a different domain.
- Per-user revocation API. Signed bearer is stateless; v1 revoke = rotate `HUD_SESSION_SECRET`.
- Multi-recipient broadcast / topic fan-out. Per-user push only.
- Push templates / rich notifications / images / actions. Single alert string + opaque IDs only.
- React/Vue/Svelte hooks. Plain TS API in v1; framework wrappers added later if needed.

## Architecture

```
   ┌────────────────────────────────────┐
   │   Hudson app (web or Apple)        │
   │   ┌──────────┐    ┌──────────┐     │
   │   │ HudAuth  │    │ HudPush  │     │
   │   └────┬─────┘    └────┬─────┘     │
   └────────┼────────────────┼──────────┘
            │  bearer        │  bearer
            ▼                ▼
   ┌────────────────────────────────────┐
   │   Cloudflare Worker (per-app)      │
   │   ┌─────────┐    ┌──────────────┐  │
   │   │ /v1/auth│    │ /v1/push     │  │
   │   └────┬────┘    └──────┬───────┘  │
   │        │                │          │
   │        └──── shares ────┤          │
   │             SESSION     │          │
   │             SECRET      │          │
   │                         ▼          │
   │             ┌─────────────────┐    │
   │             │ D1 (5 tables)   │    │
   │             └─────────────────┘    │
   └────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │   Web Push       │
                  │   (APNs in v2)   │
                  └──────────────────┘
```

Each Hudson app is one Worker, one D1, one set of secrets. The library code in this repo gives the app a typed client (`HudAuthClient`, `HudPushClient`) that talks to the app's Worker. The Worker template gives the app the server-side endpoints. The CLI walks the dev through deploying it.

## Package shape

`HudAuth` and `HudPush` ship as cross-platform Hudson primitives with equivalent contracts. They are independent imports — apps that only need auth don't pull in push:

| Surface | HudAuth import | HudPush import |
|---|---|---|
| TypeScript | `hudsonkit/auth` | `hudsonkit/push` |
| Swift | `import HudAuth` | `import HudPush` |

Worker template lives at `packages/cloud/hudson-relay-worker/` (Cloudflare Worker scaffold + D1 migrations + `wrangler.jsonc` blueprint). CLI commands ship from the existing Hudson npm CLI.

## HudAuth — public API

### Nouns (TS + Swift, identical shapes)

- `HudAuthClient` — top-level entry. Constructed once per app.
- `HudAuthSession` — the verified, in-process session object.
- `HudAuthProvider` — opaque identifier; `"github"` in v1.
- `HudAuthBearer` — the prefixed token string `hud_session_<base64url>.<hmac>`.
- `HudAuthError` — recoverable error variants: `unauthorized`, `expired`, `verifiedEmailRequired`, `providerError`, `network`.

### TypeScript

```ts
import { HudAuthClient } from 'hudsonkit/auth';

const auth = new HudAuthClient({
  workerUrl: 'https://my-app-worker.example',
  bearerPrefix: 'hud_session_',          // namespace; default 'hud_session_'
  bearerStorage: 'cookie' | 'localStorage', // default 'cookie' on browsers
});

// Browser: kick off OAuth (full redirect)
auth.signIn({ provider: 'github', returnTo: '/dashboard' });

// Read current session — null if no bearer or expired
const session: HudAuthSession | null = await auth.getSession();
session?.providerUserId;  // trust boundary
session?.login;
session?.email;
session?.expiresAt;       // ms epoch

// Sign out
await auth.signOut();

// Add a fetch wrapper that auto-attaches the bearer
const fetcher = auth.signedFetch();
const response = await fetcher('/api/protected', { method: 'POST' });
```

### Swift

```swift
import HudAuth

let auth = HudAuthClient(
    workerURL: URL(string: "https://my-app-worker.example")!,
    bearerPrefix: "hud_session_",
    storage: .keychain(service: "com.myapp.session")  // HudVault under the hood
)

// Native: opens SFSafariViewController, returns via custom URL scheme
let session = try await auth.signIn(provider: .github, returnTo: "myapp://auth-complete")

session.providerUserId  // trust boundary
session.login
session.email
session.expiresAt

// Read current session — nil if no bearer or expired
let current: HudAuthSession? = try await auth.getSession()

try await auth.signOut()

// Signed URLRequest helper
var request = URLRequest(url: protectedURL)
auth.sign(&request)
let (data, _) = try await URLSession.shared.data(for: request)
```

### Bearer format

```
hud_session_<base64url(jsonPayload)>.<base64url(hmac256(payload, SESSION_SECRET))>
```

Payload:

```ts
{
  provider: "github",
  providerUserId: "12345",       // immutable
  login: "alice",
  email: "alice@example.com",
  expiresAt: 1758_000_000_000     // ms epoch
}
```

`hud_session_` prefix reserves the bearer namespace; admin tokens, machine creds, and impersonation tokens can coexist later without ambiguity. The middleware strips the prefix before verifying.

## HudPush — public API

### Trigger model

Anyone holding a valid user session bearer can call `push.send`. That includes:

- The user's browser tab — for "remind me later" / "your task finished" / cross-tab nudges
- An agent acting on the user's behalf with a delegated bearer
- A scheduled job the user themselves configured

There is no machine-token / app-backend-credential path in v1. Every send is *user-bearer-required*, and the `userId` baked into that bearer scopes which devices the relay will forward to. This is the same auth boundary as registration: a user can only push to themselves.

### Nouns

- `HudPushClient` — top-level entry. Constructed with a `HudAuthClient` (or just its `signedFetch`) so push calls inherit the bearer.
- `HudPushDevice` — registered device (browser tab, iOS app, etc.) with platform + opaque ID.
- `HudPushPayload` — the always-generic-text + `{ itemId, kind }` shape.
- `HudPushSendResult` — success | rate-limited (with `retryAfterSeconds`) | denied.
- `HudPushError` — `notSubscribed`, `permissionDenied`, `rateLimited`, `payloadTooLarge`, `network`.

### TypeScript

```ts
import { HudPushClient } from 'hudsonkit/push';

const push = new HudPushClient({
  auth,                              // HudAuthClient instance from above
  pushPublicKey: 'BPx1...',          // server-side push signing public key
                                     // (the Web Push spec calls this "VAPID public")
});

// 1. Permission check (calls Notification.requestPermission under the hood)
const granted = await push.requestPermission();

// 2. Subscribe this browser to push
const device = await push.register({
  deviceId: crypto.randomUUID(),
  kind: 'web',
  serviceWorkerRegistration,         // app provides — see helper below
});

// 3. Send — anyone with a valid user bearer can trigger; relay scopes to that user
const result = await push.send({
  itemId: 'msg_42',
  kind: 'message',                   // small enum, app-defined
  urgency: 'normal',                 // 'low' | 'normal' | 'high'
});

if (result.rateLimited) {
  console.log('retry after', result.retryAfterSeconds);
}
```

### Service worker (app-owned)

Hudson does *not* ship a service worker. Apps own their `sw.js` so they're free to add caching, offline, and other concerns. Hudson exports a tiny handler the app mounts inside its own SW:

```ts
// app's sw.js
import { hudPushSwHandler } from 'hudsonkit/push/sw';

self.addEventListener('push', hudPushSwHandler({
  // Optional: customize how the generic payload renders
  format: ({ generic, kind }) => ({
    title: generic,
    body: kind === 'message' ? 'New message' : 'Update',
  }),
}));
```

The handler reads `{ itemId, kind, generic }` off the push payload and calls `showNotification` with sensible defaults; the `format` callback is the escape hatch.

### Swift (v2 — not in v1)

`HudAuth` and `HudPush` Swift clients are deferred to v2. The shape will mirror the TypeScript nouns. Stub for reference:

```swift
import HudPush

let push = HudPushClient(auth: auth)

// 1. Permission via HudPermissionGate (declarative)
.hudPermissionGate(.notifications, rationale: "Stay updated") { granted in
    guard granted else { return }
    Task { try await push.register(kind: .ios) }
}

// 2. Send
let result = try await push.send(.init(
    itemId: "msg_42",
    kind: "message",
    urgency: .normal
))

// 3. Receive (UNNotificationServiceExtension or AppDelegate)
//    Payload contains generic text + opaque IDs only; fetch real content
//    from your app's data source on tap.
```

### Defense surface (env-tunable)

| Limit | Default | Env var |
|---|---|---|
| Per-user / minute | 10 | `HUD_PUSH_RATE_PER_MINUTE` |
| Per-user / hour | 100 | `HUD_PUSH_RATE_PER_HOUR` |
| Per-user / day | 500 | `HUD_PUSH_RATE_PER_DAY` |
| Per-device / minute | 3 | `HUD_PUSH_DEVICE_RATE_PER_MINUTE` |
| Devices per user | 50 | `HUD_PUSH_DEVICE_CAP` |
| Body size cap (request) | 16 KB | `HUD_PUSH_BODY_MAX` |
| Custom payload cap | 1 KB | `HUD_PUSH_PAYLOAD_MAX` |

All limits live in env vars so production stays at safe defaults while integration tests run with `HUD_PUSH_RATE_PER_MINUTE=2`.

## Worker template — `packages/cloud/hudson-relay-worker/`

A single Cloudflare Worker with:

- One D1 binding (`HUD_DB`).
- **Required secrets** (private — uploaded via `wrangler secret put`):
  - `HUD_SESSION_SECRET` — 32-byte random; signs all session bearers.
  - `HUD_GITHUB_CLIENT_ID`, `HUD_GITHUB_CLIENT_SECRET` — GitHub OAuth app creds.
  - `HUD_PUSH_TOKEN_ENCRYPTION_KEY` — AES-GCM key encrypting device subscription material at rest.
  - `HUD_PUSH_PRIVATE_KEY` — push signing private key (Web Push spec calls this the VAPID private key).
  - `HUD_PUSH_SUBJECT` — `mailto:` or `https:` URI required by the Web Push spec to identify the sender.
- **Required config** (public — written into `wrangler.jsonc` `vars`, not secrets):
  - `HUD_PUSH_PUBLIC_KEY` — push signing public key. The browser receives this to subscribe; it's public by design.
- 5 D1 tables (mirrors OpenScout): `hud_push_devices`, `hud_push_attempts`, `hud_push_usage_daily`, `hud_push_rate_buckets`, `hud_push_audit_log`.
- 11 endpoints:
  - `GET  /v1/auth/github/start?return_to=…`
  - `GET  /v1/auth/github/callback?code=…&state=…`
  - `GET  /v1/auth/session`
  - `POST /v1/auth/logout`
  - `POST /v1/push/devices/register`
  - `POST /v1/push/devices/unregister`
  - `GET  /v1/push/devices`
  - `POST /v1/push`
  - `GET  /v1/push/usage`
  - `GET  /v1/push/audit`
  - `GET  /v1/push/health` *(unauthenticated)*

Auth middleware:

```ts
const session = await readHudSessionFromRequest(request, env);
if (!session) return json(401, { error: 'unauthorized' });
const userId = session.providerUserId;  // trust boundary
```

Atomic check-and-increment:

```sql
INSERT INTO hud_push_rate_buckets (bucket_key, window_kind, window_start, count, updated_at)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(bucket_key, window_kind, window_start) DO UPDATE SET
  count = count + 1,
  updated_at = excluded.updated_at
RETURNING count
```

Reject with `429` when `RETURNING count > limit`; refund the increment to keep the audit log honest.

## CLI — the user-facing differentiator

`hudson auth init` and `hudson push init` are the "super easy" promise. Each is a guided walkthrough.

### `hudson auth init`

```
$ bunx hudson auth init

[1/5] GitHub OAuth app
  → Open: https://github.com/settings/developers/new
  → Application name: <your app>
  → Authorization callback URL: https://<your-worker>.example/v1/auth/github/callback
  ↳ Paste Client ID:        ********
  ↳ Paste Client Secret:    ********

[2/5] Cloudflare Worker scaffold
  → Created: worker/ (from packages/cloud/hudson-relay-worker template)
  → wrangler.jsonc populated
  → D1 database 'my-app-db' provisioned (id: …)
  → Migrations applied (5 tables)

[3/5] Secrets
  → HUD_SESSION_SECRET: generated 32-byte random
  → HUD_GITHUB_CLIENT_ID: uploaded
  → HUD_GITHUB_CLIENT_SECRET: uploaded

[4/5] Deploy
  $ cd worker && bunx wrangler deploy
  → https://my-app-worker.example/v1/auth/github/start?return_to=/  ← test here

[5/5] Wire into your app
  → app/lib/auth.ts written (HudAuthClient pre-configured)
  → Restart `bun dev` and visit /login
```

### `hudson push init`

```
$ bunx hudson push init

[1/4] Push signing keys (Web Push)
  → Generated ES256 keypair
  → HUD_PUSH_PUBLIC_KEY: written to wrangler.jsonc vars
  → HUD_PUSH_PRIVATE_KEY: uploaded as secret
  → HUD_PUSH_SUBJECT: prompt for mailto:you@example.com
  → HUD_PUSH_TOKEN_ENCRYPTION_KEY: generated 32-byte random, uploaded

[2/4] D1 push migrations
  → 5 tables applied: hud_push_devices, hud_push_attempts, hud_push_usage_daily,
    hud_push_rate_buckets, hud_push_audit_log

[3/4] Service-worker snippet
  → public/sw-push.example.js written
  → Says: copy this push handler into your existing sw.js, or use it as your sw.js
  → Reminder printed: register the SW in your app entry

[4/4] Wire into your app
  → app/lib/push.ts written (HudPushClient pre-configured with the public key)
```

Native (APNs `.p8`, iOS extension scaffold) is **not** part of v1 `hudson push init`. Added when v2 ships APNs as a second platform.

## Decisions made (this rev)

- **Trigger model** — anyone holding a valid user session bearer can call `push.send`. No machine-token / app-backend-credential path in v1. (Browser self, delegated agents, scheduled jobs — all the same auth.)
- **Service worker** — app-owned with a Hudson-provided handler (`hudPushSwHandler`). Hudson does not ship an SW.
- **CLI in v1** — the CLI walkthrough is part of v1, not a follow-up. It's the primary "super easy" promise to app developers.
- **Native (Swift)** — deferred to v2. v1 ships TypeScript only.
- **APNs** — deferred to v2. v1 is Web Push only. CLI does not scaffold APNs assets.
- **Keys naming** — public surface uses `HUD_PUSH_*` (not `HUD_VAPID_*`). The Web Push spec name is referenced once in docs for those Googling.
- **Public key is config, not secret** — `HUD_PUSH_PUBLIC_KEY` lives in `wrangler.jsonc vars`, not `wrangler secret`.

## Open questions for review

1. **Bearer prefix** — `hud_session_` is proposed. Versioned (`hud_session_v1_`) or unversioned?
2. **Cookie name** — `hud_session` vs app-prefixed (`<app>_session`)? Default unprefixed; override via `HudAuthClient` config.
3. **Session TTL** — 30d in OpenScout. Shorten to 24h with refresh? (Less load-bearing now that v1 is browser-only — refresh story can land with v2 native.)
4. **D1 table prefix** — `hud_*` proposed. App-level prefixes for shared D1 instances later?
5. **Worker template distribution** — separate npm package (`@hudson/relay-worker`) vs tarball inside `hudsonkit` that the CLI extracts? Affects upgrade story.
6. **CLI distribution** — likely a new `packages/cli/hudson/` published as `bunx hudson`. Confirm.

## Implementation phases

| Phase | Scope | Notes |
|---|---|---|
| **P1** | TypeScript libs (`hudsonkit/auth`, `hudsonkit/push`, `hudsonkit/push/sw`) + Worker template + GitHub auth + Web Push + CLI | The v1 MVP. End-to-end deployable, end-to-end app-dev-friendly. |
| **P2** | Swift `HudAuth` (browser callback via custom URL scheme + Keychain bearer) + Swift `HudPush` | Mirrors the TS nouns. |
| **P3** | APNs as second `platform` in `hud_push_devices`; CLI gains APNs `.p8` flow + iOS Notification Service Extension scaffold | Reuses the relay's defenses. |
| **P4** | Additional auth providers: X, Apple (`AuthenticationServices`), Gmail | Each is a `fetchIdentity()` swap. |
| **Post-v1** | Hudson-managed hosted relay tier (charge app developers, not end users) | Different domain / billing surface. |

## Reply

When the matching implementation lands, reference this spec by `HUD-004` in PR titles and commit messages so the docs cross-link cleanly.
