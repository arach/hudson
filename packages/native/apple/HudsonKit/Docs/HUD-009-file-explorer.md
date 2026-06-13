# HUD-009: File Explorer

Chromeless IDE layout for native Hudson apps: a keyboard-navigable file tree
beside a CodeMirror editor for all text files (code, markdown, plain text).

## Components

| Type | Module | Role |
| --- | --- | --- |
| `HudFileTreeBrowser` | HudsonUI | Loads and caches file tree state |
| `HudFileTree` | HudsonUI | Native tree view with arrow-key navigation |
| `HudCodeMirror` | HudsonUIWeb | Chromeless CodeMirror editor (SwiftUI) |
| `HudCodeMirrorWebView` | HudsonUIWeb | WKWebView bridge to bundled CodeMirror |
| `HudFileExplorerModel` | HudsonUIWeb | Browser + open document + read/edit mode |
| `HudFileExplorer` | HudsonUIWeb | Split tree + preview layout |

Use the pieces independently when you only need a tree or CodeMirror. Compose
`HudFileExplorer` when you want the full IDE split.

## Chromeless Contract

`HudFileTree` and `HudCodeMirror` ship **without** decoration:

- No `HudCard` around the tree or editor panes
- No folder header or keyboard hint strip inside the tree
- No per-file title bar, path row, or save/mode controls inside the editor
- CodeMirror uses `HudCodeMirrorDocument(embedded: true)` so the bundled HTML
  header stays hidden
- Markdown and code both route through `HudCodeMirror` — `@codemirror/lang-markdown`
  handles `.md` / `.mdx` highlighting in the same warm web view

The host owns outer chrome: workspace roots, breadcrumbs, file actions, and
toolbars. The demo wires these in `ExplorerTab` above `HudFileExplorer`.

## Model

`HudFileExplorerModel` owns filesystem state:

```swift
@State private var model = HudFileExplorerModel(rootURL: projectRoot)

model.setRoot(otherRoot)
model.open(entry)          // called by HudFileTree
try model.saveDocument()
```

## File explorer

```swift
HudFileExplorer(model: model) { doc in
    try model.save(doc)
}
```

## CodeMirror only

```swift
HudCodeMirror(document: doc, mode: $mode) { text in
    try save(text)
}
```

`HudCodeMirror` keeps a **warm** `HudCodeMirrorWebView` mounted at all times.
When no file is selected, the web view receives an idle read-only document.
On first load a neutral skeleton appears until the bridge reports `rendered`;
tab switches reuse the warm editor without resetting visibility. Do not
conditionally mount the web view on `document != nil`.

## Tree keyboard

`HudFileTree` handles focus and navigation:

| Key | Action |
| --- | --- |
| ↑ ↓ | Move selection |
| → | Expand folder or move into children |
| ← | Collapse folder or move to parent |
| Home / End | First / last visible row |
| Return / Space | Toggle folder or open file |
| Double-click tab title | Pin tab (tree navigation then opens a new tab) |
| Type-ahead | Jump to next matching name |

## Demo wiring

`HudsonKitDemo/Tabs/ExplorerTab.swift`:

1. Workspace toolbar — root shortcuts, path, refresh
2. File toolbar — title, path, Read/Edit, Save (host only)
3. `HudFileExplorer` — bare tree + CodeMirror

```bash
bun run build:native-editor
swift run HudsonKitDemo
```

See [HUD-008](./HUD-008-web-surfaces.md) for the CodeMirror bundle and bridge.