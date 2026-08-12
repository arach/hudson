---
title: "Inference credits"
description: "User-level credit ledger for TTS, ASR, and LLM — store-agnostic, Hudson-owned"
order: 40
section: "Architecture"
---

# Inference credits

A **simple, user-level credit system** for anything that burns inference (LLM tokens, TTS characters, ASR seconds, vision). Owned by Hudson so every Hudson app shares one model. Storage is **pluggable** (memory for tests, Cloudflare D1, Postgres, or HTTP to a remote ledger).

This is **not** provider invoice truth. It is a **speedometer + wallet** so apps can reserve, spend, and show gauges before the monthly bill.

Canonical types: [`docs/inference-credits-schema.ts`](./inference-credits-schema.ts). Swift ports mirror those names. `MemoryCreditStore` in that file is the reference semantics every backend must match.

---

## Goals

1. **User-level** balances and ledgers (not only whole-account).
2. **One unit: credits** — integer, roughly 1 credit ≈ 1 LLM token (see rate card).
3. **Store-agnostic** — apps talk to one small protocol (`CreditStore`); backends implement it.
4. **Hook once** at Hudson inference doors (`HudTTSClient`, `HudAIClient`) and at server peers that bypass native Hudson (e.g. Linea web `/api/vox`, `workers/ask`) — all landing on the **same ledger**.
5. **Free paths cost 0** but are still ledgered, with an explicit `freeReason`: `cache_hit`, `system`, `seeded_demo`, `on_device`.

Non-goals (v1): FinOps, multi-currency, provider invoice reconciliation, real-time Cloudflare $.

---

## Credit unit

| Concept | Definition |
|---------|------------|
| **Credit** | Integer. Approximately one **LLM input/output token**. |
| **Wallet** | Per `(accountId, userId)` projection: available, held, period spend. |
| **Ledger entry** | Immutable event: `debit`, `credit` (grant), `hold`, `release`. |

### Rate card (v1 defaults — tune without schema changes)

Stores convert physical units → credits; **apps never invent rates**. They pass `kind` + physical amount and the store applies the card.

| Kind | Physical unit | Credits (default) |
|------|---------------|-------------------|
| `llm` | 1 token (in or out) | **1** |
| `tts` | 1 character of synthesis text | **1** |
| `asr` | 1 second of audio | **50** |
| `vision` | 1 image input (flat) | **1000** (+ token credits as a separate `llm` entry) |
| `ocr` | 1 page (cloud only) | **500** |
| free paths | any, with `freeReason` set | **0** |

Later (not v1): provider-specific multipliers (`tts.elevenlabs`, `llm.gpt-4o`).

---

## Identity

```
accountId   // operator / deployment tenant (e.g. "linea-prod")
userId      // stable subject: auth user id, email hash, or "anonymous:<device>"
projectId?  // optional app tag: "linea" | "other-hudson-app"
surface?    // optional feature: "listen" | "ask" | "explain" | "prepare"
```

- **Account** = who owns the keys / the deployment.
- **User** = who is burning credits inside that account.
- Anonymous demos use a capped `userId` bucket (device id or IP hash), never unbounded.

---

## The protocol: `CreditStore`

One interface. Memory/D1/Postgres implement it locally (atomically); `HttpCreditStore` implements it by forwarding to the HTTP API, behind which a real store runs. Rate card and policy live **inside** the store (or its server side) — callers pass physical units.

```ts
interface CreditStore {
  balance(accountId, userId): Promise<Wallet>;
  hold(req: HoldRequest): Promise<HoldResult>;      // reserve an estimate
  commit(req: CommitRequest): Promise<SpendResult>; // settle hold: release + debit actual
  release(accountId, userId, holdId): Promise<void>; // cancel without spend
  spend(req: SpendRequest): Promise<SpendResult>;   // hold + commit in one step
  grant(req: GrantRequest): Promise<Wallet>;        // top-up / monthly allotment / promo
  listEntries(query): Promise<LedgerEntry[]>;
}
```

### Semantics that matter

- **Idempotency**: every mutating request carries a client-generated `id` (UUID). Stores dedupe on it, so HTTP retries are safe. The entry `id` *is* the idempotency key — no second mechanism.
- **Holds expire**: default TTL 300 s (`ttlSeconds`). An expired hold simply stops counting against `available` — no cleanup job required. A crashed client can never strand credits for more than the TTL.
- **Commit never rejects**: actual usage already happened; over-hold actuals still ledger (marked `overBudget` in soft mode). Only `hold` and `spend` can be refused, and only in `hard` mode.
- **Free entries still ledger**: `freeReason` set ⇒ credits forced to 0, entry written anyway. The gauge shows cache hit rate and demo traffic for free.
- **Ledger is append-only**: wallets are projections; balances can always be rebuilt from entries.

### Policy modes (per account config)

| Mode | Over budget |
|------|-------------|
| `hard` | Reject `hold`/`spend` |
| `soft` | Allow, mark entry `overBudget: true` |
| `observe` | Never block; ledger only |

Defaults per caller class are in [Priority: bill safety vs availability](#priority-bill-safety-vs-availability) below.

Budget model (v1): **monthly grant** into `available` + optional `monthlyLimit` ceiling on period spend. Pick one policy per account; don't mix pool styles.

---

## Priority: bill safety vs availability

Operator priority lock. Two goals, in order:

- **P0 — never wake up to a crazy bill.** All operator-funded inference is bounded by hard, account-level breakers.
- **P1 — don't break the product.** Per-user enforcement is soft with grace; free paths keep working even when everything else is blocked.

The shape that satisfies both: **hard at the rim, soft in the middle.** The account-level breaker is the only limit that must be hard — it alone guarantees P0 no matter how many users, demos, or bugs pile up. Every per-user limit prefers degrade over deny.

### Policy default matrix

| Caller | Funding | Mode | Limits |
|--------|---------|------|--------|
| Server doors (Linea `/api/vox`, `workers/ask`), signed-in user | Operator keys | **soft + grace** | monthly grant per user; warn at 80%, degrade at 100%, refuse at 2× |
| Server doors, anonymous / demo | Operator keys | **hard** (small) | per-device daily bucket + account-wide anonymous pool; seeds/cache free |
| Account total (all users combined, operator-funded) | Operator keys | **hard breaker** | daily + monthly ceilings; trip ⇒ operator alert + product degrades to free paths |
| Native app, operator-funded | Operator keys (server-side only) | enforced at the server proxy (rows above); native gauge is advisory |
| Native BYOK (user's own API keys) | User keys | **observe** | ledger only — never block someone spending their own money |

### Safe vs unsafe hard enforcement

Hard enforcement is trustworthy **only where the operator key and the inference call both live behind a server cost door** (Linea `/api/vox` routes, `workers/ask`). A native client that calls providers directly can be modified to skip the ledger, so native metering is observe/advisory by construction — and operator keys are never shipped in a native binary anyway, so operator-funded native traffic always flows through the server proxy, which is where the breaker lives. (Same conclusion as the Codex review's threat-model finding; server-derived identity is also what makes the anonymous buckets enforceable.)

### Starting numbers (tunable, not sacred)

| Knob | Default | Rationale |
|------|---------|-----------|
| User monthly grant | 500,000 | a few dollars worst-case per user per month |
| User daily soft cap | 100,000 | catches runaway loops within hours; warns/degrades, never hard |
| Grace refuse point | 2× monthly grant | hard refusal only after the soft brakes were sailed past |
| Anonymous bucket | 20,000 / day / device | enough to taste the demo, not enough to farm |
| Anonymous pool (account-wide) | 2,000,000 / day | bounds botnets minting fresh device ids |
| Account daily breaker | 5,000,000 | bounds one bad night to a known small dollar figure |
| Account monthly breaker | 50,000,000 | the absolute ceiling; operator-set comfort number |
| Hold TTL | 300 s (accept up to 900) | covers normal calls; long streams settle via late commit |

Dollar sanity: at ~$15/1M TTS chars and ~$1/1M blended mini-LLM tokens, the daily breaker bounds a worst day to roughly $5–75 depending on mix. The shape matters; the numbers are dials.

### Failure UX

Every metered response carries a gauge state — `ok | warn | degraded | blocked` — so clients never have to infer it.

- **warn** (≥80% of grant, or daily soft cap hit): quiet gauge nudge. Nothing is blocked.
- **degraded** (≥100% of grant): operator-funded calls swap to free paths where one exists — system voice instead of cloud TTS, cached audio, on-device ASR, tighter `maxOutputTokens` for LLM. Banner copy: "You've used this month's included credits — continuing with on-device versions."
- **blocked** (≥2× grant, anonymous cap, or breaker tripped): typed refusal **before** the provider call (that's what the preflight hold is for) — never mid-stream, never a raw 402 page. The client shows what still works plus the top-up/contact path.
- **Breaker trip**: the operator gets an alert — waking up to a ping, not a bill. The product degrades to free paths and stays up.
- **Ledger outage**: hard paths fail closed (P0) but render the same degraded UX; soft/observe paths fail open (P1).

Because authorization happens at hold time, a user never loses a half-finished answer to a budget refusal.

Policy knobs live in `AccountPolicy` in the schema file. The reference `MemoryCreditStore` enforces only `mode` + `monthlyLimit`; breaker, grace, and anonymous-pool enforcement is server-side (design only for now).

---

## Ledger entry (canonical JSON)

Portable shape every store persists:

```json
{
  "id": "uuid",
  "at": "2026-08-11T18:00:00.000Z",
  "accountId": "linea-prod",
  "userId": "user_abc",
  "projectId": "linea",
  "surface": "listen",
  "kind": "tts",
  "op": "debit",
  "credits": 1200,
  "physical": { "unit": "chars", "amount": 1200 },
  "provider": "openai",
  "model": "gpt-4o-mini-tts",
  "holdId": "uuid-of-hold",
  "meta": { "documentId": "...", "pageNumber": 1 }
}
```

`op`: `debit` | `credit` | `hold` | `release`
`kind`: `llm` | `tts` | `asr` | `vision` | `ocr` | `other`
`freeReason` (optional): `cache_hit` | `system` | `seeded_demo` | `on_device`
`expiresAt` (holds only), `overBudget` (soft-mode debits only).

---

## Store implementations

| Store | Use | Status |
|-------|-----|--------|
| `MemoryCreditStore` | Tests, local dev, **reference semantics** | In the schema file |
| `D1CreditStore` | Cloudflare (Linea ask worker / edge API) | v1 build |
| `PostgresCreditStore` | Existing Linea managed-access DB | later |
| `HttpCreditStore` | Native Hudson apps → the edge API | v1 build (Swift + TS) |

**Native Hudson never embeds Cloudflare SDKs.** Native apps use `HttpCreditStore` (or `MemoryCreditStore` in dev) against whatever host the app configures:

```
HudTTSClient / HudAIClient        (Swift, HudsonKit)
        │
        ▼
HudCredits.hold / commit / spend   (Swift facade over CreditStore)
        │
        ▼
CreditStore
  ├─ MemoryCreditStore             (dev/tests, in-process)
  └─ HttpCreditStore ──HTTP──▶ edge API ──▶ D1CreditStore
                                    ▲
     Linea web /api/vox ────────────┤   same ledger, same wallets
     Linea workers/ask ─────────────┘
```

---

## HTTP API (what `HttpCreditStore` speaks)

Hosted wherever the account lives (CF Worker recommended for Linea). Mirrors the protocol 1:1 — no extra concepts.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/credits/wallet?account=&user=` | Balance + limits |
| `POST` | `/v1/credits/hold` | Reserve |
| `POST` | `/v1/credits/commit` | Settle hold |
| `POST` | `/v1/credits/release` | Cancel hold |
| `POST` | `/v1/credits/spend` | One-shot debit |
| `POST` | `/v1/credits/grant` | Operator top-up (operator auth only) |
| `GET` | `/v1/credits/entries` | Recent ledger |

Auth: service token or session. Request bodies are the schema request types verbatim; the `id` field makes every POST retry-safe.

---

## Hudson integration points

### Must wrap (the cost doors)

1. **`HudTTSClient.synthesize`** (`packages/native/apple/HudsonKit/Sources/HudsonUIAudio/TTS/HudTTSClient.swift`) — hold on estimate (chars), commit actual on success. System-voice synthesis commits 0 with `freeReason: "system"`; cache hits commit 0 with `"cache_hit"`.
2. **`HudAIClient` complete/stream** (`packages/native/apple/HudsonKit/Sources/HudsonAI/HudAIClient.swift`) — hold on estimated tokens, commit `usage.prompt + usage.completion` from the provider's usage block when present; else estimate.

### Server peers (same ledger via HTTP)

3. Linea web `server/vox` and `workers/ask` call the same HTTP API with the same `(accountId, userId)`, so web spend lands on the same user wallet as native spend.

### App responsibility

- Pass `userId`, `projectId`, `surface`.
- Pass `freeReason` for demo seeds / cache / on-device.
- Do **not** call OpenAI/ElevenLabs outside these doors if you want the gauge to be true.

---

## Example flows

### Listen (cloud TTS)

```
1. hold({ kind: "tts", physicalAmount: text.count, surface: "listen" }) → holdId
2. HudTTSClient.synthesize(...)
3. commit({ holdId, kind: "tts", physicalAmount: actualChars, provider, model })
   // cache hit → commit({ holdId, freeReason: "cache_hit" })  (0 credits, still ledgered)
4. on failure → release(holdId)   // or just let the TTL expire
```

### Ask (LLM)

```
1. hold({ kind: "llm", physicalAmount: estimatedTokens, surface: "ask" })
2. stream completion
3. commit({ holdId, kind: "llm", physicalAmount: usage.prompt + usage.completion })
```

### Demo seed / on-device

```
spend({ kind: "asr", freeReason: "on_device", surface: "listen" })
spend({ kind: "tts", freeReason: "seeded_demo", surface: "listen" })
```

---

## Relationship to other meters

| System | Role |
|--------|------|
| **Inference credits (this)** | Live user wallet + gauge for inference spend |
| Linea `tts_chars` / `llm_usage_events` | Legacy; dual-write, then migrate into credits |
| Cloudflare Billable Usage / `billing-watch` | Daily CF infra $ (Workers, R2, D1) — separate system |

---

## v1 build order

1. **Types + `MemoryCreditStore` + tests** — schema file is done; port to Swift (`HudCredits` module) and add tests against the reference semantics (idempotent retry, hold TTL expiry, hard-reject, soft `overBudget`, free-reason zeroing).
2. **Edge API + `D1CreditStore`** — one CF Worker, one D1 table (`entries`) + a small `wallets` projection table. Routes mirror the protocol 1:1.
3. **Swift `HttpCreditStore`** — thin URLSession client of the edge API; same interface as memory.
4. **Wrap the two doors** — `HudTTSClient` and `HudAIClient` grow an optional `credits: CreditStore?`; nil ⇒ no metering (zero behavior change for existing apps).
5. **Point Linea web at it** — `server/vox` and `workers/ask` call the same Worker API.
6. **Gauge** — read `balance` + `listEntries`; render in-app. Dual-write legacy Linea tables until trusted, then drop.

Each step ships independently; stop after any of them and the system is still coherent.

## What NOT to build (v1)

- **No provider-specific rate multipliers** — one flat card; tune numbers, not shapes.
- **No Postgres store yet** — D1 covers Linea; Postgres is a later backend, not a v1 gate.
- **No cleanup jobs / cron** — hold expiry is projection-side (expired holds just stop counting).
- **No per-request auth/quotas beyond the account policy** — one policy per account, three modes.
- **No dollars anywhere in the hot path** — credits are integers; $/credit mapping is an offline spreadsheet concern.
- **No product-coupled admin UI inside the credits package** — operator views use [`admin-resources`](./admin-resources.md) (`@hudsonkit/admin`) with Zod-declared projections; hosts inject loaders. Curl/`GET /v1/…` remains valid.
- **No cross-account transfers, refunds, or negative-balance recovery flows** — grants are the only credit-increasing op.
- **No event streaming / webhooks** — poll the wallet; the gauge doesn't need push.

---

## Design rules (keep it simple)

1. **Credits are integers** — no floating microdollars in the hot path.
2. **One rate card object** — change prices without migrations.
3. **Ledger is append-only** — balances are projections; entries are truth.
4. **One protocol** — every backend implements the same seven methods; `MemoryCreditStore` defines the semantics.
5. **Hudson owns the hook; the host owns the database.** Native never embeds a cloud SDK.
