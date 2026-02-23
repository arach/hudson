---
title: Quickstart
description: Get Hudson running locally in under 5 minutes
order: 2
---

# Quickstart

Get Hudson running locally and create your first app.

## Prerequisites

- [Node.js](https://nodejs.org) >= 18
- [bun](https://bun.sh) (package manager and runtime)
- git

## Setup

```bash
# Clone the repository
git clone https://github.com/arach/hudson.git
cd hudson

# Install dependencies
bun install

# Start the dev server (port 3500)
bun dev
```

Open [http://localhost:3500](http://localhost:3500). You should see the Hudson workspace with the boot animation, then the canvas with existing apps.

## Project Structure

```
hudson/
  app/
    page.tsx                  # Entry point — mounts WorkspaceShell
    shell/                    # Shell components (WorkspaceShell, HomeScreen, BootSplash)
    apps/                     # App implementations
      shaper/                 # Reference app — bezier curve editor
      hudson-docs/            # Docs browser
      intent-explorer/        # Intent catalog inspector
    workspaces/               # Workspace definitions
      hudsonOS.ts             # Multi-app canvas workspace
      shaperDev.ts            # Single-app panel workspace
      index.ts                # Exports
    lib/                      # Shared utilities (intent catalog, etc.)
    hooks/                    # Shared hooks (intent executor, etc.)
  packages/
    frame-ui/                 # Component library + types
      src/
        components/           # Chrome, Canvas, Windows, Overlays
        types/                # HudsonApp, HudsonWorkspace, AppIntent
        hooks/                # usePersistentState
        lib/                  # sounds, logger, viewport, chrome tokens
```

## Create Your First App

The fastest way to add an app is to scaffold it in `app/apps/`:

### 1. Create the app directory

```bash
mkdir -p app/apps/my-app
```

### 2. Create the Provider

```tsx
// app/apps/my-app/MyAppProvider.tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface MyAppState {
  count: number;
  increment: () => void;
}

const Ctx = createContext<MyAppState | null>(null);
export const useMyApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMyApp must be inside MyAppProvider');
  return ctx;
};

export function MyAppProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  return (
    <Ctx.Provider value={{ count, increment: () => setCount(c => c + 1) }}>
      {children}
    </Ctx.Provider>
  );
}
```

### 3. Create the Content slot

```tsx
// app/apps/my-app/MyAppContent.tsx
'use client';

import { useMyApp } from './MyAppProvider';

export function MyAppContent() {
  const { count, increment } = useMyApp();
  return (
    <div className="flex items-center justify-center h-full gap-4">
      <span className="text-4xl font-bold text-white">{count}</span>
      <button onClick={increment} className="px-4 py-2 bg-emerald-600 rounded">
        +1
      </button>
    </div>
  );
}
```

### 4. Define the app

```tsx
// app/apps/my-app/index.ts
import type { HudsonApp } from 'frame-ui';
import { MyAppProvider } from './MyAppProvider';
import { MyAppContent } from './MyAppContent';

export const myApp: HudsonApp = {
  id: 'my-app',
  name: 'My App',
  description: 'A minimal counter app',
  mode: 'panel',

  Provider: MyAppProvider,
  slots: { Content: MyAppContent },

  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: 'OK', color: 'emerald' }),
  },
};
```

### 5. Register in a workspace

```tsx
// app/workspaces/hudsonOS.ts — add to apps array
import { myApp } from '../apps/my-app';

// Inside the apps array:
{
  app: myApp,
  canvasMode: 'windowed',
  defaultWindowBounds: { x: 0, y: 0, w: 400, h: 300 },
}
```

Save, and your app appears as a draggable window on the canvas. See [Building Apps](./building-apps.md) for the full guide.
