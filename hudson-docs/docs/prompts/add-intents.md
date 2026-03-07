---
title: Add Intents to a Hudson App
description: Task template for adding intent declarations to an existing app
---

# Task: Add Intents to a Hudson App

## Context

Intents declare structured metadata about app commands for LLM/voice/search integration. Read `packages/hudson-sdk/src/types/intent.ts` for the full type.

## Inputs

- **App ID**: Which app to add intents to
- **Commands**: List of existing commands from `useCommands()`

## Steps

1. **Read existing commands**: Open `app/apps/{app}/hooks.ts`, find `useCommands()` return array. Note each command's `id`, `label`, and `action`.

2. **Create intents file** (`app/apps/{app}/intents.ts`):
   ```typescript
   import type { AppIntent } from '@hudson/sdk';

   export const {app}Intents: AppIntent[] = [
     {
       commandId: '{app}:{action}',  // Must match a CommandOption.id
       title: 'Human-Readable Action',
       description: 'Natural language description for LLM matching',
       category: 'tool',  // tool|edit|file|view|navigation|toggle|workspace|settings
       keywords: ['synonym1', 'synonym2'],
       shortcut: 'Cmd+1',  // Optional
       dangerous: false,    // Optional, true = requires confirmation
     },
   ];
   ```

3. **Add to app definition**: In `app/apps/{app}/index.ts`, import intents and add `intents: {app}Intents` to the HudsonApp object.

4. **Validate**: Every `commandId` in intents must match an `id` in the `useCommands()` return array. Mismatches will show dev-mode warnings.

## Category Guide

| Category | When to use |
|----------|-------------|
| `tool` | Activating a tool (pen, select, eraser) |
| `edit` | Mutating data (delete, duplicate, transform) |
| `file` | I/O (save, export, import, open) |
| `view` | View changes (zoom, pan, fit, toggle grid) |
| `navigation` | Navigation (go to item, switch view) |
| `toggle` | Boolean toggles (snap, rulers, dark mode) |
| `workspace` | Workspace actions (switch, create) |
| `settings` | Preferences (theme, font size) |
