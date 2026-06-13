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

The bundled CodeMirror editor is the primary concrete example: HTML/JS shipped
in `HudsonUIWeb/Resources/HudsonCodeMirror/`, a `ready/change/save` message
handler, and native save acknowledgements.

### Bundled CodeMirror (`HudCodeMirror` / `HudCodeMirrorWebView`)

The native code pane is **CodeMirror** — bundled `@codemirror/*` in
`HudsonUIWeb/Resources/HudsonCodeMirror/`. Build from the monorepo root:

```bash
bun run build:native-editor
```

Prefer the SwiftUI wrapper for chromeless Explorer editing (CodeMirror only):

```swift
HudCodeMirror(document: doc, mode: $mode) { text in
    try save(text)
}
```

Drop to the web view directly when you need full bridge control (Canvas nodes):

```swift
HudCodeMirrorWebView(
    document: HudCodeMirrorDocument(
        id: file.id,
        title: file.title,
        path: file.uri,
        language: file.language,
        text: file.value,
        readOnly: mode != .edit,
        embedded: true   // hide bundled HTML header; native chrome owns title/path
    ),
    onChange: { text in document.value = text },
    onSave: { text in try save(text) },
    onBridgeState: { state in editorReady = state == "rendered" }
)
```

Loading notes:

- Prefer `loadFileURL` on the bundled `index.html` so relative assets resolve.
- Probe until `window.__hudsonCodeMirror` exists before calling `setDocument`.
- Do not rely on `<script src="./editor.js">` with `loadHTMLString` — inject
  `editor.js` via `WKUserScript` or `inlinedPageHTML()` instead.
- On macOS, pin the web view inside a container with a non-zero `minHeight`
  (`HudLayout.textDocumentPreviewHeight`) when used inside split views.

Bridge sequence:

1. Web posts `ready` through `hudsonCodeMirror`.
2. Native sends `setDocument` (base64 JSON payload).
3. Web posts `rendered`, then `change` / `save` as the user edits.

Set `embedded: true` when native SwiftUI chrome already shows the file title and
path. The HTML shell hides its header in that mode.

For the full IDE split (file tree + CodeMirror), use `HudFileExplorer` — see
[HUD-009](./HUD-009-file-explorer.md).

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
