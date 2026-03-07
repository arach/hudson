---
title: Building Apps
description: Complete guide to building apps for the Hudson platform
order: 4
---

# Building Apps

This guide covers everything you need to build a Hudson app — from the interface contract to workspace registration.

## The HudsonApp Interface

Every app implements the `HudsonApp` interface exported from `@hudson/sdk`:

```typescript
import type { HudsonApp } from '@hudson/sdk';
```

### Full Interface

```typescript
interface HudsonApp {
  // Identity
  id: string;                    // Unique ID (key + localStorage namespace)
  name: string;                  // Display name in app switcher
  description?: string;          // Tooltip / palette description
  mode: 'canvas' | 'panel';     // Default frame mode

  // Panel configuration (optional)
  leftPanel?: {
    title: string;
    icon?: ReactNode;
    headerActions?: React.FC;    // Rendered in left panel header
  };
  rightPanel?: {               // @deprecated — use Inspector + tools instead
    title: string;
    icon?: ReactNode;
  };

  // State owner
  Provider: React.FC<{ children: ReactNode }>;

  // UI slots rendered by the shell
  slots: {
    Content: React.FC;           // Main content area (required)
    LeftPanel?: React.FC;        // Left sidebar content
    RightPanel?: React.FC;       // @deprecated — use Inspector + tools instead
    LeftFooter?: React.FC;       // Footer of left panel
    Terminal?: React.FC;         // Terminal drawer content
  };

  // Intent declarations (optional)
  intents?: AppIntent[];

  // Hooks called inside Provider scope
  hooks: {
    useCommands: () => CommandOption[];              // Required
    useStatus: () => { label: string; color: StatusColor };  // Required
    useSearch?: () => SearchConfig;
    useNavCenter?: () => ReactNode | null;
    useNavActions?: () => ReactNode | null;
    useLayoutMode?: () => 'canvas' | 'panel';
  };
}
```

### Required vs Optional

| Field | Required | Purpose |
|-------|----------|---------|
| `id`, `name`, `mode` | Yes | Identity and default layout |
| `Provider` | Yes | Wraps all slots, owns state |
| `slots.Content` | Yes | Main UI |
| `hooks.useCommands` | Yes | Commands for palette (can return `[]`) |
| `hooks.useStatus` | Yes | Status bar label and color |
| `leftPanel`, `rightPanel` (deprecated) | No | Panel header config. `rightPanel` is deprecated — use `Inspector` + `tools` instead |
| `slots.LeftPanel`, `RightPanel` (deprecated), `LeftFooter`, `Terminal` | No | Additional UI slots. `RightPanel` is deprecated — use `Inspector` + `tools` instead |
| `hooks.useSearch`, `useNavCenter`, `useNavActions`, `useLayoutMode` | No | Nav bar integration |
| `intents` | No | LLM/voice/search declarations |

## Architecture Pattern

Hudson uses a **Provider + Slots + Hooks** architecture:

```
WorkspaceShell
  └── App.Provider            ← Your context wraps everything
        ├── slots.Content     ← Rendered in main area
        ├── slots.LeftPanel   ← Rendered in left SidePanel
        ├── slots.RightPanel  ← (deprecated) Rendered in right SidePanel — use Inspector + tools
        ├── slots.Terminal    ← Rendered in TerminalDrawer
        └── hooks.*           ← Called via Bridge component inside Provider
```

The shell nests Providers recursively for all apps in the workspace:

```typescript
// Inside WorkspaceShell
let tree = <WorkspaceInner />;
for (const { app } of workspace.apps.reverse()) {
  tree = <app.Provider>{tree}</app.Provider>;
}
```

This means every app's hooks and slots have access to every app's context. However, apps should only access their own context — cross-app communication goes through the shell.

## Provider Pattern

The Provider owns all app state via React context:

```tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface GlyphEditorState {
  // View state
  view: 'overview' | 'editor';
  setView: (v: 'overview' | 'editor') => void;

  // Data state
  selectedGlyphId: string | null;
  selectGlyph: (id: string) => void;

  // Tool state
  activeTool: 'select' | 'pen' | 'eraser';
  setTool: (t: 'select' | 'pen' | 'eraser') => void;
}

const Ctx = createContext<GlyphEditorState | null>(null);

export function useGlyphEditor() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGlyphEditor must be inside GlyphEditorProvider');
  return ctx;
}

export function GlyphEditorProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<'overview' | 'editor'>('overview');
  const [selectedGlyphId, setSelectedGlyphId] = useState<string | null>(null);
  const [activeTool, setTool] = useState<'select' | 'pen' | 'eraser'>('select');

  const selectGlyph = useCallback((id: string) => {
    setSelectedGlyphId(id);
    setView('editor');
  }, []);

  return (
    <Ctx.Provider value={{ view, setView, selectedGlyphId, selectGlyph, activeTool, setTool }}>
      {children}
    </Ctx.Provider>
  );
}
```

## Slot Components

Slots are plain React components that use your app's context:

### Content (required)

The main content area. In canvas mode, this renders in world space. In panel mode, it fills the viewport between the panels.

```tsx
'use client';

import { useGlyphEditor } from './GlyphEditorProvider';
import { GlyphOverview } from './components/GlyphOverview';
import { GlyphCanvas } from './components/GlyphCanvas';

export function GlyphEditorContent() {
  const { view } = useGlyphEditor();
  return view === 'overview' ? <GlyphOverview /> : <GlyphCanvas />;
}
```

### LeftPanel

Rendered inside the left SidePanel. Good for navigation, project trees, tool palettes.

```tsx
'use client';

import { useGlyphEditor } from './GlyphEditorProvider';

export function GlyphEditorLeftPanel() {
  const { selectGlyph } = useGlyphEditor();
  return (
    <div className="p-2 space-y-1">
      {glyphs.map(g => (
        <button key={g.id} onClick={() => selectGlyph(g.id)}
          className="w-full text-left px-2 py-1 rounded hover:bg-white/5">
          {g.name}
        </button>
      ))}
    </div>
  );
}
```

### RightPanel (deprecated)

> **Deprecated.** `RightPanel` is deprecated. Use `Inspector` combined with `tools` instead. The `Inspector` slot provides a structured way to display properties and metadata, while `tools` allows apps to register tool panels that appear in the right sidebar. See the Shaper app's `ShaperInspector.tsx` and `tools/` directory for a reference implementation.

Previously used for inspector, properties, and metadata. Rendered inside the right SidePanel.

### LeftFooter

Rendered at the bottom of the left panel. Shaper uses this for a minimap preview.

### Terminal

Rendered inside the TerminalDrawer (toggled via Cmd+`). Good for logs, REPL, debug output.

## Hooks

Hooks bridge your app state into the shell chrome. They are called inside your Provider's scope.

### useCommands (required)

Return an array of `CommandOption` objects. These appear in the command palette (Cmd+K).

```tsx
import { useMemo } from 'react';
import type { CommandOption } from '@hudson/sdk';
import { useGlyphEditor } from './GlyphEditorProvider';

export function useGlyphCommands(): CommandOption[] {
  const { setView, setTool, view } = useGlyphEditor();

  return useMemo(() => [
    {
      id: 'glyph:overview',
      label: 'Show Glyph Overview',
      action: () => setView('overview'),
      shortcut: 'Cmd+1',
    },
    {
      id: 'glyph:editor',
      label: 'Open Glyph Editor',
      action: () => setView('editor'),
      shortcut: 'Cmd+2',
    },
    {
      id: 'glyph:pen-tool',
      label: 'Pen Tool',
      action: () => setTool('pen'),
      shortcut: 'P',
    },
  ], [setView, setTool, view]);
}
```

### useStatus (required)

Return a label and color for the status bar.

```tsx
export function useGlyphStatus() {
  const { view, activeTool } = useGlyphEditor();
  if (view === 'editor') return { label: activeTool.toUpperCase(), color: 'emerald' as const };
  return { label: 'OVERVIEW', color: 'neutral' as const };
}
```

Valid colors: `'emerald'`, `'amber'`, `'red'`, `'neutral'`.

### useSearch (optional)

Provides a search bar in the navigation bar.

```tsx
export function useGlyphSearch() {
  const [query, setQuery] = useState('');
  return { value: query, onChange: setQuery, placeholder: 'Search glyphs...' };
}
```

### useNavCenter (optional)

Returns content rendered in the center of the navigation bar (between left/right actions).

### useNavActions (optional)

Returns content rendered on the right side of the navigation bar. Good for action buttons.

### useLayoutMode (optional)

Overrides the workspace-level mode for this app. Useful when an app needs canvas mode even in a panel workspace, or vice versa.

```tsx
export function useGlyphLayoutMode(): 'canvas' | 'panel' {
  const { view } = useGlyphEditor();
  return view === 'editor' ? 'canvas' : 'panel';
}
```

## Intents

Intents declare structured metadata about your commands for LLM/voice/search integration.

```typescript
import type { AppIntent } from '@hudson/sdk';

export const glyphIntents: AppIntent[] = [
  {
    commandId: 'glyph:pen-tool',        // Must match a CommandOption.id
    title: 'Switch to Pen Tool',
    description: 'Activate the pen tool for drawing bezier paths',
    category: 'tool',
    keywords: ['pen', 'draw', 'bezier', 'path', 'curve'],
    shortcut: 'P',
  },
  {
    commandId: 'glyph:export',
    title: 'Export Glyph',
    description: 'Export the current glyph as SVG',
    category: 'file',
    keywords: ['export', 'save', 'svg', 'download'],
    dangerous: true,  // Requires confirmation
    params: [
      { name: 'format', description: 'Export format', type: 'string', enum: ['svg', 'png'], default: 'svg' },
    ],
  },
];
```

### Intent Categories

| Category | Use Case |
|----------|----------|
| `tool` | Tool switching (pen, select, eraser) |
| `edit` | Data mutations (delete, duplicate, transform) |
| `file` | I/O operations (save, export, import) |
| `view` | View changes (zoom, pan, fit) |
| `navigation` | Navigation (go to glyph, switch view) |
| `toggle` | Boolean toggles (grid, snap, rulers) |
| `workspace` | Workspace-level actions |
| `settings` | Preference changes |

### Execution Bridge

The shell automatically bridges intents to commands. When an intent is executed (via LLM, voice, or the Intent Explorer), the shell looks up the matching `commandId` in your `useCommands()` output and calls its `action()`.

## Workspace Registration

### Add to an existing workspace

```typescript
// app/workspaces/hudsonOS.ts
import { glyphEditorApp } from '../apps/glyph-editor';

export const hudsonOSWorkspace: HudsonWorkspace = {
  id: 'hudson-os',
  name: 'Hudson OS',
  mode: 'canvas',
  apps: [
    // ... existing apps
    {
      app: glyphEditorApp,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -300, y: -200, w: 700, h: 500 },
    },
  ],
};
```

### Create a standalone workspace

```typescript
// app/workspaces/glyphDev.ts
import type { HudsonWorkspace } from '@hudson/sdk';
import { glyphEditorApp } from '../apps/glyph-editor';

export const glyphDevWorkspace: HudsonWorkspace = {
  id: 'glyph-dev',
  name: 'Glyph Editor',
  description: 'Standalone glyph editing workspace',
  mode: 'panel',
  apps: [{ app: glyphEditorApp }],
};
```

### Register the workspace

```typescript
// app/page.tsx
import { glyphDevWorkspace } from './workspaces/glyphDev';

export default function Page() {
  return (
    <WorkspaceShell
      workspaces={[hudsonOSWorkspace, shaperDevWorkspace, glyphDevWorkspace]}
      defaultWorkspaceId="hudson-os"
      bootMode="condensed"
    />
  );
}
```

## Canvas vs Panel Mode

### Canvas mode (`mode: 'canvas'`)

- Content renders in world space (infinite pan/zoom)
- Mouse wheel zooms, space+drag pans
- Option+drag on windows to move them
- Window bounds persisted to localStorage
- Best for: editors, spatial tools, graph UIs

### Panel mode (`mode: 'panel'`)

- Content renders in viewport space (static, scrollable)
- No pan/zoom controls
- Full-width layout between side panels
- Best for: dashboards, admin interfaces, documentation

Apps can dynamically switch modes using `useLayoutMode()`.

## Persistent State

Use `usePersistentState` from @hudson/sdk for state that survives page reloads:

```tsx
import { usePersistentState } from '@hudson/sdk';

function MyComponent() {
  const [gridVisible, setGridVisible] = usePersistentState('my-app.grid', true);
  // Backed by localStorage with key 'my-app.grid'
}
```

## Sounds

Hudson includes a Web Audio synthesizer for UI feedback:

```tsx
import { sounds } from '@hudson/sdk';

// Available sounds
sounds.blipUp();    // Positive feedback
sounds.click();     // Button press
sounds.whoosh();    // Transitions
sounds.thock();     // Heavy press
```

## File Structure Convention

```
app/apps/my-app/
  index.ts                 # App definition (exports HudsonApp)
  MyAppProvider.tsx         # Context provider
  hooks.ts                 # Hook implementations
  intents.ts               # Intent declarations
  MyAppContent.tsx          # Content slot
  MyAppLeftPanel.tsx        # Left panel slot
  MyAppRightPanel.tsx       # Right panel slot (deprecated — use Inspector + tools)
  MyAppInspector.tsx        # Inspector slot (replaces RightPanel)
  tools/                    # Tool panel implementations
  MyAppTerminal.tsx         # Terminal slot
  components/               # App-specific components
    ComponentA.tsx
    ComponentB.tsx
```

## Reference Implementation

The **Shaper** app (`app/apps/shaper/`) is the most complete reference:

- Full Provider with complex state (tools, shapes, layers, selections)
- All 5 slot components implemented
- 6 hooks bridging state to shell chrome
- 25+ intents for LLM integration
- Dynamic frame mode switching (panel default, canvas when editing)
- Header actions in the left panel

The **Intent Explorer** (`app/apps/intent-explorer/`) is a simpler example if you want a minimal starting point.

## Further Reading

- [Overview](./overview.md) — Architecture and key concepts
- [Quickstart](./quickstart.md) — Get running and create a minimal app
- [Scaffolding](./scaffolding.md) — Generate apps with `create-hudson-app`
- [API Reference](./api.md) — Complete reference for all @hudson/sdk exports
