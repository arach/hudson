# HUD-004: Vantage JSONL Control API v0

Status: active draft

Vantage exposes a local JSONL control plane so external agents can drive a native Hudson runtime surface without linking against the app process. The protocol is intentionally small: write one JSON object per line to the command file, then read correlated response objects from the response file.

## Files

Default Vantage paths:

```text
/tmp/hudson-vantage-control.jsonl
/tmp/hudson-vantage-control.responses.jsonl
```

The Vantage product (`apps/vantage`) uses:

```text
/tmp/hudson-vantage-control.jsonl
/tmp/hudson-vantage-control.responses.jsonl
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

## Security and Seamless Control

The control API is meant to make agent-driven setup feel immediate: Scout,
Talkie, Codex, or a shell script should be able to open Vantage and arrange the
native surface without a manual ceremony for every low-risk command. The same
path can also create terminals, attach tmux sessions, close nodes, trigger
installs, and touch SSH. That means the security model needs to be explicit.

V0 should be treated as an opt-in local control surface. A host should only
start the watcher when the user or product has enabled external control for the
current workspace. Development defaults use predictable `/tmp` paths for easy
inspection, but product hosts should prefer per-user, app-scoped paths with
owner-only permissions and should rotate those paths when a workspace/session is
reset.

The seamless model is a short-lived capability, not a modal on every command:

- A trusted launcher can create the control files, response files, and optional
  state file, then pass those paths to the agent process it started.
- A future host may add a per-session token or nonce to the command envelope.
  Agents launched by the host get it automatically; unrelated local processes do
  not.
- Read-only commands such as `status`, `inspect`, `metrics`, and bounded
  `tmux-health` should run without repeated prompts once the channel is trusted;
  remote probes still require an explicit `probeRemote` opt-in or host policy.
- Mutating commands such as `setup`, `tile`, `spawn`, `reattach`, `style`,
  `viewport`, `select`, and `popout` are allowed within the enabled workspace
  and should remain visible in command status/audit output.
- Setup manifests may ask Vantage to display local file, plan, or diff artifacts.
  Product hosts should scope path-backed artifact reads to trusted workspace
  roots and avoid returning file contents over the control response channel.
- High-risk commands that install software, kill sessions, remove nodes, touch
  remote SSH, or cross a product/workspace boundary should require either an
  explicit `confirm` field, a host policy grant, or a user-visible approval.

Remote operations keep the same bias: make the happy path smooth, but never
background-prompt for credentials. Remote health probes are bounded and
noninteractive; remote terminal attachment uses the user's existing SSH setup and
surfaces authentication/host-key problems inside the terminal or health status.

Security backlog:

- Per-session capability token in the JSONL envelope.
- Host-owned path allocation with owner-only permissions and stale-file cleanup.
- Command classes (`read`, `mutate`, `destructive`, `network`, `install`) with a
  default policy matrix.
- Structured audit records for command id, action, caller label, affected node
  ids, and result.
- Redaction rules so responses do not echo secrets, environment values, or full
  command lines unless explicitly requested by a trusted host.

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

Selectors can be full or prefix UUIDs, exact manifest ids, exact node titles,
tmux targets, remote tmux targets in `host:target` form, Graphite paths, or
path-backed artifact paths.

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
| `tmux-health` | Inspect local tmux targets and optionally run bounded, noninteractive remote probes. |

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
    },
    {
      "id": "hudson.scout.files.provider",
      "runtimeKind": "file",
      "path": "app/apps/scout/ScoutProvider.tsx",
      "language": "typescript",
      "role": "source",
      "title": "ScoutProvider.tsx",
      "tag": "focus",
      "x": 80,
      "y": 452,
      "width": 620,
      "height": 360
    },
    {
      "id": "hudson.scout.plan.current",
      "runtimeKind": "plan",
      "path": "docs/scout-plan.md",
      "language": "markdown",
      "role": "plan",
      "title": "Current Plan",
      "x": 732,
      "y": 452,
      "width": 500,
      "height": 360
    },
    {
      "id": "hudson.scout.diff.running",
      "runtimeKind": "diff",
      "path": "/tmp/scout-running.diff",
      "language": "diff",
      "role": "review",
      "title": "Running Diff",
      "x": 1264,
      "y": 452,
      "width": 560,
      "height": 360
    }
  ],
  "selection": ["hudson.scout.agents.codex.0001.worker"],
  "focused": "hudson.scout.agents.codex.0001.worker"
}
```

Setup application is idempotent:

- Existing nodes are reused by UUID, manifest id, artifact path, Graphite path,
  or tmux target plus remote host.
- Missing nodes are created when `createIfMissing` is true.
- `removeMissing` prunes canvas nodes not mentioned in the manifest.
- Re-running the same manifest converges placement, tags, style, selection, and
  viewport instead of duplicating nodes.

Terminals are one node type. `runtimeKind: "file"`, `"plan"`, `"diff"`,
`"note"`, and `"preview"` create non-PTY canvas artifacts. They are currently
presentation nodes: Vantage stores layout, identity, tags, and a preview, while
the filesystem, git diff, tmux session, or host product remains the source of
truth. The canvas path stays native and lightweight for zoom/pan performance;
opened code artifacts can use a read-only web renderer slot that loads one local
shell and receives JSON payload updates. Diff artifacts are parsed into
`HudDiffDocument` from the HudsonDiff core target, then rendered natively by
Vantage. Hosts can still drop in richer React/Shiki/Diffs renderers later by
consuming the same diff JSON, without putting WebViews on the canvas itself.
Path-backed artifacts read local UTF-8 text for display; responses expose
metadata such as `path`, `language`, and `role`, but do not echo file contents.

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
  "sessions": ["hudson-lab"],
  "probeRemote": true,
  "timeoutMS": 750
}
```

Local health checks verify that tmux exists, the target exists, and return session/window/pane details where available. Remote health returns identity-only `remote-unverified` by default so status checks do not unexpectedly touch the network or pause canvas interaction. Set `probeRemote: true` to run a bounded noninteractive SSH probe: it never asks for passwords, does not open an interactive shell, and reports status quickly according to `timeoutMS` (default 3000, clamped to 500-30000 ms).

Remote identity is the tuple of `remoteHost`, tmux `target`, and optional Graphite path. Agents should treat that tuple as the durable address: the canvas node can disappear, but the tmux session remains findable by the same remote host and target.

Health status values:

- `ready`: tmux exists and the target is attachable.
- `auth-needed`: SSH authentication or host-key approval is required.
- `unreachable`: the host cannot be reached within the timeout.
- `tmux-missing`: tmux was not found locally or on the remote host.
- `session-missing`: tmux exists, but the requested session/window/target was not found.
- `remote-error`: SSH completed but the probe could not classify the failure.
- `remote-unverified`: remote identity was returned without probing because `probeRemote` was false or omitted.

Remote hardening backlog:

- Terminal size synchronization on attach and resize.
- tmux-friendly key/mouse policy and deeper remote latency feedback.
- Better auth UX that can guide users through host-key approval without background prompts.

The readiness/window/TERM direction is informed by Scion's tmux runtime approach:
https://github.com/GoogleCloudPlatform/scion

## Shell Wrapper Examples

```bash
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait status
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait style --scope workspace --preset jade --terminal-theme hudson-paper
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait setup --manifest /tmp/scout.vantage.setup.json --create --fit
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait tmux-health --session hudson-lab
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait tmux-health --remote devbox --session hudson-lab
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait tmux-health --remote devbox --session hudson-lab --probe-remote --timeout-ms 750
packages/native/apple/HudsonKit/Scripts/vantagectl.sh --wait reattach --remote devbox --session hudson-lab
```

Vantage exposes the same commands through:

```bash
apps/vantage/scripts/vantagectl.sh --wait status
apps/vantage/scripts/vantagectl.sh --wait style --scope tag --tag focus --terminal-theme jade-night
apps/vantage/scripts/vantagectl.sh --wait setup --manifest apps/vantage/fixtures/scout-vantage.setup.json --create --fit
```
