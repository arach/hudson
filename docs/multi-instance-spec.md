# Multi-instance apps — design spec

> **Status:** Draft, pre-implementation. Phase 1 (SDK plumbing) has landed in
> `4ab4064`; this document defines Phase 2 (shell rekey) and Phase 3
> (spawn/duplicate gestures).

## Why

Today `app.id` does double duty in Hudson: it's both the *kind* of app
(`"logo-designer"`, `"terminal"`) and the *live window's identity*. That
means a workspace can hold exactly one window per app — two Logo Designers
can't sit side-by-side with different logos, and a terminal app can't spawn
a second shell session.

Terminal is the canonical motivating case: every operator expects to open
multiple terminals with different working directories. Logo Designer is
another — comparing two design directions on the same canvas is natural
when the app supports it.

## Conceptual model

We separate two concerns that `app.id` currently conflates:

- **App kind** — the static definition (`HudsonApp`). Identified by `app.id`.
  Declares slots, Provider, hooks, intents, settings.
- **App instance** — one live window at runtime. Identified by `instanceId`.
  Owns bounds, focus, z-order, persisted state under `inst:<instanceId>:*`.

A workspace authoring config (`WorkspaceAppConfig[]`) seeds a runtime instance
list (`AppInstance[]`). After first mount, the instance list is authoritative
and can grow (spawn/duplicate) or shrink (close).

Each app declares how many instances it supports via `multiInstance`:

| Mode | UX | Example |
| --- | --- | --- |
| `singleton` (default) | No Duplicate, no New | hudson-docs, intent-explorer |
| `spawnable` | "New <Name>" command, no Duplicate | terminal, notepad |
| `duplicable` | "Duplicate" + "New <Name>" | logo-designer |

Singleton is the default so every existing app keeps working unchanged.

## What Phase 1 already landed

- `HudsonApp.multiInstance` (optional)
- `AppInstance` type
- `<InstanceProvider>`, `useInstance`, `useOptionalInstance`
- `usePersistentState` auto-scopes keys to `inst:<instanceId>:*` when an
  InstanceProvider is present
- `AppShell` wraps its single app in InstanceProvider with `instanceId = app.id`

Zero runtime change today — nothing mounts more than one Provider per kind
yet. Phase 2 is what flips the world.

## Phase 2 — shell rekey

### Runtime state: what becomes instance-keyed, what stays kind-keyed

**Becomes instance-keyed** (one entry per live window):
- `focusedInstanceId` (replaces `focusedAppId`)
- `windowBounds` map + the persisted `hudson.ws.<ws>.win.<instanceId>` keys
- `zOrderMap`
- `fullscreenInstanceId`
- Minimap indicators
- Window header / close / focus events

**Stays kind-keyed** (one entry per app kind, regardless of instance count):
- `disabledAppIds` — disabling "Logo Designer" disables all its instances
- `activatedAppIds` (shown-in-launcher set) — whether the kind is present
- Service dependencies, command palette grouping, settings, intent catalog
- App switcher / launcher entries

**Needs both**:
- Sidebar sections: one per *kind*, but focus state needs to know which
  instance is active
- URL hash: switches from `#focus=logo-designer` → `#focus=<instanceId>`
  (acceptable break per "no migration" rule)

### Instance ID strategy

- Instance IDs are workspace-local and opaque.
- Seeded workspace apps default to `instanceId === app.id` (keeps the
  singleton case clean and readable in devtools).
- Spawn/duplicate mint `<appId>-<short-nanoid>` (e.g. `terminal-k7q2`).
- Persisted at `hudson.ws.<ws>.instances` as an `AppInstance[]`, survives
  reload.

### Provider nesting

The shell currently nests each `app.Provider` once, top-down. For multi-
instance, it nests once **per instance**, each wrapped in `InstanceProvider`:

```tsx
{instances.map(inst => {
  const app = getAppByKind(inst.appId);
  return (
    <InstanceProvider key={inst.instanceId} instanceId={inst.instanceId} appId={inst.appId}>
      <app.Provider
        disabled={disabledAppIds.has(inst.appId)}
        visible={visibleInstanceIds.has(inst.instanceId)}
        focused={focusedInstanceId === inst.instanceId}
      >
        {/* ... next instance ... */}
      </app.Provider>
    </InstanceProvider>
  );
})}
```

This is the single load-bearing change. Every other rekey flows from here.

### Files in scope for Phase 2

| File | What changes |
| --- | --- |
| `app/shell/WorkspaceShell.tsx` | ~65 appId touchpoints rekeyed; introduce `instances` state |
| `app/shell/MultiAppCanvas.tsx` | Receives `focusedInstanceId`, `instances[]`, `zOrderMap` by instanceId |
| `app/shell/SidebarSection.tsx` | Focus target becomes instanceId; kind → instances[] subtree |
| `app/shell/workspace-manager/*` | "N instances" UI; per-instance close affordance |
| `app/shell/HudsonTerminal.tsx` / terminal drawer | See Open Questions |
| `app/shell/WorkspaceAI.tsx` + tool-context builders | See Open Questions |

Estimated diff size: 600–900 LOC across ~6 files.

## Phase 3 — spawn + duplicate

```ts
spawnInstance(appId: string): AppInstance        // fresh state, offset bounds
duplicateInstance(instanceId: string): AppInstance // clones bounds + persisted state
```

- **Spawn** offsets bounds from canvas centre with a 24-px cascade.
- **Duplicate** deep-copies every `inst:<old>:*` localStorage key to
  `inst:<new>:*` synchronously before mounting the new Provider, so the
  copied window hydrates with identical state.

UI surfaces:
- Window header context menu: "Duplicate" (if kind is `duplicable`),
  "Close" (existing). Menu hidden entirely for singleton kinds — no change.
- Command palette: `New <Name>` entry for every kind where
  `multiInstance !== 'singleton'`.
- Disambiguation: when >1 instance of a kind exists, window header shows
  `"<App Name> <n>"` where `<n>` is the 1-based index within that kind.

## Open design questions (for review)

These are the calls I'd like a second opinion on before we implement.

### 1. AI tool surface: kind or instance?

Today `workspaceAIToolContext` exposes `set_app_state({ appId, visible,
focused })`. With multiple instances, "focus the Logo Designer" is ambiguous.

**Options:**
- (a) Tools keep speaking in appId; "focus" picks the most-recently-focused
  instance of that kind, "set visibility" fans out to all instances.
- (b) Tools get both: `appId` (legacy) for kind-level ops, new `instanceId`
  for instance-specific ops. The AI chooses.
- (c) Rewrite tools entirely in instance terms; migrate the AI prompt.

Proposal: **(a)** for Phase 2/3 — least disruption. Revisit when the AI
actually needs to address specific instances.

### 2. Terminal tab bar

`activeTerminalAppId` today names a kind. If terminal becomes spawnable,
we have three terminal instances: which tab do we show? Possibilities:

- Each terminal instance gets its own tab (matches iTerm).
- Show only the currently-focused terminal instance; tab label says "Terminal".
- Drop per-app terminal tabs; consolidate into the spawnable terminal app.

Proposal: tabs key off `instanceId`, auto-label `"Terminal <n>"`. The
existing `dynamicWindows` system gets replaced by the generic instance
model so we don't maintain two spawning codepaths.

### 3. Workspace-level vs app-level instance persistence

Instances live in `hudson.ws.<ws>.instances`. When you switch workspaces,
you get a different instance list. Logical and matches the existing
workspace boundary. Open question: should switching workspaces preserve
a kind's window layout from last time, or reset?

Proposal: persist, match current behaviour for singletons.

### 4. "Disable app kind" UX with live instances

If the user disables `logo-designer` while two instances are open:
- Both instances unmount immediately (follows existing "disabled removes
  from Provider tree" semantics).
- Instance list purges entries matching the disabled kind.
- Re-enabling re-seeds one fresh instance (not the old two).

Proposal: above. Alternative is to keep the instances around dormant, but
that breaks the existing "disabled is really off" contract.

### 5. No-migration cost

We explicitly chose to not migrate existing localStorage. On first load
after Phase 2 ships:
- Existing window bounds lose their persisted position → windows appear at
  default bounds until dragged.
- Per-app settings under `hudson.app.<appId>.settings` keep working (those
  keys don't go through InstanceContext scoping since they're called
  with a literal app.id argument, not from inside a Provider… actually,
  **verify this** — `useAppSettings` calls `usePersistentState` from inside
  the Provider tree, so the key *does* get prefixed. If so, existing
  settings get reset on upgrade. Acceptable per "one-time it" call,
  but worth knowing.

Proposal: confirm in implementation; if settings reset is undesirable,
make `useAppSettings` opt out of instance scoping via a literal-key escape
hatch.

## Non-goals for Phase 2/3

- User-editable instance titles (auto-numbered for now)
- Drag-to-tear-off instances between workspaces
- Persisted last-focused-per-kind memory
- Intent catalog addressing specific instances
- Cross-instance communication / pipes between two Logo Designers

These can follow if demanded; none block the core feature.

## Rollout

Single PR, ordered commits:

1. ✅ Phase 1 — SDK plumbing (`4ab4064`)
2. WorkspaceShell rekey (Phase 2) — Provider loop, bounds, focus, z-order,
   URL hash. No new verbs yet. Behaviourally identical for singletons.
3. Spawn/duplicate actions + UI gestures (Phase 3). Window header menu,
   command palette entries, instance numbering in titles.
4. Apply `multiInstance` to `terminal` and `logo-designer`. Retire
   `dynamicWindows`. Smoke test.

Each step leaves main in a shippable state.
