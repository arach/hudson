---
title: Skills
description: Pre-built skill definitions for AI agents working with Hudson
order: 7
---

# Skills

Pre-built skill definitions that agents can use when working with Hudson.

## hudson-app-creator

**When to use:** When asked to create a new app for the Hudson platform.

**Steps:**
1. Read `packages/frame-ui/src/types/app.ts` to understand the HudsonApp interface
2. Read `app/apps/shaper/index.ts` as the reference implementation
3. Follow the task template in `docs/prompts/create-app.md`
4. Create all required files (Provider, Content, hooks, index.ts)
5. Register in workspace and test with `bun dev`

**Key rules:**
- Every app needs at minimum: id, name, mode, Provider, slots.Content, hooks.useCommands, hooks.useStatus
- Provider must use React context pattern
- Hooks are called inside Provider scope by the shell
- Never use purple, never use library UI components

## hudson-intent-author

**When to use:** When asked to add LLM/voice intents to an existing app.

**Steps:**
1. Read the app's `hooks.ts` to find all command IDs
2. Follow `docs/prompts/add-intents.md` template
3. Create `intents.ts` with AppIntent[] matching each command
4. Add `intents` field to the HudsonApp definition

**Key rules:**
- Every intent `commandId` must match a `CommandOption.id` from `useCommands()`
- Include diverse keywords for fuzzy matching
- Mark destructive actions as `dangerous: true`

## hudson-workspace-builder

**When to use:** When asked to create or modify a workspace.

**Steps:**
1. Read `packages/frame-ui/src/types/workspace.ts` for the HudsonWorkspace interface
2. Read `app/workspaces/hudsonOS.ts` as reference
3. Create workspace file in `app/workspaces/`
4. Register in `app/page.tsx` workspaces array

**Key rules:**
- Each workspace has a mode (canvas or panel)
- Apps specify canvasMode: 'native' or 'windowed'
- Windowed apps need defaultWindowBounds: { x, y, w, h }

## hudson-frame-ui-contributor

**When to use:** When asked to add or modify frame-ui components.

**Steps:**
1. Read `packages/frame-ui/src/index.ts` for current exports
2. Check `packages/frame-ui/src/lib/chrome.ts` for design tokens
3. Follow existing component patterns (stateless, callback-based)
4. Export from `packages/frame-ui/src/index.ts`

**Key rules:**
- Components are stateless — apps manage all state
- Use callback pattern (props in, events out)
- Dark theme only (hardcoded)
- Use Tailwind v4 for styling
- Use lucide-react for icons
