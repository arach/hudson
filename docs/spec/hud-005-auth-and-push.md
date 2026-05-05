# HUD-005 — HudAuth + HudPush Framework

- **Status:** Draft
- **Pairs:** HudVault (shipped), HudPermissionGate (shipped)
- **Reference implementation:** OpenScout `apps/mesh-front-door/` (GitHub OAuth + APNs relay), notes at `docs/from-openscout-auth-and-push.md`

## Purpose

`HudAuth` and `HudPush` are paired primitives for Hudson apps that need user identity and notifications. They are documented together because the architecture entangles them: the push relay only exists because it is gated by the auth flow — a user can register only their own devices and push only to themselves. Without `HudAuth`, `HudPush` is a public APNs/VAPID cannon. Without `HudPush`, `HudAuth` is just a sign-in button.

The pair is shipped as **library code + a Worker template + a CLI walkthrough**. Each consuming Hudson app deploys its own Cloudflare Worker (free tier) using the template and the CLI; Hudson itself does not run a shared backend in v1. A managed tier may follow later but is out of scope here.

This document is a contract. It does not prescribe implementation files or include application code.

## Reference patterns harvested

OpenScout shipped both pieces in production at `apps/mesh-front-door/`. The notes file at `docs/from-openscout-auth-and-push.md` captures the *why* behind every architectural choice. Highlights worth re-stating:

- **Stateless signed bearers** — no sessions DB. The bearer is `base64url(jsonPayload).base64url(hmac256(payload, SESSION_SECRET))`. The Worker only needs `SESSION_SECRET` to verify. Trade-off: revocation = rotate the secret = invalidates everyone. Acceptable at small scale; if not, add a `revoked_at` column on a sessions table.
- **`providerUserId` is the trust boundary** — never the username. GitHub usernames can be renamed; the immutable numeric `id` is what every downstream feature scopes on.
- **Two delivery modes for the bearer** — `Set-Cookie` for browser flows, `Authorization: Bearer` for native and server-to-server. Native uses a custom URL scheme to redirect from the OAuth callback into the app, which then stows the bearer in the OS keychain.
- **Defended push relay** — D1 (not KV/DOs) for atomic check-and-increment via `INSERT ON CONFLICT ... RETURNING count`. AES-GCM at-rest encryption of device subscription material. Per-user *and* per-device sliding-window rate limits, all env-tunable. Audit log on every state change *and* every denial.
- **Generic alert text + opaque IDs** — push payload says "An item needs attention" with `{ itemId, kind }`. Real content is fetched after tap from the app's own data source. Privacy + content-rating safety; alert bodies sit in Apple/browser logs and on lock screens.
- **Hudson is browser-first** — the OpenScout notes explicitly recommend Web Push / VAPID for Hudson, with APNs added as a second `platform` later. Defenses, schema, and atomic-bucket pattern transfer 1:1; only the JWT shape and destination URL change.

## Non-goals (v1)

- Provider expansion beyond GitHub. X, Apple, Gmail follow as `fetchIdentity()` swap-outs but are not in v1.
- APNs / native push. Web Push (VAPID) is v1; APNs is added as a second `platform` row in v2 once the relay shape is proven.
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
                  │  VAPID / Web Push│
                  │  (APNs in v2)    │
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
  auth,                                  // HudAuthClient instance from above
  vapidPublicKey: 'BPx1...',            // shipped with the Worker template
  serviceWorkerUrl: '/sw.js',           // app provides
});

// 1. Permission check (calls Notification.requestPermission under the hood)
const granted = await push.requestPermission();

// 2. Subscribe this browser
const device = await push.register({ deviceId: crypto.randomUUID(), kind: 'web' });

// 3. Send (server-to-server call; usually invoked from your backend, not the browser)
const result = await push.send({
  itemId: 'msg_42',
  kind: 'message',                       // small enum, app-defined
  urgency: 'normal',                     // 'low' | 'normal' | 'high'
});

if (result.rateLimited) {
  console.log('retry after', result.retryAfterSeconds);
}

// Service Worker handles incoming push:
self.addEventListener('push', (event) => {
  const { itemId, kind, generic } = event.data.json();
  event.waitUntil(self.registration.showNotification(generic, { data: { itemId, kind } }));
});
```

### Swift

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
- Required secrets: `HUD_SESSION_SECRET`, `HUD_GITHUB_CLIENT_ID`, `HUD_GITHUB_CLIENT_SECRET`, `HUD_PUSH_TOKEN_ENCRYPTION_KEY`, `HUD_VAPID_PUBLIC_KEY`, `HUD_VAPID_PRIVATE_KEY`, `HUD_VAPID_SUBJECT`.
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

Adds VAPID key generation and APNs `.p8` upload (the latter unused in v1, scaffolded for v2). Same interactive shape. Generates a `sw.js` snippet for browsers and a UNNotificationServiceExtension scaffold for iOS.

## Open questions for review

1. **Bearer prefix** — `hud_session_` is the proposed namespace. Should it be `hudsession_` (no underscore separator) or include a version like `hud_session_v1_`?
2. **Cookie name** — `hud_session` vs app-prefixed (`<app>_session`)? Default to `hud_session`; allow override via `HudAuthClient` config.
3. **Session TTL** — 30d in OpenScout. Worth shortening to 24h with refresh, given native bearers are stashed in plain Keychain by default?
4. **D1 table prefix** — proposed `hud_*`; should multi-tenancy in a single D1 instance ever happen, do we want app-level prefixes (`<app>_hud_*`)?
5. **Service Worker strategy on web** — does `hudsonkit/push` ship a default SW or require apps to register their own? Latter is more flexible; former is more "plug-in".
6. **Bundling the Worker template** — ship as a separate npm package (`@hudson/relay-worker`) or as a tarball inside `hudsonkit` that the CLI extracts? Affects upgrade story.
7. **CLI distribution** — is the `hudson` CLI an existing binary in this repo, or is `bunx hudson` shipped from a new package? (Likely the latter — `packages/cli/hudson/`.)

## Implementation phases

| Phase | Scope | Notes |
|---|---|---|
| **P1** | TypeScript libs + Worker template + GitHub auth + Web Push | The MVP. End-to-end deployable. |
| **P2** | Swift `HudAuth` (browser callback via custom URL scheme + Keychain bearer) | Web-first means TS leads; Apple follows. |
| **P3** | `hudson auth init` / `hudson push init` CLI | The differentiator. Can be drafted in parallel with P1 once the Worker template is stable. |
| **P4** | APNs as second `platform` in `hud_push_devices`; Swift `HudPush` register + send | Reuses the relay's defenses. |
| **P5** | Additional auth providers: X, Apple (`AuthenticationServices`), Gmail | Each is a `fetchIdentity()` swap. |
| **Post-v1** | Hudson-managed hosted relay tier | Different domain / billing surface. |

## Reply

When the matching implementation lands, reference this spec by `HUD-005` in PR titles and commit messages so the docs cross-link cleanly.
