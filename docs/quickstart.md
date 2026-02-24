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
    @hudson/sdk/                 # Component library + types
      src/
        components/           # Chrome, Canvas, Windows, Overlays
        types/                # HudsonApp, HudsonWorkspace, AppIntent
        hooks/                # usePersistentState
        lib/                  # sounds, logger, viewport, chrome tokens
```

## Create Your First App

The fastest way to create an app is with the scaffolding CLI:

```bash
bun run packages/create-hudson-app/src/index.ts my-app
```

This prompts for a description, tier, and mode, then generates all the files you need. See [Scaffolding](./scaffolding.md) for the full guide.

For this quickstart, we'll use the **minimal** tier:

```bash
bun run packages/create-hudson-app/src/index.ts my-app \
  --tier minimal --mode panel --description "A counter app"
```

This generates 5 files + a dev workspace:

```
app/apps/my-app/
  index.ts              # HudsonApp declaration
  MyAppProvider.tsx      # React context (owns state)
  MyAppContent.tsx       # Main content slot
  hooks.ts              # useCommands + useStatus
  types.ts              # Type skeleton

app/workspaces/myAppDev.ts   # Dev workspace
```

### Register the workspace

Open `app/page.tsx` and add your workspace:

```tsx
import { myAppDevWorkspace } from './workspaces/myAppDev';

// Add to the workspaces array:
<WorkspaceShell
  workspaces={[hudsonOSWorkspace, shaperDevWorkspace, myAppDevWorkspace]}
  ...
/>
```

### Start building

The scaffolded app renders a centered placeholder. Start editing:

1. **`MyAppProvider.tsx`** — Add your state (e.g. `count`, `increment`)
2. **`MyAppContent.tsx`** — Build your UI using that state
3. **`hooks.ts`** — Wire commands for the palette, update the status label

The `HudsonApp` interface in `@hudson/sdk` enforces the contract — TypeScript will tell you if you're missing a required slot or hook.

Save, run `bun dev`, and your app appears in the workspace switcher. See [Building Apps](./building-apps.md) for the full guide.
