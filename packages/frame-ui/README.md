# Frame UI

HUD-style chrome components for canvas and panel-based applications.

## Installation

This is a workspace package. Add to your app's `package.json`:

```json
{
  "dependencies": {
    "frame-ui": "workspace:*"
  }
}
```

## Usage

### Import Components

```tsx
import { Frame, NavigationBar, SidePanel, StatusBar } from 'frame-ui';
import 'frame-ui/styles';
```

### Canvas Mode (Pan/Zoom)

For canvas-based applications like Shaper:

```tsx
import { Frame, Canvas, NavigationBar, SidePanel } from 'frame-ui';

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
import { Frame, NavigationBar, SidePanel } from 'frame-ui';

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

### Utilities
- **sounds** - Web Audio synthesizer for UI feedback
- **logger** - Event bus for Frame activity logging
- **chrome** - Design tokens and styling constants

## Requirements

- React 19+
- Tailwind CSS v4
- lucide-react ^0.564.0

## Design Philosophy

- **Stateless components** - Apps manage all state, Frame just renders
- **Callback pattern** - Props in, events out (no Context/Provider wrappers)
- **Manual composition** - Apps wire up components explicitly
- **Dark theme** - Professional HUD aesthetic (hardcoded for now)

## License

Private workspace package - not published to npm.
