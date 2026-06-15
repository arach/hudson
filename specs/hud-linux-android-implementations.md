# Hudson Linux and Android Implementations

## Status

Draft. This spec defines platform implementation direction, package boundaries, and acceptance criteria for Linux desktop and Android Hudson hosts. It is design-only; implementation code should land in follow-up tasks.

## Purpose

Hudson should feel like one workspace system across web, Apple, Linux, and Android. Linux and Android implementations should preserve the Hudson mental model rather than becoming separate products:

- The shell owns chrome, workspace composition, windowing, side panels, command palette, status/terminal surfaces, and persistence policy.
- Apps expose capabilities through a HudsonApp-like contract with Providers, slots, hooks, intents, services, and optional ports.
- Native hosts add platform reach, not alternate app architecture.

Existing web Hudson remains the reference implementation for shell behavior. Apple HudsonKit remains the reference for native package shape and platform adapters. Linux and Android should reuse those concepts while respecting each platform's input, process, storage, and background execution constraints.

## Product Intent

### Linux

Linux Hudson is a desktop workspace host for developers who want Hudson shell parity on local machines. It should run the same web shell and TypeScript app catalog where possible, then add native desktop integration for terminal/process control, filesystem access, tray state, notifications, global shortcuts, and packaging.

The Linux target is not a new Linux-only IDE. It is Hudson with a Linux host bridge.

### Android

Android Hudson starts as a companion surface for an existing desktop or web Hudson session, then grows toward a touch-first shell for selected apps. It should support pairing, notifications, quick command execution, read-only workspace inspection, and lightweight app interactions before attempting full multi-window parity on small screens.

The Android target is not a replacement for desktop Hudson in v0. It is the mobile edge of the same workspace system.

## Shared Concepts To Preserve

All platform hosts must preserve these Hudson concepts:

- **HudsonApp-like contract:** apps declare identity, Provider/state owner, slots, hooks, intents, services, ports, and persistence namespaces.
- **Shell chrome ownership:** platform apps do not draw top-level nav, command palette, shell panels, status bar, or workspace switching chrome.
- **Workspaces:** a workspace is serialized composition: apps, instances, layout mode, window bounds, focus, and platform-safe persistence.
- **Slots and hooks:** apps expose UI and state to the shell through stable slot and hook names. Native hosts may adapt the rendering surface, but not the ownership boundary.
- **Canvas and windowing:** canvas mode remains a shell feature. Native hosts may map it to platform window affordances or touch-first snapping, but apps should not manage outer windows directly.
- **Intents:** intents remain static, serializable declarations. Runtime execution bridges intents back into live app commands through the active shell.
- **Services:** process, filesystem, network, AI, pairing, and terminal capabilities are requested through shell-owned service adapters.
- **Persistence:** app-owned state stays namespaced by app id; shell-owned workspace state stays namespaced by workspace id and instance id.

## Recommended Package Shape

Proposed additions:

```text
apps/
  linux/                          # Linux desktop host app
  android/                        # Android application shell or companion

packages/
  native/
    linux/
      HudsonKitLinux/             # Desktop host bridge, packaging helpers
    android/
      HudsonKitAndroid/           # Kotlin/Compose/WebView host bridge
  protocol/
    hudson-host/                  # Shared host bridge messages and schemas
```

The shared protocol package should define messages and schemas that cross the web/native boundary. Platform packages should own only platform bindings and adapters.

## API Contracts

### TypeScript host bridge

```ts
export interface HudsonHostBridge {
  platform: "web" | "macos" | "ios" | "linux" | "android";
  capabilities(): Promise<HudsonHostCapabilities>;
  invoke<TInput, TOutput>(intent: HudsonHostIntent<TInput>): Promise<TOutput>;
  subscribe<TEvent>(topic: HudsonHostTopic, handler: (event: TEvent) => void): () => void;
}

export interface HudsonHostCapabilities {
  terminal?: "none" | "relay" | "native-pty";
  filesystem?: "none" | "scoped" | "workspace";
  notifications?: boolean;
  globalShortcuts?: boolean;
  backgroundExecution?: "none" | "limited" | "service";
}
```

### Linux desktop host sketch

```ts
export interface HudsonLinuxHost {
  openWorkspace(path: string): Promise<void>;
  spawnService(spec: HudsonServiceSpec): Promise<HudsonServiceHandle>;
  createPty(options: HudsonPtyOptions): Promise<HudsonPtySession>;
  registerGlobalShortcut(shortcut: string, commandId: string): Promise<void>;
  setTrayState(state: HudsonTrayState): Promise<void>;
}
```

### Android host sketch

```kotlin
interface HudsonAndroidHost {
  val capabilities: HudsonHostCapabilities
  suspend fun pairWithHost(payload: HudsonPairingPayload): HudsonPairingSession
  suspend fun invoke(intent: HudsonHostIntent): HudsonHostResult
  fun observeNotifications(): Flow<HudsonNotification>
  fun openScopedDocument(request: HudsonDocumentRequest): HudsonDocumentHandle
}
```

## Linux Implementation

### Options

- **Browser/PWA only:** fastest path, minimal native integration, but weak terminal, tray, global shortcut, filesystem, and packaging story.
- **Electron host:** high compatibility and mature desktop APIs, but heavy runtime and another Chromium shell around a web-first product.
- **Tauri/Wry host:** lighter desktop host with native packaging and a web UI surface. Requires careful Linux WebKitGTK support and host bridge design.
- **Native GTK/Qt shell:** strongest native fit, but highest risk because it duplicates shell UI and diverges from the web reference.

### Recommended Path

Use a lightweight desktop host that embeds the existing web shell and exposes a typed host bridge. Tauri/Wry is the preferred v1 direction if WebKitGTK behavior is acceptable for Hudson's canvas and terminal surfaces. Electron remains the compatibility fallback if embedded WebKit blocks core shell features.

The Linux host should:

- Serve or load the Hudson web shell without forking shell concepts.
- Expose terminal/process operations through a host-owned PTY adapter.
- Route service lifecycle through the existing services model instead of app-local process spawning.
- Provide a tray item for session health, active workspace, and quit/reopen actions.
- Register global shortcuts for command palette, show/hide, and focused workspace actions.
- Use scoped filesystem grants, with explicit workspace roots and no broad hidden access.
- Package first as AppImage for broad testing, then evaluate Flatpak, deb, and rpm once permissions and service spawning are stable.

### Linux Constraints

- Wayland and X11 have different global shortcut and window activation behavior. Treat global shortcuts as best-effort capability flags.
- Terminal and process integration must not bypass the shell service registry.
- Filesystem access should be workspace-root scoped and visible in UI.
- Native menus, tray, and notification support vary by desktop environment.
- Packaging should not require users to install a second browser manually.

## Android Implementation

### Options

- **Companion app:** pairs with desktop/web Hudson, receives workspace state, shows status, commands, notifications, and selected app surfaces.
- **WebView shell:** runs the Hudson web workspace inside Android WebView with a Kotlin bridge for storage, share sheets, notifications, and pairing.
- **Compose-native shell:** reimplements shell chrome and app surfaces in Kotlin/Compose. Strong native feel, but high divergence risk.
- **Hybrid shell:** WebView owns the Hudson workspace; Compose owns system-adjacent surfaces such as pairing, permission gates, notifications, and document pickers.

### Recommended Path

Start with a companion app, then graduate to a hybrid WebView plus Kotlin bridge shell for selected workspaces. Avoid a Compose-native reimplementation of shell chrome until the cross-platform host protocol is stable and there is a clear app-by-app native rendering need.

Android v0 should:

- Pair to an existing desktop/web Hudson session through HudPairing.
- Show active workspace, active app, command list, status entries, and notifications.
- Allow safe remote intent execution for approved commands.
- Provide mobile-specific slots such as quick actions, inbox/status, and companion controls.
- Persist pairing and local preferences in Android encrypted storage.

Android v1 should:

- Run selected Hudson workspaces in WebView with a typed Kotlin bridge.
- Adapt shell chrome to touch: command palette as search sheet, side panels as bottom sheets, status as compact bottom rail, and canvas windows as snap/focus surfaces.
- Support Android share targets, document picker, notifications, and limited background sync.
- Respect Android background limits by using foreground services only for user-visible long-running work.

### Android Constraints

- Background execution is limited. Long-running tasks should stay on the paired host unless explicitly foregrounded.
- Filesystem access goes through scoped storage and document providers.
- Multi-window canvas behavior must be touch-first. Tiny draggable desktop windows should collapse into focus, split, or card-based layouts on phone screens.
- Push notifications and local notifications need separate permission and lifecycle handling.
- WebView can run Hudson app UI, but native bridges must validate all host intents and payloads.

## Cross-Platform Protocol Boundary

The shared protocol should be data-first and host-neutral:

- `WorkspaceSnapshot`: current workspace id, app instances, focus, mode, shell status, and visible commands.
- `HostIntent`: typed request for terminal, filesystem, notification, pairing, service, or app command execution.
- `HostEvent`: status changes, service output, notification taps, pairing state, file grants, and command results.
- `CapabilityManifest`: platform capabilities and permission state.
- `PersistenceEnvelope`: app namespace, key, version, value, origin platform, and conflict metadata.

Rules:

- Web shell code can ask for capabilities; platform packages decide whether and how to fulfill them.
- Native packages must not import app internals.
- Apps must not call platform APIs directly when a Hudson service exists.
- The protocol should be serializable over WebView bridges, local RPC, and pairing channels.

## Persistence Model

- Shell workspace state remains keyed by workspace id and app instance id.
- App state remains keyed by app id and app-controlled keys.
- Linux may use local app data plus workspace-root references for explicit project state.
- Android stores local companion state, pairing credentials, and mobile preferences locally, but desktop-owned workspace state remains authoritative in companion mode.
- Cross-device sync should use versioned envelopes and conflict metadata. Do not imply CRDT convergence in v1.

## Roadmap

### v0: Read-only and companion

- Linux launches the web shell in a packaged host or documented local shell path.
- Android pairs with an existing Hudson host.
- Shared protocol defines workspace snapshots, command lists, status, notifications, and safe intent execution.
- No native app rewrite.

### v1: Shell parity

- Linux ships native host bridge for PTY, services, tray, notifications, global shortcuts, and scoped filesystem grants.
- Android ships hybrid WebView shell for selected workspaces.
- Touch adaptations for command palette, panels, status, and canvas focus mode are implemented.
- Host capability detection is surfaced to the shell and apps.

### Later: Native deep integrations

- Linux adds richer desktop environment integration, app menus, file watchers, and optional Flatpak/deb/rpm channels.
- Android adds share sheet workflows, widgets, foreground service flows, and selected native app surfaces where they materially improve the experience.
- Cross-device persistence and sync policy is revisited once real usage exposes conflict patterns.

## Non-Goals

- Rebuilding Hudson shell chrome separately in GTK, Qt, or Compose for v1.
- Giving apps direct platform API access outside Hudson services.
- Guaranteeing identical desktop window behavior on Android phone screens.
- Promising background execution on Android without user-visible foreground affordances.
- Designing enterprise deployment, policy management, or hardened multi-tenant security.

## Acceptance Criteria

- A Linux host can launch Hudson, load the existing app registry, and preserve shell ownership of chrome.
- Linux exposes terminal/process, notification, tray, global shortcut, and filesystem capabilities through typed host services.
- Android can pair with a Hudson host and display workspace status, commands, notifications, and approved intent results.
- Android v1 can run a selected workspace in WebView with a Kotlin bridge and touch-first shell adaptations.
- The shared protocol package contains schemas for capabilities, workspace snapshots, host intents, host events, and persistence envelopes.
- Apps can feature-detect host capabilities without branching on platform names where possible.
- All persistence keys remain namespaced and migration-safe.
- Documentation clearly marks companion-only, shell-parity, and future-native features.

## Open Questions

- Should Linux commit to Tauri/Wry first, or use Electron until canvas, terminal, and WebView behavior are proven across distributions?
- Which Android surfaces must exist in v0: command execution, notifications, app previews, terminal tailing, or workspace switching?
- Should Android full-shell support target tablets first, with phones remaining companion-first?
- How much of HudPairing should be reused for Android-to-desktop control versus a new relay-backed channel?
- What is the minimum stable host protocol needed before Apple, Linux, Android, and web all consume the same definitions?
- Which app categories should be blocked from Android WebView shell mode until they provide touch-safe slots?
- Where should cross-device persistence conflicts be shown: shell status, command palette, or a dedicated sync surface?
