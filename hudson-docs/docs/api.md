---
title: API Reference
description: Complete API reference for the @hudson/sdk package
order: 5
---

# API Reference

Everything exported from the `@hudson/sdk` package.

```tsx
import { Frame, NavigationBar, SidePanel, ... } from '@hudson/sdk';
```

## Types

### HudsonApp

The core interface every app must implement. See [Building Apps](./building-apps.md) for full details.

```typescript
import type { HudsonApp } from '@hudson/sdk';
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name |
| `description` | `string` | No | Short description |
| `mode` | `'canvas' \| 'panel'` | Yes | Default frame mode |
| `leftPanel` | `{ title, icon?, headerActions? }` | No | Left panel config |
| `rightPanel` | `{ title, icon? }` | No | Right panel config |
| `Provider` | `React.FC<{ children }>` | Yes | State owner |
| `slots` | `{ Content, LeftPanel?, RightPanel?, LeftFooter?, Terminal? }` | Yes | UI slots |
| `intents` | `AppIntent[]` | No | Intent declarations |
| `hooks` | `{ useCommands, useStatus, ... }` | Yes | Shell bridge hooks |

### HudsonWorkspace

Defines a collection of apps in a shared shell.

```typescript
import type { HudsonWorkspace, WorkspaceAppConfig, CanvasParticipation } from '@hudson/sdk';
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique workspace ID |
| `name` | `string` | Yes | Display name |
| `description` | `string` | No | Workspace description |
| `mode` | `'canvas' \| 'panel'` | Yes | Global frame mode |
| `apps` | `WorkspaceAppConfig[]` | Yes | App configurations |
| `defaultFocusedAppId` | `string` | No | Initially focused app |

**WorkspaceAppConfig:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `app` | `HudsonApp` | Yes | The app instance |
| `canvasMode` | `'native' \| 'windowed'` | No | Canvas participation (default: `'native'`) |
| `defaultWindowBounds` | `{ x, y, w, h }` | No | Initial window position/size |

### AppIntent

Structured metadata for LLM/voice/search integration.

```typescript
import type { AppIntent, IntentCategory, IntentParameter } from '@hudson/sdk';
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `commandId` | `string` | Yes | Must match a CommandOption.id |
| `title` | `string` | Yes | Human-readable title |
| `description` | `string` | Yes | Natural-language description |
| `category` | `IntentCategory` | Yes | One of: tool, edit, file, view, navigation, toggle, workspace, settings |
| `keywords` | `string[]` | Yes | Synonyms for matching |
| `params` | `IntentParameter[]` | No | Typed parameters |
| `shortcut` | `string` | No | Keyboard shortcut |
| `dangerous` | `boolean` | No | Requires confirmation |

### StatusColor

```typescript
type StatusColor = 'emerald' | 'amber' | 'red' | 'neutral';
```

### SearchConfig

```typescript
interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

### CommandOption

```typescript
interface CommandOption {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: ReactNode;
  section?: string;
}
```

## Chrome Components

### Frame

Root container. Manages viewport/world transforms and renders HUD elements.

```tsx
<Frame
  panOffset={{ x: 0, y: 0 }}
  scale={1}
  onPan={(offset) => void}
  onZoom={(scale) => void}
  hud={<>{/* NavigationBar, SidePanel, etc. */}</>}
>
  {/* Content in world/viewport space */}
</Frame>
```

### NavigationBar

Top bar with title, optional search, and action slots.

```tsx
<NavigationBar
  title="APP NAME"
  subtitle="context"
  search={{ value, onChange, placeholder }}
  center={<>{/* Center content */}</>}
  actions={<>{/* Right-aligned actions */}</>}
/>
```

### SidePanel

Collapsible left or right panel with resize handle.

```tsx
<SidePanel
  side="left"
  title="Project"
  icon={<Layers size={12} />}
  headerActions={<HeaderActions />}
  footer={<FooterContent />}
  collapsed={false}
  onToggle={() => void}
  width={280}
  onResize={(w) => void}
>
  {/* Panel content */}
</SidePanel>
```

### StatusBar

Bottom bar showing app status.

```tsx
<StatusBar label="READY" color="emerald" />
```

### CommandDock

Floating command button (bottom center). Opens the command palette on click.

```tsx
<CommandDock onClick={() => void} />
```

### ZoomControls

Zoom in/out/reset buttons for canvas mode.

```tsx
<ZoomControls
  scale={1}
  onZoomIn={() => void}
  onZoomOut={() => void}
  onReset={() => void}
/>
```

### Minimap

Canvas minimap showing window positions and viewport indicator.

```tsx
<Minimap
  windowBoundsMap={boundsMap}
  panOffset={pan}
  scale={zoom}
  viewportSize={{ w, h }}
  onPanTo={(offset) => void}
/>
```

## Canvas

### Canvas

Pan/zoom input layer. Handles scroll-to-zoom, space+drag-to-pan, and gesture events.

```tsx
<Canvas
  panOffset={pan}
  scale={zoom}
  onPan={setPan}
  onZoom={setZoom}
/>
```

## Windows

### AppWindow

Draggable, resizable window with title bar chrome. Used for `windowed` canvas participation.

```tsx
<AppWindow
  title="My App"
  bounds={{ x: 0, y: 0, w: 600, h: 400 }}
  onBoundsChange={(bounds) => void}
  onReportBounds={(bounds) => void}
  maximized={false}
  onMaximizedChange={(v) => void}
  panOffset={pan}
  scale={zoom}
>
  {/* Window content */}
</AppWindow>
```

Features:
- Drag via title bar (Option+drag anywhere)
- 8-edge resize handles
- Maximize/restore toggle
- Context menu (Bring to Center, Maximize, Reset Window)
- Bounds persisted to localStorage

## Overlays

### CommandPalette

Searchable command menu triggered by Cmd+K.

```tsx
<CommandPalette
  open={true}
  onClose={() => void}
  commands={commandOptions}
/>
```

### TerminalDrawer

Bottom slide-out panel, toggled via Cmd+`.

```tsx
<TerminalDrawer open={true} onClose={() => void}>
  {/* Terminal content */}
</TerminalDrawer>
```

### HudsonContextMenu

Right-click context menu (powered by @base-ui/react + motion).

```tsx
<HudsonContextMenu entries={[
  { type: 'action', label: 'Copy', action: () => void, shortcut: 'Cmd+C' },
  { type: 'separator' },
  { type: 'action', label: 'Delete', action: () => void, destructive: true },
]}>
  {/* Trigger element */}
</HudsonContextMenu>
```

## Hooks

### usePersistentState

localStorage-backed state hook. Works like `useState` but persists across reloads.

```tsx
import { usePersistentState } from '@hudson/sdk';

const [value, setValue] = usePersistentState('storage-key', defaultValue);
```

## Utilities

### sounds

Web Audio synthesizer for UI feedback.

```tsx
import { sounds } from '@hudson/sdk';

sounds.blipUp();     // Positive feedback / success
sounds.click();      // Button press
sounds.whoosh();     // Transition / navigation
sounds.thock();      // Heavy press / confirm
```

### logger

Event bus for Frame activity logging.

```tsx
import { logEvent, FRAME_LOG_EVENT } from '@hudson/sdk';

logEvent({ type: 'app:action', detail: 'something happened' });

// Listen for events
window.addEventListener(FRAME_LOG_EVENT, (e) => {
  console.log(e.detail);
});
```

### viewport

Coordinate conversion between world and screen space.

```tsx
import { worldToScreen, screenToWorld } from '@hudson/sdk';

const screenPos = worldToScreen(worldPos, panOffset, scale);
const worldPos = screenToWorld(screenPos, panOffset, scale);
```

### chrome

Design tokens and styling constants.

```tsx
import { CHROME, CHROME_BASE, PANEL_STYLES, EDGE_EFFECTS, Z_LAYERS, LAYOUT } from '@hudson/sdk';

// CHROME — computed styles (borders, backgrounds, shadows)
// CHROME_BASE — raw color values
// PANEL_STYLES — panel-specific styling
// EDGE_EFFECTS — edge glow/shadow effects
// Z_LAYERS — z-index layer map
// LAYOUT — spacing and sizing constants
```
