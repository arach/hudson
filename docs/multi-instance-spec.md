# Multi-instance apps — first-principles design

> **Status:** Draft, pre-implementation.
> This replaces the previous framing with a simpler rule:
> **Hudson is multi-app, and every live app is an instance.**

## Goal

Hudson should make "open another one" trivial.

Terminal is only the clearest motivating example: one terminal per project,
task, or shell session. But the model is intentionally generic and should work
for any app that benefits from side-by-side state: logo designer, notepad, API
inspector, JSON explorer, and so on.

The clean fix is not to teach `app.id` to mean two things.
The clean fix is to make **instance** the runtime unit everywhere in the shell.

## Design principles

1. **Instance-first runtime**
   The shell should think in live instances, not app kinds. Focus, z-order, fullscreen, bounds, close, duplicate, and terminal tabs all belong to instances.

2. **Kind-first catalog**
   `HudsonApp` remains the static definition: name, slots, intents, settings, services, spawn policy.

3. **Providers mount once per instance**
   A live instance gets exactly one Provider tree. The shell must never read an app's hooks by "reaching through" some shared nested provider stack.

4. **No hidden magic in persistence**
   Storage scope must be explicit. Shell-global, workspace, kind, and instance state should never be inferred implicitly from where a hook happens to run.

5. **One spawning system**
   Hudson should not have special-case dynamic windows for terminal or any other app. Spawning is generic instance creation.

6. **Singleton is just a policy**
   A singleton app still uses the same runtime model. It simply refuses to create a second live instance.

## Mental model

- **App kind**
  Static `HudsonApp`, identified by `app.id`.
  Defines slots, Provider, hooks, intents, settings, services, icons, and spawn policy.

- **App instance**
  One live execution of an app inside a workspace.
  Identified by `instanceId`.
  Owns its own Provider state, bounds, focus, z position, and instance-scoped persistence.

- **Workspace runtime**
  The live list of instances plus shell state that refers to them.
  Once created, this runtime state is authoritative; the authoring workspace config is only the seed.

## Spawn policy

Keep the shipped `HudsonApp.multiInstance` field. It is the right surface; the shell just needs to treat it as a spawn policy rather than a rendering hint.

| `multiInstance` | Meaning | UX |
| --- | --- | --- |
| `singleton` (default) | At most one live instance in a workspace | Open / Focus |
| `spawnable` | Many live instances allowed | Open / New |
| `duplicable` | Many live instances allowed, and one instance can clone another | Open / New / Duplicate |

Semantically, `duplicable` includes spawn.

## Core runtime types

```ts
interface AppInstance {
  instanceId: string;
  appId: string;

  // Optional user-facing label override.
  // When omitted, the shell derives one ("Terminal 2", "Logo 1", etc.).
  title?: string;

  // Small spawn payload for first boot only.
  // Example: { cwd: "/Users/art/dev/hudson" } for terminal.
  launch?: Record<string, unknown>;

  // Persisted shell-owned chrome for this instance.
  bounds?: { x: number; y: number; w: number; h: number };

  createdAt: number;
  lastFocusedAt: number;
}

interface WorkspaceRuntimeState {
  instances: AppInstance[];
  focusedInstanceId: string | null;
  fullscreenInstanceId: string | null;

  // Back -> front ordering for windowed instances.
  zOrder: string[];
}
```

### Important simplification

The shell should drop `activatedAppIds` as a separate concept.

Presence is derived from the instance list:

- `0` instances of a kind = the app is not open in this workspace
- `1+` instances of a kind = the app is open

That removes an entire parallel state machine.

`disabledAppIds` can remain kind-keyed.

## Workspace seeding

`workspace.apps` stays authoring-time config only.

On first load for a workspace:

1. Build an initial `instances[]` list from `workspace.apps`
2. Use `instanceId === app.id` for the seeded singleton-shaped case
3. Persist `WorkspaceRuntimeState`

After that, the runtime state is authoritative.

This means:

- Switching workspaces restores the last live instances for that workspace
- Closing an app really removes its instance
- Reopening is done by spawning a new instance, not by toggling visibility back on

## Shell architecture

This is the central change.

### Current problem

Today the shell nests every app Provider around the whole workspace and then calls app hooks from the shell tree.
That works only because there is exactly one Provider per kind.

As soon as two providers of the same kind exist, the shell cannot safely ask "what is Logo Designer's status/search/commands?" because there is no single ambient Logo context anymore.

### New rule

The shell never calls app hooks directly.

Instead, every live instance mounts through an **AppInstanceHost**.
That host is the only place where the app Provider, hooks, and slots are touched.

### AppInstanceHost

```tsx
function AppInstanceHost({ instance }: { instance: AppInstance }) {
  const app = getApp(instance.appId);
  const runtime = useInstanceRuntime(instance.instanceId);

  return (
    <InstanceProvider
      instanceId={instance.instanceId}
      appId={instance.appId}
      launch={instance.launch}
    >
      <app.Provider
        disabled={runtime.disabled}
        visible={runtime.visible}
        focused={runtime.focused}
      >
        <InstanceBridge instance={instance} app={app} />
      </app.Provider>
    </InstanceProvider>
  );
}
```

### InstanceBridge

`InstanceBridge` does two jobs:

1. Calls the app hooks inside the correct Provider scope and publishes a snapshot to a shell registry
2. Renders the app's slots into shell surfaces via portals so every surface shares the same Provider state

That gives us one Provider tree per instance, no duplicated state, and no provider-order tricks.

## Shell registry

The shell should maintain a live registry of instance snapshots published by hosts.

```ts
interface InstanceSnapshot {
  instanceId: string;
  appId: string;
  appName: string;

  commands: CommandOption[];
  status: { label: string; color: StatusColor } | null;
  search: SearchConfig | null;
  navCenter: ReactNode | null;
  navActions: ReactNode | null;
  layoutMode: 'canvas' | 'panel';
  activeToolHint: string | null;

  hasLeftPanel: boolean;
  hasInspector: boolean;
  hasTerminal: boolean;
}
```

The shell then renders UI from snapshots plus instance runtime state.

This is the key simplification:

- the shell reasons about instances
- the app owns its own state
- the bridge is the seam between them

## Persistence model

This should be explicit, not automatic.

### Recommended API

```ts
usePersistentState(key, initial)            // literal key, no implicit scoping
useWorkspacePersistentState(key, initial)   // hudson.ws.<workspaceId>:<key>
useInstancePersistentState(key, initial)    // inst:<instanceId>:<key>
```

If Hudson keeps the current auto-scoping behavior, the shell will constantly be at risk of accidentally persisting global state under an instance namespace.
That is too magical for a system with nested providers.

### What belongs where

**Instance-scoped**
- app document/state
- window bounds
- per-instance UI state
- duplicated app state

**Workspace-scoped**
- `instances[]`
- `focusedInstanceId`
- `fullscreenInstanceId`
- pan / zoom
- workspace terminal visibility

**Kind-scoped or global**
- app settings
- service registry
- intent catalog metadata
- shell font/theme/audio settings

### Compatibility

If we want to preserve existing singleton app state without a bulk migration:

- seeded instances should use `instanceId === app.id`
- `useInstancePersistentState` can optionally fall back to the legacy unscoped key on first read when `instanceId === appId`

That preserves the common singleton case while still moving the model forward.

## What is keyed by instance vs kind

### Instance-keyed

- focus
- z-order
- fullscreen
- bounds
- close / duplicate / spawn
- minimap rectangles
- terminal tabs for app terminals
- live command closures
- live pipe endpoints

### Kind-keyed

- launcher entries
- disabled state
- settings
- services
- intent metadata
- app icon / name / description
- spawn policy

### Derived from both

- sidebar sections
- AI summaries
- window titles
- command palette grouping

## UI behavior

### Launcher / app switcher

The launcher should be kind-oriented, not instance-oriented.

Each app kind shows:

- app name and icon
- open instance count
- primary action:
  - if instances exist: focus most recent instance
  - if none exist: open
- secondary action for spawnable kinds: new instance

### Window titles

The shell derives titles.

- one instance: `Terminal`
- multiple instances: `Terminal 1`, `Terminal 2`, `Terminal 3`
- optional future enhancement: user-editable titles

### Sidebar

Sidebar sections should remain kind-keyed so the rail does not explode when a kind has many instances.

For a kind with multiple live instances:

- the section header shows an instance count
- the body renders the most-recently-focused instance of that kind
- the header can expose a lightweight instance switcher if needed

### Inspector

The right inspector is always instance-oriented:

- it renders the currently focused instance

That matches how users already think about the inspector surface.

### Close behavior

Closing an instance removes it from `instances[]`.

There is no separate hidden-but-open state in the core model.

That keeps the runtime honest:

- open means present
- closed means gone

## Example: Terminal, but generic by design

Terminal is just an example of the runtime model, not a special case.
Any app kind can participate the same way if its `multiInstance` policy allows
it.

Terminal should become a normal spawnable app.

```ts
spawnInstance('terminal', { launch: { cwd: '/Users/art/dev/hudson' } })
```

That replaces the current special-case `dynamicWindows` path entirely.

### Why this is better

- one spawn path for every app
- one window model
- one focus model
- one duplication model
- no special terminal-only runtime

### Terminal drawer

Keep the shell-owned tabs for:

- `AI`
- `Hudson` (system terminal / shell utilities)

For app terminals, tabs should be keyed by `instanceId`, not `appId`.

Example:

- `AI`
- `Hudson`
- `Terminal 1`
- `Terminal 2`
- `Logo 1`

If an app exposes a `Terminal` slot, each live instance gets its own tab.

## Commands, intents, and AI

### Live commands

App authors should keep stable command IDs like `logo:export` or `terminal:clear`.
They should not have to mint per-instance command IDs.

The shell should wrap them as live instance commands:

```ts
interface LiveCommand {
  instanceId: string;
  appId: string;
  commandId: string;
  label: string;
  action: () => void;
}
```

Internally, the shell can key these as `${instanceId}:${commandId}`.

### Intent catalog

Intent metadata stays kind-level.

It answers:

- what commands does this app support?
- what do those commands mean?

It does not need to become instance-addressable.

### Execution rule

When the shell executes an app intent or AI tool call:

- if `instanceId` is provided, target that exact instance
- otherwise, use the most-recently-focused live instance of `appId`
- if none exists:
  - for `singleton` / `spawnable` / `duplicable`, the shell may spawn one when the requested action implies opening a new instance
  - otherwise, ask for clarification

### AI tool surface

Expose both kinds and instances.

That gives us a simple rule:

- `appId` means "kind-level default target"
- `instanceId` means "this exact live thing"

This is cleaner than forcing AI into only kind terms or only instance terms.

## Ports and pipes

Live pipe endpoints must move from `appId` to `instanceId`.

That means:

```ts
source: { instanceId: string; appId: string; portId: string }
sink:   { instanceId: string; appId: string; portId: string }
```

Why:

- two Logo instances can both expose `params`
- the shell must know which one is the source

The port catalog can still be grouped by kind for presentation, but runtime routing has to be instance-based.

## Disable semantics

Disabling a kind should do exactly two things:

1. close all live instances of that kind
2. prevent new instances from being spawned until re-enabled

Re-enabling should not silently recreate old instances.
The launcher becomes available again, and the user can open a fresh instance if they want.

That is simpler than trying to preserve a dormant hidden set.

## Non-goals

- user-editable instance titles
- dragging instances between workspaces
- cross-workspace instance persistence
- pipes that deliberately address "all instances of a kind"
- implicit hidden instances

## Rollout

The clean rollout is:

1. **Introduce explicit persistence scopes**
   Add `useInstancePersistentState` and stop relying on implicit auto-scoping for shell-owned state.

2. **Add WorkspaceRuntimeState**
   Persist `instances[]`, `focusedInstanceId`, `fullscreenInstanceId`, and `zOrder`.

3. **Introduce AppInstanceHost + registry**
   One Provider tree per live instance.
   Bridge hooks and slots into the shell via registry + portals.

4. **Rekey shell surfaces to instance**
   Canvas, minimap, workspace manager, URL hash, fullscreen, focus, terminal tabs, and command dispatch.

5. **Move ports/pipes to instance endpoints**
   Prevent collisions for duplicable apps.

6. **Retire `dynamicWindows`**
   Replace it with `spawnInstance('terminal', { launch: { cwd } })`.

7. **Enable real spawn policies**
   Mark app kinds individually based on product need:
   `terminal` as `spawnable`, `logo-designer` as `duplicable`, and so on.

## Why this version is simpler

Because it removes the three main sources of complexity:

1. no `app.id` identity overload
2. no special terminal spawning path
3. no shell logic that depends on ambient provider ordering

The resulting rule set is small:

- app kinds are static
- instances are live
- the shell manages instances
- each instance owns one Provider tree
- persistence scope is explicit

Everything else follows from that.
