# HUD-008: Web-Backed Native Surfaces

Hudson native apps can host selected web views when the web renderer is the
right tool: CodeMirror, markdown preview, docs, OAuth handoffs, trace viewers,
or other compact tools that do not need to become native SwiftUI immediately.

The native app owns chrome, placement, lifecycle, loading state, and permissions.
The web surface owns the renderer.

## Loading Policies

Hudson uses three loading policies.

| Policy | Source | Best for |
| --- | --- | --- |
| `bundled` | Static HTML/JS/CSS in the app bundle | Offline tools, CodeMirror, markdown, stable onboarding |
| `paired` | Trusted local or paired host URL | Dogfooding, fast React iteration, local APIs |
| `hosted` | Deployed Hudson URL | Docs, shareable embeds, non-private content |

The surface id should stay stable across policies. For example, `code-editor`
can be paired during development and bundled for a release build.

## Native Contract

Use `HudWebSurfaceDescriptor` to describe the surface:

```swift
let descriptor = HudWebSurfaceDescriptor(
    id: "code-editor",
    title: "Code Editor",
    location: .paired(URL(string: "http://hudson.local:3500/native/surfaces/code-editor")!),
    lifecycle: .keepWarm
)
```

Then mount it through `HudWebSurface`, which resolves to the existing
`HudWebView` wrapper:

```swift
HudWebSurface(
    descriptor,
    state: $webState,
    configuration: HudWebViewConfiguration(
        usesNonPersistentDataStore: true,
        isInspectable: true
    )
)
```

For bundled surfaces, ship compiled assets and point the descriptor at the
resource directory:

```swift
HudWebSurfaceDescriptor(
    id: "markdown-preview",
    location: .bundled(directory: "HudsonWebSurfaces/markdown-preview")
)
```

This resolves `HudsonWebSurfaces/markdown-preview/index.html` from the app
bundle. The HTML should load its compiled JavaScript and CSS with relative URLs.

## URL Shape

The URL identifies the renderer, not the whole state payload.

Preferred route shape:

```text
/native/surfaces/:surfaceId
```

Small route selectors are fine in the URL, but large props should move through
the native bridge.

## Props And Bridge

The durable bridge shape is:

1. Web posts `ready`.
2. Native sends typed `props`.
3. Web posts typed events such as `change`, `save`, `height`, or `open`.

The CodeMirror surface in `HudsonCanvasSurface` is the current concrete
example: bundled HTML/JS, a `ready/change/save` message handler, and native
save acknowledgements.

## Lifecycle

`HudWebView` already stops loading, detaches delegates, removes script handlers
where applicable, and clears content on dismantle.

Use:

- `ephemeral` for iOS sheets, one-shot auth, docs, and surfaces unlikely to be
  reopened immediately.
- `keepWarm` for macOS slots, canvas nodes, or code editors where a quick reopen
  is likely.

Hosts decide how much `keepWarm` means. It is a hint, not a requirement.

## Platform Notes

iOS should prefer bundled or paired surfaces and tear down aggressively. This
keeps memory predictable and avoids accidental server dependencies.

macOS can keep more surfaces warm and may use paired URLs heavily while the app
is being dogfooded.

Hosted surfaces are useful, but they should not be the default for private local
workspace data.
