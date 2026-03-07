---
title: create-hudson-app
description: Scaffold a new Hudson app with the correct structure and boilerplate.
section: cli
order: 2
---

# create-hudson-app

`create-hudson-app` scaffolds a new Hudson app with the correct directory structure, boilerplate files, and a development workspace. It follows the Provider + Slots + Hooks pattern described in [Building Apps](./building-apps.md).

## Usage

Run from the root of a Hudson project (any directory containing an `app/` folder):

```bash
bunx create-hudson-app my-tool
```

The scaffolder walks up from the current directory to find the project root (the nearest parent with an `app/` directory), then writes files into `app/apps/<app-name>/`.

### Interactive Mode

With no arguments, the CLI prompts for each option:

```bash
bunx create-hudson-app
```

```
  create-hudson-app  v0.1.0

  ? App name (kebab-case): my-tool
  ? Description: A custom development tool
  ? Tier:
    1) Minimal   -- Provider + Content + basic hooks (5 files)
    2) Standard  -- + LeftPanel + Inspector + intents (8 files)
    3) Full      -- + tools + Terminal + LeftFooter + manifest (12 files)
  Choose [1/2/3]: 2
  ? Mode (panel/canvas) [panel]: panel
```

### Non-Interactive Mode

Pass all options as flags to skip prompts:

```bash
bunx create-hudson-app my-tool \
  --tier standard \
  --mode panel \
  --description "A custom development tool"
```

## Options

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--tier` | `minimal`, `standard`, `full` | Prompted | Controls how many files and slots are generated. |
| `--mode` | `panel`, `canvas` | `panel` | Layout mode for the app. |
| `--description` | `"..."` | `"A Hudson app"` | Short description used in the app definition. |
| `--no-workspace` | -- | `false` | Skip generating a workspace file. |
| `-h`, `--help` | -- | -- | Print help and exit. |

### App Name Rules

The app name must be:

- Lowercase kebab-case (e.g. `my-tool`, `data-browser`)
- Start with a letter
- Between 2 and 40 characters
- Contain only lowercase letters, digits, and hyphens

## Tiers

The `--tier` flag controls the complexity of the generated app.

### Minimal (5 files)

The simplest starting point. Generates a Provider, Content slot, basic hooks, types, and an index file.

```
app/apps/my-tool/
  index.ts                # HudsonApp definition
  MyToolProvider.tsx       # React context provider
  MyToolContent.tsx        # Content slot
  hooks.ts                # useCommands + useStatus
  types.ts                # App-specific types
```

### Standard (8 files)

Adds a left panel, inspector, and intent declarations.

```
app/apps/my-tool/
  index.ts                # HudsonApp definition
  MyToolProvider.tsx       # React context provider
  MyToolContent.tsx        # Content slot
  MyToolLeftPanel.tsx      # Left sidebar slot
  MyToolInspector.tsx      # Right inspector slot
  hooks.ts                # useCommands + useStatus
  intents.ts              # Intent declarations
  types.ts                # App-specific types
```

### Full (12 files)

The complete app scaffold with terminal integration, header actions, a left footer, and a sample tool.

```
app/apps/my-tool/
  index.ts                # HudsonApp definition
  MyToolProvider.tsx       # React context provider
  MyToolContent.tsx        # Content slot
  MyToolLeftPanel.tsx      # Left sidebar slot
  MyToolLeftFooter.tsx     # Footer below left panel
  MyToolInspector.tsx      # Right inspector slot
  MyToolHeaderActions.tsx  # Navigation bar actions
  MyToolTerminal.tsx       # Embedded terminal slot
  hooks.ts                # useCommands + useStatus
  intents.ts              # Intent declarations
  types.ts                # App-specific types
  tools/
    SampleTool.tsx        # Example tool component
```

## Generated Workspace

Unless `--no-workspace` is passed, the scaffolder also generates a development workspace file:

```
app/workspaces/myToolDev.ts
```

```typescript
import type { HudsonWorkspace } from '@hudson/sdk';
import { myToolApp } from '../apps/my-tool';

export const myToolDevWorkspace: HudsonWorkspace = {
  id: 'my-tool-dev',
  name: 'My Tool.dev',
  description: 'A custom development tool',
  mode: 'panel',
  apps: [{ app: myToolApp }],
};
```

## Template Variables

The scaffolder replaces the following placeholders in template files:

| Placeholder | Example Value | Description |
|-------------|---------------|-------------|
| `__APP_NAME__` | `MyTool` | PascalCase name for components |
| `__APP_ID__` | `my-tool` | Kebab-case ID for registration |
| `__APP_VAR__` | `myTool` | camelCase name for variables |
| `__APP_DISPLAY_NAME__` | `My Tool` | Title case for UI labels |
| `__APP_DESCRIPTION__` | `A custom development tool` | Description string |
| `__APP_MODE__` | `panel` | Layout mode |
| `__APP_ICON__` | `Box` | Lucide icon name (auto-detected from app name) |

### Icon Detection

The scaffolder maps common keywords in the app name to Lucide icon names. For example, `my-browser` resolves to `Globe`, `code-editor` resolves to `Code`, and `data-table` resolves to `Table`. If no keyword matches, the default is `Box`.

## Next Steps After Scaffolding

1. **Import the workspace** in `app/page.tsx`:

```typescript
import { myToolDevWorkspace } from './workspaces/myToolDev';

// Add to your workspaces array
const workspaces = [myToolDevWorkspace, ...otherWorkspaces];
```

2. **Start the dev server**:

```bash
bun dev
```

3. **Open Hudson** at `http://localhost:3500` and switch to your new workspace.

4. **Add state** to the generated Provider. See [Getting Started](./getting-started.md#adding-state-with-a-provider) for the context pattern.

5. **Add commands** in `hooks.ts`. See [API Reference](../npm/sdk/api-reference.md) for `useCommands` and `useStatus`.

6. **Declare intents** if your app should respond to LLM or voice commands. See [Systems](../npm/sdk/systems.md#intents).
