# HUD-009: Kit & Atelier — graduate the multi-app host into HudsonKit

Status: proposal (direction set; no code moved)
Author: hudson.feat-hudson-showroom (claude opus 4.8)
Date: 2026-06-04
Revised: 2026-06-04 (after codex review — see §7)

> Numbering note: **HUD-009**, not 008. HUD-008 is already taken twice in this
> repo — `specs/hud-008-app-backends.md` ("App Backends Convention", *implemented*)
> and native `packages/native/apple/HudsonKit/Docs/HUD-008-web-surfaces.md`. The
> app-backends spec is the API/route seam this doc depends on (§1.3); they're
> adjacent, so this gets its own number and cites it rather than colliding.

## TL;DR

The product is **HudsonKit**, not the apps. The kit provides portable, importable shells any surface embeds.

- **AppShell** is already kit-level. It takes `app: HudsonApp` plus chrome opts and imports **zero** specific apps. Scout embeds it. That's the bar.
- **WorkspaceShell** — the multi-app **host** — is 4,591 LOC in `app/shell/WorkspaceShell.tsx` that reaches directly into named apps (`../apps/terminal`, `../apps/hudson-ai/*`, `../apps/hudson-docs/*`), hardcodes ~8 host `/api/*` routes, and depends on a dozen `app/shell` contexts. It is a runtime, not yet a kit component.

The work in this HUD: **graduate the host to AppShell's implementation level** — everything injected, zero `../apps/*` imports, no hardcoded host routes — so it becomes portable/importable, **web and native**. Then:

- **Hudson = the kit.** **Atelier = the apps** (a separate first-party monorepo: logo, shaper, preframe, hero, arc, og, …) built on the kit.
- **Thin Atelier = builds apps + declares workspaces. Nothing else.** An app = its UI (slots/hooks) + its own **relay handler(s)** and **API handler(s)** (the latter via the HUD-008 app-backends convention). The kit owns the relay/API/toolset **registries and dispatch**; apps supply the **handlers** that register.
- All first-party (no external users) → **source-linked, no npm publish**, no "showroom" package, no app-tier system.

This supersedes the showroom framing. PR #111 (apps → a package *inside* hudson) was the wrong cut and is closed. We do **not** repackage the apps; we extract the **kit** and decouple the host.

> **Name decision (resolved §7-OD1):** the graduated host takes the name
> `WorkspaceShell`. The kit *already* exports a `WorkspaceShell` — the minimal
> passive embed shell for `createEmbedApp` (`packages/web/hudsonkit/src/components/WorkspaceShell.tsx`,
> `app-shell.ts:5`). That one is **renamed `EmbedShell`**; the graduated host
> claims `WorkspaceShell`. Native Vantage host aligns to `WorkspaceShell` too.

## 1. Context

### 1.1 The two shells today

| Shell | Location | Portable? | Coupling | Consumer |
|---|---|---|---|---|
| **AppShell** | `packages/web/hudsonkit/src/components/AppShell.tsx` (803 LOC) | **Yes** | Takes `app: HudsonApp` + `AppShellChromeOptions`. Zero app imports. | Scout (single-app) |
| **WorkspaceShell (host)** | `app/shell/WorkspaceShell.tsx` (4,591 LOC) | **No** | 3 named apps + ~8 hardcoded `/api/*` + ~12 `app/shell` contexts | Hudson `/app`; (intended: Atelier, Vantage) |
| **WorkspaceShell (embed) → rename `EmbedShell`** | `packages/web/hudsonkit/src/components/WorkspaceShell.tsx` (7.8 KB) | Yes | Minimal canvas+windows for `createEmbedApp`; no chrome/AI/intents/services | Passive embeds |

AppShell's signature is the whole point: nothing inside it knows the name of any app. The **embed** shell is already kit-level but is deliberately minimal — its own docstring lists what it omits ("navigation bar, side panels, status bar, command palette, terminal, inspector, ports, AI runtime, intent catalog, services, boot splash, workspace switcher"). The **host** is exactly that omitted surface. Graduating the host is making *that* surface injectable, not collapsing it into the embed shell.

The host already takes `allWorkspaces` as a prop (`app/app/page.tsx` passes it from the registry) — partway to the same shape. The gap is everything it still reaches for directly.

### 1.2 The cut — what the host reaches into

Four classes of coupling. The first two disqualify the host as a kit component; the last two are the surface area that has to become injectable. **`tsc --noEmit` is the authority — a forward symbol-grep is not** (PR #111's lesson, and the codex review found three classes this doc's first draft missed).

**A. Host → app imports (must invert — a kit cannot depend on an app).**

Direct in `WorkspaceShell.tsx`:

| Reach | Line | Verdict |
|---|---|---|
| `../apps/terminal/TerminalContent` | 43 | **KIT** — console is shell infra; own it or inject a slot |
| `../apps/hudson-ai/useHudsonAISettings` | 73 | **KIT or INJECT** — shell runtime |
| `../apps/hudson-ai/settings` | 74 | **KIT or INJECT** |
| `../apps/hudson-docs/components` (type) | 48 | **KIT** — settings type belongs to the shell |
| `../apps/hudson-docs/types` (type) | 49 | **KIT** |

**And the promotion-set contexts are not clean** — 8 of the `app/shell` files this doc wanted to "just promote" *also* import `../apps/hudson-docs/*`:

`shellSettings.ts:3` · `HudsonAIRuntimeContext.tsx:5` · `WorkspaceAI.tsx:17` · `HudsonEnvironmentEditor.tsx:5` · `HudsonVoiceSettingsEditor.tsx:10-11` · `workspace-manager/WorkspaceManagerContext.tsx:6-7` · `workspace-manager/WorkspaceManagerPanel.tsx:12,22` · and the **second, local** `app/shell/AppShell.tsx:28-29`.

So hudson-docs is not just an app — it currently owns the shell's **settings types and settings UI** (`HudsonSettings`, `VoiceSettings`, `AppSettingsEntry`, `SettingsPanel`, `ServiceActionButton`). Those must be **extracted out of hudson-docs into the kit** before anything that imports them can move (see migration §3, step 1).

**B. Hardcoded host `/api/*` routes (inject, or own as kit route plumbing).** Not import edges — runtime string coupling `tsc` won't catch:

| Route | Reached at |
|---|---|
| `/api/pipes` | `DataBusContext.tsx:148,159,215,229,247` |
| `/api/workspace-state` | `WorkspaceShell.tsx:739,759,1149,1169` |
| `/api/workspace-decor` | `decor/WorkspaceDecorContext.tsx:199,269` |
| `/api/settings/environment` | `WorkspaceShell.tsx:2712,2730`, `HudsonEnvironmentEditor.tsx:62,95,126` |
| `/api/ai/generate-image` | `WorkspaceShell.tsx:2805` |
| `/api/fetch-image` | `WorkspaceShell.tsx:2754` |
| `/api/relay/upload` | `WorkspaceShell.tsx:2863` |
| `/api/agent-actions` | `WorkspaceShell.tsx:180`, `useAgentActionLog.ts:6` |

Each becomes an injected endpoint (the host supplies the URL/handler) or a kit-owned route shipped with the shell.

**C. App-id leaks already inside the kit.** The kit itself names specific apps: `packages/web/hudsonkit/src/observability/agent-action-view.ts:88-90` hardcodes `logo-ai`, `shaper-ai`, `day-stack-ai`. Mirrored in `WorkspaceShell.tsx:171-173` and `app/api/agent-actions/route.ts:105-108`. These are existing leaks to clean as part of the boundary, not new work the move creates.

**D. `app/shell` contexts (the runtime) — move into the kit once A is inverted.** `ShellLayoutContext`, `DataBusContext` (+ `PipeConnectorLayer`, `PortInspector`, `WindowPorts`), `decor/*`, `ActiveWorkspaceContext`, `workspace-manager/*`, `HudsonAIRuntimeContext`, `useAgentActionLog`, `WorkspaceAI`, `HudsonTerminal`, switcher/sidebar/accordion, `BootSplash`, `HomeScreen`, error boundaries, `devtoolsWelcome`, `shellSettings`. Kit-grade *in role*, but several are app-coupled today (class A) and only move after the inversion.

### 1.3 The relay/API split — plumbing vs. handlers

The contract the host/app boundary turns on. The kit owns the **registries and dispatch**; each app brings its **handlers**.

- **API handlers — the real seam is HUD-008 app-backends, not HUD-007.** `specs/hud-008-app-backends.md` (implemented) defines `HudsonApp.backend` + `createAppApiClient`/`useAppApiStatus` (root `hudsonkit`) + `appStorage`/`createFsWatchEventStream` (`hudsonkit/server`). That is the convention an app's API handlers (CRUD/export/SSE routes like `app/api/logo/template/route.ts`) plug into. HUD-007's `intent(meta, fn)` is a **subset** — server-intent instrumentation/auto-logging — not the general route seam. Earlier draft overclaimed HUD-007 here.
- **Relay handlers / toolsets travel with apps.** `app/api/ai/toolsets/index.ts` imports and registers `logo/shaper/day-stack/workspace/intents` toolsets onto `@hudsonkit/ai/toolsets`'s `defaultRegistry`; `app/api/ai/toolsets/day-stack.ts:4` imports from `apps/day-stack`; `WorkspaceShell.tsx:2763-2768` special-cases logo tool names. The **registry/dispatch is kit**; each toolset is an **app handler** that registers itself. The host special-casing must move into the app's toolset.
- **Host = thin.** Next's file-based routing forces a route *file* in the host; that file is a 1-line re-export of the app's handler. The host keeps the re-export stubs + a registry that imports app handlers — nothing more.

### 1.4 Native (Vantage)

The native multi-app host exists as `HudVantageSurface` / `HudVantageHostRootView` (`packages/native/apple/HudsonKit/Sources/HudsonVantage*`). Same concept as the host shell; different name. Align the language — native host is also a **WorkspaceShell** — but **additively**, not by destructive rename:

- `HudVantageSurface` is gated on `HUDSONKIT_WITH_TERMINAL=1` (`Package.swift:114-159`) and re-exported by `HudsonVantage` (`HudVantageExports.swift:1-3`).
- It is not yet generic — it imports AppKit/WebKit/Termini and owns terminal + runtime-canvas concepts (`HudVantageSurface.swift:1-13`).
- So: introduce `WorkspaceShell` (Swift) as the additive name with a `typealias HudVantageSurface = WorkspaceShell` deprecation shim; generalize behind it over time. Update native `HUD-005-cross-destination-app-manifest.md:162-169,299-300` where `runtimeCanvas` still maps to `HudVantageSurface`.

### 1.5 Non-goals

- **Not** extracting apps into a package (PR #111). Apps are full-stack and need the host; the kit is the leaf to move (`app` → `hudsonkit`, never the reverse).
- **No npm publish, no tiers, no showroom.** First-party consumers only → source-linked. But source-linking has a constraint (§4 OD): a raw `file:`/source-folder dep makes Next/Turbopack watch the whole Hudson checkout. Needs a built-dist or workspace protocol, not a bare path.
- **No rename of the host concept** — keep `WorkspaceShell`; rename the *embed* shell to `EmbedShell` to free the name.
- **No new dispatch protocol.** The relay/API/toolset registries already exist (HUD-008 app-backends, `@hudsonkit/ai/toolsets`, the port/data bus); this is about ownership boundaries.

## 2. Design

### 2.1 The contract

| | Owns |
|---|---|
| **Kit (Hudson)** | AppShell, `WorkspaceShell` (graduated host, web + native), `EmbedShell` (minimal), relay/API/toolset **registries + dispatch**, console, canvas, the §1.2.D contexts, extracted shell settings types/UI |
| **App** | Its UI (slots/hooks) + its own relay **handler(s)** + API **handler(s)** (`HudsonApp.backend`) + its **toolset** |
| **Atelier (host)** | Builds apps + declares workspaces. Re-export stubs for app routes. Injects the environment. Nothing else. |

The dogfood that ships *with* the kit is one minimal, self-referential workspace — the **HudsonKit workspace**: canvas, code editor, document viewer, terminal, AI workflows. No business logic.

### 2.2 Target host signature — inject an environment, not loose props

Props alone are too thin (the codex review's list). The host takes a `WorkspaceShellEnvironment` (or provider) carrying every capability it reaches for today:

```ts
// hudsonkit/shell — the graduated WorkspaceShell (host)
interface WorkspaceShellProps {
  workspaces: HudsonWorkspace[];          // already passed today
  env: WorkspaceShellEnvironment;         // injected capabilities (below)
  chrome?: WorkspaceShellChromeOptions;   // switcher, sidebar, decor, ports, console…
}

interface WorkspaceShellEnvironment {
  workspaceStore: WorkspacePersistence;   // was /api/workspace-state
  pipes: PipeStore;                        // was /api/pipes (+ SSE)
  decorStore: DecorPersistence;           // was /api/workspace-decor
  agentLog: AgentLogSink;                  // was /api/agent-actions
  services: ServiceRegistry;              // service catalog + banner
  secrets: EnvSecretEditor;               // was /api/settings/environment
  uploads: UploadStore;                   // was /api/relay/upload (+ screenshots)
  images: ImageIO;                        // was /api/fetch-image, /api/ai/generate-image
  voice: VoiceEndpoints;                  // voice reply + settings
  ai: AIChatRuntime;                      // chat endpoint + toolset registry
  intents: IntentEnvironment;             // catalog + executor + server-intent registry
  settingsUi: SettingsPrimitives;         // extracted out of hudson-docs
  console?: ConsoleSlot;                  // kit-owned by default; overridable
}
```

When a host omits a capability, the kit supplies a no-op/default (the way AppShell defaults every chrome flag to `true`). Hudson and Atelier differ only in *what they inject and which workspaces they declare* — not in shell code.

### 2.3 The seam stays one file

Registration stays in `app/apps/registry.ts` (static imports + `getAppById` + `get*Workspace()` composers + the `allWorkspaces` proxy). `app/app/page.tsx` swaps `WorkspaceShell` from `app/shell` to `hudsonkit/shell` and passes `env`; otherwise unchanged.

## 3. Migration

Reordered after review — settings extraction and interface definition come **before** any context move, so nothing half-coupled lands in the kit.

| Phase | Change | Risk |
|---|---|---|
| 1 (this HUD) | Write the contract + the full cut inventory (§1.2). Rename embed shell → `EmbedShell`. No host moves. | Low |
| 2 | **Extract shell settings out of hudson-docs** into the kit: `HudsonSettings`, `VoiceSettings`, `AppSettingsEntry`, `SettingsPanel`, `ServiceActionButton`. Re-point the 8 `app/shell` reaches. | Medium |
| 3 | **Define the injected interfaces** (`WorkspaceShellEnvironment`) and adapt the 8 hardcoded `/api/*` routes (§1.2.B) + app-id leaks (§1.2.C) to go through them. | Medium |
| 4 | **Invert the host→app reaches** (§1.2.A): console → kit/slot; hudson-ai runtime → kit/inject; app toolsets register from app side (move logo special-casing into logo's toolset). Host now imports no `../apps/*`. | Medium |
| 5 | **Move the clean §1.2.D contexts** into `hudsonkit/shell`. `tsc --noEmit` gates each move. | Medium |
| 6 | **Land `WorkspaceShell` (host)** in `hudsonkit/shell` with the §2.2 signature. Host mounts it with `env`. **Acceptance: running app with console, relay, and API.** | Medium |
| 7 | Stand up the **Atelier** repo (source-linked via a built-dist/workspace protocol — §4 OD). Move apps. Hudson keeps the dogfood workspace + re-export stubs. | Medium |
| 8 | **Native:** additive `WorkspaceShell` + `typealias HudVantageSurface`; update native HUD-005 manifest. | Low |

Acceptance for the kit extraction (phases 4–6): **a running app with console, relay, and everything** — a host that boots, opens the console, takes a relay message, and serves an API handler — not a shell that merely compiles in isolation.

## 4. Open decisions

1. **(Resolved — OD1)** Embed/host name collision → host takes `WorkspaceShell`; embed shell renamed `EmbedShell`; native aligns to `WorkspaceShell`.
2. **Console ownership.** Kit-owned primitive (ship the terminal body) vs. injected `ConsoleSlot`. Leaning kit-owned — `HudsonTerminal` already lives in `app/shell`; the `../apps/terminal/TerminalContent` import is the accident to undo.
3. **HudsonAI runtime.** Fold the runtime into the kit shell, or inject an `AIChatRuntime`? The `hudson-ai` *app* (its UI) stays an app regardless; this is only about the runtime wiring + toolset registry.
4. **Source-link transport.** A bare `file:`/source-folder dep makes Next/Turbopack watch the entire Hudson checkout (the existing consumer warning). Define the actual mechanism: built `dist` consumed via `workspace:`/`link:`, or a watched-but-scoped export. This gates phase 7.
5. **Atelier shape.** One monorepo with all apps, or each app independently source-linkable (preframe-style) with Atelier aggregating.

## 5. Deliverables for phase 1

- **This doc** (HUD-009).
- **The cut inventory** (§1.2) as the authoritative list — every import edge, hardcoded route, and app-id leak, each tagged KIT / INJECT / TRAVELS.
- **Rename** the kit's minimal `WorkspaceShell` → `EmbedShell` (`components/WorkspaceShell.tsx` + `app-shell.ts` export). Low-risk, frees the name; no host code moves yet.
- **No host moves** in phase 1. PR #111 closed; `docs/hudson-kit-vs-showroom.md` marked superseded.

## 6. Relationship to prior HUDs / specs

- **`specs/hud-008-app-backends.md` (App Backends Convention, implemented)** — the API/route seam (`HudsonApp.backend`, `createAppApiClient`, `appStorage`, `createFsWatchEventStream`). This is what app API handlers plug into; cited by §1.3. (Also why this doc is HUD-009.)
- **`docs/HUD-007` (agent intent instrumentation)** — `intent(meta, fn)` + `/api/intents`. A *subset* of the API story (server-intent auto-logging), not the general seam.
- **Native HUD-005 (cross-destination app manifest)** — maps `runtimeCanvas` to `HudVantageSurface`; update when the native `WorkspaceShell` alias lands (§1.4).
- **Native HUD-008 (web surfaces)** — the native side embedding web surfaces; the web host `WorkspaceShell` is what it embeds.

## 7. Codex review notes (applied)

Reviewed by a codex-harness session via Scout (`hudson-voice-codex`, feat-hudson-showroom, 2026-06-04). It ran `bun run typecheck` (passes) and grepped the tree; verdict was "would not ship as written — the doc undercounts the cut and overstates migration safety." Every blocker was independently confirmed against the tree before folding in. Applied:

- **The cut was undercounted (blocker).** Beyond the 5 direct host→app imports, 8 promotion-set contexts import `../apps/hudson-docs/*`, there are ~8 hardcoded `/api/*` reaches, the kit itself hardcodes `logo-ai/shaper-ai/day-stack-ai`, and the AI toolset registry imports specific apps. §1.2 rewritten into four classes (A–D); §1.2.B/C/D are new.
- **Naming collision (blocker).** A kit `WorkspaceShell` already exists (the embed shell). Resolved (OD1): host takes the name, embed → `EmbedShell`.
- **Wrong API seam (blocker).** HUD-007's `intent()` is server-intent instrumentation, not the general API-handler seam — that's the implemented HUD-008 app-backends convention. §1.3 rewritten to cite it; this doc renumbered to HUD-009 to stop colliding.
- **Relay/toolset leaks (blocker).** Toolsets and the logo tool-name special-casing must travel with apps; kit owns only the registry/dispatch. Folded into §1.3.
- **Migration order (blocker).** Phase 2-before-3 dragged hudson-docs/services/API/AI-routes into the kit. §3 reordered: extract settings → define interfaces → invert reaches → move clean contexts → land the host.
- **"Trivial" overclaim (blocker).** The *package* is a leaf; the *shell* is not. Hard parts (route plumbing, watcher-safe source-linking, app-owned toolsets, service-catalog ownership, settings extraction, native API compat) named in §1.2–§4.
- **Native rename (should-fix).** Made additive — `WorkspaceShell` + `typealias HudVantageSurface`, gated-target aware — not destructive (§1.4).
- **Thin props (should-fix).** §2.2 now injects a `WorkspaceShellEnvironment` (~13 capabilities), not four loose props.
- **Source-linking conflict (should-fix).** Raw `file:` deps make Next/Turbopack watch the whole checkout; promoted to OD4 (define a built-dist/workspace transport).

### Deferred / open

- Console ownership (OD2), HudsonAI runtime placement (OD3), source-link transport (OD4), Atelier repo shape (OD5).
