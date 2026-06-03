# Native canvas workspace

> A draft extraction spec for HudsonKit on macOS/iPad: standalone native apps should be one wrapper away from living inside a canvassable multi-app workspace.

## North star

Native Hudson apps should not be dead-end demos. An app should define its identity, state owner, slots, commands, and canvas participation once. The same declaration should run in:

- `HudAppShell` as a focused standalone app.
- `HudWorkspaceShell` as one app among many.
- A canvas window/card host without rewriting the app body.

The `apps/hudson` app is the pressure test: many heavyweight Termini surfaces expose whether the native canvas primitives are stable enough for real work. The durable runtime identity direction is tracked separately in [tmux + Graphite workspaces](./tmux-graphite-workspaces.md).

## Proposed layers

### 1. App declaration

The native shape should mirror the web `HudsonApp` contract, but use Swift-friendly values instead of React hooks:

```swift
public struct HudNativeApp<Content: View, Inspector: View, Terminal: View> {
    public var id: String
    public var name: String
    public var mode: HudFrameMode
    public var canvasParticipation: HudCanvasParticipation
    public var manifest: HudAppManifest
    public var commands: @MainActor () -> [HudCommand]
    public var status: @MainActor () -> HudStatus
    public var content: @MainActor (HudAppContext) -> Content
    public var inspector: @MainActor (HudAppContext) -> Inspector
    public var terminal: @MainActor (HudAppContext) -> Terminal
}
```

The important rule: the `@main App` is only a host. App state and app declaration live in importable types, so a standalone app can later be registered in a workspace by changing the host, not the feature.

### 2. Workspace declaration

```swift
public struct HudNativeWorkspace {
    public var id: String
    public var name: String
    public var mode: HudFrameMode
    public var apps: [HudWorkspaceApp]
    public var defaultFocusedAppID: String?
}

public struct HudWorkspaceApp {
    public var appID: String
    public var canvasMode: HudCanvasParticipation
    public var defaultBounds: CGRect
}
```

`HudWorkspaceShell` owns chrome, focus, persistence, viewport, and cross-app commands. Apps still own their own data.

### 3. Viewport state

`HudCanvasViewportState` is shared by terminal canvases, app workspaces, graph editors, and other spatial tools:

```swift
public struct HudCanvasViewportState: Codable, Equatable {
    public var pan: CGSize
    public var scale: CGFloat
    public var tool: HudCanvasTool
    public var selectedIDs: Set<String>
}

public enum HudCanvasTool: String, Codable {
    case select
    case hand
}
```

Required behavior:

- Trackpad pinch zoom on macOS.
- Trackpad scroll up/down zooms around the cursor or gesture anchor.
- Horizontal trackpad scroll pans when it is not claimed by a live surface.
- Zoom range should be intentionally expansive, supporting planetary zoom-out and deep zoom-in rather than a narrow demo clamp.
- Bottom-right zoom tool with out, percent, in, fit.
- Bottom-left minimap shows world bounds, nodes, selection, current viewport, and a fit-world action.
- Status bar exposes the current viewport in world coordinates.
- Hand mode pans the world.
- Select mode supports click selection and marquee selection.
- Left navigation owns canvas filters and node selection.
- Right inspector owns selected-node detail only; it is not the node navigator.
- Navigator and inspector panels are resizable and dismissible, with header affordances to restore them.
- Space-held temporary hand mode can come later, matching web.
- Viewport state persists per workspace/app id.

### 4. Canvas items

Canvas-hosted things need stable identity and model-owned geometry:

```swift
public protocol HudCanvasNode: Identifiable {
    var id: String { get }
    var bounds: CGRect { get set }
    var zIndex: Double { get set }
}
```

Z-order must not be represented by array reordering during interaction. Selection should update `zIndex` or a small overlay ordering field so heavyweight hosted views keep their identity.

### 5. Canvas host

`HudCanvasViewport` provides the common input layer:

```swift
HudCanvasViewport(
    state: $viewport,
    nodes: $nodes,
    grid: .hudson,
    onCommit: persist
) { node, context in
    HudCanvasCard(node: node, context: context) {
        app.content(context.appContext)
    }
}
```

The host owns coordinate conversion, hit testing, marquee selection, gestures, zoom controls, and persistence hooks. The app supplies content.

## Web parity

| Capability | Web source | Native target |
|---|---|---|
| Pan/zoom state | `Canvas`, `WorkspaceShell` | `HudCanvasViewportState` |
| World/screen math | `viewport.ts` | `HudCanvasTransform` |
| Drag/resize | `AppWindow` | `HudCanvasCard` |
| Zoom HUD | `ZoomControls` | `HudCanvasZoomTool` |
| Persistence | `usePersistentState` / debounced state | `UserDefaults` / debounced commits |
| Selection tools | workspace canvas behavior | `HudCanvasTool.select` / `.hand` |
| Heavy surface stability | refs + direct DOM writes | gesture-local state + commit-on-end |

## Performance rules

The Termini sample makes these rules non-negotiable:

- Do not create PTYs or other process resources from transient SwiftUI view construction.
- Do not run process/file I/O in gesture handlers.
- Do not reorder arrays of heavyweight views to bring an item forward.
- During drag/resize/pan, keep gesture deltas in transient state and commit durable geometry at the end, or on a throttle.
- Keep hosted NSViews stable by id; prefer transforms/position changes over tearing down representables.
- Hit testing should use cached node bounds. Marquee selection should not ask every terminal surface to participate.
- The grid should remain a cheap drawing primitive, not a large SwiftUI tree.

## Persistence

Use predictable keys so standalone and workspace hosts can share placement:

| Key | Purpose |
|---|---|
| `hudson.native.app.{appID}.viewport` | Standalone app viewport |
| `hudson.native.ws.{workspaceID}.viewport` | Workspace viewport |
| `hudson.native.ws.{workspaceID}.node.{nodeID}.bounds` | Window/card placement |
| `hudson.native.ws.{workspaceID}.focus` | Focused app/node |

Persistence should be debounced and explicit. Gesture frames are not persistence frames.

## Extraction plan

1. Keep improving `apps/hudson` until 64 Termini nodes can pan, zoom, select, and move without beach-ball pauses.
2. Extract the viewport state, transform helpers, zoom HUD, hand/select tool model, and marquee hit testing into `HudsonShell`.
3. Replace the sample's local viewport with `HudCanvasViewport`.
4. Introduce `HudNativeApp` and a minimal `HudWorkspaceShell` that can host one app in standalone mode or many apps in canvas mode.
5. Move terminal-specific pieces behind `HudTerminalCanvas` once the generic canvas host is proven.

## Acceptance bar

- The Termini sample can create an 8x8 grid of real local PTY terminals and still pan/zoom/select responsively.
- Bringing a terminal forward does not recreate or reorder terminal views.
- A standalone native app can be registered in a workspace without moving its state or rewriting its content view.
- Placement and viewport survive relaunch.
- The API names map cleanly to the web Hudson concepts, so web and native docs can explain one model with platform-specific implementations.
