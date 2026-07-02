# Building Apps

A Hudson app is a plain TypeScript object satisfying the `HudsonApp` interface. The shell reads the object and renders chrome around it. This guide covers the whole contract with concrete examples.

## The interface

```ts
import type { HudsonApp } from 'hudsonkit';
```

### Required

```ts
interface HudsonApp {
  id: string;                       // unique identifier + localStorage namespace
  name: string;                     // display name (app switcher, window title)
  mode: 'canvas' | 'panel';         // default frame mode

  Provider: React.FC<{ children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }>;

  slots: {
    Content: React.FC;              // main area — the only required slot
    // (all others optional)
  };

  hooks: {
    useCommands: () => CommandOption[];                      // Cmd+K palette
    useStatus: () => { label: string; color: StatusColor };  // status bar indicator
    // (all others optional)
  };
}
```

### Optional panel configuration

```ts
{
  description?: string;                       // tooltip / palette description
  leftPanel?: {
    title: string;
    icon?: ReactNode;
    headerActions?: React.FC;                 // rendered in the panel header
  };
  rightPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };
}
```

### Optional slots

```ts
slots: {
  Content: React.FC;              // required
  LeftPanel?: React.FC;           // fills the left side panel
  Inspector?: React.FC;           // fills the right side panel (preferred over RightPanel)
  RightPanel?: React.FC;          // @deprecated — use Inspector + tools
  LeftFooter?: React.FC;          // sits above the Cmd+K dock
  Terminal?: React.FC;            // custom terminal drawer content
  Takeover?: React.FC;            // full-viewport overlay above the shell
}
```

### Optional hooks

```ts
hooks: {
  useCommands: () => CommandOption[];
  useStatus: () => { label: string; color: StatusColor };

  useSearch?: () => SearchConfig;              // nav bar search
  useNavCenter?: () => ReactNode | null;       // breadcrumb / context label
  useNavActions?: () => ReactNode | null;      // nav bar right-side actions
  useLayoutMode?: () => 'canvas' | 'panel' | 'focus';  // override mode at runtime
  useActiveToolHint?: () => string | null;     // highlights a tool in Inspector

  usePortOutput?: () => (portId: string) => unknown | null;
  usePortInput?: () => (portId: string, data: unknown) => void;
  useTakeover?: () => TakeoverState | null;    // gate a full-viewport overlay
}
```

### Optional advanced fields

```ts
{
  multiInstance?: 'singleton' | 'spawnable' | 'duplicable'; // how many live copies allowed (default: 'singleton')
  tools?: AppTool[];                // tool panels in the right sidebar accordion
  intents?: AppIntent[];            // static declarations for LLM/voice/search
  manifest?: AppManifest;           // serializable capability snapshot
  settings?: AppSettingsConfig;     // app-level settings schema (see settings.md)
  ports?: AppPorts;                 // input/output ports for inter-app data piping
  services?: ServiceDependency[];   // external process deps (via the hx registry)
}
```

See [Systems](./systems.md) for intents, ports, and services. See [Multi-instance](./multi-instance.md) for `multiInstance`. See [Settings](./settings.md) for `settings`.

## Directory layout

A typical app lives under `apps/web/app/apps/<app-name>/`:

```
apps/web/app/apps/my-app/
  index.ts                 # HudsonApp export
  MyAppProvider.tsx        # React context + state
  MyAppContent.tsx         # Content slot
  MyAppLeftPanel.tsx       # (optional) LeftPanel slot
  MyAppInspector.tsx       # (optional) Inspector slot
  hooks.ts                 # useCommands, useStatus, etc.
  intents.ts               # (optional) static intent declarations
  ports.ts                 # (optional) port hooks
```

## Walkthrough: a counter app

### 1. Provider

Owns state and exposes it via context:

```tsx
// MyAppProvider.tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePersistentState } from 'hudsonkit';

interface CounterValue {
  count: number;
  increment: () => void;
  reset: () => void;
}

const CounterContext = createContext<CounterValue | null>(null);

export function useCounter() {
  const ctx = useContext(CounterContext);
  if (!ctx) throw new Error('useCounter must be inside CounterProvider');
  return ctx;
}

export function CounterProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = usePersistentState('counter.count', 0);
  const value: CounterValue = {
    count,
    increment: () => setCount(c => c + 1),
    reset: () => setCount(0),
  };
  return <CounterContext.Provider value={value}>{children}</CounterContext.Provider>;
}
```

`usePersistentState` is SSR-safe and cross-tab-synced — use it for anything you want to survive a refresh.

### 2. Content slot

```tsx
// MyAppContent.tsx
'use client';
import { useCounter } from './MyAppProvider';

export function MyAppContent() {
  const { count, increment } = useCounter();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-[72px] font-mono tabular-nums text-white/80">{count}</div>
      <button
        onClick={increment}
        className="px-4 py-2 rounded-sm bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/20"
      >
        Increment
      </button>
    </div>
  );
}
```

### 3. Hooks

```ts
// hooks.ts
'use client';
import { useMemo } from 'react';
import type { CommandOption, StatusColor } from 'hudsonkit';
import { useCounter } from './MyAppProvider';

export function useCounterCommands(): CommandOption[] {
  const { increment, reset } = useCounter();
  return useMemo(() => [
    { id: 'counter:increment', label: 'Increment', action: increment, shortcut: 'Cmd+I' },
    { id: 'counter:reset', label: 'Reset', action: reset },
  ], [increment, reset]);
}

export function useCounterStatus(): { label: string; color: StatusColor } {
  const { count } = useCounter();
  return { label: `count: ${count}`, color: count > 0 ? 'emerald' : 'neutral' };
}
```

### 4. Compose the `HudsonApp`

```ts
// index.ts
import { createElement } from 'react';
import { Hash } from 'lucide-react';
import type { HudsonApp } from 'hudsonkit';
import { CounterProvider } from './MyAppProvider';
import { MyAppContent } from './MyAppContent';
import { useCounterCommands, useCounterStatus } from './hooks';

export const counterApp: HudsonApp = {
  id: 'counter',
  name: 'Counter',
  description: 'A minimal example app',
  mode: 'panel',
  leftPanel: { title: 'Counter', icon: createElement(Hash, { size: 12 }) },
  Provider: CounterProvider,
  slots: { Content: MyAppContent },
  hooks: {
    useCommands: useCounterCommands,
    useStatus: useCounterStatus,
  },
};
```

## Provider lifecycle props

The shell passes three optional booleans into every `Provider`:

```ts
Provider: React.FC<{ children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }>
```

- **`disabled`** — the app is mounted but not participating in the workspace. Pause all background work.
- **`visible`** — the app is on screen. Pause expensive work when `false`.
- **`focused`** — the app is the active target for shell interactions. Reserve high-frequency polling or subscriptions for when this is `true`.

**Important:** `AppShell` (single-app shell) only passes `children` to the Provider — it does not thread `disabled`, `visible`, or `focused`. These props are exercised inside `WorkspaceShell`, where multiple apps share screen real estate and exactly one is focused at a time. If you're building for `AppShell` only you can ignore them for now, but writing defensive code costs nothing.

Pattern inside `CounterProvider`:

```tsx
export function CounterProvider({
  children,
  focused = true,
}: {
  children: ReactNode;
  disabled?: boolean;
  visible?: boolean;
  focused?: boolean;
}) {
  const [count, setCount] = usePersistentState('counter.count', 0);

  // Only run the auto-increment ticker when the app is focused.
  useEffect(() => {
    if (!focused) return;
    const id = setInterval(() => setCount(c => c + 1), 5000);
    return () => clearInterval(id);
  }, [focused, setCount]);

  const value = useMemo(
    () => ({ count, increment: () => setCount(c => c + 1), reset: () => setCount(0) }),
    [count, setCount],
  );

  return <CounterContext.Provider value={value}>{children}</CounterContext.Provider>;
}
```

Drop `disabled` and `visible` into the signature the same way if your Provider does network fetching or animation loops that should pause when the app is hidden.

---

## Tools (Inspector accordion)

Declare `tools` on the `HudsonApp` object to add collapsible panels to the right sidebar accordion. Each entry satisfies `AppTool`:

```ts
interface AppTool {
  id: string;
  name: string;
  icon: ReactNode;
  Component: React.FC;
}
```

Tools render below the `Inspector` slot (or the deprecated `RightPanel` slot if `Inspector` is absent). The user opens and closes them independently; the shell persists nothing — open state resets on remount.

Example — a **Layers** tool that reads from the counter context:

```tsx
// tools.tsx
'use client';
import { createElement } from 'react';
import { Layers } from 'lucide-react';
import type { AppTool } from 'hudsonkit';
import { useCounter } from './MyAppProvider';

function LayersTool() {
  const { count } = useCounter();
  return (
    <div className="text-xs font-mono text-muted-foreground space-y-1">
      <div className="flex justify-between">
        <span>count</span>
        <span className="text-foreground">{count}</span>
      </div>
    </div>
  );
}

export const counterTools: AppTool[] = [
  {
    id: 'counter:layers',
    name: 'Layers',
    icon: createElement(Layers, { size: 12 }),
    Component: LayersTool,
  },
];
```

Add to the app object:

```ts
import { counterTools } from './tools';

export const counterApp: HudsonApp = {
  // ...
  tools: counterTools,
};
```

Use `useActiveToolHint` to highlight a specific tool programmatically — return the tool's `id` from the hook and the shell applies an accent style to its header button.

---

## Takeover slot

`slots.Takeover` is a full-viewport component rendered above all chrome. It activates when `hooks.useTakeover` returns `{ active: true }`. While active, the shell marks the rest of the UI `inert` and `aria-hidden` — pointer events and keyboard focus cannot reach chrome. The overlay is wrapped in a `role="dialog" aria-modal="true"` container; the shell moves focus into it automatically.

`TakeoverState` shape:

```ts
interface TakeoverState {
  active: boolean;
  dismissible: boolean;   // shell renders a close affordance + handles Escape
  onDismiss?: () => void; // called by the shell's Escape / close button
}
```

When `dismissible` is `true`, pressing Escape calls `onDismiss`. The hook owns the state; the shell is stateless about dismissal — flipping `active` to `false` in `onDismiss` is what clears the overlay.

Typical pattern — first-run setup:

```tsx
// MyAppProvider.tsx
interface CounterValue {
  count: number;
  increment: () => void;
  reset: () => void;
  setupDone: boolean;
  completeSetup: () => void;
}

export function CounterProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = usePersistentState('counter.count', 0);
  const [setupDone, setSetupDone] = usePersistentState('counter.setup', false);

  const value = useMemo(() => ({
    count,
    increment: () => setCount(c => c + 1),
    reset: () => setCount(0),
    setupDone,
    completeSetup: () => setSetupDone(true),
  }), [count, setCount, setupDone, setSetupDone]);

  return <CounterContext.Provider value={value}>{children}</CounterContext.Provider>;
}
```

```ts
// hooks.ts
export function useTakeover(): TakeoverState | null {
  const { setupDone, completeSetup } = useCounter();
  if (setupDone) return null;
  return { active: true, dismissible: false, onDismiss: completeSetup };
}
```

```tsx
// CounterSetup.tsx
'use client';
import { useCounter } from './MyAppProvider';

export function CounterSetup() {
  const { completeSetup } = useCounter();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <h1 className="text-2xl font-mono">Welcome to Counter</h1>
      <button
        onClick={completeSetup}
        className="px-6 py-3 rounded bg-accent text-accent-foreground hover:bg-accent/90"
      >
        Get started
      </button>
    </div>
  );
}
```

```ts
// index.ts
import { useTakeover } from './hooks';
import { CounterSetup } from './CounterSetup';

export const counterApp: HudsonApp = {
  // ...
  slots: { Content: MyAppContent, Takeover: CounterSetup },
  hooks: { useCommands: useCounterCommands, useStatus: useCounterStatus, useTakeover },
};
```

---

## Command palette behavior

`useCommands` returns the list of entries that appear in the `Cmd+K` palette. Each `CommandOption`:

```ts
interface CommandOption {
  id: string;           // must be unique across all commands (app + shell)
  label: string;        // display string; palette filters by substring match against this
  action: () => void;   // called when triggered; palette closes immediately after
  shortcut?: string;    // display hint only — NOT a registered key binding
  icon?: ReactNode;     // optional icon in the palette row
}
```

The shell merges your app's commands with its own built-in shell commands (toggle panels, toggle terminal, theme switching, etc.) before passing the combined list to the palette. Duplicate `id` values from your app will not shadow shell commands — keep IDs namespaced: `'counter:increment'`, not `'increment'`.

**Shortcuts are display hints.** The `shortcut` string is rendered in the palette row as a visual cue. It does not register a global key listener. To make `Cmd+I` actually trigger `increment`, wire it yourself inside the Provider:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      increment();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [increment]);
```

Palette interaction flow: the user types → substring filter against `label` → `ArrowUp`/`ArrowDown` to navigate → `Enter` or click calls `action()` and closes. Memoize the array returned from `useCommands` — the shell calls the hook on every render.

## Registering the app

### Inside Hudson (default workspaces)

Register committed apps in `apps/web/app/apps/registry.ts`. That file has three moving parts:

1. Import the app near the other in-tree apps.
2. Add it to the `getAppById()` lookup table so JSON/local workspace entries can resolve the app by id.
3. Add a `WorkspaceAppConfig` entry to one of the core workspace getters (`getCoreApps()`, `getDeveloperModeApps()`, `getDocumentLabWorkspace()`, etc.), or create a new `HudsonWorkspace` getter and include it in `getCoreWorkspaces()`.

```ts
import { counterApp } from './counter';

function getAppById(id: string): HudsonApp | null {
  const table: Record<string, HudsonApp> = {
    // ...existing apps
    'counter': counterApp,
  };
  return table[id] ?? null;
}

function getCoreApps(): WorkspaceAppConfig[] {
  return [
    // ...existing apps
    {
      app: counterApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 120, y: 120, w: 420, h: 320 },
    },
  ];
}
```

Committed apps appear where their workspace getter includes them. `allWorkspaces` combines those core workspaces with dev-only local workspace sources.

### Inside Hudson (dev-local only)

For apps you don't want to commit, add to `apps/web/app/local/apps.local.ts` (gitignored; auto-created by `apps/web/next.config.ts`):

```ts
import type { HudsonWorkspace, WorkspaceAppConfig } from 'hudsonkit';
import { counterApp } from '../apps/counter';

export const localApps: WorkspaceAppConfig[] = [
  { app: counterApp, canvasMode: 'windowed' },
];
export const localWorkspaces: HudsonWorkspace[] = [];
```

### Outside Hudson (consumer app via `AppShell`)

A fresh Next.js 16 + React 19 + Tailwind v4 app can consume the SDK and render a single app:

```tsx
// app/page.tsx
'use client';
import { AppShell } from 'hudsonkit/app-shell';
import { counterApp } from '@/counter';

export default function Page() {
  return <AppShell app={counterApp} />;
}
```

```css
/* app/globals.css */
@import "tailwindcss";
@import "hudsonkit/styles";
```

## Rules of thumb

- **Always `'use client'`** on every file that imports from `hudsonkit` or uses hooks — the SDK components are client-side only, and the RSC boundary must be explicit.
- **Provider goes first.** Slots and hooks read state from the Provider's context. The shell wraps everything in the Provider once; you never wrap it manually.
- **`usePersistentState` over raw `useState`** for anything you want surviving a refresh (note selection, filter state, panel sizes, etc.).
- **URL state is free.** If your app has filters, selected items, or views worth deep-linking, store state in query params via `useSearchParams` + `router.replace`. The Provider reads from the URL; browser back/forward just works.
- **Keep hooks cheap.** The shell calls them on every render. Memoize command arrays, avoid building large objects on the fly.
- **`useMemo` the context value.** Without it, every Provider render creates a new value reference and downstream consumers re-render for nothing.

## Further reading

- [Systems](./systems.md) — Intents, Services, Ports
- [Perf patterns](./perf-drag-resize-patterns.md) — drag/resize/pan optimizations used by the shell
- [API reference](./api.md) — every `hudsonkit` export with a short description
