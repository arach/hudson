---
title: Getting Started
description: Install the SDK, create a minimal app, and register it in a workspace.
section: npm
subsection: "@hudsonos/sdk"
order: 1
---

# Getting Started

Build apps for the Hudson workspace platform using `@hudsonos/sdk`. This guide walks you through installation, creating a minimal app, and registering it in a workspace.

## Installation

```bash
bun add @hudsonos/sdk
```

### Peer Dependencies

The SDK requires React 19 and Lucide React for icons:

```bash
bun add react react-dom lucide-react
```

Your project should also use Tailwind CSS v4. See [Utilities](./utilities.md#tailwind-css-v4-setup) for Tailwind configuration.

## Your First App

Every Hudson app implements the `HudsonApp` interface. At minimum, you need an `id`, `name`, `mode`, a `Provider`, `slots.Content`, and two hooks.

```tsx
import type { HudsonApp, CommandOption, StatusColor } from '@hudsonos/sdk';

const counterApp: HudsonApp = {
  id: 'counter',
  name: 'Counter',
  description: 'A simple click counter',
  mode: 'panel',

  Provider: ({ children }) => <>{children}</>,

  slots: {
    Content: () => (
      <div className="flex items-center justify-center h-full">
        <button className="px-4 py-2 bg-cyan-600 rounded text-white">
          Click me
        </button>
      </div>
    ),
  },

  hooks: {
    useCommands: (): CommandOption[] => [],
    useStatus: (): { label: string; color: StatusColor } => ({
      label: 'READY',
      color: 'emerald',
    }),
  },
};

export default counterApp;
```

### What Each Field Does

| Field | Purpose |
|-------|---------|
| `id` | Unique key used for localStorage namespacing and workspace routing |
| `name` | Human-readable label shown in the app switcher and navigation bar |
| `description` | Short summary shown in tooltips and the command palette |
| `mode` | `'canvas'` enables infinite pan/zoom; `'panel'` renders scrollable content |
| `Provider` | React component that wraps all slots and provides app state via context |
| `slots.Content` | The main content area of your app |
| `hooks.useCommands` | Returns commands for the command palette (Cmd+K) |
| `hooks.useStatus` | Returns the status bar label and color indicator |

## Adding State with a Provider

Real apps need state. The standard pattern wraps state in a React context and exposes it through a custom hook.

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePersistentState } from '@hudsonos/sdk';

interface CounterState {
  count: number;
  increment: () => void;
  reset: () => void;
}

const CounterContext = createContext<CounterState | null>(null);

function useCounter(): CounterState {
  const ctx = useContext(CounterContext);
  if (!ctx) throw new Error('useCounter must be used within CounterProvider');
  return ctx;
}

function CounterProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = usePersistentState('counter.count', 0);

  const increment = () => setCount((c) => c + 1);
  const reset = () => setCount(0);

  return (
    <CounterContext.Provider value={{ count, increment, reset }}>
      {children}
    </CounterContext.Provider>
  );
}
```

Then wire the Provider and hooks into the app definition:

```tsx
import type { HudsonApp, CommandOption } from '@hudsonos/sdk';
import { sounds } from '@hudsonos/sdk';

const counterApp: HudsonApp = {
  id: 'counter',
  name: 'Counter',
  mode: 'panel',

  Provider: CounterProvider,

  slots: {
    Content: () => {
      const { count, increment } = useCounter();
      return (
        <div className="flex items-center justify-center h-full gap-4">
          <span className="text-4xl font-mono text-neutral-200">{count}</span>
          <button
            onClick={() => { increment(); sounds.tick(); }}
            className="px-4 py-2 bg-cyan-600 rounded text-white"
          >
            +1
          </button>
        </div>
      );
    },
  },

  hooks: {
    useCommands: (): CommandOption[] => {
      const { increment, reset } = useCounter();
      return [
        { id: 'counter:increment', label: 'Increment', action: increment },
        { id: 'counter:reset', label: 'Reset Counter', action: reset },
      ];
    },
    useStatus: () => {
      const { count } = useCounter();
      return { label: `COUNT: ${count}`, color: 'emerald' };
    },
  },
};
```

## Registering in a Workspace

A workspace groups one or more apps into a shared shell. Create a workspace definition and include your app:

```tsx
import type { HudsonWorkspace } from '@hudsonos/sdk';
import counterApp from './apps/counter';

export const myWorkspace: HudsonWorkspace = {
  id: 'my-workspace',
  name: 'My Workspace',
  mode: 'panel',
  apps: [
    { app: counterApp },
  ],
  defaultFocusedAppId: 'counter',
};
```

### Multi-App Workspaces

Add multiple apps to the same workspace. Each app runs in its own Provider context, but they share the shell chrome (navigation bar, status bar, side panels).

```tsx
export const designWorkspace: HudsonWorkspace = {
  id: 'design',
  name: 'Design Studio',
  mode: 'canvas',
  apps: [
    { app: shaperApp },
    {
      app: logoApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: 100, y: 100, w: 600, h: 400 },
    },
  ],
  defaultFocusedAppId: 'shaper',
};
```

The `canvasMode` field controls how an app participates in a canvas workspace:

| Value | Behavior |
|-------|----------|
| `'native'` (default) | App renders directly on the canvas |
| `'windowed'` | App renders inside a draggable/resizable window |

## Project Structure

A typical Hudson app follows this directory layout:

```
app/apps/my-app/
  index.ts           # HudsonApp definition (entry point)
  MyAppProvider.tsx   # React context provider with all state
  MyAppContent.tsx    # Content slot
  MyAppLeftPanel.tsx  # Left panel slot (optional)
  MyAppInspector.tsx  # Inspector slot (optional)
  hooks.ts           # Hook implementations (useCommands, useStatus, etc.)
  intents.ts         # Intent declarations (optional)
  ports.ts           # Port hooks (optional)
  types.ts           # App-specific types
  components/        # Internal components
```

## Next Steps

- [Building Apps](./building-apps.md) -- deep dive into the Provider + Slots + Hooks pattern
- [API Reference](./api-reference.md) -- complete type, hook, and function reference
- [Systems](./systems.md) -- intents, services, and inter-app data piping
- [Utilities](./utilities.md) -- platform adapters, design tokens, and UI sounds
