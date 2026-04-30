# API Reference

Every `hudsonkit` export, organized by subpath. Types are authoritative in [`packages/hudson-sdk/src/types/`](../packages/hudson-sdk/src/types/); this doc is a map, not the source of truth.

## Subpath exports

| Subpath                           | Purpose                                                              |
|-----------------------------------|----------------------------------------------------------------------|
| `hudsonkit`                     | Types, hooks, platform adapter, AI component, utilities (main entry) |
| `hudsonkit/app-shell`           | `AppShell` — single-app default shell                                |
| `hudsonkit/shell`               | `WorkspaceShell` + all chrome/overlays/canvas/windows (back-compat barrel) |
| `hudsonkit/chrome`              | Chrome primitives: `Frame`, `NavigationBar`, `SidePanel`, `StatusBar`, `CommandDock`, `Minimap`, `ZoomControls`, `AnimationTimeline` |
| `hudsonkit/overlays`            | `CommandPalette`, `TerminalDrawer` (no `ContextMenu`)                |
| `hudsonkit/context-menu`        | `HudsonContextMenu` (opt-in; pulls `motion` + `@base-ui-components/react`) |
| `hudsonkit/canvas`              | `Canvas` (pan/zoom world)                                            |
| `hudsonkit/windows`             | `AppWindow` (draggable/resizable window frame)                       |
| `hudsonkit/theme`               | Design tokens: `SHELL_THEME`, `PANEL_STYLES`, `Z_LAYERS`, `LAYOUT`, etc. |
| `hudsonkit/styles`              | **Pre-compiled CSS bundle** — import once to get every utility class used by SDK chrome |
| `hudsonkit/controls`            | `ParamPanel` and related control primitives                          |

## Types

Importable from `hudsonkit`:

| Type                              | Source                                    |
|-----------------------------------|-------------------------------------------|
| `HudsonApp`                       | `types/app.ts` — the app contract         |
| `AppTool`                         | Tool panel entry for Inspector accordion  |
| `AppManifest`                     | Serializable app capability snapshot      |
| `AppSettingsConfig`, `AppSettingField`, `AppSettingsSection` | Settings UI schema |
| `SearchConfig`                    | Nav bar search wiring                     |
| `StatusColor`                     | `'emerald' \| 'amber' \| 'red' \| 'neutral'` |
| `HudsonWorkspace`, `WorkspaceAppConfig`, `CanvasParticipation` | `types/workspace.ts` |
| `AppIntent`, `IntentCategory`, `IntentParameter`, `CatalogAppEntry`, `IntentCatalog` | `types/intent.ts` |
| `ServiceDefinition`, `ServiceDependency`, `ServiceRecord`, `ServiceAction`, `ServiceStatus` | `types/service.ts` |
| `AppOutput`, `AppInput`, `AppPorts`, `PipeDefinition` | `types/port.ts`                   |
| `CommandOption`, `ContextMenuEntry`, `ContextMenuAction`, `ContextMenuSeparator`, `ContextMenuGroup` | `components/overlays` |

## Hooks (from `hudsonkit`)

| Hook                                              | Purpose                                        |
|---------------------------------------------------|------------------------------------------------|
| `usePersistentState<T>(key, initial)`             | localStorage-backed state, SSR-safe, cross-tab |
| `useDebouncedPersistentState<T>(key, initial, ms)` | Like above, with write debounce               |
| `useSaveIndicator()`                              | Status indicator for save operations           |
| `useAppSettings<T>(appId)`                        | Read/write current app's settings              |
| `useHudsonAI(options)`                            | Chat transport for the workspace AI panel      |
| `useTerminalRelay(options)`                       | WebSocket bridge to the terminal relay server  |

Returned types (also exported): `AppSettingsValues`, `HudsonAIChat`, `UseHudsonAIOptions`, `AIAttachment`, `TerminalRelayHandle`, `UseTerminalRelayOptions`, `RelayStatus`.

## Components

### From `hudsonkit`

- `AI` — chat panel component, paired with `useHudsonAI`
- `TerminalRelay`, `captureWorkspace` — terminal relay component + screenshot helper
- `ZoomControls` — reusable widget (also re-exported from `/chrome`)

### From `hudsonkit/app-shell`

- `AppShell` — single-app full-chrome shell. Props: `{ app: HudsonApp }`.

### From `hudsonkit/shell` (back-compat barrel)

All of: `WorkspaceShell`, `AppShell`, `Frame`, `NavigationBar`, `SidePanel`, `StatusBar`, `CommandDock`, `Minimap`, `ZoomControls`, `AnimationTimeline`, `Canvas`, `AppWindow`, `TerminalDrawer`, `CommandPalette`, `HudsonContextMenu`, design tokens.

### From `hudsonkit/context-menu`

- `HudsonContextMenu` — right-click menu component. Pulls `motion/react` + `@base-ui-components/react`.

## Platform adapter (from `hudsonkit`)

- `WEB_ADAPTER` — default web platform adapter
- `PlatformProvider` — wraps a subtree with a specific adapter
- `usePlatform()`, `usePlatformLayout()` — consumer hooks
- Types: `PlatformAdapter`, `PlatformLayout`

## Utilities (from `hudsonkit`)

- `sounds` — Web Audio event sounds: `blipUp`, `blipDown`, `click`, `whoosh`, `thock`, `pop`, `confirm`, `error`, `chime`, `tick`, `slideIn`, `slideOut`, `boot`, `ping`, `type`
- `logEvent`, `FRAME_LOG_EVENT` — instrumented event bus
- `FrameLogEntry` type
- `worldToScreen`, `screenToWorld` — canvas coordinate math
- `deriveManifest(app)` — build an `AppManifest` from a `HudsonApp`

## The `HudsonApp` interface at a glance

```ts
interface HudsonApp {
  // Identity
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';

  // Panel config
  leftPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };
  rightPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };

  // State owner
  Provider: React.FC<{ children: ReactNode; disabled?: boolean }>;

  // Right sidebar tool accordion
  tools?: AppTool[];

  // Slots
  slots: {
    Content: React.FC;
    LeftPanel?: React.FC;
    RightPanel?: React.FC;              // @deprecated — use Inspector
    Inspector?: React.FC;
    LeftFooter?: React.FC;
    Terminal?: React.FC;
  };

  // Shell bridge
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

  // Optional integrations
  intents?: AppIntent[];
  manifest?: AppManifest;
  settings?: AppSettingsConfig;
  ports?: AppPorts;
  services?: ServiceDependency[];
}
```

See [Building apps](./building-apps.md) for a walkthrough.
