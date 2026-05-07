# HUD-004: Vantage JSONL Control API v0

Status: active draft

Vantage exposes a local JSONL control plane so external agents can drive a native Hudson runtime surface without linking against the app process. The protocol is intentionally small: write one JSON object per line to the command file, then read correlated response objects from the response file.

## Files

Default Vantage paths:

```text
/tmp/hudson-vantage-control.jsonl
/tmp/hudson-vantage-control.responses.jsonl
```

The Termini Canvas case study uses:

```text
/tmp/termini-canvas-control.jsonl
/tmp/termini-canvas-control.responses.jsonl
```

Hosts can override these paths through `HudVantageConfiguration`. Shell wrappers also accept `--control-file`, `--response-file`, and `--state-file`.

## Envelope

Every command is one JSON object followed by `\n`.

```json
{
  "apiVersion": "v0",
  "kind": "hudson.vantage.command",
  "id": "agent-request-001",
  "action": "status"
}
```

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `apiVersion` | No | Current value is `v0`. `version` is accepted as a legacy alias. |
| `kind` | No | Recommended value is `hudson.vantage.command`. |
| `id` | No | Correlates command and response. Wrappers generate this automatically. |
| `action` | Yes | Lowercase action name; aliases are accepted for common commands. |

Responses are also one JSON object per line.

```json
{
  "apiVersion": "v0",
  "kind": "hudson.vantage.response",
  "id": "agent-request-001",
  "action": "status",
  "ok": true,
  "message": "2 terminals",
  "nodeCount": 2,
  "timestamp": "2026-05-07T12:00:00Z"
}
```

`ok: false` means the command was decoded but could not be applied. Decode failures are reported with `action: "decode"` and no request `id`.

## Common Include Flags

Most responses include nodes, viewport, and metrics by default. Agents can opt out when sending high-volume commands.

| Field | Type | Effect |
| --- | --- | --- |
| `includeNodes` | boolean | `false` omits `nodes`. |
| `includeViewport` | boolean | `false` omits `viewport`. |
| `includeMetrics` | boolean | `false` omits `metrics`. |
| `includeChildren` | boolean | `true` includes app child PIDs when available. |
| `includeStyle` | boolean | `true` includes the current workspace/tag/terminal style summary. |

## Node Selectors

Node actions accept any of:

```json
{
  "nodeID": "8F4",
  "nodeIDs": ["8F4", "932"],
  "ids": ["hudson.scout.agents.codex.0007.worker"]
}
```

Selectors can be full or prefix UUIDs, exact node titles, tmux targets, remote tmux targets in `host:target` form, or Graphite paths.

`selectionMode` accepts `replace`, `add`, `remove`, `toggle`, and `clear`.

## Core Actions

| Action | Purpose |
| --- | --- |
| `status` | Inspect current nodes, viewport, metrics, and optional style. |
| `tile` | Create a grid of local PTY terminals. |
| `spawn` | Create one or more local PTY terminals. |
| `reattach` | Attach local or remote tmux sessions/windows. |
| `select` | Replace/add/remove/toggle selected nodes. |
| `inspect` | Return node summaries for selected or requested nodes. |
| `focus` | Center the viewport on nodes and select them. |
| `focus-mode` | Enter single-terminal focus mode. |
| `exit-focus` | Leave focus mode. |
| `popout` | Open selected nodes in a separate native window. |
| `close` | Stop and remove selected nodes. |
| `viewport` | Reset, fit, or replay pan/scale. |
| `metrics` | Return performance counters. |
| `perf-reset` | Reset performance counters. |
| `perf-harness` | Create an active tmux stress harness. |
| `perf-cleanup` | Kill tmux harness sessions by prefix. |
| `ensure-tmux` | Permission-gated local tmux prerequisite check/install. |
| `save` / `save-workspace` | Persist a durable workspace snapshot. |
| `restore` / `restore-workspace` | Restore a durable workspace snapshot. |
| `setup` / `apply-workspace` | Apply a declarative Vantage setup manifest. |
| `style` | Apply or inspect workspace, tag, or terminal appearance settings. |
| `tmux-health` | Inspect local tmux targets and report remote tmux identity status. |

## Setup Manifests

`setup` is the high-level contract for host apps and agents. Instead of issuing
many small commands, an agent can describe the intended native surface: identity,
presentation, style, nodes, tags, selection, and viewport.

```json
{
  "apiVersion": "v0",
  "kind": "hudson.vantage.command",
  "id": "setup-scout",
  "action": "setup",
  "manifestPath": "/tmp/scout.vantage.setup.json",
  "createIfMissing": true,
  "removeMissing": false,
  "fit": true
}
```

Inline manifests are also accepted under `setup` or `manifest`.

```json
{
  "kind": "hudson.vantage.setup",
  "schemaVersion": 1,
  "workspaceID": "scout-lab",
  "presentation": {
    "title": "Scout Vantage",
    "subtitle": "project operating surface",
    "badge": "workspace",
    "cobrand": "powered by Hudson",
    "productName": "Scout",
    "hostName": "Talkie",
    "theme": "jade"
  },
  "style": {
    "preset": "jade",
    "terminalTheme": "hudson-paper",
    "tagStyles": {
      "focus": { "terminalThemeID": "jadeNight" }
    }
  },
  "viewport": { "fit": true },
  "layout": {
    "canvasTool": "select",
    "navigationFilter": "all",
    "minimapCollapsed": false,
    "inspectorCollapsed": false
  },
  "nodes": [
    {
      "id": "hudson.scout.agents.codex.0001.worker",
      "runtimeKind": "tmux",
      "target": "hudson-scout-codex-0001",
      "title": "codex 0001",
      "tag": "focus",
      "x": 80,
      "y": 96,
      "width": 520,
      "height": 320
    },
    {
      "id": "hudson.scout.logs.tail.0001.watch",
      "runtimeKind": "tmux",
      "target": "hudson-scout-logs",
      "tag": "watch",
      "x": 632,
      "y": 96,
      "width": 460,
      "height": 280
    }
  ],
  "selection": ["hudson.scout.agents.codex.0001.worker"],
  "focused": "hudson.scout.agents.codex.0001.worker"
}
```

Setup application is idempotent:

- Existing nodes are reused by UUID, Graphite path, or tmux target plus remote
  host.
- Missing nodes are created when `createIfMissing` is true.
- `removeMissing` prunes canvas nodes not mentioned in the manifest.
- Re-running the same manifest converges placement, tags, style, selection, and
  viewport instead of duplicating nodes.

Presentation fields are intentionally host-friendly. `title`, `subtitle`,
`badge`, and `cobrand` are rendered by Vantage today. `productName`, `hostName`,
`icon`, `theme`, and `accent` are part of the manifest contract so Scout,
Talkie, Codex, or a standalone Vantage host can keep branded setup files even
when a specific host chooses different chrome.

## Appearance Control

`style` updates cascade through workspace -> tag -> terminal. Workspace scope can set shell chrome, terminal defaults, canvas grid, and focus inset. Tag and terminal scopes can set terminal theme/font overrides.

Workspace example:

```json
{
  "apiVersion": "v0",
  "kind": "hudson.vantage.command",
  "id": "style-workspace",
  "action": "style",
  "styleScope": "workspace",
  "stylePreset": "jade",
  "terminalTheme": "hudson-paper",
  "terminalFontSize": 14.5,
  "canvasGridMode": "dots",
  "canvasGridStep": 24,
  "focusPadding": 20,
  "includeStyle": true
}
```

Tag example:

```json
{
  "id": "style-focus-tag",
  "action": "style",
  "styleScope": "tag",
  "tag": "focus",
  "terminalTheme": "jade-night",
  "terminalFontFamily": "Menlo",
  "includeStyle": true
}
```

Terminal example:

```json
{
  "id": "style-node",
  "action": "style",
  "styleScope": "terminal",
  "nodeIDs": ["8F4"],
  "terminalFontSize": 13,
  "includeStyle": true
}
```

Supported style values:

| Field | Values |
| --- | --- |
| `stylePreset` | `adaptive`, `graphite`, `jade`, `blueprint` |
| `chromeStyle` | `system`, `graphite`, `paper` |
| `terminalTheme` | `adaptive`, `hudson-graphite`, `hudson-paper`, `jade-night`, `blueprint` |
| `canvasGridMode` | `lines`, `dots`, `none` |

Numeric values are clamped by Vantage: terminal font size `8...28`, grid step `4...160`, opacities `0...1`, and focus padding `0...160`.

## Tmux Control

Attach local session:

```json
{
  "id": "attach-local",
  "action": "reattach",
  "sessions": ["hudson-lab"],
  "createIfMissing": true
}
```

Attach remote session:

```json
{
  "id": "attach-remote",
  "action": "reattach",
  "remoteHost": "devbox",
  "sessions": ["hudson-lab"]
}
```

Inspect health:

```json
{
  "id": "health-remote",
  "action": "tmux-health",
  "remoteHost": "devbox",
  "sessions": ["hudson-lab"]
}
```

Local health checks verify that tmux exists, the target exists, and return session/window/pane details where available. Remote health currently reports the remote identity and marks it `remote-unverified`; it deliberately does not open a background SSH health probe until the host app provides an explicit auth UX and timeout policy.

Remote hardening backlog:

- Noninteractive reconnect check with bounded timeout and no password prompt.
- Session readiness polling before attach.
- Active tmux window discovery so toolbar/UI state can sync after reconnect.
- Terminal size synchronization on attach and resize.
- Explicit `TERM=xterm-256color` and tmux-friendly key/mouse policy.
- Remote identity docs covering `remoteHost`, tmux target, and Graphite path together.

The readiness/window/TERM items are informed by Scion's tmux runtime approach:
https://github.com/GoogleCloudPlatform/scion

## Shell Wrapper Examples

```bash
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait status
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait style --scope workspace --preset jade --terminal-theme hudson-paper
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait setup --manifest /tmp/scout.vantage.setup.json --create --fit
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait tmux-health --session hudson-lab
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait reattach --remote devbox --session hudson-lab
```

Termini Canvas exposes the same commands through:

```bash
examples/termini-canvas/scripts/canvasctl.sh --wait status
examples/termini-canvas/scripts/canvasctl.sh --wait style --scope tag --tag focus --terminal-theme jade-night
examples/termini-canvas/scripts/canvasctl.sh --wait setup --manifest examples/termini-canvas/examples/scout-vantage.setup.json --create --fit
```
