# API Reference

Every `hudsonkit` export, organized by subpath. Types are authoritative in [`packages/web/hudsonkit/src/types/`](../packages/web/hudsonkit/src/types/); this doc is a map, not the source of truth.

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
| `hudsonkit/controls`            | `ParamSection`, `ParamSlider`, `ParamToggle`, `ParamColor`, `ParamEnum`, `ParamText`, `ParamRepeatable`, `ParamGrid`, `CodeViewer`, `CodeEditor` — see controls.md |
| `hudsonkit/cache`               | `createHudsonCache`, `hudsonCache`, `useCachedResource` — TTL/SWR cache with tag invalidation; see [Cache](./cache.md) |
| `hudsonkit/voice`               | Opt-in voice plugin — see voice.md                                   |
| `hudsonkit/observability`       | `HLogger`, `HMetrics`, `HObservability`, `HSpan`, `HTrace` — see observability.md |

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
| `TakeoverState`                   | Return type of `useTakeover` hook — `{ active, dismissible, onDismiss? }` |
| `MultiInstanceMode`               | `'singleton' \| 'spawnable' \| 'duplicable'` |
| `HudsonWorkspace`, `WorkspaceAppConfig`, `CanvasParticipation` | `types/workspace.ts` |
| `AppIntent`, `IntentCategory`, `IntentParameter`, `CatalogAppEntry`, `IntentCatalog` | `types/intent.ts` |
| `ServiceDefinition`, `ServiceDependency`, `ServiceRecord`, `ServiceAction`, `ServiceStatus` | `types/service.ts` |
| `AppOutput`, `AppInput`, `AppPorts`, `PipeDefinition` | `types/port.ts`                   |
| `CommandOption`, `ContextMenuEntry`, `ContextMenuAction`, `ContextMenuSeparator`, `ContextMenuGroup` | `components/overlays` |
| `HudsonTheme`                     | `'light' \| 'dark' \| 'system'`           |
| `HudsonTemplate`                  | `'hudson' \| 'editorial'`                 |

## Hooks (from `hudsonkit`)

| Hook                                              | Purpose                                        |
|---------------------------------------------------|------------------------------------------------|
| `usePersistentState<T>(key, initial)`             | localStorage-backed state, SSR-safe, cross-tab |
| `useDebouncedPersistentState<T>(key, initial, ms)` | Like above, with write debounce               |
| `useSaveIndicator()`                              | Status indicator for save operations           |
| `useAppSettings<T>(appId)`                        | Read/write current app's settings              |
| `useHudsonAI(options)`                            | Chat transport for the workspace AI panel      |
| `useAssistant(options)`                           | Wires app intents + commands to an AI chat; see Assistant section below |
| `useCachedResource(key, loader, options?)`        | Subscribed async resource cache read; see Cache section below |
| `useTerminalRelay(options)`                       | WebSocket bridge to the terminal relay server  |
| `useTheme()`                                      | Read/set current theme and template; throws outside `ThemeProvider` |
| `useOptionalTheme()`                              | Like `useTheme()` but returns `null` outside provider |
| `useInstance()`                                   | Returns `{ instanceId, appId }`; throws outside `InstanceProvider` |
| `useOptionalInstance()`                           | Like `useInstance()` but returns `null` outside provider |

Returned types (also exported): `AppSettingsValues`, `HudsonAIChat`, `UseHudsonAIOptions`, `AIAttachment`, `AssistantChat`, `UseAssistantOptions`, `TerminalRelayHandle`, `UseTerminalRelayOptions`, `RelayStatus`.

## Cache (from `hudsonkit/cache`)

`hudsonkit/cache` is the shared cache substrate for values that can be refetched or recomputed. It supports TTL, stale-while-revalidate windows, in-flight async dedupe, tag invalidation, optional local/session storage, hydrate/dehydrate, and subscribed React reads.

| Export | Kind | Description |
|---|---|---|
| `createHudsonCache(options?)` | Factory | Create a scoped cache with namespace, default TTL/SWR, `maxEntries`, optional storage, and a custom clock. |
| `hudsonCache` | Instance | Default memory cache with `namespace: 'hudson'`. |
| `useCachedResource(key, loader, options?)` | Hook | Read/load a cache entry and subscribe to writes, deletes, and invalidations. |

Cache instances expose `read`, `get`, `has`, `set`, `getOrLoad`, `revalidate`, `delete`, `clear`, `invalidateTag`, `keys`, `prune`, `dehydrate`, `hydrate`, and `subscribe`.

Types: `HudsonCache`, `HudsonCacheEntry`, `HudsonCacheRead`, `HudsonCacheEvent`, `HudsonCacheStatus`, `HudsonCacheStorage`, `HudsonCacheLoadOptions`, `HudsonCacheSetOptions`, `HudsonCacheOptions`, `HudsonCacheLoader`, `CachedResourceStatus`, `UseCachedResourceOptions`, `UseCachedResourceResult`.

See [Cache](./cache.md) for the policy guidance: when to use Hudson's primitive, when to keep data in Provider state, and when to reach for TanStack Query, IndexedDB, Cache API, or Next.js caching instead.

## Components

### From `hudsonkit`

- `AI` — chat panel component, paired with `useHudsonAI`
- `Assistant` — assistant panel component, paired with `useAssistant`
- `TerminalRelay`, `captureWorkspace` — terminal relay component + screenshot helper
- `ZoomControls` — reusable widget (also re-exported from `/chrome`)

### From `hudsonkit/app-shell`

#### `AppShell` props

| Prop              | Type               | Default      | Description                                                               |
|-------------------|--------------------|--------------|---------------------------------------------------------------------------|
| `app`             | `HudsonApp`        | —            | Required. The app to render.                                              |
| `assistant`       | `boolean`          | `true`       | Enable the built-in Assistant tab in the bottom drawer.                   |
| `defaultTheme`    | `HudsonTheme`      | `'system'`   | Initial theme; user can switch at runtime.                                |
| `defaultTemplate` | `HudsonTemplate`   | `'hudson'`   | Initial template.                                                         |
| `managedTheme`    | `boolean`          | `true`       | When `false`, assumes a parent `ThemeProvider` already exists.            |

### From `hudsonkit/shell` (back-compat barrel)

All of: `WorkspaceShell`, `AppShell`, `Frame`, `NavigationBar`, `SidePanel`, `StatusBar`, `CommandDock`, `Minimap`, `ZoomControls`, `AnimationTimeline`, `Canvas`, `AppWindow`, `TerminalDrawer`, `CommandPalette`, `HudsonContextMenu`, design tokens.

### From `hudsonkit/context-menu`

- `HudsonContextMenu` — right-click menu component. Pulls `motion/react` + `@base-ui-components/react`.

## Theme (from `hudsonkit`)

| Export               | Kind      | Description                                                       |
|----------------------|-----------|-------------------------------------------------------------------|
| `ThemeProvider`      | Component | Wraps a subtree; manages `data-hudson-theme` / `data-hudson-template` on root. |
| `HudsonThemeScript`  | Component | Inline script for SSR flash-free theme init. Render before `<body>`. |
| `useTheme`           | Hook      | Returns `{ theme, resolvedTheme, template, setTheme, setTemplate }`. Throws outside provider. |
| `useOptionalTheme`   | Hook      | Same return shape, or `null` outside provider.                    |

Types: `HudsonTheme`, `HudsonTemplate`, `ThemeProviderProps`.

`ThemeProviderProps`: `{ children, defaultTheme?, defaultTemplate?, storageKey?, rootElement? }`.

See [Theming](./theming.md) for usage.

## Instance context (from `hudsonkit`)

| Export                | Kind      | Description                                                    |
|-----------------------|-----------|----------------------------------------------------------------|
| `InstanceProvider`    | Component | `{ instanceId, appId, children }` — scopes per-instance state. |
| `useInstance`         | Hook      | Returns `InstanceContextValue`; throws outside provider.       |
| `useOptionalInstance` | Hook      | Returns `InstanceContextValue \| null`.                        |

Types: `InstanceContextValue` — `{ instanceId: string; appId: string }`.

## Assistant (from `hudsonkit`)

- `Assistant` — panel component. Props: `{ app: HudsonApp; commands: CommandOption[] }`. Renders a chat UI wired to the app's declared intents.
- `useAssistant(options)` — lower-level hook. Builds context from `app.intents`, wires a `dispatch` tool call to the live `commands` array, delegates to `useHudsonAI` internally.

| `UseAssistantOptions` field | Type                           | Description                                        |
|-----------------------------|--------------------------------|----------------------------------------------------|
| `app`                       | `HudsonApp`                    | Required.                                          |
| `commands`                  | `CommandOption[]`              | Live commands from `app.hooks.useCommands()`.      |
| `state`                     | `Record<string, unknown>`      | Optional snapshot included in model context.       |
| `provider`                  | `string`                       | Provider override (e.g. `'anthropic'`).            |
| `model`                     | `string`                       | Model override.                                    |
| `onFinish`                  | `ChatOnFinishCallback`         | Called when an assistant turn finishes.            |

`AssistantChat` is an alias for `HudsonAIChat`.

Note: `useAssistant` is app-intent aware; `useHudsonAI` is the lower-level workspace AI panel transport.

## Observability (from `hudsonkit`)

| Export                  | Kind     | Description                                              |
|-------------------------|----------|----------------------------------------------------------|
| `HLogger`               | Class    | Structured log emitter.                                  |
| `HMetrics`              | Class    | Metric counter/gauge/histogram emitter.                  |
| `HObservability`        | Class    | Core bus; call `HObservability.global()` for the default instance. |
| `HObservabilityDefault` | Instance | Pre-built `HObservability.global()` singleton.           |
| `HSpan`                 | Class    | Active trace span handle.                                |
| `HTrace`                | Class    | Trace builder.                                           |

Exported types: `HLogEvent`, `HLogInput`, `HLogLevel`, `HMetricEvent`, `HMetricInput`, `HMetricType`, `HObservabilityOptions`, `HObservation`, `HObservationBase`, `HObservationData`, `HObservationKind`, `HObservationSink`, `HObservationTags`, `HSubscribeOptions`, `HTraceInput`, `HTraceSpan`, `HTraceStatus`, `HUnsubscribe`.

These are advanced — refer to `src/observability.ts` and `hudsonkit/observability` for the full surface.

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
- `probeVoxAvailability()` — check voice availability; returns `VoxAvailability`

## The `HudsonApp` interface at a glance

```ts
interface HudsonApp {
  // Identity
  id: string;
  name: string;
  description?: string;
  mode: 'canvas' | 'panel';
  icon?: ReactNode;

  // Multi-instance behaviour (default: 'singleton')
  multiInstance?: MultiInstanceMode; // 'singleton' | 'spawnable' | 'duplicable'

  // Panel config
  leftPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };
  rightPanel?: { title: string; icon?: ReactNode; headerActions?: React.FC };

  // State owner — disabled/visible/focused reflect workspace mount state
  Provider: React.FC<{ children: ReactNode; disabled?: boolean; visible?: boolean; focused?: boolean }>;

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
    /** Full-viewport overlay rendered above shell chrome. Shell marks
     *  background `inert` + `aria-hidden` while active. */
    Takeover?: React.FC;
  };

  // Shell bridge
  hooks: {
    useCommands: () => CommandOption[];
    useStatus: () => { label: string; color: StatusColor };
    useSearch?: () => SearchConfig;
    useNavCenter?: () => ReactNode | null;
    useNavActions?: () => ReactNode | null;
    useLayoutMode?: () => 'canvas' | 'panel' | 'focus';
    useActiveToolHint?: () => string | null;
    usePortOutput?: () => (portId: string) => unknown | null;
    usePortInput?: () => (portId: string, data: unknown) => void;
    /** Return active:true to mount Takeover above chrome. Shell is
     *  stateless about dismissal — the hook's own state drives it. */
    useTakeover?: () => TakeoverState | null;
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
