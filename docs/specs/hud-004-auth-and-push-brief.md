# HUD-004 — Auth & Push framework brief

## What

A paired identity + push-notification primitive for Hudson. Apps need to know *who* a user is and need a defended path for sending them notifications without each shipping their own auth library, OAuth client, push relay, signing-key plumbing, rate limiting, and audit logging.

`HudAuth` and `HudPush` are separate primitives but architecturally paired: the push relay only exists because it's gated by the auth flow (a user can register only their own devices, push only to themselves). Both run on a single Cloudflare Worker + D1, deployable by each Hudson app dev.

## Where to harvest

Working in production at OpenScout — treat as reference, not greenfield. Notes already extracted in `docs/specs/from-openscout-auth-and-push.md` (paired-architecture context, decisions explained, defense table, threat model). The `apps/mesh-front-door/` Worker in OpenScout is ~1500 LOC TypeScript total (auth.ts ~400 + push-relay.ts ~620 + glue) and most of it is portable.

## Hard dependencies

- **HudVault** (shipped). Bearer storage on web (cookie or `localStorage`) and Apple (Keychain via `HudVault`). Push device-token-at-rest encryption key never leaves Cloudflare secrets.
- **HudPermissionGate** (shipped). Used for `notifications` permission ask before subscribing to push.
- A Cloudflare account per consuming app (Workers + D1 — both have free tiers). The differentiator is *not* asking devs to maintain their own auth/push infra; it's making the Cloudflare deploy a 5-minute walkthrough.

## What you ship

A design spec at `docs/specs/hud-004-auth-and-push.md`. **Not implementation code.** Implementation lands as separate PRs after the spec is reviewed.

Cover at minimum:
- Public API surface for TypeScript (v1) — Swift mirrors in v2.
- The Worker template shape — endpoints, D1 schema, secret list, deploy command.
- The CLI walkthrough — `bunx hudson auth init`, `bunx hudson push init`. The user-facing "super easy" promise; in v1, not deferred.
- Provider abstraction for HudAuth — GitHub is v1 reference; X, Apple, Gmail follow as `fetchIdentity()` swaps.
- Transport for HudPush — Web Push only in v1 (Hudson is browser-first); APNs as a second `platform` later.
- The defense table copied verbatim from OpenScout notes (rate limits, atomic check-and-increment, AES-GCM at rest, generic alert text, audit log).
- Anything you couldn't decide cleanly — flag for human review.

## Out of scope (v1)

- Provider expansion beyond GitHub (X, Apple, Gmail are post-v1).
- APNs / native push (Web Push only in v1; APNs is a v2 platform addition).
- Native (Swift) clients (TypeScript only in v1).
- Hudson-hosted relay (BYO Cloudflare in v1; managed tier is a separate later effort).
- Per-user revoke (signed bearer is stateless; revoke = rotate `HUD_SESSION_SECRET` in v1).
- Push topic broadcast / multi-recipient fan-out (per-user push only in v1).

## Constraints

- Web: bun, React 19, Next.js 16, Tailwind v4. No purple in designs (cyan/blue/teal/emerald).
- Apple: SwiftUI. iOS demo is HudLint-strict — no raw color/font/spacing literals; design tokens only.
- Commits: gitmoji, no co-author footers.

## Reply

When the spec is written, reply with the file path and a ~150-word executive summary.
