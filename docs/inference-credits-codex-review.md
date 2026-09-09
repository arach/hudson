# Engineering review: inference credits v1

**Verdict:** the product shape is good and worth shipping, but the protocol is
not implementation-ready yet. Keep the wallet, physical-unit rate card, and
HTTP boundary. Before porting the reference store to Swift or D1, fix the hold
state machine, atomicity/idempotency contract, authenticated identity boundary,
and hard/soft network behavior. Those are correctness requirements, not v2
features.

## Review snapshot

This review covers the canonical files as they existed at the start of review:

- `docs/inference-credits.md` — SHA-256
  `fb50746456af82e9ef944d62e304157736323b8a33c1817dbe406deb707884c5`
- `docs/inference-credits-schema.ts` — SHA-256
  `773f1b48be4d0ef494f928d15d95491eb67874c99e73dfe0f5a3bebca15cf612`
- Both files were untracked and last written at approximately 15:18 EDT on
  2026-08-11. Fable reported the design complete while this review was in
  progress. I did not edit either canonical file, so there is no write conflict.

I also inspected the current Hudson hooks and the Linea checkout at
`/Users/arach/dev/linea`, including `HudTTS`, `HudTTSClient`, `HudAIClient`,
`server/vox/routes.ts`, `server/access/*`, and `workers/ask/src/index.ts`.

## What should ship

- One integer credit unit and one store-owned rate card.
- A wallet scoped to `(accountId, userId)`, with `projectId` and `surface` as
  attribution only.
- `hold -> commit/release` for calls that may materially exceed the remaining
  balance, and atomic `spend` for small or postpaid events.
- An append-only audit ledger plus mutable projections/state used for fast,
  correct decisions.
- Native clients depending on a small HTTP protocol, not a Cloudflare SDK.
- Free observations recorded at zero for system/on-device, seeded demo, and
  real cache hits.
- Optional metering at Hudson call sites so existing HudsonKit consumers retain
  source and behavior compatibility.

This is a reasonable v1 if the first implementation is restricted to LLM and
TTS, one production store, one account policy, and the real Linea/Hudson doors.

## Blocking correctness findings

### 1. A hold needs an atomic state machine

`commit` is currently implemented as `release()` followed by `debit()`. That is
not one atomic operation. A concurrent hold can observe the temporarily released
balance; concurrent release and commit have no defined winner; and a backend
crash can leave only half of the settlement written.

More seriously, the reference `commit` does not validate that the hold exists,
is owned by the supplied `(accountId, userId)`, or is still in a committable
state. Passing any non-empty `holdId` also bypasses hard-budget rejection in
`debit`. A commit for `holdId: "missing"` therefore creates spend against an
arbitrary wallet and can make it negative in hard mode.

Required semantics:

1. Persist a hold record with owner, kind, project/surface attribution,
   reserved credits, expiry, and state: `active | committed | released`.
2. `commit` atomically changes `active -> committed`, removes the active
   reservation, appends the settlement debit, and updates the wallet.
3. `release` atomically changes `active -> released` and removes the active
   reservation. Exactly one of concurrent release/commit wins.
4. A valid commit is never rejected **for budget reasons**, including after the
   hold's TTL. Unknown, wrong-owner, already-released, or conflicting commits
   must return a typed error. “Commit never rejects” is otherwise unsafe.
5. A repeated commit returns the original result. It must not report a newly
   calculated wallet/result as though that were the original operation.

Expiry should release capacity according to store/server time, not client time.
The expired hold record still needs to exist so a late provider response can be
settled once. Cap accepted TTLs and validate them; do not accept client dates.

### 2. Every production mutation needs a request id and stored idempotent result

The prose says every mutation has a client-generated id, but `CommitRequest` has
no `id`, and `release` takes positional fields with no request id. `SpendRequest`
and `GrantRequest` make `id` optional. The `seenIds: Set` also cannot implement
HTTP idempotency correctly:

- it does not bind an id to an operation, principal, or canonical payload;
- reuse of a grant id for another account is reported as a successful spend;
- it does not retain the original response (`ok`, `overBudget`, wallet version);
- hard rejections are not remembered, so the same id may later produce a
  different outcome;
- a compound commit can create release and debit entries, so “entry id equals
  request id” is no longer a complete model.

For production APIs, make `requestId` required on hold, commit, release, spend,
and grant. Uniqueness should be at least `(accountId, requestId)`. Persist the
operation name, a canonical request hash, and the original response. Same key +
same request returns that response; same key + different request returns 409.
Ledger entry ids can remain separate immutable event ids. Memory may offer a
convenience id generator for tests, but the HTTP contract should not.

### 3. Store decisions must be one serializable apply, not read/check/write

`balance -> check -> push/update` is safe only because the memory example runs
in one JS turn. Two D1/HTTP requests can both see the same available balance and
both authorize it. Each mutating `CreditStore` method needs a documented atomic
apply boundary covering:

- idempotency claim/result;
- hold state transition;
- budget/limit check;
- ledger append(s);
- wallet projection update.

Use the backend's transactional/serialized primitive; do not implement the
decision as several awaited queries in a Worker handler. Unique constraints are
still required as the last double-spend barrier.

The proposed D1 shape needs more than `entries + wallets` unless every balance
read reconstructs unresolved holds from the full ledger. A small `holds` state
table and an idempotency/result table are pragmatic v1 projections, not
over-design. The immutable entries remain audit truth.

### 4. Hard monthly limits are not enforced by `hold`

The reference `hold` only compares the reservation with `wallet.available`; it
does not compare `period.spent + active holds + requested credits` with
`monthlyLimit`. A hard account with a five-credit monthly limit and a 100-credit
balance currently accepts a ten-credit hold. Commit then spends it.

Define the check once and use it in `hold` and `spend` atomically:

```text
overBalance = requested > available
overPeriod  = periodSpent + activePeriodHolds + requested > monthlyLimit
overBudget  = overBalance || overPeriod
```

Also choose one v1 funding model. The doc currently says “monthly grant +
optional monthlyLimit” and then says not to mix pool styles. The smallest model
is either (a) opening/monthly grants with a carry/no-carry rule, or (b) a monthly
limit with no grant balance. If both remain, specify why both gates exist and
how the monthly grant is issued idempotently without cron. Document that
`available` may be negative in soft/observe mode.

### 5. Do not trust wallet identity or zero-cost overrides from an end-user client

`accountId` and `userId` should not be authoritative HTTP body fields. The edge
must derive `accountId` from the service/session credential and `userId` from the
authenticated subject. A privileged server-to-server token may impersonate a
user explicitly, but that permission must be scoped and audited. `projectId`
and `surface` are tags, not security boundaries or sub-wallets.

Likewise, public callers can currently send `credits: 0` or any `freeReason` and
bypass a hard wallet. Direct-credit overrides and privileged free reasons must
be server-derived or restricted to trusted service roles. Validate all amounts
as finite, non-negative, bounded values; grants must be positive integers.

There is also a threat-model limit: native `HudAIClient` and `HudTTSClient`
currently call providers directly using local credentials. Remote holds cannot
securely enforce operator-funded quota against a modified client that can skip
the ledger. Hard enforcement is trustworthy only when the operator key and the
inference call live behind a server cost door. Direct native/BYOK metering is
observe/advisory.

## HTTP/native latency and failure policy

Do not hide failure behavior inside `HttpCreditStore`; make the Hudson credits
facade apply the account mode consistently.

| Phase | Hard/operator-funded | Soft or observe/BYOK |
|---|---|---|
| Before provider call | Await hold; ledger unavailable or timeout means fail closed and do not call provider. | Fail open after a short timeout; retain the stable request id and record later if possible. |
| After provider call | Usage has happened. Commit cannot be undone; durably queue/retry the same request id. Do not turn a successful inference into an apparent “not spent” state. | Same retry behavior; a lossy best-effort path must be labeled as such. |
| User-visible latency | One preflight RTT is unavoidable for real hard enforcement. Avoid an extra wallet GET. | Do not put ledger latency in front of the inference unless desired for telemetry. |

A durable native outbox is the robust answer for post-call settlement, but it
may be too much for the first slice. If v1 omits it, say explicitly that commits
are best effort and the gauge is approximate. A short in-memory retry is not
durable across app termination.

Never ship a long-lived operator service token in a native app. Use the existing
user session token or an app backend proxy. Co-locating the ledger endpoint with
the managed inference proxy is the simplest secure hard path.

## Rate card edge cases

1. **Rounding is currently wrong for fractional units.** The implementation
   computes `ceil(amount) * multiplier`. `1.01` ASR seconds becomes 100 credits
   at 50/sec. The usual rule is `ceil(amount * multiplier)`, which yields 51.
   Define the rule and test boundaries such as 0, 0.001, 1.0, and 1.01.
2. **TTS “character” must be portable.** JS `text.length` counts UTF-16 code
   units while Swift `String.count` counts extended grapheme clusters. Pick one
   exact v1 definition. A practical choice is Unicode scalar values in the
   final trimmed text actually sent to the provider, with no normalization; add
   cross-language emoji/combining-mark fixtures. State how SSML markup counts.
3. **ASR should pass measured duration.** Use a fractional number of seconds
   from media duration, then apply the one final credit rounding. Linea currently
   rounds `alignment.durationMs / 1000` before storing, which loses information.
4. **Vision is a composite call.** If the flat image fee is added to the
   provider's total prompt-token usage, say that the flat fee is an intentional
   surcharge rather than image-token replacement. Correlate the vision and LLM
   entries with one request/call id. If hard authorization must cover both at
   once, the protocol needs a composite hold; that is a good reason to defer
   billable vision rather than add `spendMany` to v1.
5. **Provider cache tokens are not free.** `HudAIUsage` exposes cache creation
   and cache read counts, while `inputTokens` is the provider total. Continue to
   charge the provider-reported total unless a rate policy later says otherwise.

## Multi-app identity clarity

The scope is understandable if the doc adds four explicit rules:

- `(accountId, userId)` is the only wallet key; user ids are only meaningful
  inside an account.
- `projectId`/`surface` are immutable attribution copied from hold to settlement,
  not caller-editable on commit and not budget partitions.
- The service derives the account and authenticated user. Applications should
  supply context tags, not self-assert identity.
- Web and native must use the same identity issuer/subject mapping. An email
  hash, legacy X id, and Better Auth user id are not automatically the same user.

If future project budgets are wanted, add them later. Do not make
`projectId` part of the v1 wallet key.

## Migration from Linea's real stores

The current migration paragraph is too vague. Linea presently has:

- Postgres `linea_usage_events` keyed primarily by normalized email, with
  `tts_chars` and `transcription_seconds` plus nullable `auth_user_id`;
- Postgres `linea_llm_usage_events` with separate input/output/total tokens;
- per-kind TTS and transcription monthly limits in `linea_access_grants`;
- a separate Better Auth/D1 identity and request-count budgets in
  `workers/ask`.

Those are two stores and at least two identity schemes. They cannot become one
wallet merely by dual-writing.

Recommended v1 cutover:

1. Pick the canonical account id and identity issuer. Create an explicit legacy
   mapping from normalized email/X `auth_user_id` to the Better Auth subject;
   quarantine rows that cannot be mapped rather than merging by guess.
2. Seed each wallet with an idempotent opening grant/remaining balance at a
   documented UTC cutover. Decide openly that the old separate TTS/ASR quotas
   become one pooled credit budget, or preserve the old gates during transition.
3. Add dual-write at the server cost doors, using a stable id derived from the
   original request/event id. Do not generate unrelated ids on each retry.
4. Reconcile counts by user, kind, and UTC month for at least one full cycle.
5. Stop legacy writes, keep legacy tables read-only, and remove their gates only
   after the new ledger is authoritative.

Avoid importing all historical debits into a live grant-minus-lifetime-spend
wallet unless matching historical grants are also imported. It is easy to make
every wallet negative. If history is needed in the gauge, backfill into a
separate analytics/archive view or use a dedicated operator import that writes
balanced opening state and deterministic ids.

## Gaps against the real cost doors

### Hudson TTS

- `HudTTSClient.synthesize` explicitly rejects `.system`; system synthesis and
  playback live in `HudTTS.synthesize`/`HudTTS.speak`. Wrapping only the client
  cannot record `freeReason: system`.
- The current native client has no cache layer and `HudTTSResult` has no cached
  flag. Cache-hit metering belongs at the cache-owning layer (Linea's Vox route
  today) or requires a future result field.
- Direct cloud TTS can reserve and settle the exact same final request-text
  count. On provider failure, release; on an ambiguous timeout, decide whether
  the provider may have billed and record an estimated/unknown outcome rather
  than always assuming free.
- Adding a protocol existential to `HudTTSClient: Sendable` will require the
  Swift credits protocol/store to be `Sendable` (an actor is a natural HTTP
  implementation).

### Hudson AI

- `complete` has a terminal `HudAIResponse.usage`, so settlement is direct.
- `stream` emits both `.usage` and `.completed`, and cancellation/failure may
  occur after billable tokens. The wrapper must commit exactly once from the
  completed response or the last observed usage. Releasing every cancelled
  stream undercounts real spend.
- Define the hold estimator. A conservative first rule is estimated input plus
  `maxOutputTokens`; “estimate tokens” is not yet an API or shared utility.
- A five-minute TTL exceeds current default AI/TTS request timeouts, but long
  streams can cross it. Late valid commit must still settle an expired hold.

### Linea `/api/vox`

The concrete routes are `/synthesize`, `/explain`, and `/align/:cacheKey`, not a
single generic Vox call:

- `/synthesize` already prechecks estimated chars, discovers cache status only
  after `vox.synthesize`, and writes `tts_chars` only for cache misses. It maps
  naturally to hold then paid/free commit.
- the public seeded demo returns before auth/metering, so recording it requires a
  bounded anonymous subject and a deliberate zero-credit spend;
- `/align` is the real ASR seconds door and has a cached-alignment path;
- `/explain` is an LLM door and currently writes the Postgres LLM usage table
  only for signed-in managed sessions.

These server routes should call the ledger using server-derived identity. Do
not make the browser call the credits API independently.

### Linea `workers/ask`

The Worker has four model routes: `/chat/answer`, `/document/prepare-page`,
`/document/label-page`, and `/document/ask-region`. They use Better Auth plus
short-window/request-count budgets; they do not currently share the Postgres
usage ledger. The answer path also discards upstream token usage from its parsed
payload today, while prepare/label paths already parse usage for event telemetry.

Meter each managed upstream fetch at the Worker itself, after auth and before
return. Preserve burst rate limits; credits are not a replacement for abuse
control. BYOK/own-upstream preparation should be observe or unmetered according
to policy. Use explicit surfaces (`ask`, `prepare`, `label`, `ask-region`) and
one stable call id through hold/commit and existing telemetry.

## Scope recommendation: ship / fix / cut

### Ship

- Types plus tests for corrected semantics.
- One production D1-backed service and one Swift HTTP client.
- LLM + TTS paid/free paths.
- Server-side Linea integration first, then native observe mode.

### Fix before implementation

- Atomic hold state machine and serializable store apply.
- Required request ids with original-result replay and conflict detection.
- Server-derived identity and privileged override rules.
- Monthly-limit check including active holds.
- Store-time expiry and late-commit behavior.
- Explicit hard/soft/observe network policy.
- Cross-language physical-unit and rounding definitions.

### Cut or defer

- Postgres production store.
- Billable vision/OCR and composite holds (keep enum/rates reserved if useful).
- Historical ledger import; use a cutover/opening balance first.
- A polished gauge/admin surface until the ledger reconciles.
- “Hard” enforcement for direct native provider calls; call it observe unless
  the operator-funded inference itself is server-side.

## Minimum conformance tests

Every backend, including HTTP, should run the same black-box suite:

1. concurrent holds cannot authorize more than balance/period allowance;
2. commit vs commit and commit vs release have exactly one terminal result;
3. missing/wrong-owner/released hold cannot be charged;
4. expired hold stops reserving but can be committed once by its owner;
5. same request id replays the original result; changed payload gets conflict;
6. hard monthly limit includes active holds;
7. free reason produces zero debit but cannot be asserted by an unauthorized client;
8. commit actual below/equal/above hold settles correctly in all three modes;
9. server clock controls timestamps, periods, and expiry;
10. Unicode TTS, fractional ASR, and multi-image rounding match in TS and Swift.

The existing memory smoke tests are a useful start, but they currently confirm
the simplified single-thread behavior rather than these production invariants.
