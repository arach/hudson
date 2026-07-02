# WorkspaceShell Decomposition Plan

**Date:** 2026-07-02
**Status:** Proposed — blocked on four in-flight work items (see §6) landing first
**Target:** `packages/web/hudsonkit/src/workspace/shell/WorkspaceShell.tsx` (4,705 lines)
**Companion:** `packages/web/hudsonkit/src/components/AppShell.tsx` (826 lines)
**Prior art:** `docs/plans/shell-graduation-2026-06-05.md` (moved this file into the kit; this plan splits it apart)

## Non-negotiable invariants

These hold through every step of this plan:

1. **The Provider + slots + hooks bridge is preserved exactly.** All app Providers are nested for ALL apps (including disabled ones, lines 883–895) so the React tree never remounts when an app is toggled. `useAppHooks` / `useAppSettingsBridge` / `usePortBridge` are called unconditionally per app inside `.map()` (lines 1044–1066) — hook order stability depends on `fullWorkspace.apps` order. Provider runtime gating (`visible` / `focused` / `disabled` props, published back via `onProviderRuntimeChange`, lines 685–843, 1229–1234) is behavior-frozen.
2. **Every localStorage key string is byte-identical after extraction.** Users' saved layouts must survive.
3. **Ref-based drag paths stay ref-based.** No conversion of drag-time DOM/ref writes into per-frame React state.
4. **No new public exports** from `hudsonkit` without coordinating with the export-hygiene work item (§6b). All extracted modules are package-internal until explicitly graduated.
5. Each PR is independently landable and revertable; the file compiles and all characterization tests pass at every step.

---

## 1. Responsibility inventory of the current file

Line numbers verified against the current working tree (dirty, branch `codex/hudson-reply-speech`).

### File-level scaffolding
| Lines | Responsibility |
|---|---|
| 1–93 | Imports (pulls from `../../index` barrel — a cycle hazard to keep an eye on) |
| 95–133 | Tuning constants: `PERSIST_DEBOUNCE_MS = 5000` (pan/zoom), `BOUNDS_FLUSH_MS = 500` (window-bounds → state flush), `FIT_ALL_DELAY_MS = 600`, `DEFAULTS` (panel/terminal dims), `TILE` (smart-tiler sizes), `HUD_LOGGER_MAX_EVENTS = 240`, `AGENT_ACTION_PERSIST_SEEN_LIMIT = 500` |
| 135–195 | Perf instrumentation: `isPerfLogEnabled`, `useCanvasMountTrace`, `MountTrace` (reads `?perf=1` / `localStorage.hudsonPerf`) |
| 164–190 | Agent-action observation persistence helpers (`isPersistableAgentActionObservation`, `persistAgentActionObservation` → POST `routes.agentActions`) |
| 197–208 | Public types: `WindowBounds`, `WorkspaceShellInitialState` |

### Duplicated infrastructure (the fork)
| Lines | Responsibility |
|---|---|
| 211–306 | **Local fork of `usePersistentState` / `useDebouncedPersistentState`** + `useHydrated` + `readStorage`/`writeStorage`. Differs from the canonical `src/hooks/usePersistentState.ts` in three ways: (1) supports `{ enabled }` gating for `persistSession`; (2) restores via `queueMicrotask` + `restoreReady` gate instead of synchronous render-phase restore; (3) no `inst:` instance-key scoping. **Being unified by another agent right now — do not touch (§6a).** |
| 308–332 | Cross-workspace terminal handoff via raw localStorage (`hudson.ws.{id}.terminal.pending-active`, `primeHudsonAIWorkspaceHandoff`) |

### Status-bar / overlay leaf components
| Lines | Responsibility |
|---|---|
| 337–361 | `ServiceStatusIndicator` (status-bar Services m/n button) |
| 363–374 | `HudLoggerStatusButton` |
| 376–436 | `HudLoggerOverlay` (fullscreen agent-actions log, Escape-to-close) |
| 438–450 | `renderStatusRightItems` layout helper |
| 452–494 | Pure service helpers: `getWorkspaceServiceStatus`, `getWorkspaceServiceIds`, `appHasPorts`, `appShowsPorts` |

### AI tool-call plumbing (pure)
| Lines | Responsibility |
|---|---|
| 496–639 | Setting-value coercion for AI tool calls (`coerceBooleanToolValue`, `coerceNumberToolValue`, `clampToolNumber`, `coerceAppSettingToolValue`) and `buildShellSettingsPatch` (big switch over every shell setting key) |

### Outer shell
| Lines | Responsibility |
|---|---|
| 641–651 | `useWindowBounds` — per-window persisted bounds (`hudson.ws.{ws}.win.{app}`) |
| 653–698 | `WorkspaceShellEnvironment` / `WorkspaceShellProps` / `ProviderRuntimeState` types + small helpers |
| 700–929 | **`WorkspaceShell` (outer):** session restore (`loadSession`/`saveSession`), agent-action observability subscription, disabled-apps load/save through `routes.workspaceState` (1s debounce), feature-flag gating of apps, provider runtime state, **the Provider nesting loop (883–895)**, context-provider stack (HostRoutes → ActiveWorkspace → Decor → DataBus), boot splash |
| 931–985 | Bridge hooks: `AppHookData`, `useAppHooks`, `useAppSettingsBridge`, `useNoHudsonAISettingsEntry` |

### `WorkspaceInner` (lines 990–3895 — the monolith)
| Lines | Responsibility group |
|---|---|
| 1024–1103 | Hook merging over all apps, port bridge registration, per-app settings assembly (incl. injected `useHudsonAISettingsEntry`), service registry + auto-start of required services |
| 1105–1164 | Focus state (`hudson.ws.{ws}.focus`), z-order counter/map, tool-accordion expansion |
| 1166–1234 | Activated-apps state + disk load/save via `routes.workspaceState` (1s debounce, staleness generation counter), provider-runtime publishing effect |
| 1236–1430 | Launcher state/dismiss, activate/toggle-visibility/toggle-disabled handlers, app ordering (`hudson.ws.{ws}.appOrder`), dynamic windows (`spawnTerminal` via `environment.renderTerminal`), smart tiling (`tileWindowBounds` — writes `hudson.ws.{ws}.win.{app}` keys directly), pending fit-all |
| 1432–1438 | Layout-mode resolution (canvas/panel/focus, left-navigation mode) |
| 1440–1548 | **Persisted chrome state** — panels (`leftCollapsed/rightCollapsed/leftW/rightW`), pan/zoom (debounced 5s), terminal (`.terminal`, global `hudson.termH`), minimap (`hudson.minimap`), guides, code workbench (`codeWorkbenchSize/EditorWidth/ChatWidth`, `codeSheetWidth`); fullscreen-app derivation (1463–1486); URL hash deep-link sync `#focus=&fullscreen=` (1492–1525) |
| 1550–1605 | Focused code-surface derivations, workbench parallax shift, **window-bounds tracking: `windowBoundsRef` (live truth) + `windowBoundsMap` (state) + `reportWindowBounds` debounced flush at `BOUNDS_FLUSH_MS`** |
| 1607–1661 | Console drawer routing state (`consoleWorkspaceKind` ai/terminal, `consoleAIKind` workspace/app, `setActiveTerminalAppId` back-compat write-only handle, pending-terminal handoff consumption) |
| 1663–1754 | Shell settings (`hudson.settings` persisted, normalize-on-read + normalize-repair effect, mute wiring, font CSS custom properties, context-menu mode, devtools-welcome install) |
| 1756–1837 | `playSound` gate, `hudson:agent-action` listener, `hudson:open-app` listener (cross-workspace app open), hud-logger open, `startVoicePrompt` |
| 1839–1982 | Pan/zoom handlers, `handleFitAll` (reads `windowBoundsRef`), **panel resize drag (1902–1928): writes `[data-frame-panel]` element width during drag, commits state on mouseup**, reset-all-windows (removes `.win.*` keys + remount via `windowResetKey`), auto-layout, fullscreen enter/exit, `openSettings`/`openWorkspaceManager`, `setPanelCollapsed` |
| 1984–2191 | Shell commands (~20), service commands, `allCommands` merge + flag filtering, intent catalog/executor |
| 2193–2231 | Keyboard shortcuts (Cmd+K, Cmd+,, Cmd+Shift+,, Cmd+Shift+F, Escape — note the unconditional `preventDefault` on Escape) |
| 2233–2271 | Canvas context menu items, `ShellLayoutContext` value, terminal offsets/zoom-control visibility |
| 2273–2434 | Left/right panel content JSX (minimap footer, `SidebarSection` list, inspector/tools/ports), panel titles/icons/header actions |
| 2436–2631 | DataBus consumption + **`workspaceAIToolContext` (a ~175-line `useMemo` with 17 deps)** + `queueHudsonAIPrompt` |
| 2633–2662 | Window-event API: `hudson:close-terminal`, `hudson:open-settings`, `hudson:set-panel-collapsed` |
| 2664–2884 | **`handleWorkspaceToolCall`** — 220-line switch over 13 AI tool names (commands, settings, app state, services, workspace switch, env vars, pipes, image fetch/generation) |
| 2886–3002 | Terminal screenshot capture, terminal voice capture (`useVoiceInput`, Cmd+Shift+M shortcut, auto-send logic) |
| 3004–3199 | Console drawer JSX: title tabs, header actions, voice overlay, AI/terminal content routing |
| 3201–3305 | World content assembly (`MultiAppCanvas` props explosion), `handleResetLayout`, `wmData` (WorkspaceManager context value), `hudsonAIRuntime` value |
| 3307–3895 | **Return JSX:** provider stack (HudsonAIRuntime → ServiceRegistry → WorkspaceManager → ShellLayout); fullscreen panel-app layout branch (3313–3558, its own header/panels/status bar/terminal/code surfaces); `Frame` branch (3560–3849, nav/panels/status/terminal/code/palette/launcher with boot-phase motion wrappers); overlays (manager panel, hud logger, spawn dialog, devtools dialog, setting-changed notice) |

### Trailing components (same file)
| Lines | Responsibility |
|---|---|
| 3900–4089 | `MultiAppCanvas` — native vs windowed app render loops, decor layer, pipe connectors, dynamic windows, canvas-painted perf mark. (Note: `workspace/shell/canvas/WindowedAppList.tsx` already exists as a prepared, **currently unreferenced** extraction of the windowed loop.) |
| 4091–4149 | `DynamicWindowedApp` — non-Provider window wrapper |
| 4151–4380 | `TerminalSpawnDialog` + `SPAWN_PRESETS` (contains hardcoded `/Users/arach/...` paths) + `prettyCwdShort` |
| 4382–4527 | `DevtoolsIntegrationDialog` |
| 4529–4705 | `WindowedApp` — persisted bounds, maximize math against `ShellLayout`, bounds reporting, context menu wiring |

Hook census (current tree): 43 `useEffect`, 78 `useMemo`/`useCallback`, 18 persistent-state call sites file-wide — consistent with the audit numbers given the uncommitted diff.

### Duplication with AppShell (the second consumer)

`AppShell.tsx` independently reimplements: panel collapse/width persistence (`appshell.{app}.left/right/leftW/rightW`) + resize drag (state-driven, immediate); command palette state + Cmd+K; terminal drawer (`appshell.{app}.termH`, maximize, tabs); code workbench sizing (`codeWorkbenchSize/EditorWidth/ChatWidth/codeSheetWidth` — 4 keys ×2 shells, ~12 references in AppShell vs ~21 in WorkspaceShell); keyboard shortcuts (Cmd+[, Cmd+], Ctrl+`, Cmd+J); shell command list; status-bar wiring; the auto-collapse-right-panel-when-workbench-opens effect (AppShell 191–196 ≡ WorkspaceShell 1565–1570). AppShell additionally has the `AppShellControlsContext` imperative surface and takeover handling; WorkspaceShell has neither.

---

## 2. Target structure

### New shared layer: `src/shell-core/` (internal, consumed by both shells)

```
packages/web/hudsonkit/src/shell-core/
  keys.ts                  # THE single source of truth for storage key strings:
                           #   appShellKey(appId, name)   -> `appshell.${appId}.${name}`
                           #   workspaceKey(wsId, name)   -> `hudson.ws.${wsId}.${name}`
                           #   windowKey(wsId, appId)     -> `hudson.ws.${wsId}.win.${appId}`
                           #   GLOBAL_KEYS = { settings: 'hudson.settings', termH: 'hudson.termH',
                           #                   minimap: 'hudson.minimap' }
  constants.ts             # PERSIST_DEBOUNCE_MS, BOUNDS_FLUSH_MS, FIT_ALL_DELAY_MS, panel min/max
  useShellPanels.ts        # left/right collapsed + width (persisted), clamp fn injection,
                           # resize-drag with two strategies:
                           #   'immediate'          — set state per mousemove (AppShell today)
                           #   'commit-on-release'  — write [data-frame-panel] DOM width during
                           #                          drag, setState on mouseup (WorkspaceShell today)
                           # + setPanelCollapsed(side, collapsed|'toggle')
  useTerminalDrawer.ts     # showTerminal, isMaximized, height (persisted; key + default injected),
                           # open/close/toggle, canvas bottom-offset derivation
  useCommandPaletteState.ts# showCommandPalette open/close/toggle (palette-enabled gating)
  useCodeWorkbench.ts      # workbenchSize/editorWidth/chatWidth/sheetWidth (persisted),
                           # placement derivation (inspector|sheet|workbench),
                           # auto-collapse-right-on-open effect, viewport parallax shift calc
  CodeSurfaceLayer.tsx     # the sheet/workbench fixed-position wrappers (today copy-pasted
                           # 3x in WorkspaceShell + 2x in AppShell), parameterized on insets
  shellCommands.ts         # buildCommonShellCommands({panels, terminal, codeSurface, theme, ...})
                           # producing the shared subset; each shell appends its own extras
  windowing/
    useWindowBoundsTracker.ts  # windowBoundsRef + windowBoundsMap + reportWindowBounds
                               # (BOUNDS_FLUSH_MS debounce), getLiveBounds() for fit-all
    tiling.ts                  # pure: computeTiledBounds(windowedIds, TILE) -> Record<id,Bounds>
    fit.ts                     # pure: computeFitTransform(boundsList, viewport, padding)
```

Persistence itself is NOT re-implemented here: shell-core hooks call the canonical `src/hooks/usePersistentState.ts` (post-unification, §6a — which must gain the `{ enabled }` option the WorkspaceShell fork has today).

### What stays workspace-specific (`src/workspace/shell/`, new files)

```
workspace/shell/
  WorkspaceShell.tsx       # outer component: Provider nesting loop, session restore,
                           # disabled-apps persistence, boot splash (~350 lines) — UNCHANGED logic
  WorkspaceInner.tsx       # orchestrator: hook merging, mode resolution, composition (~600–800)
  state/
    useActivatedApps.ts    # activated set + routes.workspaceState load/save + provider publish
    useFocusAndZOrder.ts   # focus persistence + z-counter + hash deep-link sync
    useAppOrder.ts
  console/
    useWorkspaceConsole.ts # kind routing + activeTerminalAppId back-compat + handoff consumption
    useTerminalVoice.ts    # voice capture, Cmd+Shift+M, auto-send
    ConsoleTitleTabs.tsx, TerminalVoiceOverlay.tsx, ConsoleContent.tsx
  ai/
    toolContext.ts         # pure buildWorkspaceAIToolContext(inputs)
    toolCallHandler.ts     # createWorkspaceToolCallHandler(deps) — the 13-case switch
    toolValueCoercion.ts   # coerce* + buildShellSettingsPatch (pure)
  canvas/
    MultiAppCanvas.tsx, WindowedApp.tsx, DynamicWindowedApp.tsx,
    perf.ts (MountTrace/useCanvasMountTrace), WindowedAppList.tsx (existing, to be wired or removed)
  chrome/
    statusItems.tsx        # ServiceStatusIndicator, HudLoggerStatusButton, renderStatusRightItems
    HudLoggerOverlay.tsx
    FullscreenPanelLayout.tsx   # lines 3313–3558 as a component
    WorkspacePanels.tsx         # left/right panel content builders
  dialogs/
    TerminalSpawnDialog.tsx, DevtoolsIntegrationDialog.tsx
  serviceStatus.ts         # getWorkspaceServiceStatus/-Ids, appHasPorts/appShowsPorts (pure)
  agentActions.ts          # observation persistence helpers
  terminalHandoff.ts       # pending-terminal localStorage handoff
```

Workspace-only concerns that must not migrate into shell-core: Provider nesting/runtime gating, hook-merging bridge, DataBus/ports/pipes, service registry, workspace manager, launcher/boot choreography, intents, decor, dynamic windows, the Hudson AI runtime. AppShell-only concerns that stay put: `AppShellControlsContext` imperative controls, takeover/inert handling, Assistant drawer tabs, `InstanceProvider`.

---

## 3. Sequenced extraction roadmap

Ordering principle: **land tests first, then peel from the file's edges inward** (bottom-of-file leaf components and top-of-file pure helpers first — they don't overlap the WorkspaceInner hot zone where the in-flight diffs live), then introduce shell-core in AppShell (small blast radius), then migrate WorkspaceShell onto it, then split the big domains. Every PR: `bun run --filter hudsonkit build` clean, `bunx vitest run` green, manual smoke of one multi-app workspace + one single-app AppShell.

**PR 0 — gate.** Do not start until §6 items (a)–(d) are merged/committed; rebase onto their result.

**PR 1 — characterization tests only** (no src changes). See §4. Files under `apps/web/test/lib/`.
*Verify: tests fail if key strings, debounce timings, or provider gating change.*

**PR 2 — leaf dialogs + status chrome out of the file.** Move `TerminalSpawnDialog` (+`SPAWN_PRESETS`+`prettyCwdShort`), `DevtoolsIntegrationDialog`, `HudLoggerOverlay`, `HudLoggerStatusButton`, `renderStatusRightItems`, `ServiceStatusIndicator` to `dialogs/` and `chrome/statusItems.tsx`. Pure cut-and-paste; no public export changes. (~800 lines removed.)
*Verify: build + tests; `git grep` confirms no new exports from `src/index.ts`/`src/workspace.ts`.*

**PR 3 — window components out.** Move `WindowedApp`, `DynamicWindowedApp`, `MultiAppCanvas`, `DynamicWindowEntry`, `useWindowBounds`, `MountTrace`/`useCanvasMountTrace`/`isPerfLogEnabled` to `canvas/` and `perf.ts`. Decide the fate of the orphaned `canvas/WindowedAppList.tsx` (recommend: leave unwired, file follow-up). **Touches AppWindow consumers — land only after the AppWindow a11y PR (§6c) merges.** (~600 lines removed.)
*Verify: bounds-flush characterization test still passes (the 500 ms debounce path crosses this seam); drag a window manually, minimap indicator updates after release; `?perf=1` marks still fire.*

**PR 4 — pure helpers out.** `ai/toolValueCoercion.ts`, `serviceStatus.ts`, `agentActions.ts`, `terminalHandoff.ts`, `shell-core/constants.ts` + `shell-core/keys.ts` (introduce key builders; replace inline template literals in WorkspaceShell AND AppShell with them — mechanical, greppable). Add direct unit tests for `buildShellSettingsPatch` and coercers.
*Verify: golden localStorage-key test byte-identical; unit tests for every `buildShellSettingsPatch` case.*

**PR 5 — shell-core hooks, wired into AppShell only.** Create `useShellPanels` (absorbing the just-landed `panelBounds`/`clampPanelWidth` from §6d), `useTerminalDrawer`, `useCommandPaletteState`, `useCodeWorkbench`, `CodeSurfaceLayer`. AppShell consumes them; its `AppShellControlsContext` values delegate to the hook returns. WorkspaceShell untouched.
*Verify: AppShell keys unchanged (`appshell.*` golden test), palette/drawer tests, controls-context memo identity (render-count spy), manual resize drag still live-updates (immediate mode).*

**PR 6 — WorkspaceShell onto shell-core chrome hooks.** Replace lines 1440–1548 + 1902–1982 + palette state with `useShellPanels` (commit-on-release drag mode, `[data-frame-panel]` writer), `useTerminalDrawer` (`hudson.ws.{ws}.terminal` + global `hudson.termH`), `useCommandPaletteState`, `useCodeWorkbench`, `CodeSurfaceLayer` at all three render sites. **This is the highest-risk PR; keep it to state/handler swaps with zero JSX restructuring beyond the code-surface wrappers.**
*Verify: full characterization suite; manual: collapse/resize both panels, drag has no per-frame re-render (React DevTools highlight), workbench open auto-collapses right panel, sheet/workbench/inspector placements in normal + fullscreen modes.*

**PR 7 — windowing module.** Extract `useWindowBoundsTracker` (ref + `BOUNDS_FLUSH_MS` flush + `getLiveBounds`), pure `tiling.ts` and `fit.ts`; `handleFitAll`/`handleAutoLayout`/`handleResetLayout`/`tileWindowBounds` become thin callers. Unit-test the pure math (1/2/n-grid tiling, fit clamping to 0.2–1).
*Verify: fit-all after launcher dismiss (600 ms delay path), auto-layout, reset-all-windows (keys removed + remount), minimap rects.*

**PR 8 — console + voice domain.** `useWorkspaceConsole`, `useTerminalVoice`, `ConsoleTitleTabs`, `TerminalVoiceOverlay`, `ConsoleContent` (lines 1607–1661, 2886–3199). Preserves the write-only `setActiveTerminalAppId` back-compat contract and handoff-key consumption.
*Verify: voice shortcut test, `hudson:close-terminal` event test, AI↔terminal tab routing with and without app Chat/Terminal slots.*

**PR 9 — AI runtime assembly.** `ai/toolContext.ts` (pure builder; the `useMemo` stays in WorkspaceInner with an **identical dependency array**) and `ai/toolCallHandler.ts` (`createWorkspaceToolCallHandler(deps)`; `useCallback` wrapper stays). Lines 2436–2884.
*Verify: new unit tests call the pure builder/handler directly (workspace switch handoff, set_app_setting coercion path, unknown-command warn); memo identity spy unchanged.*

**PR 10 — workspace state hooks.** `state/useActivatedApps.ts` (incl. the generation-counter stale-response guard and 1 s POST debounce), `state/useFocusAndZOrder.ts` (incl. hash sync + `pendingFullscreenHashRef`), `state/useAppOrder.ts`. The provider-publishing effect moves into `useActivatedApps` with the same dep list.
*Verify: provider-gating characterization test (§4.4), hash deep-link test, workspace-switch remount (keyed by `workspace.id`) still restores per-workspace state.*

**PR 11 — JSX split.** `chrome/FullscreenPanelLayout.tsx` (3313–3558), `chrome/WorkspacePanels.tsx` (2273–2434), and finally split `WorkspaceInner` into its own file, leaving `WorkspaceShell.tsx` as outer + re-exports (public API file path unchanged for `src/workspace.ts`). End state: no file in the shell over ~800 lines.
*Verify: visual smoke of fullscreen panel mode, canvas-focus mode, boot animation; type-only diff on `dist/workspace.d.ts` public surface.*

**PR 12 (optional follow-up).** Converge shell command lists via `shell-core/shellCommands.ts`; reconcile keyboard-shortcut deltas (AppShell has Cmd+[/Cmd+]/Ctrl+` keydowns, WorkspaceShell only exposes them as palette commands — document, don't silently change); wire `WindowedAppList` skeletons.

Rebase-pain notes: PRs 2–4 don't touch WorkspaceInner's body, so they can land while any straggling chrome work merges. PRs 6–10 all edit WorkspaceInner and MUST be serial. PR 5 is the only one touching AppShell and must follow §6d.

---

## 4. Characterization test strategy (write before moving code — PR 1)

Infrastructure exists: `apps/web/vitest.config.ts` (jsdom, `apps/web/test/setup.ts`, aliases `hudsonkit` → `packages/web/hudsonkit/src`), helper `apps/web/test/helpers/renderWithHudson.tsx`. Build a shared fixture: `makeTestWorkspace()` with 2–3 minimal `HudsonApp`s (one `canvasMode: 'windowed'`, one native, one with a `Chat` slot) whose `Provider` records its `visible/focused/disabled` props into a spy array. Render `<WorkspaceShell workspaces={[ws]} defaultWorkspaceId="test" bootMode="none" />` with mocked `fetch`.

1. **Persistence-key goldens** (`apps/web/test/lib/workspace-shell-persistence.test.tsx`):
   - After mount + flushing timers, snapshot `Object.keys(localStorage)` against a golden list.
   - Open palette (Cmd+K), click "Toggle Left Panel" → assert `hudson.ws.test.leftCollapsed` === `true` and a `hudson:saved` CustomEvent fired with that key.
   - Toggle terminal command → `hudson.ws.test.terminal`; assert `hudson.termH` and `hudson.minimap` are the global (non-workspace-scoped) spellings.
   - Same for AppShell: mount, toggle panels via Cmd+[ → `appshell.{id}.left`; assert `appshell.{id}.termH`, code-workbench keys.
   - These tests are the contract for `shell-core/keys.ts`.
2. **Palette open/close** (`workspace-shell-palette.test.tsx`): Cmd+K opens (assert against post-a11y DOM — role/labels from the merged CommandPalette PR, §6c), Escape closes, commands from app hooks + shell + services all present, flag-gated command filtered.
3. **Bounds flush debounce** (`workspace-shell-bounds.test.tsx`): with fake timers, mount with the windowed fixture app (it reports bounds on mount via `WindowedApp`'s effect). Advance 499 ms → minimap has no window rect; advance past 500 ms (`BOUNDS_FLUSH_MS`) → rect present with expected percentage geometry. Also: pan/zoom localStorage write only after `PERSIST_DEBOUNCE_MS` (5 000 ms) and immediately on unmount (flush-on-unmount contract).
4. **Provider runtime gating** (`workspace-shell-providers.test.tsx`): Provider spy asserts (a) mounted once per app **including a flag-disabled app** (`disabled: true`, `visible: false`); (b) `visible: true` exactly for `defaultActivatedAppIds`; (c) `focused: true` only for the default-focused app; (d) navigating `#focus=app-b` flips focus without remounting any Provider (instance-count stays constant).
5. **Pure-function goldens** (cheap, added in PR 4/7/9 as code becomes importable): `buildShellSettingsPatch` per key, tiling for n=1/2/5, fit-scale clamping, `getWorkspaceServiceStatus` matrix.
6. **SSR smoke**: `renderToString` of WorkspaceShell in a node (non-jsdom) test file must not throw and must not touch storage (guards the `useHydrated`/microtask-restore timing through the §6a unification).

---

## 5. Risk register

| # | Risk | Details | Mitigation |
|---|---|---|---|
| R1 | **localStorage key drift** | 16+ workspace-scoped keys, 3 globals, `appshell.*` family, `.win.{app}` written both via hook AND raw `localStorage.setItem` in `tileWindowBounds`/`handleResetAllWindows`; `hudson:saved` event drives the save indicator. A silently changed key wipes user layouts. | `shell-core/keys.ts` as single source; golden-key tests (§4.1); grep audit for remaining string templates per PR; never re-scope existing keys. Note: canonical `usePersistentState` auto-prefixes `inst:` under `InstanceProvider` but exempts `inst:`/`hudson.ws.` — the globals `hudson.settings`/`hudson.termH`/`hudson.minimap` are NOT exempt, safe only because WorkspaceShell never renders under `InstanceProvider`; add exemption or assertion during PR 6. |
| R2 | **Ref-based drag paths** | Panel resize writes `[data-frame-panel]` width directly during drag and commits on mouseup (1902–1928); window bounds live in `windowBoundsRef`, state flushed at 500 ms; `handleFitAll` reads the ref, not state. Converting any of these to state-per-frame reintroduces the shell-wide re-render the comments explicitly engineered away (see `docs/perf-drag-resize-patterns.md`). | `useShellPanels` supports both drag strategies; `useWindowBoundsTracker` keeps ref+flush shape and exposes `getLiveBounds()`; DevTools render-highlight manual check in PRs 5–7; bounds-flush test pins timing. |
| R3 | **Memoization dependency breakage** | `workspaceAIToolContext` (17 deps), `wmData`, `hudsonAIRuntime`, `shellCommands` are giant memos. Extraction hazards: helper functions created per-render become unstable deps (infinite effect loops via `onProviderRuntimeChange`); or deps dropped, causing stale AI tool context / stale commands. | Extract pure builders, keep `useMemo`/`useCallback` shells in place with dep arrays copied verbatim; enable `react-hooks/exhaustive-deps` on new modules; render-count spy tests on context providers; review each PR diff for dep-array changes as a blocking checklist item. |
| R4 | **Provider bridge** | Hooks called in `.map()` over `fullWorkspace.apps` — any conditional call or reorder breaks hook order; Provider nesting for disabled apps prevents remounts; `environment.useHudsonAISettingsEntry` must keep stable identity; `WorkspaceInner` remount is keyed by `workspace.id`. | The bridge block (931–1103) and nesting loop (883–895) are declared frozen — PRs may move them whole-file only (PR 11), never restructure; §4.4 gating test; keep the existing `eslint-disable react-hooks/rules-of-hooks` comments attached. |
| R5 | **SSR/hydration timing** | Fork restores persisted state in a `queueMicrotask` with a `restoreReady` gate suppressing the first write-back; canonical hook restores synchronously in render. The §6a unification changes flash-of-default timing and first-write behavior; layering shell-core on top could double-restore or clobber stored values with defaults on first paint. | SSR smoke test (§4.6); sequence strictly after §6a lands with its own tests; shell-core hooks add no additional storage reads of their own; verify `initialState` (server-provided `WorkspaceShellInitialState`) path still wins over localStorage on first render. |
| R6 | **Barrel-import cycles** | WorkspaceShell imports from `../../index`; new deep modules importing the barrel can create cycles that tsup tolerates but that break tree-shaking/types. | New modules import concrete paths only; check `dist/workspace.js` for cycle warnings each PR. |
| R7 | **Two-shell regression asymmetry** | A shell-core change validated only in WorkspaceShell silently breaks AppShell (or vice-versa) — e.g. drawer-tab guard, chrome opt-outs, takeover suppression. | Both shells' characterization suites run on every PR; PR 5 (AppShell first) deliberately front-loads the smaller consumer. |

---

## 6. Coordination note — in-flight work (as of 2026-07-02)

Concurrent items on/around this working tree:

- **(a) `usePersistentState` fork unification** — landed in the working tree 2026-07-02: `{ enabled }`/`version`/`migrate` options added to the canonical hook, fork deleted, WorkspaceShell switched over, 21 new tests. Restore timing is now render-phase (not microtask); see the hook's tests for the pinned behavior. **PR 1's tests should be written against this merged behavior.**
- **(b) `index.ts` export hygiene + `defineApp` helper** — landed in the working tree 2026-07-02 (explicit named exports for cache/sounds; new `defineApp` + `useCommandShortcuts`). This plan adds **zero public exports**, so overlap is limited to `src/index.ts` context lines.
- **(c) Remote a11y PRs on `components/overlays/CommandPalette.tsx` and `components/windows/AppWindow.tsx`** (codex, in flight). We consume both, never edit them. PR 1's palette assertions must target post-merge roles/labels; **PR 3 (WindowedApp/DynamicWindowedApp move) must land after the AppWindow PR** since both change `AppWindow` call-site expectations. No other steps touch these files.
- **(d) Uncommitted changes on this branch** (`codex/hudson-reply-speech`): AppShell panel clamping (`panelBounds`/`clampPanelWidth`, `app.layout` widths), StatusBar changes, `AppHookData.status: StatusState` in WorkspaceShell, `types/app.ts`, `createEmbedApp`. Must be committed/landed first: PR 5's `useShellPanels` **absorbs** `clampPanelWidth`, and the `StatusState` edit sits inside the bridge block PRs 9–11 move.

**Sequencing:** Step/PR 1 starts only after (a)–(d) are merged. File-overlap matrix for the roadmap: PRs 2–4, 6–11 edit `WorkspaceShell.tsx` (serialize 6–10); PR 5 edits `AppShell.tsx` (after (d)); PR 4 edits both shells (key builders) plus creates `shell-core/`; only PR 12 would revisit `CommandPalette`/`AppWindow` territory. If item (c) slips, PRs 2 and 4 (pure moves, no persistence surface) may proceed as the only safe parallel work, at the cost of one mechanical rebase.

---

## Critical files

- `packages/web/hudsonkit/src/workspace/shell/WorkspaceShell.tsx`
- `packages/web/hudsonkit/src/components/AppShell.tsx`
- `packages/web/hudsonkit/src/hooks/usePersistentState.ts`
- `packages/web/hudsonkit/src/context/AppShellControlsContext.tsx`
- `apps/web/vitest.config.ts` + `apps/web/test/helpers/renderWithHudson.tsx` (characterization suite)
