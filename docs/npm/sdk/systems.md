---
title: Systems
description: Intents, services, and inter-app data piping
section: npm
subsection: "@hudsonos/sdk"
order: 4
---

# Systems

Hudson provides three inter-app systems: **Intents** for command discovery by AI and search, **Services** for managing external process dependencies, and **Ports** for piping data between apps at runtime.

## Intents

Intents are static declarations that describe what your app can do. They bridge the gap between your app's commands and external systems like LLMs, voice assistants, and semantic search. Each intent maps to a `CommandOption` returned by `useCommands()`.

### How Intents Work

1. You declare intents as an array of `AppIntent` objects on your `HudsonApp`.
2. The shell aggregates all app intents into an `IntentCatalog`.
3. External systems (AI agents, voice input, search) use the catalog to discover and invoke commands.
4. When an intent is triggered, the shell finds the matching `CommandOption` by `commandId` and calls its `action()`.

```
User says: "Switch to the pen tool"
  |
  v
LLM matches intent: { commandId: 'shaper:pen-tool', ... }
  |
  v
Shell finds CommandOption with id 'shaper:pen-tool'
  |
  v
Calls action() -> switchTool('pen')
```

### Declaring Intents

Add an `intents` array to your `HudsonApp` definition:

```tsx
import type { HudsonApp, AppIntent } from '@hudsonos/sdk';

const myIntents: AppIntent[] = [
  {
    commandId: 'editor:pen-tool',
    title: 'Switch to Pen Tool',
    description: 'Activate the pen tool for drawing bezier curves.',
    category: 'tool',
    keywords: ['pen', 'draw', 'bezier', 'path tool'],
    shortcut: 'P',
  },
  {
    commandId: 'editor:save',
    title: 'Save Project',
    description: 'Save the current project to local storage.',
    category: 'file',
    keywords: ['save', 'store', 'persist', 'write'],
    shortcut: 'Cmd+S',
  },
];

const editorApp: HudsonApp = {
  id: 'editor',
  name: 'Editor',
  // ...
  intents: myIntents,
};
```

### AppIntent Interface

```ts
interface AppIntent {
  /** Must match a CommandOption.id from useCommands() */
  commandId: string;
  /** Human-readable title: "Switch to Pen Tool" */
  title: string;
  /** Natural-language description for LLM/voice matching */
  description: string;
  /** Categorization for grouping and filtering */
  category: IntentCategory;
  /** Synonyms for fuzzy/semantic matching */
  keywords: string[];
  /** Optional parameters for parameterized intents */
  params?: IntentParameter[];
  /** Keyboard shortcut display string */
  shortcut?: string;
  /** If true, the intent requires confirmation before execution */
  dangerous?: boolean;
}
```

### The commandId Link

The `commandId` field is the bridge between intents and commands. It must exactly match the `id` field of a `CommandOption` returned by your `useCommands()` hook.

```tsx
// In intents.ts
{ commandId: 'editor:save', title: 'Save', ... }

// In hooks.ts — useCommands()
{ id: 'editor:save', label: 'Save', action: () => save(), shortcut: 'Cmd+S' }
```

This decoupling lets intents be declared statically (for indexing) while commands are dynamic (created inside Provider scope with access to state).

### Intent Categories

```ts
type IntentCategory =
  | 'tool'        // Tool switching: "Switch to Pen Tool"
  | 'edit'        // Editing actions: "Undo", "Delete Selected"
  | 'file'        // File operations: "Save", "Export", "New Project"
  | 'view'        // Visibility toggles: "Toggle Grid", "Show Anchors"
  | 'navigation'  // Viewport control: "Zoom In", "Reset Zoom"
  | 'toggle'      // Mode toggles: "Toggle Animation Mode"
  | 'workspace'   // Workspace-level: "Switch App", "Split View"
  | 'settings';   // Settings: "Open Preferences"
```

Use the most specific category. For example, toggling a view layer is `'view'`, while toggling a mode (like animation mode) is `'toggle'`.

### Parameters

Some intents accept parameters. Declare them with `IntentParameter`:

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

#### Parameterized Intent Example

```tsx
{
  commandId: 'editor:set-zoom',
  title: 'Set Zoom Level',
  description: 'Set the canvas zoom to a specific percentage.',
  category: 'navigation',
  keywords: ['zoom', 'set zoom', 'zoom level'],
  params: [
    {
      name: 'level',
      description: 'Zoom percentage (e.g. 100 for 100%)',
      type: 'number',
      default: 100,
    },
  ],
}
```

Parameters are passed to the LLM/agent system for structured invocation. Your `CommandOption.action()` implementation handles the actual execution.

### Keywords

Keywords enable fuzzy and semantic matching. Include:

- The primary term ("save")
- Common synonyms ("store", "persist")
- Alternate phrasings ("write to disk", "quick save")
- Abbreviations users might say ("ctrl z" for undo)

```tsx
{
  commandId: 'editor:undo',
  title: 'Undo',
  description: 'Undo the last editing action.',
  category: 'edit',
  keywords: ['undo', 'revert', 'go back', 'ctrl z', 'step back'],
  shortcut: 'Cmd+Z',
}
```

### Dangerous Intents

Set `dangerous: true` for intents that perform destructive or irreversible actions. The execution layer can require confirmation before running.

```tsx
{
  commandId: 'editor:delete-all',
  title: 'Delete All Objects',
  description: 'Remove all objects from the canvas. This cannot be undone.',
  category: 'edit',
  keywords: ['delete all', 'clear canvas', 'remove everything'],
  dangerous: true,
}
```

### The Intent Catalog

The shell aggregates all app intents into an `IntentCatalog`:

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

The `index` field provides a flat lookup from `commandId` to the owning app and intent. This makes it fast for agents to resolve which app handles a given command.

#### CatalogAppEntry

```ts
interface CatalogAppEntry {
  appId: string;
  appName: string;
  appDescription: string;
  intents: AppIntent[];
}
```

### Real-World Example: Shaper Intents

The Shaper reference app declares intents across multiple categories:

```tsx
import type { AppIntent } from '@hudsonos/sdk';

export const shaperIntents: AppIntent[] = [
  // Tools
  {
    commandId: 'shaper:select-tool',
    title: 'Switch to Select Tool',
    description: 'Activate the selection tool for picking and moving anchor points.',
    category: 'tool',
    keywords: ['select', 'pointer', 'cursor', 'pick', 'arrow'],
    shortcut: 'V',
  },
  {
    commandId: 'shaper:pen-tool',
    title: 'Switch to Pen Tool',
    description: 'Activate the pen tool for drawing new bezier curve anchor points.',
    category: 'tool',
    keywords: ['pen', 'draw', 'bezier', 'add point', 'create'],
    shortcut: 'P',
  },

  // Edit
  {
    commandId: 'shaper:undo',
    title: 'Undo',
    description: 'Undo the last editing action in the bezier editor.',
    category: 'edit',
    keywords: ['undo', 'revert', 'go back', 'ctrl z'],
    shortcut: 'Cmd+Z',
  },

  // File
  {
    commandId: 'shaper:save',
    title: 'Save Project',
    description: 'Save the current bezier project to local storage.',
    category: 'file',
    keywords: ['save', 'store', 'persist', 'quick save'],
    shortcut: 'Cmd+S',
  },

  // View
  {
    commandId: 'shaper:toggle-grid',
    title: 'Toggle Grid',
    description: 'Show or hide the background grid on the canvas.',
    category: 'view',
    keywords: ['grid', 'gridlines', 'show grid', 'background grid'],
  },

  // Toggle
  {
    commandId: 'shaper:toggle-animation',
    title: 'Toggle Animation Mode',
    description: 'Enable or disable animation mode for previewing path animations.',
    category: 'toggle',
    keywords: ['animation', 'animate', 'motion', 'preview animation'],
    shortcut: 'T',
  },
];
```

### Intent Best Practices

1. **One intent per command.** Each intent maps to exactly one `CommandOption`.
2. **Write descriptions for humans and LLMs.** Be specific about what the action does and when to use it.
3. **Include 4-6 keywords.** Cover the primary term, synonyms, and common natural-language phrasings.
4. **Namespace commandIds.** Use the pattern `appId:action` (e.g., `shaper:save`).
5. **Use categories consistently.** Tools switch modes, edits change data, views toggle visibility.
6. **Mark destructive actions as dangerous.** Deletion, clearing, and reset actions should require confirmation.

---

## Services

The service system lets Hudson apps declare dependencies on external services (local servers, databases, language servers, etc.) and manage their lifecycle through a standard interface.

### Overview

Apps declare which services they depend on. The shell provides a service registry that can install, start, stop, and health-check services. This lets users see the status of all required services in one place and start them with a single click.

### ServiceDefinition

A `ServiceDefinition` describes everything needed to manage a service:

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

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique service identifier. |
| `name` | `string` | Human-readable name. |
| `description` | `string` | What the service does. |
| `version` | `string?` | Expected version string. |
| `icon` | `string?` | Icon identifier for UI display. |
| `check.healthUrl` | `string?` | HTTP URL to probe for health status. |
| `check.port` | `number?` | TCP port to check for availability. |
| `install.command` | `string` | Shell command to install the service. |
| `install.cwd` | `string?` | Working directory for the install command. |
| `start.command` | `string` | Shell command to start the service. |
| `start.cwd` | `string?` | Working directory for the start command. |
| `start.env` | `Record<string, string>?` | Environment variables for the start command. |
| `stop.command` | `string?` | Shell command to stop the service. |

#### Example

```ts
import type { ServiceDefinition } from '@hudsonos/sdk';

const terminalRelay: ServiceDefinition = {
  id: 'terminal-relay',
  name: 'Terminal Relay',
  description: 'WebSocket relay for PTY sessions',
  version: '1.0.0',
  check: {
    healthUrl: 'http://localhost:3600/health',
    port: 3600,
  },
  install: {
    command: 'bun install',
    cwd: '/path/to/terminal-relay',
  },
  start: {
    command: 'bun run start',
    cwd: '/path/to/terminal-relay',
    env: { PORT: '3600' },
  },
  stop: {
    command: 'kill $(lsof -ti:3600)',
  },
};
```

### ServiceDependency

Apps declare service dependencies in their `HudsonApp` definition:

```ts
interface ServiceDependency {
  serviceId: string;
  optional?: boolean;
  reason?: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `serviceId` | `string` | References a `ServiceDefinition.id` in the registry. |
| `optional` | `boolean?` | If `true`, the app works without this service but with reduced functionality. |
| `reason` | `string?` | Human-readable explanation of why this service is needed. |

#### Declaring Dependencies

```tsx
import type { HudsonApp } from '@hudsonos/sdk';

const myApp: HudsonApp = {
  id: 'my-app',
  name: 'My App',
  // ...
  services: [
    {
      serviceId: 'terminal-relay',
      optional: false,
      reason: 'Required for embedded terminal functionality',
    },
    {
      serviceId: 'language-server',
      optional: true,
      reason: 'Enables autocomplete and diagnostics',
    },
  ],
};
```

### Service Status

The registry tracks each service with a `ServiceRecord`:

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

#### ServiceStatus

```ts
type ServiceStatus = 'unknown' | 'not_installed' | 'installed' | 'running' | 'error';
```

| Status | Meaning |
|--------|---------|
| `'unknown'` | Service has not been checked yet. |
| `'not_installed'` | Health check failed and the service is not found. |
| `'installed'` | Service is installed but not running. |
| `'running'` | Service is running and health check passes. |
| `'error'` | Service failed to start or health check failed after start. |

### Service Actions

Every action taken on a service is logged as a `ServiceAction`:

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

This provides an audit trail for debugging. You can see what command was run, who triggered it, whether it succeeded, and how long it took.

### Lifecycle

A typical service lifecycle:

```
check -> not_installed -> install -> installed -> start -> running
                                                            |
                                                          stop -> installed
                                                            |
                                                          error -> check -> ...
```

1. **Check**: Probe the health URL or port to determine current status.
2. **Install**: Run the install command if the service is not found.
3. **Start**: Run the start command to bring the service up.
4. **Stop**: Run the stop command to gracefully shut down.

The shell can automate this flow or let users manage each step manually through the service panel.

### Health Checks

Services can declare either a `healthUrl` (HTTP GET that returns 200) or a `port` (TCP port that accepts connections) for health checking.

```ts
// HTTP health check
check: {
  healthUrl: 'http://localhost:3600/health',
}

// Port-based health check
check: {
  port: 5432,
}

// Both (health URL takes precedence)
check: {
  healthUrl: 'http://localhost:8080/healthz',
  port: 8080,
}
```

### Service Best Practices

1. **Use descriptive service IDs.** Prefer `terminal-relay` over `relay` or `tr`.
2. **Set `optional: true` for non-critical services.** If your app works without it, mark it optional and degrade gracefully.
3. **Provide a reason.** The `reason` field helps users understand why a service is needed.
4. **Include a stop command.** Without one, the shell cannot cleanly shut down the service.
5. **Use health URLs over port checks.** HTTP health endpoints can verify the service is actually functional, not just listening.

---

## Ports

Ports enable inter-app data piping in Hudson workspaces. One app can expose data outputs, another can accept data inputs, and the shell connects them through pipe definitions.

### Concepts

- **Output**: Data a source app produces (e.g., an SVG string, a JSON object).
- **Input**: Data a sink app consumes.
- **Pipe**: A connection between one app's output and another app's input.
- **Data type**: A semantic label (like `'svg'`, `'json'`, `'text'`) that helps match compatible ports.

```
App A (source)          Pipe             App B (sink)
  output:svg ---------> [pipe] --------> input:svg
```

### Declaring Ports

Declare ports statically on your `HudsonApp` definition:

```tsx
import type { HudsonApp } from '@hudsonos/sdk';

const shaperApp: HudsonApp = {
  id: 'shaper',
  name: 'Shaper',
  // ...
  ports: {
    outputs: [
      {
        id: 'svg',
        name: 'SVG Output',
        dataType: 'svg',
        description: 'Complete SVG of the current Shaper canvas',
      },
    ],
  },
};
```

#### AppOutput

```ts
interface AppOutput {
  id: string;
  name: string;
  dataType: string;
  description?: string;
}
```

#### AppInput

```ts
interface AppInput {
  id: string;
  name: string;
  dataType: string;
  description?: string;
}
```

#### AppPorts

```ts
interface AppPorts {
  outputs?: AppOutput[];
  inputs?: AppInput[];
}
```

### Implementing Port Hooks

The shell reads and writes port data through two hooks on your app definition.

#### usePortOutput

Returns a getter function that produces a data snapshot for a given port ID.

**Signature on HudsonApp.hooks:**

```ts
usePortOutput?: () => (portId: string) => unknown | null;
```

**Implementation example (Shaper):**

```tsx
import { useCallback } from 'react';
import { useShaper } from './ShaperProvider';

export function useShaperPortOutput() {
  const { strokesPath, pathColor, fillEnabled, fillPattern } = useShaper();

  return useCallback((portId: string): unknown | null => {
    if (portId !== 'svg') return null;
    if (!strokesPath) return null;

    const fill = fillEnabled ? pathColor : 'none';
    const stroke = fillEnabled && fillPattern === 'solid' ? 'none' : pathColor;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="${strokesPath}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
</svg>`;
  }, [strokesPath, pathColor, fillEnabled, fillPattern]);
}
```

Key points:
- The hook returns a **function**, not the data directly. The shell calls this function when it needs a snapshot.
- Return `null` for unknown port IDs or when data is unavailable.
- Wrap the getter in `useCallback` for stable references.

#### usePortInput

Returns a setter function that receives data pushed from a pipe.

**Signature on HudsonApp.hooks:**

```ts
usePortInput?: () => (portId: string, data: unknown) => void;
```

**Implementation example:**

```tsx
import { useCallback } from 'react';
import { useEditor } from './EditorProvider';

export function useEditorPortInput() {
  const { importSvg } = useEditor();

  return useCallback((portId: string, data: unknown) => {
    if (portId === 'svg' && typeof data === 'string') {
      importSvg(data);
    }
  }, [importSvg]);
}
```

#### Wiring Hooks into the App

```tsx
const myApp: HudsonApp = {
  // ...
  hooks: {
    useCommands: useMyCommands,
    useStatus: useMyStatus,
    usePortOutput: useMyPortOutput,
    usePortInput: useMyPortInput,
  },
};
```

### PipeDefinition

Pipes are persisted connections between an output and an input:

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

| Field | Description |
|-------|-------------|
| `id` | Unique pipe identifier. |
| `name` | Human-readable label. |
| `source` | The output port: which app and port ID. |
| `sink` | The input port: which app and port ID. |
| `createdAt` | Unix timestamp of creation. |
| `lastPushedAt` | Unix timestamp of last data push, or `null`. |
| `enabled` | Whether the pipe is active. |

Pipes are stored as JSON files (typically in `.data/pipes/`) and managed by the shell.

### Data Types

The `dataType` field is a semantic label that describes the kind of data a port handles. Use consistent strings across your apps so the shell can suggest compatible connections.

Common data types:

| Data Type | Description |
|-----------|-------------|
| `'svg'` | SVG markup string |
| `'json'` | Arbitrary JSON object |
| `'text'` | Plain text string |
| `'image'` | Base64 or URL to an image |
| `'markdown'` | Markdown text |

There is no enforced schema for data types. They are hints for the user and shell UI when creating pipe connections.

### Full Pipe Setup Example

App A (Shaper) outputs SVG. App B (Logo Designer) accepts SVG as input.

**App A -- Shaper:**

```tsx
const shaperApp: HudsonApp = {
  id: 'shaper',
  // ...
  ports: {
    outputs: [
      { id: 'svg', name: 'SVG Output', dataType: 'svg' },
    ],
  },
  hooks: {
    // ...
    usePortOutput: useShaperPortOutput,
  },
};
```

**App B -- Logo Designer:**

```tsx
const logoApp: HudsonApp = {
  id: 'logo-designer',
  // ...
  ports: {
    inputs: [
      { id: 'svg', name: 'SVG Input', dataType: 'svg' },
    ],
  },
  hooks: {
    // ...
    usePortInput: useLogoPortInput,
  },
};
```

**Pipe Definition (created by the shell):**

```json
{
  "id": "pipe-shaper-logo-svg",
  "name": "Shaper SVG to Logo",
  "source": { "appId": "shaper", "portId": "svg" },
  "sink": { "appId": "logo-designer", "portId": "svg" },
  "createdAt": 1709654321000,
  "lastPushedAt": null,
  "enabled": true
}
```

When the pipe is triggered, the shell calls Shaper's `usePortOutput` getter with `portId: 'svg'`, takes the returned SVG string, and passes it to Logo Designer's `usePortInput` setter with `portId: 'svg'`.

### Port Best Practices

1. **Use semantic data types.** Match `dataType` strings between compatible ports.
2. **Return null for unknown ports.** Always check the `portId` parameter and return `null` for IDs your app does not handle.
3. **Keep output snapshots lightweight.** The getter may be called frequently. Avoid expensive computation inside it.
4. **Validate input data.** Check the type and shape of incoming data before applying it to your app state.
5. **Namespace port IDs if needed.** Simple IDs like `'svg'` work when an app has one port of that type. Use longer IDs like `'canvas-svg'` if disambiguation is needed.
