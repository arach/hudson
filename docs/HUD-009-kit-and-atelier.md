# HUD-009: Kit & Atelier — graduate the multi-app host into HudsonKit

Status: active migration plan (direction set; Shaper extraction probe started)
Author: hudson.feat-hudson-showroom (claude opus 4.8)
Date: 2026-06-04
Revised: 2026-06-04 (after codex review — see §7)
Revised: 2026-06-05 (Codex takeover — app extraction first)

> Numbering note: **HUD-009**, not 008. HUD-008 is already taken twice in this
> repo — `specs/hud-008-app-backends.md` ("App Backends Convention", *implemented*)
> and native `packages/native/apple/HudsonKit/Docs/HUD-008-web-surfaces.md`. The
> app-backends spec is the API/route seam this doc depends on (§1.3); they're
> adjacent, so this gets its own number and cites it rather than colliding.

## TL;DR

The product is **HudsonKit**, not the apps. The first migration goal is to move first-party apps like **Logo**, **Shaper**, Theme Designer, etc. out of the main Hudson repo so Hudson can focus on being the kit/runtime.

- **AppShell** is already kit-level. It takes `app: HudsonApp` plus chrome opts and imports **zero** specific apps. Scout embeds it. That's the bar.
- **WorkspaceShell** — the multi-app **host** — is 4,591 LOC in `app/shell/WorkspaceShell.tsx` that reaches directly into named apps (`../apps/terminal`, `../apps/hudson-ai/*`, `../apps/hudson-docs/*`), hardcodes ~8 host `/api/*` routes, and depends on a dozen `app/shell` contexts. Fixing that is enabling work, not the main outcome.
- **App bundles travel together.** A moved app brings its `HudsonApp`, slots/hooks/provider, settings, intents, ports, AI toolset(s), backend route handlers, static assets/seeds, and workspace registrations. Hudson imports/registers the bundle; it should not own the app's source.

The work in this HUD: **extract real apps first**, using the host/kit changes only where they remove root-cause coupling. Shaper is the first probe because it is a real app with ports/intents/AI but a small backend surface. Logo follows after the app-bundle contract handles app-owned route handlers and template storage.

- **Hudson = the kit/runtime.** It keeps hudsonkit, portable shell primitives, host plumbing, and a small dogfood workspace.
- **Atelier = the apps** (eventually a separate first-party monorepo: logo, shaper, preframe, hero, arc, og, …) built on the kit.
- **Thin Atelier = app bundles + workspace declarations. Nothing else.** An app = its UI (slots/hooks) + its own **relay handler(s)**, **API handler(s)** (HUD-008), **toolset(s)**, assets, and workspace entries. The kit owns shared registries/dispatch; apps supply the handlers that register.
- **Hudson should be turnkey for App Builder.** A downstream builder should not assemble a relay, AI route layer, service lifecycle API, storage, uploads, and tool dispatch by hand. HudsonKit should offer the specific host shape needed to serve a multi-app, AI-enabled workspace: declare apps/workspaces, bind secrets/storage, run one host, get shell + relay + AI + app APIs.
- All first-party (no external users) → **source-linked, no npm publish**, no tiers. The current `hudson-showroom` package is only a transitional staging area for extracted app code; it is not the product shape or naming direction.

This supersedes the showroom framing as a product direction. PR #111's mistake was treating demo packaging as the end state. The corrected path is to move app ownership out of Hudson, while fixing only the kit/host seams needed to make those moved apps run.

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

### 2.1.1 Turnkey host services

HudsonKit is not just a component library. It should ship a **host services layer**
for app builders who want to serve a real multi-app, AI-enabled product.

The target App Builder experience:

```ts
import { createHudsonHost } from 'hudsonkit/host';
import { logoBundle, shaperBundle } from '@atelier/apps';

export default createHudsonHost({
  workspaces,
  bundles: [logoBundle, shaperBundle],
  storage,
  secrets,
  ai,
  relay,
});
```

That host should provide, by default or adapter:

| Surface | Responsibility |
|---|---|
| **Workspace app** | Serve the React `WorkspaceShell` with declared workspaces and app bundles. |
| **Relay** | Own terminal/agent session transport instead of hardcoding `ws://localhost:3600` in apps. Expose a stable relay URL through the shell environment. |
| **AI API** | Serve chat/model/image routes, toolset registration, and tool-call dispatch. Apps bring toolsets; Hudson owns the loop and provider boundary. |
| **App API** | Mount app-owned HUD-008 backend handlers under predictable routes, with thin host stubs only where a framework requires files. |
| **Services** | Provide service status/start/stop/install APIs and a catalog that app bundles can extend. |
| **Storage/uploads/assets** | Provide app storage, workspace persistence, uploads, screenshots, and static asset/seeds mounting. |
| **Observability** | Provide action logs, service logs, and shell/runtime events without making product-action lifecycle logging part of routine platform development. |
| **Voice and local capabilities** | Bind optional local voice/native services through the same environment contract. |

Adapters can differ (`Next`, `Vite+Bun`, cloud worker, native shell), but the
shape should not. A consumer should choose a host adapter, register app bundles,
and get a working AI-enabled workspace without rebuilding Hudson's server tier.

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
  host: HudsonHostServices;              // turnkey server/service surface
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

When a host omits a capability, the kit supplies a no-op/default (the way AppShell defaults every chrome flag to `true`). For App Builder, the default should be stronger than no-op: a local turnkey host that runs the relay, serves app APIs, and exposes the AI route layer. Hudson and Atelier differ only in *what they inject and which workspaces they declare* — not in shell code.

### 2.3 The seam stays one file

Registration stays in `app/apps/registry.ts` (static imports + `getAppById` + `get*Workspace()` composers + the `allWorkspaces` proxy). `app/app/page.tsx` swaps `WorkspaceShell` from `app/shell` to `hudsonkit/shell` and passes `env`; otherwise unchanged.

## 3. Migration

Reordered after takeover — app extraction drives the work. Host/kit moves happen only when a real app cannot leave `app/apps` without them.

| Phase | Change | Risk |
|---|---|---|
| 1 | **Extract Shaper as the first real app probe.** Move/register Shaper through the external app package path; move its AI toolset with it; expose any required shell contract from `hudsonkit` instead of importing `app/shell`. Known remaining Shaper bundle work: static seeds under `public/shaper/*`, `/api/shaper/save`, and the cross-app `/api/assets` export path. | Medium |
| 2 | **Define the app-bundle contract.** A bundle carries apps, toolsets, route handlers/stubs, static assets/seeds, settings, ports, and workspace entries. Hudson's registry imports bundles; the host owns only registration/plumbing. This is the contract Logo needs before it moves. | Medium |
| 3 | **Move Logo with its backend.** Logo brings `/api/logo/*`, template storage, export/icon-composer routes, `logoToolset`, prompts, settings, and data seeds. Hudson keeps only thin route stubs or registry wiring required by Next. | High |
| 4 | **Move the rest of the first-party apps by dependency depth.** Simple client apps first, then app pairs with ports/workspaces (Assets, Image Process Lab, Theme Designer, Day Stack, Vantage, etc.). Each move removes source from `app/apps`, not just re-exports it. | Medium |
| 5 | **Extract shell settings out of hudson-docs** into the kit: `HudsonSettings`, `VoiceSettings`, `AppSettingsEntry`, `SettingsPanel`, `ServiceActionButton`. Re-point the 8 `app/shell` reaches. | Medium |
| 6 | **Define the injected host interfaces** (`WorkspaceShellEnvironment`) and adapt the 8 hardcoded `/api/*` routes (§1.2.B) + app-id leaks (§1.2.C) to go through them. | Medium |
| 7 | **Land the turnkey host services layer.** Provide a local host adapter that serves service lifecycle APIs, app backend handlers, AI routes/toolsets, uploads/assets, and relay URL/startup through one `HudsonHostServices` object. | High |
| 8 | **Invert remaining host→app reaches** (§1.2.A): console → kit/slot; hudson-ai runtime → kit/inject; app toolsets register from app bundles. Host now imports no `../apps/*`. | Medium |
| 9 | **Graduate `WorkspaceShell` (host)** into `hudsonkit/shell` with the §2.2 signature. Host mounts it with `env`. **Acceptance: running app with console, relay, AI API, and app API.** | Medium |
| 10 | Stand up the **Atelier** repo (source-linked via a built-dist/workspace protocol — §4 OD). Hudson keeps the kit/runtime + dogfood workspace. | Medium |
| 11 | **Native:** additive `WorkspaceShell` + `typealias HudVantageSurface`; update native HUD-005 manifest. | Low |

Acceptance for the kit extraction (phases 4–9): **a running app with console, relay, AI, and app APIs** — a host that boots, opens the console, takes a relay message, serves an AI chat/tool request, and serves an app-owned API handler — not a shell that merely compiles in isolation.

## 4. Open decisions

1. **(Resolved — OD1)** Embed/host name collision → host takes `WorkspaceShell`; embed shell renamed `EmbedShell`; native aligns to `WorkspaceShell`.
2. **Console ownership.** Kit-owned primitive (ship the terminal body) vs. injected `ConsoleSlot`. Leaning kit-owned — `HudsonTerminal` already lives in `app/shell`; the `../apps/terminal/TerminalContent` import is the accident to undo.
3. **HudsonAI runtime.** Fold the runtime into the kit shell, or inject an `AIChatRuntime`? The `hudson-ai` *app* (its UI) stays an app regardless; this is only about the runtime wiring + toolset registry.
4. **Source-link transport.** A bare `file:`/source-folder dep makes Next/Turbopack watch the entire Hudson checkout (the existing consumer warning). Define the actual mechanism: built `dist` consumed via `workspace:`/`link:`, or a watched-but-scoped export. This gates the standalone Atelier repo step after the host services layer exists.
5. **Atelier shape.** One monorepo with all apps, or each app independently source-linkable (preframe-style) with Atelier aggregating.

## 5. Deliverables for phase 1

- **This doc** (HUD-009).
- **The cut inventory** (§1.2) as the authoritative list — every import edge, hardcoded route, and app-id leak, each tagged KIT / INJECT / TRAVELS.
- **Shaper extraction probe:** Shaper is registered from the external app package path, and its AI toolset is exported from that package instead of `app/api/ai/toolsets/shaper.ts`.
- **Public shell-layout contract:** `ShellLayoutProvider` / `useShellLayout` live in `hudsonkit`, because extracted apps cannot import `app/shell/ShellLayoutContext`.
- **Known remaining Shaper bundle work:** move static seeds out of `public/shaper/*`, make `/api/shaper/save` a bundle-owned route/stub, and replace the direct `/api/assets` export POST with a port or injected asset API.
- **No broad host move** in phase 1. PR #111 closed; `docs/hudson-kit-vs-showroom.md` marked superseded. Rename the kit's minimal `WorkspaceShell` → `EmbedShell` before host graduation, but it is not the driver of this slice.

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
