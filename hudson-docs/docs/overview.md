---
title: Overview
description: Introduction to Hudson — a multi-app canvas workspace platform for React
order: 1
---

# Overview

Hudson is a **multi-app canvas workspace platform** built with React 19, Next.js 16, and Tailwind CSS v4. It provides a shared shell where multiple applications coexist — each rendering in draggable, resizable windows on an infinite pan/zoom canvas, or in a static panel layout.

Think of it as a desktop environment in the browser: apps register themselves, the shell provides chrome (navigation bar, side panels, command palette, status bar), and each app just focuses on its own UI and state.

## Minimal Example

A Hudson app is a plain object satisfying the `HudsonApp` interface:

```tsx
import type { HudsonApp } from '@hudson/sdk';

export const counterApp: HudsonApp = {
  id: 'counter',
  name: 'Counter',
  mode: 'panel',
  Provider: ({ children }) => <CounterCtx.Provider value={state}>{children}</CounterCtx.Provider>,
  slots: { Content: () => <div>{count}</div> },
  hooks: {
    useCommands: () => [{ id: 'counter:reset', label: 'Reset', action: () => setCount(0) }],
    useStatus: () => ({ label: 'OK', color: 'emerald' }),
  },
};
```

Register it in a workspace and it immediately gets panels, command palette, status bar, and canvas windowing — all for free. See the [Quickstart](./quickstart.md) for a complete walkthrough.

## Architecture

Hudson has three layers:

### 1. Frame UI (`packages/@hudson/sdk`)

The component library and type system. Provides:

- **Chrome components** — Frame, NavigationBar, SidePanel, StatusBar, CommandDock, ZoomControls
- **Canvas system** — Pan/zoom engine with space-bar gestures
- **Window system** — AppWindow with dragging, resizing, maximize/restore
- **Overlays** — CommandPalette (Cmd+K), TerminalDrawer, HudsonContextMenu
- **Type contracts** — `HudsonApp`, `HudsonWorkspace`, `AppIntent`
- **Utilities** — Web Audio sounds, persistent state, viewport math

### 2. Shell (`app/shell/`)

The runtime orchestrator. `WorkspaceShell` is the main entry point that:

- Nests all app Providers recursively
- Calls each app's hooks inside the correct context scope
- Renders app slots into shell chrome (panels, content area, terminal)
- Manages workspace switching, boot animations, and canvas state
- Provides the command palette, merging commands from all active apps

### 3. Apps (`app/apps/`)

Self-contained applications that implement the `HudsonApp` interface. Each app provides:

- A **Provider** (React context) that owns all app state
- **Slot components** (Content, LeftPanel, RightPanel, Terminal) rendered by the shell
- **Hooks** that bridge app state into shell chrome (commands, status, search, nav)
- Optional **intents** for LLM/voice/search indexing

## Key Concepts

### Workspaces

A workspace is a collection of apps that coexist in a shared shell. Each workspace defines:

- A **mode** (`canvas` or `panel`) — the global layout strategy
- A list of **apps** with canvas participation settings
- A **default focused app**

Hudson supports multiple workspaces. Users switch between them at runtime.

### Frame Modes

Apps can render in two modes:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `canvas` | Infinite pan/zoom world space | Editors, graph UIs, spatial tools |
| `panel` | Static scrollable viewport | Dashboards, admin interfaces, docs |

Individual apps can override the workspace-level mode via the `useLayoutMode` hook.

### Canvas Participation

In canvas-mode workspaces, each app chooses how it appears:

| Participation | Behavior | Example |
|---------------|----------|---------|
| `native` | Renders directly on canvas, no window frame | Hudson Docs |
| `windowed` | Renders inside AppWindow with title bar, dragging, resizing | Shaper, Intent Explorer |

### Intent System

Hudson includes an intent catalog for LLM/voice integration. Apps declare intents — structured metadata about their commands — which are indexed into a searchable catalog. An execution bridge maps intent `commandId` values to live command actions.

## Current Apps

| App | Description | Mode |
|-----|-------------|------|
| **Shaper** | Bezier curve editor for vector shapes | Panel (overrides to canvas) |
| **Hudson Docs** | Documentation browser | Canvas native |
| **Intent Explorer** | Browsable intent catalog inspector | Canvas windowed |

## Next Steps

- [Quickstart](./quickstart.md) — Get Hudson running locally and create your first app
- [Building Apps](./building-apps.md) — Full integration guide (Provider, slots, hooks, intents, workspaces)
- [API Reference](./api.md) — Complete reference for @hudson/sdk exports

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Fonts | SF Rounded (UI), JetBrains Mono (monospace) |
| Package manager | bun |
| Dev server | Port 3500 |
