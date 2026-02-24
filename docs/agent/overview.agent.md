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
| Entry point | `app/page.tsx` → `WorkspaceShell` |

## Architecture (3 layers)

| Layer | Location | Role |
|-------|----------|------|
| @hudson/sdk | `packages/hudson-sdk/src/` | Component library + type contracts |
| Shell | `app/shell/` | Runtime orchestrator (WorkspaceShell) |
| Apps | `app/apps/` | Self-contained apps implementing HudsonApp |

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
| `shaper` | Shaper | windowed |
| `hudson-docs` | Hudson Docs | native |
| `intent-explorer` | Intent Explorer | windowed |

## File structure for new app

```
app/apps/{name}/
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

1. Create app in `app/apps/{name}/`
2. Add to workspace in `app/workspaces/{workspace}.ts`
3. If new workspace, add to `app/page.tsx` workspaces array

## Critical constraints

- Use bun, never npm/pnpm
- Never use purple in designs
- All UI components are custom-built — don't use library components
- Use @base-ui/react for context menu only
- Apps must not manage shell chrome
