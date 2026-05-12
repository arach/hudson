# HUD-006 — AI Backends

**Status**: Draft → reviewed (4-way agent consultation + @hudson-claude sign-off) → ready for human review
**Owner**: TBD (Arach's call)
**Targets**: hudsonkit web (Next.js + Vite apps); Apple side out of scope for v1 (handled by HudAI framework)

## Summary

A slim `Backend` interface + `hudAI()` config factory that collapses Hudson's current AI surface (`Assistant`, `AI`, `useAssistant`, `useHudsonAI`, `useTerminalRelay`, `TerminalRelay`, multi-provider `/api/ai/chat`) into one app-author-facing contract. Backends live in a new optional package `@hudson/ai-backends`; hudsonkit gains a single `HudsonApp.ai` field that AppShell consumes. Existing primitives stay as escape hatches.

Apps adopt with one line:

```ts
ai: hudAI({ surface: 'chat', model: 'anthropic/claude-sonnet-4-6', placement: 'drawer' })
```

## Motivation

Hudson today has rich AI capability but no formal app-author primitive. The current state across the tree:

- **Six exports** to choose from (`Assistant`, `AI`, `useAssistant`, `useHudsonAI`, `useTerminalRelay`, `TerminalRelay`) with overlapping responsibilities.
- **Two transports** (`ws://localhost:3600` relay PTY, `/api/ai/chat` Next.js route) with implicit silent-fail defaults — the `Assistant` component tries the relay regardless of whether one is running.
- **One god route** at `app/api/ai/chat/route.ts` that does provider resolution, toolset loading, credential lookup, and streaming in a single file.
- **Per-app ad-hoc wiring** in `app/apps/logo-designer/LogoTerminal.tsx`, `app/apps/shaper/useShaperAI.ts`, etc. — each app rebuilds the dual-mode UI, the toolset dispatch, the streaming consumption.

Two working apps already prove a cleaner factoring exists:

- **Contextual** (`/Users/arach/dev/contextual/src/lib/backends/`) ships a `Backend` interface with `pi-ai` (in-process) and `pi-coding-agent` (subprocess) implementations + capabilities + OAuth credential adapter. The dual-backend pattern works in production.
- **Logo Designer** (`app/apps/logo-designer/`) shows the toolset + intents combination that real apps need (Zod-validated tools, not just no-arg commands).

HUD-006 promotes the Contextual pattern into hudsonkit, trims its app-specific concerns, and gives every Hudson app the same one-line adoption.

## Layering

HUD-006 sits between the app and the inference primitive:

```
┌────────────────────────────────────────────────────────┐
│  App (Hero, Logo Designer, Contextual, Shaper...)      │
│    declares: ai: hudAI({ surface, model, placement })  │
├────────────────────────────────────────────────────────┤
│  hudsonkit AppShell + HudsonApp.ai field               │  ← HUD-006
│    routes config → Backend, renders surface            │
├────────────────────────────────────────────────────────┤
│  @hudson/ai-backends                                   │  ← HUD-006
│    Backend interface + adapters:                       │
│    pi-ai · pi-coding-agent · NextRouteAdapter          │
├────────────────────────────────────────────────────────┤
│  HudAI framework (hud-ai-framework.md)                 │  ← existing draft
│    provider-neutral inference primitive                │
│    cross-platform (Swift + TS)                         │
├────────────────────────────────────────────────────────┤
│  Anthropic · OpenAI · pi-ai · Bedrock · Gemini         │
└────────────────────────────────────────────────────────┘
```

Three relationships matter:

- **HUD-006 → HudAI**: the `chat`-surface adapter in `@hudson/ai-backends` consumes HudAI for provider-neutral inference. HUD-006 does not redefine providers, streaming events, or credential lookup — HudAI owns those.
- **HUD-006 → hudson-relay**: the `pi-coding-agent` adapter wraps the existing `hudson-relay` (`packages/services/hudson-relay/`) protocol. No changes to the relay itself.
- **HUD-006 → `/api/ai/chat`**: the `NextRouteAdapter` makes the existing god route a thin Backend consumer. `useHudsonAI` + `DefaultChatTransport` callers keep working without code changes.

## Package boundary

New package: **`@hudson/ai-backends`** (or `@hudsonkit/ai` — naming TBD).

Reasons for a separate package:

- hudsonkit already ships 15+ entry points. AI dependencies (`ai`, `@ai-sdk/react`, pi-ai, `motion`, codemirror) shouldn't pull into apps that don't want them.
- Apps that want AI: `bun add hudsonkit @hudson/ai-backends`. Apps that don't: just `hudsonkit`.
- Concrete adapters have their own provider SDK deps. Keeping them out of hudsonkit means the AI dependency tree can evolve independently.
- The `hudAI()` config factory in hudsonkit is a thin type-only wrapper that imports `Backend` from `@hudson/ai-backends`. DX stays a single import.

Package layout:

```
packages/web/ai-backends/
  src/
    index.ts              ← public exports
    types.ts              ← Backend, BackendCapabilities, DispatchRequest, StreamEvent
    capabilities.ts       ← capability helpers, status() utilities
    adapters/
      pi-ai.ts            ← in-process via @earendil-works/pi-ai
      pi-coding-agent.ts  ← subprocess via hudson-relay
      next-route.ts       ← NextRouteAdapter wrapping /api/ai/chat
      vercel-ai-sdk.ts    ← AI SDK-flavored adapter (consumes HudAI under the hood)
    credentials.ts        ← getCredential resolver type + HudVault default
```

## Core API

### Backend interface

```ts
interface Backend<Cfg = unknown, TMeta = unknown> {
  id: string;
  label: string;
  surface: 'chat' | 'terminal';
  capabilities: BackendCapabilities;

  /**
   * Optional availability check. Apps and AppShell call this before showing
   * the surface to determine whether to render the live UI or an unavailable
   * affordance (e.g., "Start Relay" button when relay is required but not
   * running). Returns `{ available: false, reason }` to drive the UI.
   */
  status?(config: Cfg): Promise<{ available: boolean; reason?: string }>;

  /**
   * Streaming dispatch — the primary path. Returns semantic stream events
   * (text deltas, tool calls, usage, completion). Non-streaming is sugar
   * over this.
   */
  stream(req: DispatchRequest<Cfg>): AsyncIterable<StreamEvent<TMeta>>;

  /**
   * Non-streaming dispatch. Default implementation: consume stream() to
   * completion and aggregate. Backends can override for efficiency.
   */
  dispatch?(req: DispatchRequest<Cfg>): Promise<DispatchResult<TMeta>>;

  /**
   * Session forking — only relevant when capabilities.sessions is true.
   * Returns an opaque sessionRef the caller can pass to a future stream()
   * call. The Backend, not the caller, owns the session storage layout.
   */
  fork?(req: { sessionRef?: string }): Promise<{ sessionRef?: string }>;
}
```

### Capabilities

First-class capability flags. AppShell and apps key off these to render correct UI affordances:

```ts
interface BackendCapabilities {
  /** Stream events as they arrive (default true). */
  streaming?: boolean;

  /** Maintains persistent sessions across dispatches (e.g., pi-coding-agent). */
  sessions?: boolean;

  /** How credentials are sourced. */
  auth?: 'none' | 'api-key' | 'oauth';

  /**
   * Whether a relay service is required.
   * - 'required': UI shows "Start Relay" affordance when status() reports unavailable
   * - 'optional': UI gracefully falls back to chat mode
   * - 'none':     no relay dependency
   */
  relay?: 'required' | 'optional' | 'none';

  /** Multi-provider — exposes a model picker in the UI. */
  models?: boolean;
}
```

Capabilities replace silent-fail defaults. Today `Assistant` tries `ws://localhost:3600` regardless; under HUD-006, a backend with `capabilities.relay === 'required'` plus a failing `status()` renders a "Start Relay" CTA, not a broken terminal.

### Dispatch request

```ts
interface DispatchRequest<Cfg = unknown> {
  /** Stable identifier for the conversation thread. */
  conversationId: string;

  /** Optional opaque session pointer for backends with `capabilities.sessions`. */
  sessionRef?: string;

  /** Working directory hint for terminal-surface backends only. */
  cwd?: string;

  /** Conversation history. App-side responsibility to flatten domain to messages. */
  messages: Message[];

  /** Optional system prompt; merged with toolset.system if both present. */
  system?: string;

  /** New user input. */
  input: string;

  /** Toolset selection — see Toolsets section. */
  toolset?: string | ToolsetDefinition;

  /** Convenience: pre-built intents that compile to the built-in `intents` toolset. */
  intents?: AppIntent[];

  /** Backend-specific config (model id, provider, auth mode, etc.). */
  config: Cfg;

  /**
   * Cancellation primitive. Backends propagate to the underlying transport:
   * - chat-surface backends abort the streaming fetch
   * - terminal-surface backends send SIGINT to the relay PTY process
   * Required for `Cmd+.` / "Stop" UI affordances.
   */
  signal?: AbortSignal;
}

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
}
```

Notes:

- Request takes `messages[]`, not Contextual's Fixed/Soft/Task zones. **Domain-to-messages flattening is the app's responsibility.** Contextual's `pi-ai.ts:buildMessages()` is a fine internal pattern but doesn't belong in the shared contract.
- `sessionRef` is opaque. Apps must never inspect or construct session paths.
- `cwd` is a hint for terminal-surface backends; chat-surface backends ignore it.

### Stream events

Streaming is the primary path. Semantic events, not vendor-specific:

```ts
type StreamEvent<TMeta = unknown> =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: unknown; error?: string }
  | { type: 'usage'; input: number; output: number; cost?: number }
  | { type: 'session'; sessionRef: string }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; meta?: TMeta };
```

The event shape is borrowed from OpenScout's adapter boundary (called out in `hud-ai-framework.md`'s "Reference patterns harvested" section). Apps consume semantic events; they never see provider-specific event names.

### Dispatch result

Non-streaming convenience over `stream()`:

```ts
interface DispatchResult<TMeta = unknown> {
  reply: string;
  toolCalls?: { id: string; name: string; input: unknown; output?: unknown }[];
  usage?: { input: number; output: number; cost?: number };
  sessionRef?: string;
  meta?: TMeta;
}
```

The `<TMeta>` generic lets adapters return typed backend-specific data (workspace materialization for `pi-coding-agent`, provider response IDs, etc.) without polluting the shared shape.

## Toolsets vs intents

Hudson today has two patterns for giving AI access to app capabilities:

- **Intents** (`AppIntent[]` on `HudsonApp`) — no-arg commands the assistant can invoke. Used by `useAssistant`.
- **Toolsets** (`ToolsetDefinition` in `app/api/ai/toolsets/`) — full Zod-validated tools with input schemas. Used by Logo Designer, Shaper, etc.

Toolsets are strictly more powerful. HUD-006 keeps both, with a clear taxonomy:

| Concept | Scope | Owner |
|---|---|---|
| **Toolset** | Full capability surface — `system` + `context()` + `tools()` with Zod schemas | Hudson framework (built-in `intents` toolset; apps can define custom) |
| **Intents** | Shorthand that compiles to the built-in `intents` toolset | App (`app.intents`) |
| **Commands** | Client-side dispatch targets — the `action()` invoked when the assistant calls a tool | App (`app.hooks.useCommands()`) |

Backends accept either:

```ts
ai: hudAI({
  surface: 'chat',
  toolset: 'intents',           // explicit — pull intents+commands from app
  // OR
  toolset: 'logo',              // a registered ToolsetDefinition
  // OR
  toolset: customToolset,       // inline ToolsetDefinition
})
```

When `toolset` is omitted, AppShell defaults to `'intents'` if `app.intents` is non-empty, otherwise no tools. Commands stay client-side; the Backend receives tool *calls* from the model but tool *execution* happens app-side via `commands[].action()`. This preserves the current dispatch model.

## hudAI() config factory

`hudAI()` is a pure config builder — it does not render or hook. AppShell derives hooks/components later.

```ts
function hudAI(opts: {
  surface: 'chat' | 'terminal';
  model?: string;                        // qualified 'provider/model' string
  provider?: ProviderId;                 // alternative to qualified model
  placement?: 'drawer' | 'popover' | 'inline';
  cwd?: string;                          // terminal-surface only
  toolset?: string | ToolsetDefinition;
  systemPrompt?: string;
  attachments?: AIAttachment[];
  backend?: Backend | BackendId;         // override the resolved backend
}): HudsonAppAIConfig;
```

`HudsonApp` gains one field:

```ts
interface HudsonApp {
  // ... existing fields
  ai?: HudsonAppAIConfig;
}
```

The factory resolves to a backend in this order:

1. Explicit `backend` (Backend instance or BackendId from `@hudson/ai-backends` registry)
2. `surface: 'terminal'` → `pi-coding-agent` adapter
3. `surface: 'chat'` + model.startsWith('anthropic/') → AI SDK adapter against Anthropic
4. `surface: 'chat'` (no provider hint) → `NextRouteAdapter` pointing at `/api/ai/chat`

## AppShell integration

`AppShell` reads `app.ai` and renders accordingly:

- **`placement: 'drawer'`** — replaces the current `<Assistant>` component in the bottom drawer Assistant tab. If `app.slots.Terminal` exists, both tabs render.
- **`placement: 'popover'`** — floating AI surface anchored to a trigger; matches Shaper's pattern.
- **`placement: 'inline'`** — app handles mounting; AppShell exposes `useAI()` for hooks-style consumption.

Availability rendering:

```
backend.status({ ...config }) → { available: true }   → render live surface
backend.status({ ...config }) → { available: false, reason } →
  capabilities.relay === 'required' → "Start Relay" CTA + reason
  capabilities.auth === 'api-key'   → "Configure API Key" CTA + reason
  capabilities.auth === 'oauth'     → "Sign In" CTA + reason
```

No more silent `ws://localhost:3600` failures. The drawer either shows working chrome or shows a clear, actionable reason it isn't working.

Keyboard shortcut `Cmd+J` continues to toggle the Assistant tab — unchanged from current AppShell behavior.

## NextRouteAdapter — `/api/ai/chat` migration

The existing `app/api/ai/chat/route.ts` does too much. Under HUD-006 it shrinks to a thin adapter:

```ts
// app/api/ai/chat/route.ts (after HUD-006)
import { NextRouteAdapter } from '@hudson/ai-backends/adapters/next-route';
import { vercelAISdkBackend } from '@hudson/ai-backends/adapters/vercel-ai-sdk';

export const POST = NextRouteAdapter({
  backend: vercelAISdkBackend,
  credentials: ({ provider }) => HudVault.getApiKey(provider),
  toolsets: '/api/ai/toolsets',  // existing toolset registry
});
```

Provider resolution, credential lookup, toolset loading, and streaming all delegate to the backend + helpers. The route file is ~10 lines instead of ~400.

Consumers using `useHudsonAI` and `DefaultChatTransport` see no change — the route protocol stays identical. This is the migration seam that lets HUD-006 land without breaking existing apps.

## Credential resolution

Credentials are not the Backend's job. The interface accepts an injected resolver:

```ts
type CredentialResolver = (ctx: {
  provider: string;
  scope?: string;
}) => Promise<{ apiKey?: string; oauthToken?: string } | null>;
```

Default resolver in `@hudson/ai-backends`:

1. HudVault (per `hud-ai-framework.md`'s hard dependency)
2. Fallback to `~/.lattices/inference.json` (existing Hudson convention)
3. Fallback to provider-specific env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)

Apps can pass a custom resolver to the adapter factory. The Backend interface itself stays credential-agnostic.

## Hero adoption example

Hero's current `web/src/hero/index.ts` declares a `HudsonApp` with intents, hooks, slots, ports. Under HUD-006 it gains one field:

```ts
import { hudAI } from 'hudsonkit';
// ... existing imports

export const heroApp: HudsonApp = {
  id: 'hero',
  name: 'Hero',
  description: 'Font viewer and glyph editor',
  mode: 'panel',

  // NEW — one field
  ai: hudAI({
    surface: 'chat',
    model: 'anthropic/claude-sonnet-4-6',
    placement: 'drawer',
    // toolset omitted — defaults to 'intents' since app.intents is populated
  }),

  // ... existing intents, hooks, slots — no other changes
  intents: heroIntents,
  hooks: { useCommands: useHeroCommands, /* ... */ },
  slots: { Content: HeroContent, /* ... */ },
};
```

The 10 intents in `web/src/hero/intents.ts` (Grid View, Compare View, Talkie Studio, Import Font, etc.) become AI-callable automatically. `useHeroCommands` in `web/src/hero/hooks.ts` already returns `CommandOption[]` with matching `commandId`s — no changes needed.

If Hero wants the Claude Code-style terminal experience instead, swap one config:

```ts
ai: hudAI({
  surface: 'terminal',
  cwd: '/Users/arach/dev/hero',
  placement: 'drawer',
})
```

AppShell now renders the pi-coding-agent in the drawer. If hudson-relay isn't running, the drawer shows a "Start Relay" CTA instead of a hanging xterm.

## Migration plan

Order of PRs:

1. **`@hudson/ai-backends` skeleton** — interface, capabilities, types, no adapters. Independent unit tests against fake backend.
2. **`pi-ai` adapter** — in-process via `@earendil-works/pi-ai`. Lands behind a feature flag in hudsonkit.
3. **`pi-coding-agent` adapter** — wraps `useTerminalRelay` and the existing relay protocol. Logo Designer is the validation target.
4. **`NextRouteAdapter` + `vercel-ai-sdk` adapter** — `/api/ai/chat` becomes a backend consumer. `useHudsonAI` callers see no behavior change.
5. **`hudAI()` + `HudsonApp.ai` in hudsonkit** — config factory and AppShell integration. Existing `assistant?: boolean` prop on AppShell stays; when `app.ai` is set, it takes precedence.
6. **Migrate Logo Designer** to declare `ai: hudAI(...)` and remove its hand-rolled `LogoTerminal` dual-mode code. Validation.
7. **Migrate Hero** — add one config line. Validation that the abstraction works for a fresh consumer.
8. **Deprecation notes** for `Assistant`, `useAssistant`. They stay as exports; the AppShell rendering path no longer constructs them directly.

Existing escape hatches (`Assistant`, `AI`, `useAssistant`, `useHudsonAI`, `useTerminalRelay`, `TerminalRelay`) stay public for apps that want lower-level control. They're not deprecated — they're the layer below `hudAI()`.

## Open questions

Resolved during @hudson-claude review (kept for context; no longer blocking):

1. **Naming.** ✅ `@hudson/ai-backends`. Matches existing `@hudson/relay` scope in `packages/services/hudson-relay/package.json`. No `@hudsonkit/*` scope exists in the tree — don't invent one.
2. **Stream event taxonomy.** ✅ `reasoning` stays a top-level event type. Extended thinking blocks are structurally different from text (may be redacted, affect billing differently). Collapsing into a typed `text` event would be a lossy merge.
3. **Toolset registration.** ✅ The current registry (`app/api/ai/toolsets/index.ts`) is **not portable** — hardcoded static imports in Next.js route context. `@hudson/ai-backends` must ship a portable registry that both Next.js and Vite apps can consume. **P1 for the package skeleton PR**, load-bearing for Hero (Vite, no Next.js) and Contextual (Vite).
4. **AbortSignal lifecycle.** ✅ `signal?: AbortSignal` is on `DispatchRequest` (above). Backends propagate to the underlying transport: chat-surface aborts the streaming fetch; terminal-surface sends SIGINT to the relay PTY process.
5. **WorkspaceShell.** ✅ WorkspaceShell treats AI as a **workspace-level concern** (the `hudson-ai` app), not per-app. The existing wiring — `primeHudsonAIWorkspaceHandoff()`, `useHudsonAISettingsBridge()`, `aiMode` setting, special-casing for `hudson-ai` app — is a different orchestration model. HUD-006 explicitly does not extend `app.ai` into WorkspaceShell. A multi-app AI orchestration story is a follow-up HUD-NNN.
6. **Provider/model wire format.** ✅ Canonical wire format is the object `{ provider, model }` — avoids edge-case string parsing for model names containing `/`. The `hudAI()` factory accepts both forms for ergonomics; qualified strings are parsed to `{ provider, model }` internally. The Backend interface only sees the object form.
7. **Apple side.** ✅ Defer. HUD-006 is web-only in v1. Backend interface is generic enough to mirror in Swift later; sketching the Swift surface now is premature without a consumer.

Still open — flag for human review at implementation time:

- **Backend registry vs factories.** Should adapters self-register on import (`import '@hudson/ai-backends/adapters/pi-ai'`) or expose factory functions consumers call explicitly? Implementation detail; doesn't block the spec.
- **Per-event metadata.** Stream events have semantic types but no per-event timestamp or correlation id. Adding them is cheap; we should decide before the first adapter ships.
- **`config: Cfg` type discipline.** The generic `Cfg` parameter lets adapters declare their config shape. Should we ship a registry of typed configs (`AnthropicConfig`, `PiAiConfig`, etc.) or leave it to adapter docs?

## References

Existing specs:

- `specs/hud-ai-framework.md` — provider-neutral inference primitive (lower layer)
- `specs/hud-004-auth-and-push.md` — HudAuth/HudPush patterns (separate package model)
- `specs/hud-005-liquid-bar.md` — separate-package + config-factory pattern reference

Working code referenced:

- `/Users/arach/dev/contextual/src/lib/backends/` — Backend pattern prior art
- `/Users/arach/dev/hero/web/src/hero/` — validation target
- `app/apps/logo-designer/` — current best in-tree AI app, migration target
- `app/apps/shaper/useShaperAI.ts` — custom toolset reference
- `app/api/ai/chat/route.ts` — god route to be slimmed via NextRouteAdapter
- `app/api/ai/providers.ts` — provider resolution to migrate to HudAI/HudVault
- `app/api/ai/toolsets/` — toolset registry to portabilize
- `packages/web/hudsonkit/src/components/Assistant.tsx` — current dual-mode UI
- `packages/web/hudsonkit/src/components/AppShell.tsx` — integration target
- `packages/web/hudsonkit/src/hooks/useAssistant.ts` — current intent dispatch
- `packages/web/hudsonkit/src/hooks/useHudsonAI.ts` — current chat hook
- `packages/web/hudsonkit/src/hooks/useTerminalRelay.ts` — current relay client
- `packages/services/hudson-relay/src/relay/session.ts` — relay protocol

Design provenance:

- Four-way agent consultation on 2026-05-12 (`@hudson-codex`, `@hudson-claude`, `@contextual-codex`, `@contextual-claude`) — see brief for individual contributions.
