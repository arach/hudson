# Architecture

Hudson is a monorepo with two main packages: the **Hudson workspace** (the Next.js app that actually runs — `app/`) and **`@hudson/sdk`** (the shell + primitives library — `packages/hudson-sdk/`).

## Monorepo layout

```
hudson/
  app/                              # Next.js 16 app (App Router)
    app/page.tsx                    # Mounts <WorkspaceShell>
    layout.tsx                      # Root HTML + globals.css
    globals.css                     # Tailwind v4 + scrollbar styles
    shell/
      WorkspaceShell.tsx            # Multi-app orchestrator (the main shell)
      HomeScreen.tsx                # App launcher grid
      BootSplash.tsx                # Boot animation
      workspace-manager/            # Runtime workspace editor
    apps/                           # App implementations
      registry.ts                   # Aggregates built-in + local apps
      shaper/                       # Reference app (bezier editor)
      hudson-docs/
      intent-explorer/
      logo-designer/
      trace-viewer/
      openscout/
      notepad/
      json-explorer/
      api-inspector/
      assets/
    workspaces/
      hudsonOS.ts                   # Default workspace composition
      index.ts                      # Re-exports
    local/
      apps.local.ts                 # Gitignored — dev-local app registrations
      workspaces.json
    lib/                            # Shared utilities
    hooks/                          # Shared hooks
    services/                       # Service registry (hx, etc.)
    api/                            # Next.js API routes (AI, saves, etc.)

  packages/
    hudson-sdk/                     # The SDK (workspace-internal for now)
      src/
        index.ts                    # Public main entry — types, hooks, AI, platform
        app-shell.ts                # `@hudson/sdk/app-shell` subpath
        chrome.ts                   # `@hudson/sdk/chrome`
        overlays.ts                 # `@hudson/sdk/overlays`
        context-menu.ts             # `@hudson/sdk/context-menu`
        canvas.ts                   # `@hudson/sdk/canvas`
        windows.ts                  # `@hudson/sdk/windows`
        theme.ts                    # `@hudson/sdk/theme`
        shell.ts                    # `@hudson/sdk/shell` (back-compat barrel)
        styles/bundle.css           # Source for the compiled CSS bundle
        dist/styles.css             # Compiled via `bun run build:css`
        components/
          AppShell.tsx              # Single-app shell (default)
          chrome/                   # Frame, NavigationBar, SidePanel, StatusBar, CommandDock, Minimap, ZoomControls, AnimationTimeline
          canvas/Canvas.tsx
          windows/AppWindow.tsx
          overlays/                 # CommandPalette, TerminalDrawer, HudsonContextMenu
          AI.tsx, TerminalRelay.tsx
        types/
          app.ts                    # HudsonApp interface
          workspace.ts              # HudsonWorkspace interface
          intent.ts, port.ts, service.ts
        hooks/                      # usePersistentState, useAppSettings, useHudsonAI, useTerminalRelay
        platform/                   # Platform adapter (web, desktop)
        lib/                        # theme, sounds, logger, viewport, manifest

  native/                           # Desktop shell experiments
  docs/                             # Architecture, case study, builder notes
```

## Data flow (WorkspaceShell)

```
app/app/page.tsx
  └── <WorkspaceShell workspaces={allWorkspaces} defaultWorkspaceId="hudsonOS" />
        │
        ├── Nests every app's Provider recursively
        │     AppA.Provider → AppB.Provider → ... → WorkspaceShellInner
        │
        └── WorkspaceShellInner
              ├── Calls each app's hooks (useCommands, useStatus, useSearch, ...)
              ├── Merges commands from all apps + shell commands → CommandPalette
              ├── Renders Frame with chrome (NavigationBar, SidePanel, StatusBar, CommandDock)
              ├── Canvas mode: wraps windowed apps in AppWindow, renders native apps directly on canvas
              ├── Panel mode: single focused app fills the viewport inset
              └── Merges app intents → IntentCatalog (for LLM/voice/search)
```

## Data flow (AppShell)

```
app/page.tsx (consumer — e.g. premotion)
  └── <AppShell app={catalogApp} />
        │
        └── app.Provider wraps everything
              └── AppShellInner reads app.hooks, fills slots
                    ├── NavigationBar (title + search + nav center + nav actions)
                    ├── SidePanel left (app.slots.LeftPanel + LeftFooter + CommandDock)
                    ├── SidePanel right (app.slots.Inspector | RightPanel + tools accordion)
                    ├── Content area (app.slots.Content)
                    ├── StatusBar (app.hooks.useStatus + terminal toggle + clock)
                    ├── TerminalDrawer (app.slots.Terminal or placeholder)
                    └── CommandPalette (fed by useCommands + shell shortcuts)
```

## Key architectural decisions

### Provider-first state

Each app owns its state via a React context Provider. The shell never touches app internals — it only reads through the app's declared hooks. Apps stay fully decoupled.

### Hook Bridge pattern

The shell calls an app's hooks *inside* that app's Provider scope via a small internal Bridge component. This means hooks can call `useMyAppContext()` safely. The shell doesn't import app modules — it only calls the hook functions registered in the `HudsonApp` object.

### Refs, not state, during drag/pan/resize

Window bounds, pan/zoom offsets, and resize deltas are tracked in `useRef` during interaction — React re-renders are suppressed. State gets flushed on a debounce (`BOUNDS_FLUSH_MS = 500` in `WorkspaceShell.tsx`) so the minimap and persistence observe stable values without dragging the whole tree on every mouse move.

See [`perf-drag-resize-patterns.md`](./perf-drag-resize-patterns.md) for the full set of tricks.

### Static intent declarations

Intents are declared as plain data (not runtime functions) so they can be indexed, serialized, and searched without executing app logic. An intent executor bridges discovered intents back to the app's live commands at runtime.

### Recursive Provider nesting

All app Providers wrap the entire workspace content. This enables cross-app context sharing when needed; isolated state is the default.

### Registry-driven app loading

Built-in apps are enumerated in [`app/apps/registry.ts`](../app/apps/registry.ts). Developer-local apps are loaded from gitignored `app/local/apps.local.ts` (auto-created as an empty stub by `next.config.ts` on first run). This lets the main repo ship a stable default workspace while individual devs add private apps without touching shared files.

## State persistence

All persistent UI state uses `usePersistentState()` backed by localStorage:

| Key pattern                              | Purpose                                           |
|------------------------------------------|---------------------------------------------------|
| `hudson.ws.{workspaceId}.win.{appId}`    | Window bounds (canvas mode)                       |
| `hudson.ws.{workspaceId}.mode`           | Current workspace mode                            |
| `hudson.session`                         | Active session / focused app                      |
| `appshell.{appId}.left` / `.right`       | Side panel collapsed state (AppShell)             |
| `appshell.{appId}.leftW` / `.rightW`     | Side panel widths (AppShell)                      |
| `{appId}.{key}`                          | App-specific state (owned by app Provider)        |

App code should prefer the `{appId}.{key}` namespace and use `usePersistentState('myapp.notes', [])` — the hook handles serialization, SSR safety, and cross-tab sync.

## Build & dev

| Command                                     | Purpose                                   |
|---------------------------------------------|-------------------------------------------|
| `bun install`                               | Install all workspace deps                |
| `bun dev`                                   | Start Hudson dev server on :3500          |
| `bun run build`                             | Production build                          |
| `bun run lint`                              | ESLint                                    |
| `bun run relay`                             | Start the terminal relay WS server        |
| `cd packages/hudson-sdk && bun run build:css` | Rebuild the SDK's compiled CSS bundle   |
