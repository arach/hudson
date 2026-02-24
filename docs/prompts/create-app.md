---
title: Create a New Hudson App
description: Task template for creating a new app in the Hudson platform
---

# Task: Create a New Hudson App

## Context

You are building an app for the Hudson workspace platform. Read `docs/building-apps.md` and `packages/hudson-sdk/src/types/app.ts` before starting.

## Inputs

- **App name**: (e.g., "Glyph Editor")
- **App ID**: (e.g., "glyph-editor")
- **Description**: (e.g., "Vector glyph editor with family overview and detail editing")
- **Frame mode**: `canvas` or `panel`
- **Panels needed**: left, right, both, or none
- **Canvas participation**: `native` or `windowed`

## Steps

1. **Create directory**: `app/apps/{app-id}/`

2. **Create Provider** (`{Name}Provider.tsx`):
   - Define context interface with all app state
   - Create context + `use{Name}()` hook
   - Export Provider component wrapping children with context

3. **Create Content slot** (`{Name}Content.tsx`):
   - Import and use the app context hook
   - Render main UI

4. **Create panel slots** (if needed):
   - `{Name}LeftPanel.tsx` — navigation, tools, project tree
   - `{Name}RightPanel.tsx` — inspector, properties

5. **Create hooks** (`hooks.ts`):
   - `use{Name}Commands()` — return CommandOption[] for palette
   - `use{Name}Status()` — return { label, color }
   - Optional: `use{Name}Search()`, `use{Name}NavCenter()`, `use{Name}LayoutMode()`

6. **Create intents** (`intents.ts`, optional):
   - Declare AppIntent[] with commandId matching CommandOption.id values
   - Include keywords for fuzzy matching

7. **Create app definition** (`index.ts`):
   - Import all pieces
   - Export const satisfying HudsonApp interface

8. **Register in workspace**:
   - Add to `app/workspaces/hudsonOS.ts` or create new workspace file
   - If new workspace, register in `app/page.tsx`

9. **Test**:
   - Run `bun dev`
   - Verify app renders in workspace
   - Test command palette commands (Cmd+K)
   - Test panel toggle
   - Test intent execution if applicable

## Validation Checklist

- [ ] App implements `HudsonApp` interface
- [ ] Provider wraps state correctly
- [ ] `useCommands` returns valid CommandOption[]
- [ ] `useStatus` returns valid { label, color }
- [ ] Intent commandIds match command IDs
- [ ] App registered in workspace
- [ ] No purple colors used
- [ ] No library UI components (custom only)
- [ ] Uses bun, not npm/pnpm
