---
title: Scaffolding
description: Generate new Hudson apps with create-hudson-app
order: 6
---

# Scaffolding

`create-hudson-app` generates the boilerplate for a new Hudson app module. Hudson apps are declarative — you define a config object that satisfies the `HudsonApp` interface, and the shell handles all chrome, layout, and lifecycle. The CLI generates the files that fulfill that contract so you can skip straight to building your app's logic.

## Usage

```bash
# Interactive — prompts for description, tier, mode
bun run packages/create-hudson-app/src/index.ts my-browser

# Non-interactive
bun run packages/create-hudson-app/src/index.ts my-browser \
  --tier standard --mode panel --description "A web browser"
```

### Options

| Flag | Values | Default |
|------|--------|---------|
| `--tier` | `minimal`, `standard`, `full` | prompted |
| `--mode` | `panel`, `canvas` | `panel` |
| `--description` | any string | prompted |
| `--no-workspace` | — | generates workspace |
| `-h`, `--help` | — | show help |

## Tiers

Pick based on how many shell integration points your app needs. You can always promote a minimal app to standard later by adding slots and hooks — the `HudsonApp` interface will tell you what's missing.

### Minimal (5 files)

Provider, Content slot, and 2 required hooks. Use this for simple single-pane apps.

```bash
bun run packages/create-hudson-app/src/index.ts my-app --tier minimal
```

| File | Purpose |
|------|---------|
| `index.ts` | `HudsonApp` declaration with Content slot |
| `Provider.tsx` | Context with `selectedItem` state |
| `hooks.ts` | `useCommands` (empty), `useStatus` (READY) |
| `Content.tsx` | Centered placeholder |
| `types.ts` | Type skeleton |

### Standard (8 files)

Adds sidebar, inspector, search, and intents. Use this for apps that need navigation and inspection.

```bash
bun run packages/create-hudson-app/src/index.ts my-app --tier standard
```

Adds to minimal:

| File | Purpose |
|------|---------|
| `LeftPanel.tsx` | Sidebar with placeholder item list |
| `Inspector.tsx` | Right panel showing selected item |
| `intents.ts` | Empty array with commented example |

Also upgrades `index.ts` (adds panel config, `useSearch`/`useLayoutMode` hooks) and `Provider.tsx` (adds `searchQuery` state).

### Full (12 files)

Everything — terminal drawer, footer, header actions, tools accordion, manifest. Use this for complex editor-style apps.

```bash
bun run packages/create-hudson-app/src/index.ts my-app --tier full
```

Adds to standard:

| File | Purpose |
|------|---------|
| `LeftFooter.tsx` | Footer widget below the sidebar |
| `Terminal.tsx` | Terminal drawer with tab UI |
| `HeaderActions.tsx` | Three-dot menu in left panel header |
| `tools/SampleTool.tsx` | Example tool for the right sidebar accordion |

Also upgrades `index.ts` (adds manifest, tools array, all 7 hooks) and `Provider.tsx` (adds `openSections`, `toggleSection`, `devMode`).

## The generated contract

The core of every scaffolded app is a declarative export in `index.ts`:

```ts
export const myBrowserApp: HudsonApp = {
  id: 'my-browser',
  name: 'My Browser',
  mode: 'panel',

  Provider: MyBrowserProvider,
  slots: { Content, LeftPanel, Inspector },
  hooks: { useCommands, useStatus, useSearch, useLayoutMode },
};
```

Your app never touches shell chrome. The shell reads this declaration and wires everything — sidebar, inspector, status bar, command palette, nav bar.

## After scaffolding

1. Import the generated workspace in `app/page.tsx`:
   ```ts
   import { myBrowserDevWorkspace } from './workspaces/myBrowserDev';
   ```
2. Add it to the workspaces array
3. `bun dev`
4. Open `http://localhost:3500` — your app appears in the workspace switcher

## Where to start editing

1. **`types.ts`** — Define your domain types
2. **`Provider.tsx`** — Add state, callbacks, data fetching to the context
3. **`Content.tsx`** / **`LeftPanel.tsx`** — Build your UI
4. **`hooks.ts`** — Return real commands from `useCommands`, real status from `useStatus`
5. **`intents.ts`** — Declare intents for command palette and LLM indexing

## Template variables

For contributors modifying templates in `packages/create-hudson-app/templates/`:

| Placeholder | Example (`my-browser`) |
|---|---|
| `__APP_NAME__` | `MyBrowser` |
| `__APP_ID__` | `my-browser` |
| `__APP_VAR__` | `myBrowser` |
| `__APP_DISPLAY_NAME__` | `My Browser` |
| `__APP_DESCRIPTION__` | user input |
| `__APP_MODE__` | `panel` or `canvas` |
| `__APP_ICON__` | auto-suggested Lucide icon |

Templates are plain `.tsx.tmpl` / `.ts.tmpl` files with global string replacement — no special syntax, no AST transforms.

## Further reading

- [Quickstart](./quickstart.md) — Get running and create a minimal app
- [Building Apps](./building-apps.md) — Full guide to the Provider + Slots + Hooks architecture
- [API Reference](./api.md) — Complete reference for `@hudson/sdk`
