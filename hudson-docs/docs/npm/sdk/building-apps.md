---
title: Building Apps
description: Learn the Provider + Slots + Hooks architecture for Hudson apps.
section: npm
subsection: "@hudsonos/sdk"
order: 2
---

# Building Apps

Hudson apps follow a **Provider + Slots + Hooks** architecture. The app owns all state inside a React context Provider. The shell renders the app's UI through named slots. Hooks feed dynamic data back to the shell chrome.

This guide covers each piece in depth with practical examples drawn from the Shaper reference app.

## Architecture Overview

```
Shell (WorkspaceShell)
  |
  +-- App.Provider              <-- wraps everything; owns state
       |
       +-- Bridge component     <-- calls hooks, feeds data to shell
       |
       +-- slots.Content        <-- main content area
       +-- slots.LeftPanel      <-- left sidebar content
       +-- slots.Inspector      <-- right sidebar content
       +-- slots.LeftFooter     <-- bottom of left panel
       +-- slots.Terminal       <-- bottom drawer content
```

The shell nests all app Providers recursively in a multi-app workspace. Each app's hooks are called inside its own Provider scope through a Bridge component that the shell renders automatically.

## The Provider

The Provider is a standard React context provider. It wraps all slots and hooks, so any state you put in context is accessible from every part of your app.

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePersistentState } from '@hudsonos/sdk';

export interface EditorState {
  tool: 'select' | 'draw' | 'eraser';
  setTool: (tool: 'select' | 'draw' | 'eraser') => void;
  color: string;
  setColor: (color: string) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

const EditorContext = createContext<EditorState | null>(null);

export function useEditor(): EditorState {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<'select' | 'draw' | 'eraser'>('select');
  const [color, setColor] = usePersistentState('editor.color', '#06b6d4');
  const [zoom, setZoom] = useState(1);

  return (
    <EditorContext.Provider value={{ tool, setTool, color, setColor, zoom, setZoom }}>
      {children}
    </EditorContext.Provider>
  );
}
```

### Key Rules

1. The Provider receives `{ children: ReactNode }` and must render `children`.
2. All app state lives inside the Provider. The shell never manages app state.
3. Use `usePersistentState` for state that should survive page reloads.
4. Keep expensive computations in `useMemo` inside the Provider.

## Slots

Slots are React function components that the shell places in fixed layout regions. Each slot is rendered inside the Provider, so it has full access to your app context.

### Content (required)

The main content area. For canvas apps this is the infinite pan/zoom surface. For panel apps it fills the area between the navigation bar and status bar.

```tsx
export function MyAppContent() {
  const { tool, zoom } = useEditor();

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-950">
      {/* Your app's main UI */}
    </div>
  );
}
```

### LeftPanel

Rendered inside the left sidebar (280px wide). Typically used for layer lists, project trees, or visibility toggles.

```tsx
export function MyAppLeftPanel() {
  const { layers, selectedLayer, selectLayer } = useEditor();

  return (
    <div className="space-y-1 p-3">
      {layers.map((layer) => (
        <button
          key={layer.id}
          onClick={() => selectLayer(layer.id)}
          className={`w-full text-left px-2 py-1 rounded text-xs ${
            selectedLayer === layer.id
              ? 'bg-cyan-500/20 text-cyan-300'
              : 'text-neutral-400 hover:bg-white/5'
          }`}
        >
          {layer.name}
        </button>
      ))}
    </div>
  );
}
```

### Inspector

Rendered inside the right sidebar. Used for property editors, detailed controls, and contextual information. If your app also declares `tools`, the Inspector appears as a section alongside tool accordion panels.

```tsx
export function MyAppInspector() {
  const { selectedObject, updateProperty } = useEditor();

  if (!selectedObject) {
    return (
      <div className="p-3 text-xs text-neutral-500">
        Select an object to inspect
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <label className="block">
        <span className="text-[10px] text-neutral-600">Width</span>
        <input
          type="number"
          value={selectedObject.width}
          onChange={(e) => updateProperty('width', Number(e.target.value))}
          className="w-full rounded bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 text-xs font-mono text-neutral-300"
        />
      </label>
    </div>
  );
}
```

### LeftFooter

Rendered at the bottom of the left panel. The Shaper app uses this for a minimap.

```tsx
export function MyAppLeftFooter() {
  return <Minimap />;
}
```

### Terminal

Rendered inside the bottom drawer that the user can toggle open. Use it for logs, debug output, or an embedded terminal.

```tsx
export function MyAppTerminal() {
  const { logs } = useEditor();

  return (
    <pre className="p-3 text-xs font-mono text-neutral-500 whitespace-pre-wrap">
      {logs.join('\n') || 'No output'}
    </pre>
  );
}
```

### RightPanel (deprecated)

`RightPanel` is deprecated. Use `Inspector` and `tools` instead.

## Hooks

Hooks are functions called inside the Provider scope via a Bridge component that the shell renders. They return data that drives shell chrome: the command palette, status bar, navigation bar, and more.

### useCommands (required)

Returns an array of `CommandOption` objects. These appear in the command palette (Cmd+K) and drive keyboard shortcuts.

```tsx
import type { CommandOption } from '@hudsonos/sdk';

function useEditorCommands(): CommandOption[] {
  const { setTool, undo, redo, save } = useEditor();

  return useMemo(() => [
    { id: 'editor:select', label: 'Select Tool', action: () => setTool('select'), shortcut: 'V' },
    { id: 'editor:draw', label: 'Draw Tool', action: () => setTool('draw'), shortcut: 'P' },
    { id: 'editor:undo', label: 'Undo', action: undo, shortcut: 'Cmd+Z' },
    { id: 'editor:redo', label: 'Redo', action: redo, shortcut: 'Cmd+Shift+Z' },
    { id: 'editor:save', label: 'Save', action: save, shortcut: 'Cmd+S' },
  ], [setTool, undo, redo, save]);
}
```

Command IDs should be namespaced with your app ID (e.g., `editor:save`) to avoid collisions in multi-app workspaces.

### useStatus (required)

Returns a label and color for the status bar indicator.

```tsx
function useEditorStatus(): { label: string; color: StatusColor } {
  const { isDirty, isSaving } = useEditor();
  if (isSaving) return { label: 'SAVING', color: 'amber' };
  if (isDirty) return { label: 'MODIFIED', color: 'amber' };
  return { label: 'READY', color: 'emerald' };
}
```

Available colors: `'emerald'`, `'amber'`, `'red'`, `'neutral'`.

### useSearch (optional)

Returns a `SearchConfig` that powers the search field in the navigation bar.

```tsx
function useEditorSearch(): SearchConfig {
  const { query, setQuery } = useEditor();
  return {
    value: query,
    onChange: setQuery,
    placeholder: 'Search layers...',
  };
}
```

### useNavCenter (optional)

Returns a `ReactNode` rendered in the center of the navigation bar. Useful for showing the active tool or mode.

```tsx
function useEditorNavCenter() {
  const { tool } = useEditor();
  return (
    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
      {tool}
    </span>
  );
}
```

### useNavActions (optional)

Returns a `ReactNode` rendered on the right side of the navigation bar. Use it for save indicators, file names, or action buttons.

### useLayoutMode (optional)

Returns `'canvas'` or `'panel'` to dynamically switch the layout mode at runtime. If not provided, the static `mode` field on the app definition is used.

### useActiveToolHint (optional)

Returns a tool ID string (matching a tool in the `tools` array) or `null`. The shell uses this hint to auto-expand the corresponding tool accordion panel in the right sidebar.

### usePortOutput / usePortInput (optional)

Enable inter-app data piping. See [Systems](./systems.md#ports) for details.

## Tools

Tools are interactive panels that appear in the right sidebar as an accordion. Each tool has an ID, name, icon, and a React component.

```tsx
import type { AppTool } from '@hudsonos/sdk';
import { Anchor, Paintbrush, Play } from 'lucide-react';

const editorTools: AppTool[] = [
  {
    id: 'anchors',
    name: 'Anchors',
    icon: <Anchor size={12} />,
    Component: AnchorsTool,
  },
  {
    id: 'fill',
    name: 'Fill',
    icon: <Paintbrush size={12} />,
    Component: FillTool,
  },
  {
    id: 'animation',
    name: 'Animation',
    icon: <Play size={12} />,
    Component: AnimationTool,
  },
];
```

Tool components are rendered inside the Provider, so they have access to your app context.

## Panel Configuration

The `leftPanel` and `rightPanel` fields configure the headers for the side panels.

```tsx
import { Layers, ScanSearch } from 'lucide-react';

const myApp: HudsonApp = {
  // ...
  leftPanel: {
    title: 'Project',
    icon: <Layers size={12} />,
    headerActions: MyHeaderActionsComponent,
  },
  rightPanel: {
    title: 'Inspector',
    icon: <ScanSearch size={12} />,
  },
};
```

The `headerActions` field accepts a React component that renders action buttons (like a menu) in the left panel header.

## Manifest

The manifest is a serializable snapshot of your app's capabilities. It is used by external tooling and LLM integrations. You can provide it statically or let the SDK derive it automatically.

```tsx
import { deriveManifest } from '@hudsonos/sdk';
import type { AppManifest } from '@hudsonos/sdk';

// Option 1: Static manifest
const manifest: AppManifest = {
  id: 'editor',
  name: 'Editor',
  description: 'Vector graphics editor',
  mode: 'canvas',
  commands: [
    { id: 'editor:save', label: 'Save', shortcut: 'Cmd+S' },
  ],
  tools: [
    { id: 'anchors', name: 'Anchors' },
  ],
};

// Option 2: Auto-derive from app definition
const manifest = deriveManifest(myApp);
```

## Putting It All Together

Here is the full structure of a Hudson app, modeled after the Shaper reference:

```tsx
// index.ts
import type { HudsonApp } from '@hudsonos/sdk';
import { EditorProvider } from './EditorProvider';
import { EditorContent } from './EditorContent';
import { EditorLeftPanel } from './EditorLeftPanel';
import { EditorInspector } from './EditorInspector';
import { EditorTerminal } from './EditorTerminal';
import {
  useEditorCommands,
  useEditorStatus,
  useEditorSearch,
  useEditorNavCenter,
} from './hooks';
import { editorTools } from './tools';
import { editorIntents } from './intents';

export const editorApp: HudsonApp = {
  id: 'editor',
  name: 'Editor',
  description: 'Vector graphics editor',
  mode: 'canvas',

  intents: editorIntents,

  leftPanel: { title: 'Layers' },
  rightPanel: { title: 'Inspector' },

  tools: editorTools,

  Provider: EditorProvider,

  slots: {
    Content: EditorContent,
    LeftPanel: EditorLeftPanel,
    Inspector: EditorInspector,
    Terminal: EditorTerminal,
  },

  hooks: {
    useCommands: useEditorCommands,
    useStatus: useEditorStatus,
    useSearch: useEditorSearch,
    useNavCenter: useEditorNavCenter,
  },
};
```

## Next Steps

- [API Reference](./api-reference.md) -- hooks, types, and utilities reference
- [Systems](./systems.md) -- intents, services, and inter-app data piping
- [Utilities](./utilities.md) -- platform adapters, design tokens, and UI sounds
