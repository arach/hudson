# Building Apps

A Hudson app is a plain TypeScript object satisfying the `HudsonApp` interface. The shell reads the object and renders chrome around it. This guide covers the whole contract with concrete examples.

For a real-world app built against this contract, see [Case study: Premotion](./case-study-premotion.md).

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

  Provider: React.FC<{ children: ReactNode; disabled?: boolean }>;

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
  useLayoutMode?: () => 'canvas' | 'panel';    // override mode at runtime
  useActiveToolHint?: () => string | null;     // highlights a tool in Inspector

  usePortOutput?: () => (portId: string) => unknown | null;
  usePortInput?: () => (portId: string, data: unknown) => void;
}
```

### Optional advanced fields

```ts
{
  tools?: AppTool[];                // tool panels in the right sidebar accordion
  intents?: AppIntent[];            // static declarations for LLM/voice/search
  manifest?: AppManifest;           // serializable capability snapshot
  settings?: AppSettingsConfig;     // app-level settings UI (rendered by shell)
  ports?: AppPorts;                 // input/output ports for inter-app data piping
  services?: ServiceDependency[];   // external process deps (via the hx registry)
}
```

See [Systems](./systems.md) for intents, ports, and services.

## Directory layout

A typical app lives under `app/apps/<app-name>/`:

```
app/apps/my-app/
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

## Registering the app

### Inside Hudson (default workspace)

Add to `app/apps/registry.ts`:

```ts
import { counterApp } from './counter';

export const coreApps = [
  // ...existing apps,
  counterApp,
];
```

Apps in `coreApps` appear in the default workspace automatically.

### Inside Hudson (dev-local only)

For apps you don't want to commit, add to `app/local/apps.local.ts` (gitignored; auto-created by `next.config.ts`):

```ts
import type { WorkspaceAppConfig } from 'hudsonkit';
import { counterApp } from '../apps/counter';

export const localApps: WorkspaceAppConfig[] = [
  { app: counterApp, participation: 'windowed' },
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

The SDK is workspace-internal today, so current consumers install it via a manual symlink and a `turbopack.root` lift. See the [Premotion case study](./case-study-premotion.md) for the full real setup + known gaps.

## Rules of thumb

- **Always `'use client'`** on every file that imports from `hudsonkit` or uses hooks — the SDK components are client-side only, and the RSC boundary must be explicit.
- **Provider goes first.** Slots and hooks read state from the Provider's context. The shell wraps everything in the Provider once; you never wrap it manually.
- **`usePersistentState` over raw `useState`** for anything you want surviving a refresh (note selection, filter state, panel sizes, etc.).
- **URL state is free.** If your app has filters, selected items, or views worth deep-linking, store state in query params via `useSearchParams` + `router.replace`. The Provider reads from the URL; browser back/forward just works. See Premotion's `catalog/Provider.tsx`.
- **Keep hooks cheap.** The shell calls them on every render. Memoize command arrays, avoid building large objects on the fly.
- **`useMemo` the context value.** Without it, every Provider render creates a new value reference and downstream consumers re-render for nothing.

## Further reading

- [Systems](./systems.md) — Intents, Services, Ports
- [Perf patterns](./perf-drag-resize-patterns.md) — drag/resize/pan optimizations used by the shell
- [API reference](./api.md) — every `hudsonkit` export with a short description
- [Case study: Premotion](./case-study-premotion.md) — a complete real app
