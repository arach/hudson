---
title: API Reference
description: Complete reference for every type, hook, utility, and component in @hudsonos/sdk.
section: npm
subsection: "@hudsonos/sdk"
order: 3
---

# API Reference

Complete reference for every type, hook, utility, and component exported by `@hudsonos/sdk`.

## Types

### HudsonApp

The core contract every app must implement to plug into the Hudson shell.

```ts
interface HudsonApp {
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';
  leftPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };
  rightPanel?: { title: string; icon?: ReactNode };
  Provider: React.FC<{ children: ReactNode }>;
  tools?: AppTool[];
  slots: {
    Content: React.FC;
    LeftPanel?: React.FC;
    RightPanel?: React.FC;  // deprecated
    Inspector?: React.FC;
    LeftFooter?: React.FC;
    Terminal?: React.FC;
  };
  intents?: AppIntent[];
  manifest?: AppManifest;
  settings?: AppSettingsConfig;
  ports?: AppPorts;
  services?: ServiceDependency[];
  hooks: {
    useCommands: () => CommandOption[];
    useStatus: () => { label: string; color: StatusColor };
    useSearch?: () => SearchConfig;
    useNavCenter?: () => ReactNode | null;
    useNavActions?: () => ReactNode | null;
    useLayoutMode?: () => 'canvas' | 'panel';
    useActiveToolHint?: () => string | null;
    usePortOutput?: () => (portId: string) => unknown | null;
    usePortInput?: () => (portId: string, data: unknown) => void;
  };
}
```

### StatusColor

```ts
type StatusColor = 'emerald' | 'amber' | 'red' | 'neutral';
```

### AppTool

A tool panel entry for the right sidebar accordion.

```ts
interface AppTool {
  id: string;
  name: string;
  icon: ReactNode;
  Component: React.FC;
}
```

### SearchConfig

Configuration for the navigation bar search field.

```ts
interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

### AppManifest

Serializable snapshot of an app's capabilities for LLM and tooling introspection.

```ts
interface AppManifest {
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';
  commands?: { id: string; label: string; shortcut?: string }[];
  tools?: { id: string; name: string }[];
}
```

### AppSettingField

```ts
interface AppSettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'toggle' | 'slider' | 'segment';
  default: string | number | boolean;
  options?: { value: string; label: string }[];  // for 'segment' type
  min?: number;     // for 'slider' and 'number'
  max?: number;
  step?: number;
  format?: (v: number) => string;  // for 'slider' display
}
```

### AppSettingsSection

```ts
interface AppSettingsSection {
  label: string;
  fields: AppSettingField[];
}
```

### AppSettingsConfig

```ts
interface AppSettingsConfig {
  sections: AppSettingsSection[];
}
```

---

### HudsonWorkspace

A collection of apps that coexist in a shared shell.

```ts
interface HudsonWorkspace {
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';
  apps: WorkspaceAppConfig[];
  defaultFocusedAppId?: string;
}
```

### WorkspaceAppConfig

```ts
interface WorkspaceAppConfig {
  app: HudsonApp;
  canvasMode?: CanvasParticipation;
  defaultWindowBounds?: { x: number; y: number; w: number; h: number };
}
```

### CanvasParticipation

```ts
type CanvasParticipation = 'native' | 'windowed';
```

---

### AppIntent

Static intent declaration for LLM, voice, and search indexing.

```ts
interface AppIntent {
  commandId: string;
  title: string;
  description: string;
  category: IntentCategory;
  keywords: string[];
  params?: IntentParameter[];
  shortcut?: string;
  dangerous?: boolean;
}
```

### IntentCategory

```ts
type IntentCategory =
  | 'tool'
  | 'edit'
  | 'file'
  | 'view'
  | 'navigation'
  | 'toggle'
  | 'workspace'
  | 'settings';
```

### IntentParameter

```ts
interface IntentParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  optional?: boolean;
  enum?: string[];
  default?: string | number | boolean;
}
```

### CatalogAppEntry

```ts
interface CatalogAppEntry {
  appId: string;
  appName: string;
  appDescription: string;
  intents: AppIntent[];
}
```

### IntentCatalog

```ts
interface IntentCatalog {
  version: 1;
  generatedAt: string;
  workspace: { id: string; name: string };
  shell: AppIntent[];
  apps: CatalogAppEntry[];
  index: Record<string, { appId: string; intent: AppIntent }>;
}
```

---

### ServiceDefinition

Defines an external service that can be installed, started, and health-checked.

```ts
interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  icon?: string;
  check: {
    healthUrl?: string;
    port?: number;
  };
  install: { command: string; cwd?: string };
  start: { command: string; cwd?: string; env?: Record<string, string> };
  stop?: { command?: string };
}
```

### ServiceDependency

```ts
interface ServiceDependency {
  serviceId: string;
  optional?: boolean;
  reason?: string;
}
```

### ServiceStatus

```ts
type ServiceStatus = 'unknown' | 'not_installed' | 'installed' | 'running' | 'error';
```

### ServiceRecord

```ts
interface ServiceRecord {
  serviceId: string;
  status: ServiceStatus;
  pid?: number;
  logFile?: string;
  lastChecked: number;
  lastChanged: number;
  error?: string;
}
```

### ServiceAction

```ts
interface ServiceAction {
  id: string;
  serviceId: string;
  action: 'check' | 'install' | 'start' | 'stop';
  triggeredBy: 'user' | 'agent' | 'system';
  timestamp: number;
  command?: string;
  output?: string;
  exitCode?: number | null;
  success: boolean;
  durationMs: number;
}
```

---

### AppOutput

```ts
interface AppOutput {
  id: string;
  name: string;
  dataType: string;
  description?: string;
}
```

### AppInput

```ts
interface AppInput {
  id: string;
  name: string;
  dataType: string;
  description?: string;
}
```

### AppPorts

```ts
interface AppPorts {
  outputs?: AppOutput[];
  inputs?: AppInput[];
}
```

### PipeDefinition

```ts
interface PipeDefinition {
  id: string;
  name: string;
  source: { appId: string; portId: string };
  sink: { appId: string; portId: string };
  createdAt: number;
  lastPushedAt: number | null;
  enabled: boolean;
}
```

---

### CommandOption

Entry for the command palette.

```ts
interface CommandOption {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
}
```

### ContextMenuEntry

```ts
type ContextMenuEntry = ContextMenuAction | ContextMenuSeparator | ContextMenuGroup;
```

### ContextMenuAction

```ts
interface ContextMenuAction {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}
```

### ContextMenuSeparator

```ts
interface ContextMenuSeparator {
  type: 'separator';
}
```

### ContextMenuGroup

```ts
interface ContextMenuGroup {
  type: 'group';
  label: string;
  items: ContextMenuAction[];
}
```

---

### AI Types

These types are exported for typing app hooks. The runtime ships separately as `@hudsonos/ai`.

### HudsonAIChat

```ts
interface HudsonAIChat {
  messages: unknown[];
  sendMessage: (message: { role: string; content: string }) => void;
  stop: () => void;
  status: string;
  setMessages: (messages: unknown[]) => void;
  clearChat: () => void;
  error: Error | undefined;
  mode: 'cli' | 'api';
  attachments: AIAttachment[];
  activeAttachments: Set<string>;
  toggleAttachment: (label: string) => void;
}
```

### UseHudsonAIOptions

```ts
interface UseHudsonAIOptions {
  toolset: string;
  context?: Record<string, unknown>;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void | Promise<void>;
  mode?: 'cli' | 'api';
  attachments?: AIAttachment[];
}
```

### AIAttachment

```ts
interface AIAttachment {
  label: string;
  content: () => string | Record<string, unknown> | null;
}
```

---

## Hooks

The SDK provides three hooks for common app needs: persistent state, app settings, and terminal relay. All hooks handle SSR gracefully through the platform adapter system.

### usePersistentState

A drop-in replacement for `useState` that persists values to `localStorage`. The API is identical to React's `useState`.

```ts
function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>]
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | The localStorage key. Namespace it with your app ID to avoid collisions. |
| `initialValue` | `T` | Default value used when nothing is found in localStorage. |

#### Return Value

A tuple identical to `useState`: the current value and a setter function. The setter accepts either a new value or an updater function.

#### Behavior

1. On initial render, reads `localStorage.getItem(key)` and parses JSON.
2. Falls back to `initialValue` if no stored value exists or parsing fails.
3. On SSR (`isSSR` from PlatformProvider), defers the localStorage read to a `useEffect`.
4. Every state change is written back to localStorage as JSON.

#### Example

```tsx
import { usePersistentState } from '@hudsonos/sdk';

function ProjectSettings() {
  const [gridSize, setGridSize] = usePersistentState('editor.gridSize', 20);
  const [snapEnabled, setSnapEnabled] = usePersistentState('editor.snap', true);

  return (
    <div>
      <label>
        Grid size
        <input
          type="number"
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={() => setSnapEnabled((v) => !v)}
        />
        Snap to grid
      </label>
    </div>
  );
}
```

#### Key Namespacing

Use a consistent prefix to avoid collisions between apps:

```tsx
// Good: namespaced keys
usePersistentState('shaper.zoom', 0.45);
usePersistentState('shaper.tool', 'select');

// Bad: generic keys that could collide
usePersistentState('zoom', 0.45);
```

---

### useAppSettings

Manages per-app settings backed by localStorage with merge semantics. Works with the `AppSettingsConfig` schema to derive defaults and persist user overrides.

```ts
function useAppSettings(
  appId: string,
  config: AppSettingsConfig,
): [AppSettingsValues, (patch: Partial<AppSettingsValues>) => void, () => void]
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `appId` | `string` | Your app's unique ID. Used to namespace the localStorage key as `hudson.app.{appId}.settings`. |
| `config` | `AppSettingsConfig` | The settings schema, containing sections and fields with defaults. |

#### Return Value

A three-element tuple:

| Index | Type | Description |
|-------|------|-------------|
| `[0]` | `AppSettingsValues` | Current merged settings (defaults + user overrides). |
| `[1]` | `(patch) => void` | Merge function. Pass partial values to update specific keys. |
| `[2]` | `() => void` | Reset function. Restores all settings to their declared defaults. |

`AppSettingsValues` is `Record<string, string | number | boolean>`.

#### Defining a Settings Schema

The settings schema uses `AppSettingsConfig`, which contains sections of typed fields:

```tsx
import type { AppSettingsConfig } from '@hudsonos/sdk';

const settingsConfig: AppSettingsConfig = {
  sections: [
    {
      label: 'Canvas',
      fields: [
        {
          key: 'gridSize',
          label: 'Grid Size',
          type: 'slider',
          default: 20,
          min: 5,
          max: 100,
          step: 5,
          format: (v) => `${v}px`,
        },
        {
          key: 'snapToGrid',
          label: 'Snap to Grid',
          type: 'toggle',
          default: true,
        },
      ],
    },
    {
      label: 'Export',
      fields: [
        {
          key: 'format',
          label: 'Export Format',
          type: 'segment',
          default: 'svg',
          options: [
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
            { value: 'json', label: 'JSON' },
          ],
        },
      ],
    },
  ],
};
```

#### Field Types

| Type | Control | Default Type |
|------|---------|-------------|
| `'text'` | Text input | `string` |
| `'number'` | Number input | `number` |
| `'toggle'` | On/off switch | `boolean` |
| `'slider'` | Range slider with optional `format` | `number` |
| `'segment'` | Segmented control with `options` | `string` |

#### Example

```tsx
import { useAppSettings } from '@hudsonos/sdk';

function MyAppProvider({ children }: { children: React.ReactNode }) {
  const [settings, updateSettings, resetSettings] = useAppSettings(
    'my-editor',
    settingsConfig,
  );

  // Read a value
  const gridSize = settings.gridSize as number;

  // Update a value
  const handleGridChange = (size: number) => {
    updateSettings({ gridSize: size });
  };

  // Reset to defaults
  const handleReset = () => {
    resetSettings();
  };

  return (
    <EditorContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </EditorContext.Provider>
  );
}
```

#### Registering Settings on the App

Pass the config to the `settings` field of your `HudsonApp` definition. The shell reads this to render a settings panel.

```tsx
const myApp: HudsonApp = {
  id: 'my-editor',
  name: 'Editor',
  // ...
  settings: settingsConfig,
};
```

---

### useTerminalRelay

Connects to a WebSocket-based terminal relay server. The relay manages PTY sessions on a backend, allowing your app to embed a live terminal.

```ts
function useTerminalRelay(
  options?: UseTerminalRelayOptions,
): TerminalRelayHandle
```

#### Options

```ts
interface UseTerminalRelayOptions {
  /** WebSocket URL. Defaults to ws://localhost:3600 */
  url?: string;
  /** System prompt for the CLI session */
  systemPrompt?: string;
  /** Working directory for the PTY session */
  cwd?: string;
  /** Files to bootstrap in the CWD before spawning */
  workspaceFiles?: Record<string, string>;
  /** Auto-connect on mount. Defaults to false. */
  autoConnect?: boolean;
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `url` | `'ws://localhost:3600'` | WebSocket URL of the relay server. |
| `systemPrompt` | `undefined` | Passed to the CLI session on init. |
| `cwd` | Server's `$HOME` | Working directory for the spawned PTY. |
| `workspaceFiles` | `undefined` | Map of relative paths to file contents. Created on the server if missing. |
| `autoConnect` | `false` | When `true`, opens the WebSocket on mount. |

#### Return Value: TerminalRelayHandle

```ts
interface TerminalRelayHandle {
  status: RelayStatus;
  sessionId: string | null;
  error: string | null;
  exitCode: number | null;
  onData: (cb: (data: string) => void) => void;
  sendInput: (data: string) => void;
  sendLine: (text: string) => void;
  resize: (cols: number, rows: number) => void;
  connect: () => void;
  disconnect: () => void;
}
```

| Field | Description |
|-------|-------------|
| `status` | Connection state: `'disconnected'`, `'connecting'`, `'connected'`, or `'error'`. |
| `sessionId` | Server-assigned session ID after init. `null` before connection or after exit. |
| `error` | Human-readable error message. `null` when healthy. |
| `exitCode` | Process exit code. `null` while running or before start. |
| `onData` | Register a callback to receive terminal output. |
| `sendInput` | Send raw keystrokes to the PTY. |
| `sendLine` | Send a line of text (appends `\r` automatically). |
| `resize` | Resize the remote terminal. Can be called before connect to set initial size. |
| `connect` | Open the WebSocket and initialize or reconnect a session. |
| `disconnect` | Close the WebSocket. The server-side session stays alive for reconnection. |

#### RelayStatus

```ts
type RelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
```

#### Example

```tsx
import { useTerminalRelay } from '@hudsonos/sdk';
import { useEffect, useRef } from 'react';

function AppTerminal() {
  const terminal = useTerminalRelay({
    url: 'ws://localhost:3600',
    systemPrompt: 'You are a helpful coding assistant.',
    cwd: '/Users/me/project',
    autoConnect: false,
  });

  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    terminal.onData((data) => {
      if (outputRef.current) {
        outputRef.current.textContent += data;
      }
    });
  }, [terminal]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
        <span className={`h-2 w-2 rounded-full ${
          terminal.status === 'connected' ? 'bg-emerald-500' :
          terminal.status === 'connecting' ? 'bg-amber-500' :
          terminal.status === 'error' ? 'bg-red-500' :
          'bg-neutral-600'
        }`} />
        <span className="text-xs text-neutral-500">{terminal.status}</span>
        {terminal.status === 'disconnected' && (
          <button onClick={terminal.connect} className="text-xs text-cyan-400">
            Connect
          </button>
        )}
      </div>
      <pre ref={outputRef} className="flex-1 p-3 text-xs font-mono text-neutral-400 overflow-auto" />
    </div>
  );
}
```

#### Session Lifecycle

1. Call `resize(cols, rows)` to set the initial terminal dimensions.
2. Call `connect()` to open the WebSocket.
3. On open, the hook sends a `session:init` message with dimensions, system prompt, and CWD.
4. The server responds with `session:ready` containing the session ID.
5. Terminal data flows via `terminal:data` messages to the `onData` callback.
6. Call `sendInput` or `sendLine` to write to the PTY.
7. On disconnect and reconnect, the hook sends `session:reconnect` to resume the existing session.
8. If the session has expired, the server responds with `session:expired` and the hook automatically re-initializes.

---

## Utilities

### sounds

Tactile UI sounds generated with the Web Audio API. No audio files required.

```ts
import { sounds, click, thock, blipUp, blipDown, pop, confirm, error, whoosh, chime, tick, slideIn, slideOut, boot, ping, type } from '@hudsonos/sdk';
```

See [Utilities](./utilities.md#sounds) for the full catalog.

### Mute Control

```ts
function isMuted(): boolean;
function setMuted(muted: boolean): void;
function toggleMute(): boolean;
```

### Sound Preview

```ts
function preview(name: SoundName): void;
```

Plays the sound even when muted. Useful for settings previews.

### SoundName

```ts
type SoundName = keyof typeof sounds;
// 'click' | 'thock' | 'blipUp' | 'blipDown' | 'pop' | 'confirm' | 'error' | 'whoosh' | 'chime' | 'tick' | 'slideIn' | 'slideOut' | 'boot' | 'ping' | 'type'
```

---

### logEvent

Event-based debug logging. Only emits when `FRAME_DEBUG` is enabled (via `window.FRAME_DEBUG = true` or `localStorage.setItem('FRAME_DEBUG', '1')`).

```ts
function logEvent(label: string, payload: Record<string, unknown>, tag?: string): void;
```

### FRAME_LOG_EVENT

The CustomEvent type string for log listeners.

```ts
const FRAME_LOG_EVENT: string; // 'frame:log'
```

### FrameLogEntry

```ts
interface FrameLogEntry {
  id: string;
  label: string;
  tag: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
```

---

### worldToScreen

Converts world-space coordinates to screen-space coordinates.

```ts
function worldToScreen(
  worldPos: { x: number; y: number },
  panOffset: { x: number; y: number },
  scale: number,
  viewportCenter: { x: number; y: number },
): { x: number; y: number }
```

### screenToWorld

Converts screen-space coordinates to world-space coordinates.

```ts
function screenToWorld(
  screenPos: { x: number; y: number },
  panOffset: { x: number; y: number },
  scale: number,
  viewportCenter: { x: number; y: number },
): { x: number; y: number }
```

---

### deriveManifest

Derives a serializable `AppManifest` from a `HudsonApp` definition. Returns the app's static manifest if one is provided; otherwise builds one from top-level fields.

```ts
function deriveManifest(app: HudsonApp): AppManifest
```

---

### SHELL_THEME

Design tokens for Hudson shell chrome. See [Utilities](./utilities.md#theme) for full details.

```ts
const SHELL_THEME: {
  tokens: { blur, bg, border, shadow, topHighlight };
  base: string;
  panels: { navigationStack, manifest, inspector, minimap, statusBar, commandDock };
  effects: { rightFade, leftFade, bottomGlow };
  zIndex: { canvas, worldContent, panels, minimap, navigationStack, statusBar, drawer, modals };
  layout: { navHeight, panelWidth, panelTopOffset, statusBarHeight, panelBottomOffset };
}
```

---

## Platform

### PlatformAdapter

```ts
interface PlatformAdapter {
  titleBarInset: number;
  dragRegionProps: React.HTMLAttributes<HTMLElement>;
  onInteractiveMouseDown?: (e: React.MouseEvent) => void;
  isSSR: boolean;
  apiBaseUrl: string;
  serviceApiUrl: string;
}
```

### PlatformLayout

```ts
interface PlatformLayout {
  navTotalHeight: number;
  panelTopOffset: number;
}
```

### WEB_ADAPTER

Zero-config web defaults. Used when no `PlatformProvider` is present.

```ts
const WEB_ADAPTER: PlatformAdapter;
```

### PlatformProvider

```tsx
function PlatformProvider(props: {
  adapter: PlatformAdapter;
  children: React.ReactNode;
}): JSX.Element
```

### usePlatform

```ts
function usePlatform(): PlatformAdapter
```

### usePlatformLayout

```ts
function usePlatformLayout(): PlatformLayout
```

---

## Components

### ZoomControls

A canvas zoom widget with plus/minus buttons and an editable percentage display.

```tsx
import { ZoomControls } from '@hudsonos/sdk';

<ZoomControls
  scale={zoom}
  onZoom={(newScale) => setZoom(newScale)}
  min={0.1}
  max={3}
  step={0.1}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `scale` | `number` | -- | Current zoom level (1 = 100%). |
| `onZoom` | `(newScale: number) => void` | -- | Called with the clamped new scale on zoom change. |
| `min` | `number` | `0.2` | Minimum zoom level. |
| `max` | `number` | `3` | Maximum zoom level. |
| `step` | `number` | `0.1` | Zoom increment per click. |

The percentage label is clickable for direct numeric input.
