---
title: Multi-instance
description: How Hudson scopes state per live app instance and how to opt in to multiple
order: 6
---

# Multi-instance

## The instance model

Every live app is an *instance*. An instance has two identifiers:

- `appId` — the `id` from your `HudsonApp` definition
- `instanceId` — the runtime key that scopes all state for this particular live copy

Inside `AppShell`, there is always exactly one instance, and `instanceId === app.id`. Inside `WorkspaceShell`, each live app gets its own `instanceId` minted by the workspace, so two live counters never share state even though they share an `appId`.

All state hooks (`usePersistentState`, etc.) use `instanceId` as their storage namespace. You get isolation for free.

## Declaring intent

Set `multiInstance` on your `HudsonApp`:

```ts
export const terminalApp: HudsonApp = {
  id: 'terminal',
  name: 'Terminal',
  mode: 'panel',
  multiInstance: 'spawnable',
  // ...
};
```

| value | behaviour |
|---|---|
| `'singleton'` | Default. One mounted instance per workspace. |
| `'spawnable'` | Shell can mint fresh instances on demand. Each starts with default state. |
| `'duplicable'` | Shell can clone an existing instance's state. Also implies spawn support. |

`multiInstance` is omitted or `'singleton'` for most apps. Opt in only when the app genuinely supports parallel sessions.

## State scoping is automatic

`usePersistentState` checks `InstanceContext` on every call. When an `InstanceProvider` is present, it rewrites the storage key:

```
inst:${instanceId}:${key}
```

Two terminal instances using `usePersistentState('buffer', '')` each get their own localStorage entry with no extra work.

**Escape hatch.** Keys that already start with `inst:` or `hudson.ws.` are left unchanged. Shell-owned workspace-wide state won't get double-scoped when a hook is called from inside an app Provider.

## useInstance / useOptionalInstance

Use these when you need the raw identifiers — for example, to namespace your own caches or label UI by instance.

```ts
import { useInstance, useOptionalInstance } from 'hudsonkit';

// Throws if called outside an InstanceProvider
const { instanceId, appId } = useInstance();

// Returns null if called outside an InstanceProvider
const instance = useOptionalInstance(); // InstanceContextValue | null
```

Both return `{ instanceId: string; appId: string }` when inside a provider. Prefer `useOptionalInstance` in library hooks that need to degrade gracefully; prefer `useInstance` in app code where a missing provider is a bug.

## Within AppShell

`AppShell` wraps your app in an `InstanceProvider` before mounting `Provider`:

```tsx
<InstanceProvider instanceId={app.id} appId={app.id}>
  <app.Provider>
    <AppShellInner app={app} />
  </app.Provider>
</InstanceProvider>
```

Nothing to wire. `instanceId` equals `app.id` for the lifetime of the shell. `AppShell` is single-instance — spawning multiple instances of the same app is a `WorkspaceShell` capability.

## Within WorkspaceShell

`WorkspaceShell` mounts each live app under its own `InstanceProvider` with a workspace-assigned `instanceId`. The shell surfaces gestures based on `multiInstance`:

- `'spawnable'` — a **New** gesture appears for the app
- `'duplicable'` — both **New** and **Duplicate** gestures appear

See [Architecture](./architecture.md) for how the workspace tracks live instances and persists their bounds, focus, and z-order.
