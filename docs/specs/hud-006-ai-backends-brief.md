# HUD-006 — AI Backends framework brief

## What

The app-author-facing layer for AI in Hudson apps. Today every Hudson app that wants an AI surface picks from a fragmented set of primitives (`Assistant`, `AI`, `useAssistant`, `useHudsonAI`) with implicit defaults that fail silently (`ws://localhost:3600`), inconsistent transport semantics (relay PTY vs `/api/ai/chat`), and no shared abstraction for swapping providers or surfaces.

HUD-006 introduces:

1. A **`Backend` interface** — slim, streaming-first transport contract with first-class capabilities (`streaming`, `auth`, `relay`, `sessions`).
2. A **`hudAI()` config factory** in hudsonkit — apps declare AI as one field on `HudsonApp`, AppShell consumes it and renders the right surface.
3. A **`@hudson/ai-backends` package** holding the interface + concrete adapters (`pi-ai`, `pi-coding-agent`, `NextRouteAdapter` over the existing `/api/ai/chat`). Keeps hudsonkit AI-optional.

The relationship to existing work:

- **HudAI framework (`hud-ai-framework.md`)** is the *lower* layer — provider-neutral inference primitive (Swift + TS). HUD-006 sits on top: the chat-mode adapter in `@hudson/ai-backends` consumes HudAI.
- **hudson-relay** stays exactly as it is. HUD-006 wraps it as the `pi-coding-agent` adapter and makes its availability first-class (no more silent ws://localhost:3600 failures).
- **`/api/ai/chat`** stops being a god route — it becomes a thin `NextRouteAdapter` over a Backend, preserving the contract for `useHudsonAI` / `DefaultChatTransport` consumers.

## Where to harvest

Three working references — two prior art, one prompting use case:

- **`/Users/arach/dev/contextual`** — Vite + hudsonkit + `@earendil-works/pi-ai`. Already ships a `Backend` interface (`src/lib/backends/types.ts`) with two concrete impls (`pi-ai.ts` in-process, `pi-coding-agent.ts` subprocess), an OAuth credential backend (`oauth.ts`), a browser client wrapper (`client.ts`), and a Vite plugin (`vite-plugin-backends.ts`) that exposes `/api/dispatch` + `/api/branch` + `/api/tree` + `/api/workspace`. This is the proof-of-concept; HUD-006 trims it of Contextual-specific concerns (ContextModule, SoftItem, ThreadTask, branch manifests, workspace materialization) and upstreams the slim shape.
- **`apps/web/app/apps/logo-designer`** — current best in-tree AI app. `LogoTerminal.tsx` shows dual-mode (`useTerminalRelay` + `useHudsonAI` fallback). `useLogoAI.ts` shows custom toolset + intents working in production. The migration target: Logo Designer keeps working through the Backend abstraction with zero behavior change.
- **`/Users/arach/dev/hero`** — Vite + hudsonkit AppShell font viewer. `web/src/hero/index.ts` is the `HudsonApp` declaration site; `web/src/hero/intents.ts` declares 10 intents; `web/src/hero/hooks.ts` exposes `useHeroCommands` with matching `commandId`s. Hero is the validation target: adoption should be exactly one new field on the app (`ai: hudAI({...})`), no other code changes.

Skim Contextual and Logo Designer; identify what generalizes; drop what's app-specific. The point is to ship a contract that lets Contextual, Logo Designer, Hero, and future apps share one transport story.

## Hard dependencies

- **HudAI framework (`hud-ai-framework.md`)** — the chat-mode adapter (`vercel-ai-sdk` or direct) consumes HudAI for provider-neutral inference. HUD-006 ships after HudAI lands, or in parallel with a stub HudAI client that the chat adapter swaps to once HudAI is real.
- **HudVault (shipped)** — credentials flow through HudVault. The Backend interface accepts an injected `getCredential` resolver; concrete adapters use HudVault by default but the interface stays credential-agnostic.
- **hudson-relay (shipped)** — the `pi-coding-agent` adapter wraps the existing relay protocol unchanged.

## What you ship

A design spec at `docs/specs/hud-006-ai-backends.md`. **Not implementation code.** Implementation lands as separate PRs after the spec is reviewed:

1. `@hudson/ai-backends` package skeleton (interface + capabilities types, no adapters yet)
2. `pi-ai` adapter
3. `pi-coding-agent` adapter (wraps existing hudson-relay)
4. `NextRouteAdapter` migrating `/api/ai/chat` to be a Backend consumer
5. `hudAI()` config factory + `HudsonApp.ai` field in hudsonkit
6. AppShell integration (render the right surface, "Start Relay" affordance, Cmd+J unchanged)
7. Migration of Logo Designer to the new abstraction (validation)

Cover at minimum:

- Public Backend interface (id, label, surface, capabilities, status?, stream / dispatch, fork?). Streaming primary.
- The `hudAI()` config factory shape and `HudsonApp.ai` integration.
- `BackendCapabilities` — streaming, sessions, auth (`none | api-key | oauth`), relay (`required | optional | none`).
- Request/response shape. Toolset and intents taxonomy. Opaque `sessionRef`, never paths.
- The `NextRouteAdapter` migration seam for `/api/ai/chat`.
- Credential injection model (no hardcoded paths).
- AppShell rendering rules — when to show "Start Relay", when surface flip is allowed, what the drawer tabs look like.
- Migration plan for existing Assistant/AI/useAssistant/useHudsonAI consumers (escape hatches stay).
- Anything you couldn't decide cleanly — flag for human review.

## Out of scope (v1)

- Voice / realtime inference (HudAI v1 already excludes these).
- Multi-backend per thread (each conversation picks one backend at birth; switching is config-time, not per-turn).
- Cross-app AI orchestration (single app at a time; WorkspaceShell adoption is a follow-up).
- Tool execution permissions UI — surfaces use what the toolset declares, no new gating layer in v1.
- Provider marketplace / dynamic adapter loading — adapters ship in `@hudson/ai-backends`.

## Constraints

- Web: bun, React 19, Next.js 16, Tailwind v4. No purple in designs (cyan/blue/teal/emerald).
- Apple: out of scope for v1 (HudAI framework handles cross-platform; HUD-006 is web/hudsonkit-side).
- Commits: gitmoji, no co-author footers.

## Design provenance

Spec consolidates a four-way agent consultation from a Hero-side cross-project review (May 12):

- `@hudson-codex` — framing of `hudAI()` as config factory; surface = transport; intents pull from `app` not duplicated; first-class relay availability; streaming primary with non-streaming as sugar
- `@hudson-claude` — streaming gap surfaced (Vercel AI SDK boundary); toolsets first-class alongside intents; NextRouteAdapter migration seam; separate package boundary
- `@contextual-codex` — Contextual's Backend interface needs trimming; opaque sessionRef not paths; status() for availability; streaming/relay/auth first-class
- `@contextual-claude` — DispatchRequest needs flattening (messages[] not zones); `<TMeta>` generic on result; injected credential resolver; client assembly is the app's job

All four converged on: separate package, slim Backend interface, drop Contextual zones, streaming-first.

## Reply

When the spec is written, reply with the file path and a ~150-word executive summary.
