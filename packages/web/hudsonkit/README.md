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
