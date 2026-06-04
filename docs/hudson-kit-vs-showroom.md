# Hudson Kit vs. Showroom — extraction map

> Status: **map only** (no code moved yet). Name decided: **Showroom** (`hudson-showroom`).
> Still pending: target layout (package vs. repo) + go/no-go on Phase 1.
> Goal: Hudson the repo focuses on **Kits** (the published primitives + shell/runtime).
> The 23 demo apps stay valuable as **dogfooding**, but move into the **Showroom** —
> working apps on display — so they stop crowding the primitives.

## TL;DR

Moving the apps into the Showroom is really **two moves**, not one:

1. **Demote the demos** — `app/apps/*` (23 apps, ~35.9k LOC) → `hudson-showroom`,
   which consumes published `hudsonkit` like any external user would.
2. **Promote the primitives** — Kit-grade code stranded in `app/shell` (~12.9k LOC) +
   `app/lib` (~4k LOC) moves *up* into `hudsonkit`, so the Showroom can import it.

The apps already consume the published Kit in **100** import sites (`hudsonkit`) plus
sub-entries (`/controls`, `/voice`, `/observability`, `/workflow`, `/context-menu`). The
boundary is ~90% there. Only **37 import sites across ~24 files** reach into shell/lib
internals — that's the entire cut-list, and every one resolves to either "promote this
primitive" or "this is app-private, it travels with the app."

## What's where today (sizes)

| Bucket | LOC | Role | Destination |
|--------|-----|------|-------------|
| `app/apps/` | 35,918 | 23 demo apps | → `hudson-showroom` (except shaper + hudson-ai, see below) |
| `app/shell/` | 12,939 | Kit-grade runtime masquerading as app code (WorkspaceShell, AppShell, contexts, decor, data bus) | → promote into `hudsonkit` |
| `app/lib/` | 4,034 | mixed: shared primitives (drawing, ai-models, intent-catalog) + app-private (vantage) | → split: promote shared, keep app-private with its app |
| `app/api/` | 5,605 | Next.js route handlers, 7 paired to apps | → re-export from Showroom (full-stack apps) |

## The 23 apps, tiered by extraction difficulty

The scan sorts the apps into **four tiers**. Tier 1 can move today with zero prep.

### Tier 1 — Trivial movers (client-only, consume only `hudsonkit`) — **8 apps**
`notepad` · `code-editor` · `document-lab` · `json-explorer` · `api-inspector` ·
`web-fetch` · `trace-viewer` · `workflow-lab`

No server tier, no internal reach. Pure consumers of the published Kit — moved into the
`hudson-showroom` package with the registry import re-pointed. **Phase 1 (done).**

> **Reverse-coupling lesson.** A forward audit (app → host internals) is NOT enough — you
> must also check host → app reaches, and `tsc --noEmit` is the authority (it sees the whole
> program). Phase 1 surfaced three the symbol-grep missed:
> - `app/shell/WorkspaceShell.tsx` renders `terminal/TerminalContent` directly → **terminal
>   is console infrastructure, not a demo app.** Reverted to `app/apps/terminal/`; it is NOT
>   in the Showroom (and was never registered as a windowed app anyway).
> - `app/api/traces/route.ts` imported `trace-viewer/types` (type-only) → re-pointed to the
>   subpath `hudson-showroom/trace-viewer/types`.
> - `test/apps/code-editor-documents.test.ts` imported `code-editor/types` (runtime values)
>   → re-pointed to the package source path.

### Tier 2 — Client, but reach into ONE shell/lib primitive — **4 apps**
| App | Reaches into | Promote target |
|-----|--------------|----------------|
| `hud-logger` | `shell/useAgentActionLog` | already maps to **`hudsonkit/observability`** — just re-point |
| `image-process-lab` | `shell/ShellLayoutContext` | promote `ShellLayoutContext` → Kit |
| `intent-explorer` | `lib/intent-catalog` | promote `intent-catalog` → Kit (pairs with `hudsonkit/workflow`) |
| `stage-design` | `shell/decor/*` | promote the decor system → Kit |

Move after the named primitive lands in the Kit. **Phase 2.**

### Tier 3 — Full-stack (client + `app/api/<id>/*` and/or `intents.ts`) — **9 apps**
`logo` · `shaper` · `vantage` · `theme-designer` · `services` · `openscout` ·
`assets` · `day-stack` · `hudson-docs`

Paired server routes: `app/api/{logo,shaper,vantage,theme-designer,services,openscout,assets}`.
Server intents: `{day-stack,hudson-docs,logo,shaper,vantage}/intents.ts`.

These need a **server-tier story** (see Central Risk). `vantage` additionally has
app-private `lib/vantage/*` (types, paths) that travels with it, plus native probes. **Phase 3.**

### Tier 4 — Shell-runtime (entangled with the shell's AI/voice runtime) — **1 app**
`hudson-ai` — the most coupled file in the tree (8 internal-reach sites:
`HudsonAIRuntimeContext`, `voiceReply`, `HudsonEnvironmentEditor`,
`HudsonVoiceSettingsEditor`, `workspace-manager/WorkspaceManagerContext`,
`ActiveWorkspaceContext`, `ai-models`).

`hudson-ai` is arguably **part of the Kit's shell**, not a Showroom app. Recommendation:
either keep it in the host or fold it into `hudsonkit` shell-runtime. **Phase 4 / keep.**

## The cut-list — every internal reach, and its verdict

`PROMOTE` = move into `hudsonkit`; `TRAVELS` = app-private, moves with its app.

| Internal module reached | Reached by | Verdict |
|-------------------------|-----------|---------|
| `lib/drawing` | logo (×4: LogoInteractiveSurface, LogoProvider, TemplateSvg, types) | **PROMOTE** — vector/drawing primitive |
| `lib/ai-models` + `lib/useAIModelOptions` | hudson-ai, logo, day-stack | **PROMOTE** — AI model registry (candidate `hudsonkit/ai`) |
| `lib/intent-catalog` | intent-explorer | **PROMOTE** — pairs with `hudsonkit/workflow` |
| `shell/DataBusContext` | logo (hooks, LogoContent) | **PROMOTE** — cross-app pipe bus |
| `shell/ShellLayoutContext` | image-process-lab, shaper | **PROMOTE** — layout context |
| `shell/decor/*` (types, WorkspaceDecorContext) | stage-design (×5) | **PROMOTE** — workspace decor system |
| `shell/useAgentActionLog` | hud-logger | **PROMOTE** → already `hudsonkit/observability` |
| `shell/ActiveWorkspaceContext`, `shell/workspace-manager/*`, `shell/HudsonAIRuntimeContext`, `shell/voiceReply`, `shell/HudsonEnvironmentEditor`, `shell/HudsonVoiceSettingsEditor` | hudson-ai | **PROMOTE** to `hudsonkit/voice` + shell-runtime — or keep hudson-ai in host |
| `lib/vantage/*` (types, paths) | vantage | **TRAVELS** — app-private |
| `shaper/lib/exporters` | shaper (already app-local) | already clean |

## The seam — where the host re-wires

There is exactly **one** host file to change for registration: `app/apps/registry.ts`.

- **Seam 1 — static imports** (`registry.ts:28–49`): `import { logoApp } from './logo'` →
  `import { logoApp } from 'hudson-showroom'`.
- **Seam 2 — id→app table** (`getAppById`, `registry.ts:80–108`) and the `getXApps()`
  workspace composers — same file, same import swap.
- **Product surface** (`app/app/page.tsx`) mounts `WorkspaceShell` with `allWorkspaces`
  from the registry — **unaffected**, as long as the registry still yields workspaces.
- **Marketing** (`marketing/`, `app/landing/`) embeds **no** real apps (uses the
  `LogoComparisonSheet` primitive, not the logo app) — **decoupled**, nothing to untangle.

## Central risk — the server tier

Full-stack apps (Tier 3) have logic in Next.js route handlers under `app/api/<id>/`.
Next's routing is file-based and must live in the host. Proposed pattern: each Showroom
app module exports its server pieces, and the host keeps a 1-line re-export:

```ts
// host: app/api/logo/compile/route.ts
export { POST } from 'hudson-showroom/logo/api/compile';
```

The handler *logic* lives in the package; the host keeps only the route file Next needs.
Same for intents: the package exports them, the host's intent registry imports them.
This is the main design decision that gates Tier 3; Tiers 1–2 don't touch it.

## Recommended target layout

```
packages/web/
  hudsonkit/          ← the Kit: primitives + promoted shell/runtime
  hudson-showroom/    ← 23 demo apps; deps: { "hudsonkit": "workspace:*" }
hudson  (app/)        ← thin host: routing, the registry seam, marketing, api re-exports
```

Showroom apps may import **only** `hudsonkit` (+ sub-entries). Any reach for an internal
is, by construction, a gap in the Kit's public surface — which is exactly the dogfooding
signal we want.

**Repo vs. package:** start as a **monorepo workspace package** (cheap, reversible,
proves the SDK surface immediately via `workspace:*`). Graduate `hudson-showroom` to its
own repo installing published `hudsonkit` from npm once the Kit's public API stops
churning. Root `package.json` `workspaces` already lists 5 packages — adding a 6th is
mechanical.

## Phased sequence (low-risk first)

1. **Phase 1 — scaffold + Tier 1.** Create `packages/web/hudson-showroom/`, move the 9
   trivial movers, swap the registry imports. Zero promotion, zero server work. Proves
   the seam end-to-end.
2. **Phase 2 — promote 4 primitives, move Tier 2.** Promote `ShellLayoutContext`,
   `decor/*`, `intent-catalog`, re-point `useAgentActionLog`→`observability`. Move the
   4 apps.
3. **Phase 3 — server-tier pattern, move Tier 3.** Land the re-export pattern on one app
   (logo is the richest), then the remaining 8. Promote `drawing`, `ai-models`,
   `DataBusContext` along the way.
4. **Phase 4 — decide hudson-ai.** Fold into Kit shell-runtime, or keep in host.

## Open decisions (yours)

1. **Layout:** monorepo `packages/web/hudson-showroom/` first (recommended) vs. separate
   repo now.
2. **In-core reference app:** CLAUDE.md designates `shaper` as the reference impl, but
   shaper is full-stack (Tier 3) — it demonstrates the *full* pattern. Keep shaper, or
   also keep a minimal one (`notepad`) as the simplest example? Or keep none and point
   docs at the Showroom?
3. **`hudson-ai`:** promote into the Kit shell, or leave in the host?
4. **Scope of move 1:** just scaffold + Tier 1 (recommended), or go wider in the first PR?
