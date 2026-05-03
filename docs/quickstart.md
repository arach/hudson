---
title: Quickstart
description: Mount AppShell with a minimal app in 5 minutes
order: 1
---

# Quickstart

## Install

```bash
# bun
bun add hudsonkit

# npm
npm install hudsonkit
```

`react` and `react-dom` ≥ 19 are peer dependencies — they should already be present in your Next.js 16 project.

## Add the CSS bundle

In `app/globals.css`:

```css
@import "tailwindcss";
@import "hudsonkit/styles";
```

## Define a minimal HudsonApp

Create `app/counter/index.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { HudsonApp, CommandOption } from 'hudsonkit';

// --- context ---
const Ctx = createContext<{ count: number; increment: () => void } | null>(null);
const useCounter = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('outside CounterProvider');
  return ctx;
};

function CounterProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const value = useMemo(() => ({ count, increment: () => setCount(c => c + 1) }), [count]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// --- slots ---
function CounterContent() {
  const { count, increment } = useCounter();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-[72px] font-mono tabular-nums">{count}</div>
      <button
        onClick={increment}
        className="px-4 py-2 rounded border border-border bg-accent/10 hover:bg-accent/20 text-accent"
      >
        Increment
      </button>
    </div>
  );
}

// --- hooks ---
function useCommands(): CommandOption[] {
  const { increment } = useCounter();
  return useMemo(() => [
    { id: 'counter:increment', label: 'Increment', action: increment, shortcut: 'Cmd+I' },
  ], [increment]);
}

function useStatus() {
  const { count } = useCounter();
  return { label: `count: ${count}`, color: 'emerald' as const };
}

// --- app ---
export const counterApp: HudsonApp = {
  id: 'counter',
  name: 'Counter',
  mode: 'panel',
  Provider: CounterProvider,
  slots: { Content: CounterContent },
  hooks: { useCommands, useStatus },
};
```

## Mount AppShell

In `app/page.tsx`:

```tsx
'use client';

import { AppShell } from 'hudsonkit/app-shell';
import { counterApp } from './counter';

export default function Page() {
  return <AppShell app={counterApp} />;
}
```

## Run it

```bash
bun dev
# or: npm run dev
```

Open `http://localhost:3000`. You should see the Hudson chrome: a nav bar with "COUNTER", a status bar showing `count: 0`, and the counter UI in the content area. Press `Cmd+K` to open the command palette and run **Increment**.

## Next steps

- [Building apps](./building-apps.md) — the full `HudsonApp` contract: slots, hooks, panels, tools, takeover
- [API reference](./api.md) — every `hudsonkit` export organized by subpath
- [Theming](./theming.md) — runtime theme/template switching, token surface, custom templates
- [Systems](./systems.md) — Intents, Services, and Ports for LLM/voice integration and inter-app data piping
