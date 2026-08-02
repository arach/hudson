---
title: Overview (Agent)
description: Dense, structured overview of Hudson for AI agent consumption
---

# Hudson — Agent Context

## Identity

| Field | Value |
|-------|-------|
| Name | Hudson |
| Type | Multi-app canvas workspace platform |
| Stack | React 19, Next.js 16, Tailwind v4, TypeScript |
| Package manager | bun |
| Dev server | `bun dev` → port 3500 |
| Entry point | `apps/web/app/app/page.tsx` → `WorkspaceShell` |

## Architecture (3 layers)

| Layer | Location | Role |
|-------|----------|------|
| hudsonkit | `packages/web/hudsonkit/src/` | Component library + type contracts |
| Shell | `packages/web/hudsonkit/src/workspace/shell/` | Package-owned runtime orchestrator (`WorkspaceShell`) |
| Host environment | `apps/web/app/lib/hudsonShellEnvironment.tsx` | Hudson-owned route, terminal, and AI settings bindings passed into the shell |
| Apps | `apps/web/app/apps/` | Self-contained apps implementing HudsonApp |

## HudsonApp Interface (required fields)

```typescript
{
  id: string,           // Unique ID
  name: string,         // Display name
  mode: 'canvas'|'panel',
  Provider: React.FC<{children}>,  // State owner (React context)
  slots: { Content: React.FC },    // Main UI (required)
  hooks: {
    useCommands: () => CommandOption[],    // Palette commands
    useStatus: () => {label, color},      // Status bar
  }
}
```

## Optional HudsonApp fields

| Field | Type | Purpose |
|-------|------|---------|
| `description` | string | Tooltip text |
| `leftPanel` | {title, icon?, headerActions?} | Left panel config |
| `rightPanel` | {title, icon?} | Right panel config |
| `slots.LeftPanel` | React.FC | Left sidebar content |
| `slots.RightPanel` | React.FC | Right sidebar content |
| `slots.LeftFooter` | React.FC | Left panel footer |
| `slots.Terminal` | React.FC | Terminal drawer content |
| `hooks.useSearch` | () => SearchConfig | Nav bar search |
| `hooks.useNavCenter` | () => ReactNode | Nav center content |
| `hooks.useNavActions` | () => ReactNode | Nav right actions |
| `hooks.useLayoutMode` | () => 'canvas'|'panel' | Mode override |
| `intents` | AppIntent[] | LLM/voice declarations |

## StatusColor valid values

`'emerald'` | `'amber'` | `'red'` | `'neutral'`

## IntentCategory valid values

`'tool'` | `'edit'` | `'file'` | `'view'` | `'navigation'` | `'toggle'` | `'workspace'` | `'settings'`

## Canvas participation modes

| Mode | Behavior |
|------|----------|
| `native` | Renders directly on canvas, no window frame |
| `windowed` | Renders inside AppWindow with title bar + drag/resize |

## Existing apps

| ID | Name | Canvas Mode |
|----|------|-------------|
| `hudson-docs` | Hudson Docs | windowed |
| `hudson-ai` | Hudson AI | windowed |
| `intent-explorer` | Intent Explorer | windowed |
| `services` | Services | windowed |
| `terminal` | Terminal | windowed |
| `theme-designer` | Theme Designer | windowed |
| `document-lab` | Document Lab | windowed |
| `code-editor` | Code Editor | windowed |
| `workflow-lab` | Workflow Lab | windowed |
| `stage-design` | Stage Design | windowed |
| `api-inspector` | API Inspector | windowed |
| `trace-viewer` | Trace Viewer | windowed |
| `json-explorer` | JSON Explorer | windowed |
| `hud-logger` | HUD Logger | windowed |

## File structure for new app

```
apps/web/app/apps/{name}/
  index.ts              # HudsonApp export
  {Name}Provider.tsx    # Context provider
  hooks.ts              # useCommands, useStatus, etc.
  intents.ts            # AppIntent[] (optional)
  {Name}Content.tsx     # Content slot
  {Name}LeftPanel.tsx   # LeftPanel slot (optional)
  {Name}RightPanel.tsx  # RightPanel slot (optional)
  {Name}Terminal.tsx     # Terminal slot (optional)
  components/           # Private components
```

## Registration steps

1. Create app in `apps/web/app/apps/{name}/`
2. Add it to `apps/web/app/apps/registry.ts` if it is a tracked HudsonKit showcase app
3. For local-only experiments, use `apps/web/app/local/apps.local.ts` or `apps/web/app/local/workspaces.json`

## Critical constraints

- Use bun, never npm/pnpm
- Never use purple in designs
- All UI components are custom-built — don't use library components
- Use `@base-ui-components/react` for headless behaviors via opt-in subpaths (`hudsonkit/behaviors`, `hudsonkit/context-menu`); Hudson owns visual register
- Apps must not manage shell chrome
