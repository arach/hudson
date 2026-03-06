---
title: Utilities
description: Platform adapters, design tokens, and UI sounds
section: npm
subsection: "@hudsonos/sdk"
order: 5
---

# Utilities

Hudson ships three utility systems: the **Platform Adapter** for abstracting host-specific concerns, the **Theme** for design tokens and layout measurements, and the **Sounds** library for tactile UI audio feedback.

## Platform Adapter

The platform adapter system abstracts host-specific concerns so the Hudson shell runs identically on web (Next.js) and native hosts (Electrobun, Tauri, Electron). Apps access the adapter through a React context.

### How It Works

1. The host wraps the app root in a `PlatformProvider` with a custom adapter.
2. Shell components and hooks call `usePlatform()` to read adapter values.
3. If no provider is present, the context falls back to `WEB_ADAPTER`.

```
Host (Next.js / Electrobun / Tauri)
  |
  +-- PlatformProvider adapter={myAdapter}
       |
       +-- WorkspaceShell
            |
            +-- usePlatform()   -> reads adapter values
            +-- usePlatformLayout()  -> derives layout math
```

### PlatformAdapter Interface

```ts
interface PlatformAdapter {
  /** Extra vertical inset above the nav bar for native title bars (0 for web). */
  titleBarInset: number;

  /** HTML attributes spread onto the nav bar to enable native window dragging. */
  dragRegionProps: React.HTMLAttributes<HTMLElement>;

  /** Called on mousedown of interactive elements inside a drag region to prevent drag. */
  onInteractiveMouseDown?: (e: React.MouseEvent) => void;

  /** Whether the host uses SSR (true for Next.js, false for native). */
  isSSR: boolean;

  /** Base URL for API calls. Empty string = same-origin (web). */
  apiBaseUrl: string;

  /** Base URL for service management API. Empty string = same-origin (web). */
  serviceApiUrl: string;
}
```

#### Field Details

| Field | Web Default | Native Example | Purpose |
|-------|-------------|----------------|---------|
| `titleBarInset` | `0` | `28` | Pushes content below the native title bar. |
| `dragRegionProps` | `{}` | `{ style: { WebkitAppRegion: 'drag' } }` | Makes the nav bar act as a native drag region. |
| `onInteractiveMouseDown` | `undefined` | Stops drag propagation | Prevents buttons inside the drag region from initiating window drag. |
| `isSSR` | `true` | `false` | Controls hydration-safe localStorage access in `usePersistentState`. |
| `apiBaseUrl` | `''` | `'http://localhost:3600'` | Prefix for fetch calls. Empty uses same-origin. |
| `serviceApiUrl` | `''` | `'http://localhost:3601'` | Prefix for service management API calls. |

### WEB_ADAPTER

The default adapter for browser-based deployments. Zero configuration needed.

```ts
import { WEB_ADAPTER } from '@hudsonos/sdk';

const WEB_ADAPTER: PlatformAdapter = {
  titleBarInset: 0,
  dragRegionProps: {},
  onInteractiveMouseDown: undefined,
  isSSR: true,
  apiBaseUrl: '',
  serviceApiUrl: '',
};
```

You do not need to use `PlatformProvider` if running on the web with default settings. The context falls back to `WEB_ADAPTER` automatically.

### PlatformProvider

Wrap your app root to override platform defaults.

```tsx
import { PlatformProvider } from '@hudsonos/sdk';

function App() {
  return (
    <PlatformProvider adapter={myAdapter}>
      <WorkspaceShell workspace={myWorkspace} />
    </PlatformProvider>
  );
}
```

### usePlatform

Read the active platform adapter from any component.

```tsx
import { usePlatform } from '@hudsonos/sdk';

function MyComponent() {
  const { isSSR, apiBaseUrl } = usePlatform();

  const fetchData = async () => {
    const res = await fetch(`${apiBaseUrl}/api/data`);
    return res.json();
  };

  // ...
}
```

### usePlatformLayout

Derives layout measurements from the base shell theme combined with the active platform adapter. Use this instead of hardcoding pixel values.

```ts
interface PlatformLayout {
  /** Total nav bar height including native title bar inset. */
  navTotalHeight: number;
  /** Top offset for side panels (same as navTotalHeight). */
  panelTopOffset: number;
}
```

```tsx
import { usePlatformLayout } from '@hudsonos/sdk';

function SidePanel() {
  const { panelTopOffset } = usePlatformLayout();

  return (
    <div style={{ top: panelTopOffset, position: 'fixed' }}>
      {/* panel content */}
    </div>
  );
}
```

The layout values are derived as:

```
navTotalHeight = SHELL_THEME.layout.navHeight + adapter.titleBarInset
panelTopOffset = navTotalHeight
```

### Writing a Custom Adapter

To run Hudson inside a native host like Electrobun or Tauri, create a custom adapter.

#### Electrobun Example

```tsx
import type { PlatformAdapter } from '@hudsonos/sdk';

const ELECTROBUN_ADAPTER: PlatformAdapter = {
  titleBarInset: 28,

  dragRegionProps: {
    style: { WebkitAppRegion: 'drag' } as React.CSSProperties,
  },

  onInteractiveMouseDown: (e: React.MouseEvent) => {
    // Prevent drag when clicking buttons inside the nav bar
    (e.currentTarget as HTMLElement).style.setProperty(
      '-webkit-app-region',
      'no-drag',
    );
    requestAnimationFrame(() => {
      (e.currentTarget as HTMLElement).style.removeProperty(
        '-webkit-app-region',
      );
    });
  },

  isSSR: false,

  apiBaseUrl: 'http://localhost:3600',

  serviceApiUrl: 'http://localhost:3601',
};
```

#### Tauri Example

```tsx
import type { PlatformAdapter } from '@hudsonos/sdk';

const TAURI_ADAPTER: PlatformAdapter = {
  titleBarInset: 32,
  dragRegionProps: {
    'data-tauri-drag-region': true,
  } as React.HTMLAttributes<HTMLElement>,
  isSSR: false,
  apiBaseUrl: 'http://localhost:3600',
  serviceApiUrl: 'http://localhost:3601',
};
```

#### Using the Adapter

```tsx
import { PlatformProvider } from '@hudsonos/sdk';

function NativeApp() {
  return (
    <PlatformProvider adapter={ELECTROBUN_ADAPTER}>
      <WorkspaceShell workspace={myWorkspace} />
    </PlatformProvider>
  );
}
```

### SSR Considerations

When `isSSR` is `true` (the default for web), `usePersistentState` defers localStorage reads to a `useEffect` to avoid hydration mismatches. Native hosts set `isSSR: false` to read localStorage synchronously on first render, since there is no server-side rendering step.

---

## Theme

Hudson uses a consolidated design token system called `SHELL_THEME` for all shell chrome components. The theme defines Tailwind CSS classes, z-index layers, and layout measurements.

### SHELL_THEME

Import the theme tokens:

```tsx
import { SHELL_THEME } from '@hudsonos/sdk';
```

#### Structure

```ts
const SHELL_THEME = {
  tokens: {
    blur: 'backdrop-blur-xl',
    bg: 'bg-neutral-950/95',
    border: 'border border-neutral-700/80',
    shadow: 'shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)]',
    topHighlight: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
  },
  base: string,  // Combined: bg + blur + border + shadow
  panels: { ... },
  effects: { ... },
  zIndex: { ... },
  layout: { ... },
};
```

#### tokens

Atomic Tailwind class groups for composing custom surfaces.

| Token | Classes | Usage |
|-------|---------|-------|
| `blur` | `backdrop-blur-xl` | Glass-morphism backdrop blur |
| `bg` | `bg-neutral-950/95` | Near-opaque dark background |
| `border` | `border border-neutral-700/80` | Subtle border |
| `shadow` | Complex box-shadow | Depth + inner highlight |
| `topHighlight` | Pseudo-element gradient | Top-edge light reflection |

#### base

The combined base style for panels and overlays:

```
bg-neutral-950/95 backdrop-blur-xl border border-neutral-700/80 shadow-[...]
```

Use this as a starting point when building custom panels that match the shell style:

```tsx
<div className={`${SHELL_THEME.base} rounded-lg p-4`}>
  Custom panel content
</div>
```

#### panels

Pre-composed class strings for each shell region.

| Panel | Description |
|-------|-------------|
| `navigationStack` | Top navigation bar container |
| `manifest` | Left sidebar panel |
| `inspector` | Right sidebar panel |
| `minimap` | Minimap overlay (bottom-left) |
| `statusBar` | Bottom status bar |
| `commandDock` | Command dock (bottom-right) |

#### effects

Utility class strings for edge effects.

| Effect | Description |
|--------|-------------|
| `rightFade` | Right-edge fade gradient (pseudo-element) |
| `leftFade` | Left-edge fade gradient (pseudo-element) |
| `bottomGlow` | Bottom-edge glow gradient (pseudo-element) |

#### zIndex

Z-index values for layering.

| Layer | Value | Usage |
|-------|-------|-------|
| `canvas` | `0` | Canvas background |
| `worldContent` | `10` | Content rendered in world space |
| `panels` | `40` | Side panels |
| `minimap` | `45` | Minimap overlay |
| `navigationStack` | `50` | Navigation bar |
| `statusBar` | `60` | Status bar |
| `drawer` | `70` | Bottom drawer (terminal) |
| `modals` | `100` | Modals and command palette |

When positioning custom overlays, use these values to ensure correct stacking:

```tsx
<div style={{ zIndex: SHELL_THEME.zIndex.modals }}>
  My overlay
</div>
```

#### layout

Pixel measurements for shell chrome regions.

| Measurement | Value | Description |
|-------------|-------|-------------|
| `navHeight` | `48` | Navigation bar height (before platform inset) |
| `panelWidth` | `280` | Side panel width |
| `panelTopOffset` | `48` | Top offset for panels (same as navHeight) |
| `statusBarHeight` | `28` | Status bar height |
| `panelBottomOffset` | `28` | Bottom offset for panels (same as statusBarHeight) |

For platform-aware layout values, use `usePlatformLayout()` instead of reading these directly. The hook adds the native title bar inset.

### Tailwind CSS v4 Setup

Hudson uses Tailwind CSS v4. To ensure Tailwind scans the SDK's classes, add a `@source` directive in your CSS:

```css
@import "tailwindcss";
@source "../node_modules/@hudsonos/sdk/dist/**/*.js";
```

This tells Tailwind to scan the SDK's compiled output for class names.

### Scrollbar Styles

The SDK ships a CSS file with dark-themed scrollbar styles for panels. Import it in your app:

```css
@import "@hudsonos/sdk/styles.css";
```

This provides the `.frame-scrollbar` class:

```tsx
<div className="frame-scrollbar overflow-auto">
  Scrollable content with styled scrollbars
</div>
```

The styles apply:
- A 4px-wide scrollbar track (transparent background)
- A subtle white/12% thumb with rounded corners
- A brighter white/22% thumb on hover
- Firefox-compatible `scrollbar-width: thin` and `scrollbar-color`

### Color Guidelines

Hudson's design language uses a dark neutral palette with cool accent colors.

**Do use:**
- `cyan` / `blue` / `teal` / `emerald` for accents and highlights
- `neutral-950` through `neutral-400` for backgrounds and text
- Semi-transparent whites (`white/5`, `white/10`) for hover states

**Do not use:**
- Purple tones
- Bright saturated backgrounds
- Pure white text (prefer `neutral-200` or `neutral-300`)

#### Status Colors

The shell uses these semantic colors for status indicators:

| Color | Tailwind Class | Meaning |
|-------|---------------|---------|
| Emerald | `text-emerald-400` | Ready, success, healthy |
| Amber | `text-amber-400` | In progress, warning |
| Red | `text-red-400` | Error, failure |
| Neutral | `text-neutral-400` | Inactive, idle |

### Theme Example: Custom Panel

Build a panel that matches the shell aesthetic:

```tsx
import { SHELL_THEME } from '@hudsonos/sdk';

function CustomOverlay() {
  return (
    <div
      className={`${SHELL_THEME.base} rounded-lg p-4 fixed`}
      style={{ zIndex: SHELL_THEME.zIndex.modals }}
    >
      <h3 className="text-sm font-medium text-neutral-200 mb-2">
        Custom Panel
      </h3>
      <p className="text-xs text-neutral-400">
        This panel uses SHELL_THEME tokens for a consistent look.
      </p>
    </div>
  );
}
```

---

## Sounds

The SDK includes a tactile UI sound library generated entirely with the Web Audio API. No audio files are shipped.

### Import

```tsx
import { sounds, click, thock, confirm, isMuted, setMuted, preview } from '@hudsonos/sdk';
```

All sound functions and controls are named exports from the SDK barrel.

### Available Sounds

| Function | Description | Suggested Usage |
|----------|-------------|-----------------|
| `click()` | Soft click | Button press, toggle |
| `thock()` | Deep thock with attack | Panel open, focus change |
| `blipUp()` | Rising frequency blip | Success, task complete |
| `blipDown()` | Falling frequency blip | Dismiss, close |
| `pop()` | Quick pop | Command palette open, modal |
| `confirm()` | Two-tone ascending | Save, commit |
| `error()` | Two-tone descending | Soft error |
| `whoosh()` | Noise sweep | Transition, navigation |
| `chime()` | Four-note ascending chime | System init (bypasses mute) |
| `tick()` | Quick tick | Checkbox, step progress |
| `slideIn()` | Rising sweep | Drawer open |
| `slideOut()` | Falling sweep | Drawer close |
| `boot()` | Four-tone ascending sequence | System boot |
| `ping()` | High bell tone | Notification |
| `type()` | Randomized mechanical keystroke | Typing feedback |

### Usage

Call any sound function directly. Sounds are fire-and-forget with no return value.

```tsx
import { sounds, confirm, click } from '@hudsonos/sdk';

function SaveButton() {
  const handleSave = () => {
    save();
    confirm();
  };

  return (
    <button onClick={() => { handleSave(); click(); }}>
      Save
    </button>
  );
}
```

#### Using the sounds Object

All sounds are also available as a named object for dynamic access:

```tsx
import { sounds } from '@hudsonos/sdk';

// Call by name
sounds.click();
sounds.confirm();

// Dynamic access
const soundName = 'blipUp';
sounds[soundName]();
```

#### SoundName Type

```ts
type SoundName = keyof typeof sounds;
// 'click' | 'thock' | 'blipUp' | 'blipDown' | 'pop' | 'confirm' | 'error' | 'whoosh' | 'chime' | 'tick' | 'slideIn' | 'slideOut' | 'boot' | 'ping' | 'type'
```

### Mute Control

Sounds are muted by default. The mute state is persisted in `localStorage` under the key `frame_sounds`.

#### isMuted

Returns the current mute state.

```ts
function isMuted(): boolean;
```

#### setMuted

Sets the mute state and persists it.

```ts
function setMuted(muted: boolean): void;
```

#### toggleMute

Toggles mute and returns the new state.

```ts
function toggleMute(): boolean;
```

#### Mute Toggle Button Example

```tsx
import { isMuted, toggleMute } from '@hudsonos/sdk';
import { useState } from 'react';

function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted());

  const handleToggle = () => {
    toggleMute();
    setMutedState(isMuted());
  };

  return (
    <button onClick={handleToggle}>
      {muted ? 'Unmute' : 'Mute'} sounds
    </button>
  );
}
```

### Preview

The `preview` function plays a sound even when muted. It temporarily disables mute, plays the sound, then restores the previous mute state. Use this in settings panels to let users hear sounds before enabling them.

```ts
function preview(name: SoundName): void;
```

```tsx
import { preview } from '@hudsonos/sdk';
import type { SoundName } from '@hudsonos/sdk';

function SoundPreviewer() {
  const soundNames: SoundName[] = [
    'click', 'thock', 'blipUp', 'blipDown', 'pop',
    'confirm', 'error', 'whoosh', 'tick', 'boot', 'ping',
  ];

  return (
    <div className="space-y-1">
      {soundNames.map((name) => (
        <button
          key={name}
          onClick={() => preview(name)}
          className="block text-xs text-neutral-400 hover:text-cyan-400"
        >
          {name}
        </button>
      ))}
    </div>
  );
}
```

### Technical Details

- Sounds are generated using the Web Audio API's `OscillatorNode` and `BufferSource` (for noise).
- Each sound function creates short-lived audio nodes and schedules them on the `AudioContext` timeline.
- The `AudioContext` is lazily created on first use and resumed if suspended (browser autoplay policy).
- The `type()` sound adds randomized pitch and volume for a natural feel.
- The `chime()` sound always plays, bypassing the mute setting. It is intended for system-level events.
- All sound functions are wrapped in `try/catch` and fail silently if the Web Audio API is unavailable.
