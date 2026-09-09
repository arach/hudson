# HudsonKit

SDK and chrome primitives for canvas and panel-based Hudson applications.

## Installation

This is a workspace package. Add to your app's `package.json`:

```json
{
  "dependencies": {
    "hudsonkit": "workspace:*"
  }
}
```

## Usage

### Import Components

```tsx
import { Frame, NavigationBar, SidePanel, StatusBar } from 'hudsonkit';
import 'hudsonkit/styles';
```

### Canvas Mode (Pan/Zoom)

For canvas-based applications:

```tsx
import { Frame, Canvas, NavigationBar, SidePanel } from 'hudsonkit';

function CanvasApp() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  return (
    <Frame
      panOffset={pan}
      scale={zoom}
      onPan={setPan}
      onZoom={setZoom}
      hud={<>
        <NavigationBar title="APP" />
        <SidePanel side="left" title="Tools">
          {/* ... */}
        </SidePanel>
      </>}
    >
      <Canvas />
      {/* SVG content in world space */}
    </Frame>
  );
}
```

### Panel Mode (Static Layout)

For admin interfaces and dashboards:

```tsx
import { Frame, NavigationBar, SidePanel } from 'hudsonkit';

function AdminApp() {
  return (
    <Frame
      panOffset={{ x: 0, y: 0 }}
      scale={1}
      onPan={() => {}}
      onZoom={() => {}}
      hud={<>
        <NavigationBar title="ADMIN" subtitle="Dashboard" />
        <SidePanel side="left" title="Navigation">
          <nav>{/* Menu */}</nav>
        </SidePanel>
      </>}
    >
      {/* Content in viewport space */}
      <div className="p-8">
        <table>{/* Data table */}</table>
      </div>
    </Frame>
  );
}
```

## Components

### Chrome
- **Frame** - Root container with viewport/world space transforms
- **NavigationBar** - Top app bar with title, search, actions
- **SidePanel** - Collapsible left/right panels with resize
- **StatusBar** - Bottom status bar with indicators
- **CommandDock** - Floating toolbar for commands
- **ZoomControls** - Zoom in/out/reset buttons

### Canvas
- **Canvas** - Pan/zoom input layer with space-bar gestures

### Overlays
- **CommandPalette** - CMD+K searchable command menu
- **TerminalDrawer** - Bottom slide-out terminal panel

### Hooks
- **usePersistentState** - localStorage-backed state
- **useCachedResource** - async resource cache hook with TTL and revalidation

### Utilities
- **sounds** - Web Audio synthesizer for UI feedback
- **logger** - Event bus for Frame activity logging
- **createHudsonCache** - typed cache with TTL, stale-while-revalidate, in-flight dedupe, tags, and optional local/session storage
- **chrome** - Design tokens and styling constants

### Cache

```tsx
import { createHudsonCache, useCachedResource } from 'hudsonkit/cache';

const cache = createHudsonCache({
  namespace: 'assets',
  storage: 'session',
  defaultTtlMs: 30_000,
  defaultStaleWhileRevalidateMs: 120_000,
});

function AssetPreview({ id }: { id: string }) {
  const { data, isLoading, refresh } = useCachedResource(
    `asset:${id}`,
    () => fetch(`/api/assets/${id}`).then(r => r.json()),
    { cache, tags: ['assets'] },
  );

  return <button onClick={refresh}>{isLoading ? 'Loading' : data?.name}</button>;
}
```

### Framework-free agent composer

`hudsonkit/agent-composer` is a DOM-native, controlled composer for agent and
code-workflow surfaces. It keeps transport and product state in the host while
standardizing attachments, context chips, send/queue/steer/stop behavior,
host-controlled dictation, IME-safe keyboard submission, and
runtime/model/effort selection.

```ts
import {
  createAgentComposer,
  createAgentRuntimePicker,
} from 'hudsonkit/agent-composer';
import 'hudsonkit/agent-composer/styles';

const composer = createAgentComposer(document.querySelector('#composer')!, {
  onChange: (value) => saveDraft(value),
  onSubmit: (action, value) => invokeAgent({ action, value }),
  onStop: () => stopAgent(),
  onFiles: (files) => stageFiles(files),
  onVoiceAction: (action) => nativeDictation.perform(action),
});

const picker = createAgentRuntimePicker(composer.tools, {
  catalog: liveRuntimeCatalog,
  value: savedRuntime,
  onChange: persistRuntime,
});

composer.update({
  value: draft,
  active: agentIsRunning,
  steerSupported: activeHarness === 'codex',
  attachments,
  voice: {
    status: nativeDictation.status,
    canCancel: nativeDictation.status === 'preparing' || nativeDictation.status === 'transcribing',
  },
});
```

Voice is deliberately host-owned: Hudson renders the control and emits typed
`start`, `stop`, and `cancel` requests, but does not select a provider, capture
audio, or transcribe it. The idle action is an icon-only button beside Send,
with an accessible label and tooltip. Omit `voice` when dictation is unavailable. When a
transcript completes, the host appends it to its draft and calls
`composer.update({ value: nextDraft, voice: { status: 'idle' } })`.

For sibling-repository development, build a sealed artifact with
`bun run pack` in `packages/web/hudsonkit`, copy the resulting `.tgz` into the
consumer repository, and use a repository-relative `file:` dependency. Do not
depend on HudsonKit's source directory or require a Hudson checkout at runtime.

The interaction structure is adapted from OpenScout's web MessageComposer and
RuntimePicker under Apache-2.0. The HudsonKit implementation has no OpenScout,
React, agent-transport, or editor dependency.

For the surrounding hybrid layout, `hudsonkit/agent-workspace` provides named
DOM slots for navigation, conversation history, composer, artifact editor, and
results. Its optional tool surface keeps the conversation fixed while arbitrary
host-owned results, editor, and terminal nodes switch in the right column or
share it as a split pane:

```ts
import { createAgentWorkspace } from 'hudsonkit/agent-workspace';
import 'hudsonkit/agent-workspace/styles';

const workspace = createAgentWorkspace(
  document.querySelector('#app')!,
  {
    navigation: behaviorList,
    conversation: history,
    composer: composer.element,
  },
  {
    tools: [
      { id: 'tests', label: 'Test', content: runHistory },
      { id: 'editor', label: 'IDE', content: monacoHost },
      { id: 'terminal', label: 'Terminal', content: terminalHost },
    ],
    selectedToolId: 'tests',
    onToolSelect: (id, pane) => saveToolSelection({ id, pane }),
    onToolLayoutChange: (layout) => saveToolLayout(layout),
  },
);

workspace.update({
  navigationVisible: false,
  selectedToolId: 'editor',
  secondaryToolId: 'terminal',
  toolLayout: 'split',
  toolSplitPercent: 58,
});
```

The original `editor` and `results` slots remain available for fixed layouts.
Calling `createAgentWorkspace(host, slots)` without tools preserves the original
two-argument behavior.

For workflows where conversation, tests, an IDE, and a terminal are equivalent
work surfaces, pass `panels` instead of `tools`. Hudson keeps every panel's DOM
node mounted while the caller changes visibility, focus, order, or arrangement:

```ts
const workspace = createAgentWorkspace(document.querySelector('#app')!, {}, {
  panels: [
    { id: 'details', label: 'Details', content: detailsView },
    { id: 'test', label: 'Test', content: testView },
    { id: 'ide', label: 'IDE', content: monacoHost },
    { id: 'terminal', label: 'Terminal', content: terminalHost },
    { id: 'chat', label: 'Chat', content: conversationView },
  ],
  panelLayout: savedLayout ?? {
    arrangement: 'single',
    focusedPanelId: 'details',
    hiddenPanelIds: ['test', 'ide', 'terminal', 'chat'],
  },
  onPanelLayoutChange: (layout) => saveLayout(layout),
});

workspace.showPanel('test');
workspace.setPanelLayout({ arrangement: 'columns' });
```

`AgentWorkspacePanelLayoutState` is JSON-serializable. It records the
arrangement, panel order, hidden panel IDs, focused panel ID, grid column count,
and row or column sizes. Users can reorder panels by dragging a panel heading,
pressing `Alt+Arrow`, or using the panel action menu. Separators support pointer
dragging and arrow-key resizing.

## Requirements

- React 19+
- Tailwind CSS v4
- Iconoir is included by HudsonKit; consumers do not install an icon peer.

## Design Philosophy

- **Stateless components** - Apps manage all state, Frame just renders
- **Callback pattern** - Props in, events out (no Context/Provider wrappers)
- **Manual composition** - Apps wire up components explicitly
- **Dark theme** - Professional HUD aesthetic (hardcoded for now)

## License

Licensed under the [Functional Source License, Version 1.1, MIT Future License](./LICENSE.md) (FSL-1.1-MIT).

You may use, modify, and redistribute this software for any purpose other than a Competing Use — broadly, offering a commercial product or service that substitutes for or replicates this SDK's functionality. Internal use, non-commercial research, and building applications on top of Hudson are explicitly permitted.

On the second anniversary of each release, that release automatically converts to the MIT License.

Copyright 2026 Arach Tchoupani.
