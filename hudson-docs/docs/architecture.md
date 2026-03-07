---
title: Architecture
description: Hudson project structure and architectural decisions
order: 3
---

# Architecture

Hudson is a monorepo with two main packages: the **shell application** (Next.js) and the **frame-ui component library**.

## Monorepo Structure

```
hudson/
  app/                          # Next.js application (App Router)
    page.tsx                    # Entry: mounts WorkspaceShell
    layout.tsx                  # Root layout
    globals.css                 # Tailwind + global styles
    shell/                      # Shell runtime
      WorkspaceShell.tsx        # Main orchestrator (~40KB)
      HomeScreen.tsx            # App launcher grid
      BootSplash.tsx            # Boot animation
      SidebarSection.tsx        # Reusable sidebar section
    apps/                       # App implementations
      shaper/                   # Bezier editor (reference app)
        index.ts                # HudsonApp definition
        ShaperProvider.tsx      # Context (~64KB, full state)
        ShaperContent.tsx       # Canvas renderer
        ShaperLeftPanel.tsx     # Project tree
        ShaperRightPanel.tsx    # Inspector
        ShaperLeftFooter.tsx    # Minimap
        ShaperTerminal.tsx      # Log output
        ShaperHeaderActions.tsx # Panel header buttons
        hooks.ts                # 6 hook implementations
        intents.ts              # 25+ intent declarations
        components/             # Private components
      hudson-docs/              # Docs browser (canvas native)
      intent-explorer/          # Intent catalog viewer
    workspaces/                 # Workspace definitions
      hudsonOS.ts               # Multi-app canvas workspace
      shaperDev.ts              # Shaper standalone workspace
      index.ts                  # Re-exports
    lib/                        # Shared utilities
      intent-catalog.ts         # buildIntentCatalog()
    hooks/                      # Shared hooks
      useIntentExecutor.ts      # Intent → command bridge
    api/                        # API routes
      shaper/save/route.ts      # Shaper save endpoint
  packages/
    frame-ui/                   # Component library
      src/
        index.ts                # Public exports
        components/
          chrome/               # Frame, NavBar, SidePanel, StatusBar, CommandDock, ZoomControls, Minimap
          canvas/               # Canvas (pan/zoom engine)
          windows/              # AppWindow (draggable/resizable)
          overlays/             # CommandPalette, TerminalDrawer, ContextMenu
        types/
          app.ts                # HudsonApp interface
          workspace.ts          # HudsonWorkspace interface
          intent.ts             # AppIntent, IntentCatalog
        hooks/
          usePersistentState.ts # localStorage-backed state
        lib/
          chrome.ts             # Design tokens (CHROME, Z_LAYERS, LAYOUT)
          sounds.ts             # Web Audio synthesizer
          logger.ts             # Event bus
          viewport.ts           # Coordinate math (worldToScreen, screenToWorld)
      README.md
      package.json
```

## Data Flow

```
page.tsx
  └── WorkspaceShell(workspaces, defaultWorkspaceId)
        │
        ├── Nests all app Providers (recursive wrapping)
        │     AppA.Provider → AppB.Provider → ... → WorkspaceInner
        │
        └── WorkspaceInner
              ├── Calls each app's hooks (useCommands, useStatus, etc.)
              ├── Merges commands from all apps + shell into CommandPalette
              ├── Renders Frame with chrome (NavBar, SidePanel, StatusBar)
              ├── Renders active app's slots into chrome slots
              │     ├── slots.Content → main area (canvas world or viewport)
              │     ├── slots.LeftPanel → left SidePanel
              │     ├── slots.RightPanel → right SidePanel
              │     └── slots.Terminal → TerminalDrawer
              └── In canvas mode: wraps windowed apps in AppWindow
```

## Key Architectural Decisions

### Provider-first state management

Each app owns its state via a React context Provider. The shell never accesses app state directly — it only reads through hooks. This keeps apps fully decoupled.

### Hook bridge pattern

The shell calls app hooks inside the Provider's scope. This means hooks can call `useMyAppContext()` safely. The shell doesn't import app internals — it only calls the hook functions declared in the `HudsonApp` object.

### Ref-based window tracking

Window positions are tracked in a `useRef` (not state) during drag operations to avoid re-renders on every mouse move. Positions are flushed to state via a 60ms debounce for minimap rendering.

### Static intent declarations

Intents are declared as plain data (not runtime code) so they can be indexed, serialized, and searched without executing app logic. The execution bridge connects them to live commands at runtime.

### Recursive Provider nesting

All app Providers wrap the entire workspace content. This enables cross-app context sharing if needed, while keeping the default pattern of isolated state per app.

## State Persistence

All persistent state uses `usePersistentState()` backed by localStorage:

| Key Pattern | Data |
|-------------|------|
| `hudson.ws.{workspaceId}.win.{appId}` | Window bounds |
| `hudson.leftW` | Left panel width |
| `hudson.rightW` | Right panel width |
| `hudson.session` | Active session |
| `{appId}.{key}` | App-specific state |

## Build & Dev

| Command | Purpose |
|---------|---------|
| `bun install` | Install all dependencies |
| `bun dev` | Start dev server (port 3500) |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
