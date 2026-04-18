# Overview

Hudson is a **shell** for building app-like interfaces in the browser. It owns the workspace chrome — nav bar, side panels, command palette, terminal, status bar, canvas pan/zoom — and hosts apps that plug in via a small interface.

Think of it as a desktop environment in a tab: each "app" is a self-contained React feature with its own state and UI, but they all share the same chrome, keyboard shortcuts, search, AI, and persistent-state plumbing.

## Two shell modes

Hudson ships two top-level components. Pick based on whether your product has one purpose or many tools.

### `AppShell` — the default

One `HudsonApp`, full chrome. Best for single-purpose products where the whole surface is about one thing: a catalog browser, a settings dashboard, a reader, a logo designer.

```tsx
import { AppShell } from '@hudson/sdk/app-shell';
import { catalogApp } from './catalog';

<AppShell app={catalogApp} />
```

The shell reads the app's hooks for labels, search, status, and commands; renders the app's Provider once around everything; mounts the app's slot components into the chrome's regions (LeftPanel, Content, Inspector, Terminal).

### `WorkspaceShell` — multi-app canvas

Many `HudsonApp`s sharing a dotted-grid workspace, with windows that float, resize, and minimize. Best for tool-kit surfaces — Hudson itself uses this for its default OS workspace (Shaper + Logo Designer + Notepad + more).

```tsx
import { WorkspaceShell } from '@hudson/sdk/shell';

<WorkspaceShell workspaces={[hudsonOSWorkspace]} defaultWorkspaceId="hudsonOS" />
```

Each workspace declares which apps it hosts and how they participate (windowed, native, maximized, etc.).

## The `HudsonApp` contract

Every app — whether it runs in AppShell or as a window in WorkspaceShell — satisfies the same interface:

```ts
interface HudsonApp {
  id: string;
  name: string;
  mode: 'canvas' | 'panel';

  Provider: React.FC<{ children: ReactNode }>;  // state lives here

  slots: {
    Content: React.FC;       // main area — required
    LeftPanel?: React.FC;    // optional — fills the left side panel
    Inspector?: React.FC;    // optional — fills the right side panel
    Terminal?: React.FC;     // optional — custom terminal drawer content
    LeftFooter?: React.FC;   // optional — sits above the command palette trigger
  };

  hooks: {
    useCommands: () => CommandOption[];                      // feeds Cmd+K palette
    useStatus: () => { label: string; color: StatusColor };  // status bar indicator
    useSearch?: () => SearchConfig;                          // nav bar search input
    useNavCenter?: () => ReactNode | null;                   // breadcrumb / context
    useNavActions?: () => ReactNode | null;                  // nav right-side actions
    useLayoutMode?: () => 'canvas' | 'panel';                // runtime mode override
    useActiveToolHint?: () => string | null;                 // highlights a tool in Inspector
  };
  // + optional: tools, intents, ports, services, settings, manifest
}
```

It's a mechanism, not a framework. The shell doesn't dictate how state works, doesn't wrap your components, and doesn't enforce a routing model. It reads what you expose and renders chrome around it.

## The pattern: Provider + Slots + Hooks

Every Hudson app follows the same shape:

- **Provider** owns state (usually via React Context + a custom hook like `useCatalog()`). Slot components and hooks call that hook to read state.
- **Slots** are React components the shell renders inside its chrome. They read state via the Provider's hook.
- **Hooks** are called *inside the Provider's scope* by the shell via an internal Bridge component. They read state and return shell-readable values (commands, status, search config, nav content).

The Provider wraps everything; slots and hooks read from it. This matches how React context works naturally — nothing clever.

## Frame modes

Each app declares a `mode`, and the workspace's active layout drives Frame behavior:

| Mode     | Behavior                                  | Use case                                  |
|----------|-------------------------------------------|-------------------------------------------|
| `canvas` | Infinite pan/zoom world space             | Editors, graph UIs, spatial tools         |
| `panel`  | Static scrollable viewport, absolute inset | Dashboards, catalogs, readers, admin UIs  |

Apps can override at runtime via `useLayoutMode`.

## Canvas participation (WorkspaceShell only)

In canvas-mode workspaces, each app chooses how it appears:

| Participation | Behavior                                             | Example            |
|---------------|------------------------------------------------------|--------------------|
| `native`      | Renders directly on canvas, no window frame          | Hudson Docs        |
| `windowed`    | Renders inside `AppWindow` with title bar, drag, resize | Shaper, Notepad |

## What the shell gives you

- Navigation bar with title, search input, breadcrumb slot, action slot
- Left + right side panels with resize handles, collapse toggles, persistent widths
- Command palette (`Cmd+K`) populated from `useCommands`
- Terminal drawer (`Ctrl+` `` ` ``)
- Status bar with live indicator, console toggle, clock, (canvas) pan/zoom display
- Keyboard shortcuts (`Cmd+[`, `Cmd+]` for panel toggles)
- Persistent UI state via `usePersistentState` (localStorage-backed)
- Dark aesthetic — monospace metadata, cyan accents, emerald/amber/red status colors, tabular numerics

## Current apps in this repo

Workspace apps (rendered by Hudson's `WorkspaceShell` at `/app`):

| App             | Purpose                                    |
|-----------------|--------------------------------------------|
| Shaper          | Bezier curve editor for vector shapes      |
| Logo Designer   | Icon composer with templates               |
| Hudson Docs     | Documentation browser                      |
| Intent Explorer | Browsable intent catalog inspector         |
| Trace Viewer    | Frame-log / instrumentation viewer         |
| Openscout       | Open-source project scout                  |
| Notepad         | Markdown scratchpad                        |
| JSON Explorer   | Interactive JSON inspector                 |
| API Inspector   | HTTP request/response debugger             |
| Assets          | Asset browser                              |

The live app list lives in [`app/apps/registry.ts`](../app/apps/registry.ts).

## Next steps

- **[Building apps](./building-apps.md)** — the full contract, with examples
- **[Architecture](./architecture.md)** — how the shell is structured
- **[Systems](./systems.md)** — Intents (LLM/voice discovery), Services (process deps), Ports (inter-app piping)
- **[Case study: Premotion](./case-study-premotion.md)** — a real app built on Hudson
- **[Perf patterns](./perf-drag-resize-patterns.md)** — drag/resize/pan tricks used by the shell
